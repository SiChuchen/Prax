import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "playwright";
import { ARTIFACT_CHECK_IDS, type ArtifactCheckId, type MeasurementReceipt } from "prax-validator";
import type { CheckOutcome } from "./checks/layout.overflow.js";
import { run as layoutOverflow } from "./checks/layout.overflow.js";
import { run as layoutResponsiveCollision } from "./checks/layout.responsive_collision.js";
import { run as textTruncation } from "./checks/text.truncation.js";
import { run as a11yContrast } from "./checks/a11y.contrast.js";
import { run as a11yFocusOrder } from "./checks/a11y.focus_order.js";
import { run as a11yTargetSize } from "./checks/a11y.target_size.js";
import { run as typeMinProjectedSize } from "./checks/type.min_projected_size.js";
import { writeReceiptAtomically } from "./receipt.js";

export interface RunnerViewport {
  width: number;
  height: number;
  label?: string | undefined;
}

export interface RunMeasurementOptions {
  appDir: string; // app root; dist/ presence selects vite preview, otherwise a static server
  outDir: string; // session/output directory; evidence lands under validation-evidence/
  viewports: RunnerViewport[];
  entry?: string | undefined; // URL path of the measured page; default "/"
  serve?: string | undefined; // reuse an already-running base URL instead of spawning a server
  buildRef?: string | null | undefined;
}

type CheckModule = { id: ArtifactCheckId; run: (page: import("playwright").Page, ctx: { viewport: RunnerViewport; screenshotDir: string }) => Promise<CheckOutcome> };

const CHECKS: CheckModule[] = [
  { id: "layout.overflow", run: layoutOverflow },
  { id: "layout.responsive_collision", run: layoutResponsiveCollision },
  { id: "text.truncation", run: textTruncation },
  { id: "a11y.contrast", run: a11yContrast },
  { id: "a11y.focus_order", run: a11yFocusOrder },
  { id: "a11y.target_size", run: a11yTargetSize },
  { id: "type.min_projected_size", run: typeMinProjectedSize },
];

const TOOL_VERSION = "0.1.0";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

interface RunningServer {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startStaticServer(root: string): Promise<RunningServer> {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      let pathName = decodeURIComponent(url.pathname);
      if (pathName.endsWith("/")) pathName = `${pathName}index.html`;
      const target = resolve(root, `.${pathName}`);
      if (!target.startsWith(resolve(root))) {
        response.writeHead(403).end("forbidden");
        return;
      }
      const stats = await stat(target);
      const filePath = stats.isDirectory() ? join(target, "index.html") : target;
      response.writeHead(200, { "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream" });
      response.end(await readFile(filePath));
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())),
  };
}

async function startVitePreview(appDir: string): Promise<RunningServer> {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const viteBin = join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
  const server: ChildProcess = spawn(
    process.execPath,
    [viteBin, "preview", "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    { cwd: appDir, stdio: ["ignore", "pipe", "pipe"] },
  );
  const baseUrl = `http://127.0.0.1:${port}/`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) });
      if (response.ok) break;
    } catch {
      // not up yet
    }
    if (attempt === 39) {
      server.kill();
      throw new Error("vite preview did not come up within 20s");
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolvePromise) => {
        server.once("exit", () => resolvePromise());
        server.kill();
      }),
  };
}

function mergeOutcomes(id: ArtifactCheckId, outcomes: CheckOutcome[]): CheckOutcome {
  const failing = outcomes.find((outcome) => outcome.status === "fail");
  const base = failing ?? outcomes[0]!;
  if (outcomes.length === 1) return base;
  const perViewport = outcomes.map((outcome) => ({
    viewport: (outcome.measured as Record<string, unknown>).viewport ?? null,
    status: outcome.status,
  }));
  const status = failing !== undefined ? "fail" : outcomes.some((o) => o.status === "skipped") ? "skipped" : "pass";
  return {
    ...base,
    id,
    status,
    measured: { ...(base.measured as Record<string, unknown>), per_viewport: perViewport },
    evidence_refs: outcomes.flatMap((outcome) => outcome.evidence_refs ?? []),
  };
}

function skippedOutcome(id: ArtifactCheckId, reason: string): CheckOutcome {
  return {
    id,
    status: "skipped",
    severity: id === "a11y.contrast" || id === "a11y.target_size" ? "error" : "warning",
    subject: `check ${id}`,
    measured: {},
    threshold: {},
    evidence_refs: [],
    supported_fixes: [],
    reason,
  };
}

/**
 * Orchestration (spec §5.1): serve the app (vite preview when a build is
 * present, static server otherwise), then for each viewport × each check run
 * on a fresh page. Evidence sha256 is recomputed by the runner from the files
 * on disk — values declared by checks are never trusted. Environment failures
 * degrade honestly to skipped-with-reason, never guessed fixes.
 */
export async function runMeasurement(options: RunMeasurementOptions): Promise<string> {
  const screenshotDir = join(options.outDir, "validation-evidence");
  const appRoot = isAbsolute(options.appDir)
    ? options.appDir.replace(/\\/g, "/")
    : options.appDir.replace(/\\/g, "/");
  const hasBuild = await stat(join(options.appDir, "dist")).then((stats) => stats.isDirectory()).catch(() => false);
  const entry = options.entry ?? "/";

  let server: RunningServer | undefined;
  let baseUrl: string;
  if (options.serve !== undefined) {
    baseUrl = options.serve;
  } else {
    server = hasBuild ? await startVitePreview(options.appDir) : await startStaticServer(options.appDir);
    baseUrl = server.baseUrl;
  }

  const outcomesByCheck = new Map<ArtifactCheckId, CheckOutcome[]>();
  let environmentFailure: string | undefined;
  try {
    const browser = await chromium.launch();
    try {
      for (const viewport of options.viewports) {
        for (const check of CHECKS) {
          const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
          try {
            await page.goto(new URL(entry, baseUrl).href, { waitUntil: "load" });
            const outcome = await check.run(page, { viewport, screenshotDir });
            const bucket = outcomesByCheck.get(check.id) ?? [];
            bucket.push(outcome);
            outcomesByCheck.set(check.id, bucket);
          } catch (error) {
            const bucket = outcomesByCheck.get(check.id) ?? [];
            bucket.push(
              skippedOutcome(check.id, `check execution failed: ${error instanceof Error ? error.message : String(error)}`),
            );
            outcomesByCheck.set(check.id, bucket);
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    environmentFailure = `browser environment unavailable: ${error instanceof Error ? error.message : String(error)}`;
    for (const id of ARTIFACT_CHECK_IDS) {
      outcomesByCheck.set(id, [skippedOutcome(id, environmentFailure)]);
    }
  } finally {
    await server?.close();
  }

  const checks = ARTIFACT_CHECK_IDS.map((id) => {
    const outcomes = outcomesByCheck.get(id) ?? [skippedOutcome(id, "check did not run")];
    return mergeOutcomes(id, outcomes);
  });

  // the runner recomputes every evidence digest from the bytes on disk
  for (const check of checks) {
    for (const ref of check.evidence_refs ?? []) {
      const filePath = join(options.outDir, ref.ref);
      ref.sha256 = await readFile(filePath)
        .then((bytes) => createHash("sha256").update(bytes).digest("hex"))
        .catch(() => {
          throw new Error(`evidence file declared by check ${check.id} is missing on disk: ${ref.ref}`);
        });
    }
  }

  const receipt: MeasurementReceipt = {
    receipt_version: "0.1",
    tool: { name: "prax-measure", version: TOOL_VERSION },
    target: { app_root: appRoot, base_url: baseUrl, build_ref: options.buildRef ?? null },
    run_at: new Date().toISOString(),
    viewport_matrix: options.viewports.map((viewport) => ({
      width: viewport.width,
      height: viewport.height,
      ...(viewport.label === undefined ? {} : { label: viewport.label }),
    })),
    checks,
    summary: {
      pass: checks.filter((check) => check.status === "pass").length,
      fail: checks.filter((check) => check.status === "fail").length,
      skipped: checks.filter((check) => check.status === "skipped").length,
      warnings: checks.filter((check) => check.severity === "warning" && check.status === "fail").length,
    },
  };

  return writeReceiptAtomically(options.outDir, receipt);
}
