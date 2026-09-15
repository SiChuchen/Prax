import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { verifyEvidenceFile } from "prax-runtime";
import { captureContracts, captureImplementation, CONTRACT_FILES, type ExpectedMeasurementTarget } from "./measurement-binding.js";
import {
  ARTIFACT_CHECK_IDS,
  ARTIFACT_CHECK_DEFAULT_SEVERITY,
  CHECK_MEASUREMENT_MAP,
  MeasurementReceiptSchema,
  type ArtifactCheckId,
  type MeasurementReceipt,
  type MeasurementBindingStatus,
  type ValidationEvidence,
} from "./contracts.js";

export interface ArtifactEvidenceInput {
  sessionDirectory: string;
  evidence: ValidationEvidence;
  expectedTarget?: ExpectedMeasurementTarget;
}

export interface ArtifactEvidenceResult {
  status: "PASS" | "REVIEW" | "EXPAND" | "BLOCK";
  codes: string[];
  issues: string[];
  warnings: string[];
  /** check ids whose mapped measurement coverage failed (merge into evaluation missing_evidence) */
  missingEvidence: string[];
  /** receipt-backed → "measured"; everything else stays "attested" (spec §5.4) */
  provenanceByCheck: Map<string, "measured" | "attested">;
  /** valid, covering receipts seen (readiness receipt_ref uses the first) */
  receiptRefs: string[];
  /** open error-severity receipt failures (spec §5.7 R2) */
  errorFailuresOpen: number;
  /** catalog ids skipped in valid receipts (readiness claims.skipped) */
  skippedArtifactIds: string[];
  /** false when any receipt went stale (spec §5.7 R3) */
  evidenceCurrent: boolean;
  bindingByReceipt: Record<string, MeasurementBindingStatus>;
}

const RECEIPT_PREFIX = "validation-evidence/";

interface LoadedReceipt {
  ref: string;
  receipt: MeasurementReceipt | undefined;
  covering: boolean; // false when stale (spec §5.7 R3) or invalid
}

function invertMap(): Map<ArtifactCheckId, string[]> {
  const inverted = new Map<ArtifactCheckId, string[]>();
  for (const [checkId, artifactIds] of Object.entries(CHECK_MEASUREMENT_MAP)) {
    for (const artifactId of artifactIds) {
      const owners = inverted.get(artifactId) ?? [];
      owners.push(checkId);
      inverted.set(artifactId, owners);
    }
  }
  return inverted;
}

async function artifactMtime(sessionDirectory: string, fileName: string): Promise<Date | undefined> {
  try {
    const stats = await stat(join(sessionDirectory, fileName));
    return stats.mtime;
  } catch {
    return undefined;
  }
}

/**
 * Receipt verification and cross-check (spec §5.4). For every evidence item:
 * declared receipts are file-verified (containment under
 * validation-evidence/), schema-parsed, digest-bound (sha256 recomputed from
 * disk — declared values are never trusted), staleness-checked against the
 * gated artifacts (§5.7 R3), and cross-checked against claimed outcomes. A
 * receipt `fail` contradicting a claimed `pass` BLOCKs; mapped checks passing
 * without receipt coverage EXPAND; skipped-with-reason satisfies coverage
 * honestly but stays `attested`.
 */
export async function verifyArtifactEvidence(input: ArtifactEvidenceInput): Promise<ArtifactEvidenceResult> {
  const codes: string[] = [];
  const issues: string[] = [];
  const warnings: string[] = [];
  const missingEvidence: string[] = [];
  const provenanceByCheck = new Map<string, "measured" | "attested">();
  const bindingByReceipt: Record<string, MeasurementBindingStatus> = {};
  let evidenceCurrent = true;

  const addIssue = (code: string, issue: string) => {
    if (!codes.includes(code)) codes.push(code);
    issues.push(`${code}: ${issue}`);
  };

  const sdirMtime = await artifactMtime(input.sessionDirectory, "screen.sdir.yaml");
  const briefMtime = await artifactMtime(input.sessionDirectory, "implementation-brief.yaml");
  const newestArtifact = [sdirMtime, briefMtime].reduce<Date | undefined>(
    (newest, current) => (current !== undefined && (newest === undefined || current > newest) ? current : newest),
    undefined,
  );

  // ── load and verify every declared receipt ──
  const loaded = new Map<string, LoadedReceipt>();
  for (const item of input.evidence.items) {
    if (item.measurement_receipt === undefined) continue;
    const ref = item.measurement_receipt;
    if (loaded.has(ref)) continue;

    const verified = await verifyEvidenceFile(input.sessionDirectory, ref, RECEIPT_PREFIX);
    if (!verified.ok) {
      addIssue("EVIDENCE_FILE_INVALID", verified.error);
      loaded.set(ref, { ref, receipt: undefined, covering: false });
      bindingByReceipt[ref] = "invalid";
      evidenceCurrent = false;
      continue;
    }
    let parsed: MeasurementReceipt | undefined;
    try {
      parsed = MeasurementReceiptSchema.parse(JSON.parse(await readFile(join(input.sessionDirectory, ref), "utf8")));
    } catch (error) {
      addIssue("MEASUREMENT_RECEIPT_INVALID", `${ref} does not parse as a measurement receipt: ${error instanceof Error ? error.message : String(error)}`);
      loaded.set(ref, { ref, receipt: undefined, covering: false });
      bindingByReceipt[ref] = "invalid";
      evidenceCurrent = false;
      continue;
    }

    let covering = true;
    bindingByReceipt[ref] = parsed.receipt_version === "0.1" ? "legacy_unbound" : "unverified_target";
    if (parsed.receipt_version === "0.1" && input.expectedTarget !== undefined) {
      addIssue("MEASUREMENT_BINDING_REQUIRED", `receipt ${ref} predates implementation binding but this session has a prepared measurement target`);
      covering = false;
    }
    // digest binding: recompute every declared evidence hash from disk
    for (const check of parsed.checks) {
      for (const evidenceRef of check.evidence_refs) {
        const evidenceVerified = await verifyEvidenceFile(input.sessionDirectory, evidenceRef.ref, RECEIPT_PREFIX);
        if (!evidenceVerified.ok) {
          addIssue("EVIDENCE_FILE_INVALID", `receipt ${ref} declares unreadable evidence: ${evidenceVerified.error}`);
          covering = false;
          continue;
        }
        if (evidenceVerified.sha256 !== evidenceRef.sha256) {
          addIssue("EVIDENCE_DIGEST_MISMATCH", `receipt ${ref} declares sha256 ${evidenceRef.sha256.slice(0, 12)}… for ${evidenceRef.ref} but the file hashes to ${evidenceVerified.sha256.slice(0, 12)}…`);
          covering = false;
        }
      }
    }

    // staleness (§5.7 R3): a receipt older than the newest gated artifact
    // does not count as coverage — human edits invalidate prior measurement
    if (parsed.receipt_version === "0.1" && newestArtifact !== undefined && new Date(parsed.run_at) < newestArtifact) {
      addIssue("MEASUREMENT_RECEIPT_STALE", `receipt ${ref} ran at ${parsed.run_at}, before the newest gated artifact change (${newestArtifact.toISOString()}) — measurement is stale and does not cover`);
      covering = false;
    }
    if (parsed.receipt_version === "0.2") {
      if (parsed.checks.some((check) => check.status === "skipped" && ARTIFACT_CHECK_DEFAULT_SEVERITY[check.id] === "error")) {
        addIssue("MEASUREMENT_INCOMPLETE", `receipt ${ref} did not complete every error-tier measurement; self-attestation cannot close the missing measurement`);
      }
      if (parsed.target_validation.status === "invalid") {
        addIssue("MEASUREMENT_TARGET_INVALID", `receipt ${ref} has an invalid target: ${parsed.target_validation.issues.join("; ")}`);
        covering = false;
      }
      if (input.expectedTarget === undefined) {
        addIssue("MEASUREMENT_TARGET_UNVERIFIED", `receipt ${ref} has no independently prepared target; its declared root is not read or verified`);
        evidenceCurrent = false;
      } else {
        try {
          const expected = input.expectedTarget;
          const implementation = await captureImplementation(expected.appRoot);
          const binding = parsed.binding;
          if (binding.implementation.root !== implementation.root || parsed.target.app_root !== implementation.root
            || binding.entry !== expected.entry || binding.scenario !== expected.scenario || binding.session_id !== expected.sessionId) {
            throw new Error("receipt root, entry, scenario or session does not match the prepared target");
          }
          if (binding.implementation.digest !== implementation.digest) throw new Error("implementation content changed since measurement");
          const contracts = await captureContracts(input.sessionDirectory);
          if (CONTRACT_FILES.some((name) => binding.contract_digests[name] !== contracts[name])) throw new Error("design contract content changed since measurement");
          bindingByReceipt[ref] = binding.implementation.kind === "static_tree" ? "implementation_current" : "association_current";
        } catch (error) {
          addIssue("MEASUREMENT_BINDING_INVALID", `receipt ${ref}: ${error instanceof Error ? error.message : String(error)}`);
          covering = false;
        }
      }
    }
    if (!covering) {
      bindingByReceipt[ref] = "invalid";
      evidenceCurrent = false;
    }

    // skipped spread: >50% of the catalog skipped demands human environment confirmation
    const skippedCount = parsed.checks.filter((check) => check.status === "skipped").length;
    if (skippedCount / ARTIFACT_CHECK_IDS.length > 0.5) {
      warnings.push(`measurement environment suspect: ${skippedCount}/${ARTIFACT_CHECK_IDS.length} catalog checks skipped in ${ref} — confirm the measurement environment with a human before trusting this receipt`);
    }

    loaded.set(ref, { ref, receipt: parsed, covering });
  }

  // ── contradiction cross-check (receipt fail vs claimed pass) ──
  const inverted = invertMap();
  for (const entry of loaded.values()) {
    if (entry.receipt === undefined) continue;
    for (const check of entry.receipt.checks) {
      if (check.status !== "fail") continue;
      for (const ownerId of inverted.get(check.id) ?? []) {
        const claimed = input.evidence.items.find((item) => item.check_id === ownerId && item.outcome === "pass");
        if (claimed !== undefined) {
          addIssue("VALIDATION_MEASUREMENT_CONTRADICTION", `receipt ${entry.ref} measures ${check.id} as fail while check '${ownerId}' claims pass — measured evidence outranks attestation (PRAX-P-043)`);
        }
      }
    }
  }

  // ── coverage enforcement + provenance ──
  for (const item of input.evidence.items) {
    const mapped = CHECK_MEASUREMENT_MAP[item.check_id];
    if (mapped === undefined || mapped.length === 0 || item.outcome !== "pass") continue;

    const receipts = (item.measurement_receipt === undefined ? [] : [item.measurement_receipt])
      .map((ref) => loaded.get(ref))
      .filter((entry): entry is LoadedReceipt => entry !== undefined && entry.covering && entry.receipt !== undefined);

    const statusById = new Map<ArtifactCheckId, "pass" | "fail" | "skipped">();
    for (const entry of receipts) {
      for (const check of entry.receipt!.checks) {
        if (mapped.includes(check.id) && !statusById.has(check.id)) {
          statusById.set(check.id, check.status);
        }
      }
    }

    const uncovered = mapped.filter((artifactId) => !statusById.has(artifactId));
    if (uncovered.length > 0) {
      addIssue("MEASUREMENT_RECEIPT_MISSING", `check '${item.check_id}' claims pass but no valid receipt covers ${uncovered.join(", ")}`);
      if (!missingEvidence.includes(item.check_id)) missingEvidence.push(item.check_id);
      provenanceByCheck.set(item.check_id, "attested");
      continue;
    }

    const skippedIds = mapped.filter((artifactId) => statusById.get(artifactId) === "skipped");
    if (skippedIds.length > 0) {
      provenanceByCheck.set(item.check_id, "attested");
      warnings.push(`check '${item.check_id}' stays attested: measurement unavailable for ${skippedIds.join(", ")} (skipped is not passed) — self-attestation honestly downgraded`);
    } else {
      provenanceByCheck.set(item.check_id, "measured");
    }
  }

  const block = codes.includes("MEASUREMENT_RECEIPT_INVALID")
    || codes.includes("MEASUREMENT_BINDING_REQUIRED")
    || codes.includes("MEASUREMENT_TARGET_INVALID")
    || codes.includes("MEASUREMENT_BINDING_INVALID")
    || codes.includes("EVIDENCE_DIGEST_MISMATCH")
    || codes.includes("VALIDATION_MEASUREMENT_CONTRADICTION");
  const review = codes.includes("MEASUREMENT_TARGET_UNVERIFIED") || codes.includes("MEASUREMENT_INCOMPLETE") || warnings.some((warning) => warning.includes("measurement environment suspect"));
  const status: ArtifactEvidenceResult["status"] = block
    ? "BLOCK"
    : review
      ? "REVIEW"
      : codes.length > 0 || missingEvidence.length > 0
        ? "EXPAND"
        : "PASS";

  const validReceipts = [...loaded.values()].filter((entry) => entry.covering && entry.receipt !== undefined);
  return {
    status,
    codes,
    issues,
    warnings,
    missingEvidence,
    provenanceByCheck,
    receiptRefs: validReceipts.map((entry) => entry.ref),
    errorFailuresOpen: validReceipts.reduce(
      (count, entry) =>
        count + entry.receipt!.checks.filter((check) => check.severity === "error" && check.status === "fail").length,
      0,
    ),
    skippedArtifactIds: [...new Set(validReceipts.flatMap((entry) => entry.receipt!.checks.filter((check) => check.status === "skipped").map((check) => check.id)))],
    evidenceCurrent,
    bindingByReceipt,
  };
}
