import { zodIssues } from "prax-runtime";
import { SdirDeltaSchema, type SdirDeltaValidation, type SdirIssue } from "./contracts.js";
import { renderLeakIssues } from "./engine.js";

export function validateSdirDelta(input: unknown): SdirDeltaValidation {
  const parsed = SdirDeltaSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "RETRY", schema_errors: zodIssues(parsed.error), semantic_errors: [], semantic_issues: [] };
  }
  const delta = parsed.data;
  const issues: SdirIssue[] = [];
  const declared = new Set(delta.base_regions.map((region) => region.id));
  const added = new Set<string>();

  delta.changes.forEach((change, index) => {
    if (change.action === "add") {
      if (declared.has(change.region) || added.has(change.region)) {
        issues.push({
          code: "SDIR_REGION_ID_DUPLICATE",
          message: `changes[${index}] adds '${change.region}' which already exists or was already added.`,
        });
      } else {
        added.add(change.region);
      }
      if (change.role === undefined) {
        issues.push({
          code: "SDIR_REGION_ROLE_MISSING",
          message: `changes[${index}] adds '${change.region}' without a role.`,
        });
      }
    } else if (!declared.has(change.region)) {
      issues.push({
        code: "SDIR_RELATION_REGION_NOT_FOUND",
        message: `changes[${index}].region '${change.region}' is not a declared base region; only add actions may introduce new regions.`,
      });
    }
    for (const message of renderLeakIssues(change.fields, `changes[${index}].fields`)) {
      issues.push({ code: "SDIR_RENDER_LEVEL_LEAK", message });
    }
  });

  for (const surface of delta.preserved) {
    if (!declared.has(surface) && !added.has(surface)) {
      issues.push({
        code: "SDIR_RELATION_REGION_NOT_FOUND",
        message: `preserved entry '${surface}' does not reference a declared or added region.`,
      });
    }
  }

  if (issues.length > 0) {
    return { status: "RETRY", schema_errors: [], semantic_errors: issues.map((issue) => issue.message), semantic_issues: issues };
  }
  return { status: "PASS", schema_errors: [], semantic_errors: [], semantic_issues: [], value: delta };
}
