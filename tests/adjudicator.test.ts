import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { join } from "node:path";
import { expect, it, describe } from "vitest";
import {
  AdjudicationError,
  adjudicateScreenshots,
  decodePng,
  type AdjudicationReport,
} from "prax-validator";

// ---------------------------------------------------------------------------
// Synthetic PNG encoder (test helper): 8-bit, filter 0, color type 2 or 6.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(new Uint8Array(body)));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width: number, height: number, raw: Uint8Array, colorType: 2 | 6 = 6): Uint8Array {
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    scanlines[y * (stride + 1)] = 0; // filter: none
    Buffer.from(raw.buffer, raw.byteOffset + y * stride, stride).copy(scanlines, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0; // no interlace
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", new Uint8Array(deflateSync(scanlines))),
      pngChunk("IEND", new Uint8Array(0)),
    ]),
  );
}

function solidImage(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = rgb[0];
    rgba[i * 4 + 1] = rgb[1];
    rgba[i * 4 + 2] = rgb[2];
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

function fillRect(
  rgba: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  rectWidth: number,
  rectHeight: number,
  rgb: [number, number, number],
): void {
  for (let y = y0; y < y0 + rectHeight; y += 1) {
    for (let x = x0; x < x0 + rectWidth; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];
      rgba[i + 3] = 255;
    }
  }
}

function toImageData(width: number, height: number, rgba: Uint8Array, name: string) {
  return { name, data: encodePng(width, height, rgba) };
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

describe("adjudicator PNG decoding", () => {
  it("decodes a color-type-6 PNG with exact pixel values", () => {
    const rgba = solidImage(4, 3, [0xee, 0xee, 0xee]);
    fillRect(rgba, 4, 1, 1, 2, 1, [0xb9, 0xa8, 0xdc]);
    const image = decodePng(encodePng(4, 3, rgba));
    expect(image.width).toBe(4);
    expect(image.height).toBe(3);
    expect(Array.from(image.rgba.slice(0, 4))).toEqual([0xee, 0xee, 0xee, 255]);
    expect(Array.from(image.rgba.slice((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 3))).toEqual([0xb9, 0xa8, 0xdc]);
  });

  it("decodes a color-type-2 PNG", () => {
    const rgb = new Uint8Array(2 * 2 * 3);
    rgb.set([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
    const image = decodePng(encodePng(2, 2, rgb, 2));
    expect(image.width).toBe(2);
    expect(Array.from(image.rgba.slice(4 * 3, 4 * 3 + 4))).toEqual([100, 110, 120, 255]);
  });

  it("rejects non-PNG data with AdjudicationError", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4]))).toThrow(AdjudicationError);
  });

  it("rejects truncated PNG data with AdjudicationError", () => {
    const rgba = solidImage(4, 4, [1, 2, 3]);
    const whole = encodePng(4, 4, rgba);
    expect(() => decodePng(whole.slice(0, whole.length - 40))).toThrow(AdjudicationError);
  });
});

// ---------------------------------------------------------------------------
// Deterministic hue/glow adjudication on synthetic images
// ---------------------------------------------------------------------------

describe("adjudicator synthetic rules", () => {
  it("flags a novel saturated hue family absent from the reference image", () => {
    const reference = toImageData(200, 200, solidImage(200, 200, [0xee, 0xee, 0xee]), "ref.png");
    const impact = solidImage(200, 200, [0xee, 0xee, 0xee]);
    fillRect(impact, 200, 70, 70, 60, 60, [0xb9, 0xa8, 0xdc]); // lilac
    const report = adjudicateScreenshots([reference, toImageData(200, 200, impact, "impact.png")]);
    expect(report.verdict).toBe("fail");
    const novel = report.violations.filter(
      (violation) => violation.type === "hue_violation" && violation.kind === "novel_family",
    );
    expect(novel.length).toBeGreaterThan(0);
    expect(novel[0].family).toBe("purple_255_315");
    expect(novel[0].sampleHex).toContain("#b9a8dc");
    expect(report.referenceImage).toBe("ref.png");
  });

  it("does not flag a saturated patch below the blob and share thresholds", () => {
    // 600x600 so a 6x6 patch stays below both the 0.02% share and the blob floor.
    const reference = toImageData(600, 600, solidImage(600, 600, [0xf0, 0xf0, 0xf0]), "ref.png");
    const impact = solidImage(600, 600, [0xf0, 0xf0, 0xf0]);
    fillRect(impact, 600, 100, 100, 6, 6, [0xb9, 0xa8, 0xdc]);
    const report = adjudicateScreenshots([reference, toImageData(600, 600, impact, "impact.png")]);
    expect(report.verdict).toBe("pass");
    expect(report.violations).toEqual([]);
  });

  it("flags a patch at the blob threshold (share still below)", () => {
    const reference = toImageData(600, 600, solidImage(600, 600, [0xf0, 0xf0, 0xf0]), "ref.png");
    const impact = solidImage(600, 600, [0xf0, 0xf0, 0xf0]);
    fillRect(impact, 600, 100, 100, 8, 8, [0xb9, 0xa8, 0xdc]); // 64px >= 40px blob floor, share < 0.02%
    const report = adjudicateScreenshots([reference, toImageData(600, 600, impact, "impact.png")]);
    expect(report.verdict).toBe("fail");
    expect(report.violations.some((violation) => violation.kind === "novel_family")).toBe(true);
  });

  it("flags per-type rainbow coding when two novel families carry element-scale blobs", () => {
    const reference = toImageData(300, 300, solidImage(300, 300, [0xf0, 0xf0, 0xf0]), "ref.png");
    const impact = solidImage(300, 300, [0xf0, 0xf0, 0xf0]);
    fillRect(impact, 300, 60, 100, 50, 40, [0xb9, 0xa8, 0xdc]); // purple
    fillRect(impact, 300, 180, 100, 50, 40, [0x4c, 0xaf, 0x50]); // green
    const report = adjudicateScreenshots([reference, toImageData(300, 300, impact, "impact.png")]);
    expect(report.verdict).toBe("fail");
    expect(report.violations.some((violation) => violation.kind === "rainbow")).toBe(true);
  });

  it("allows families explicitly whitelisted by policy even when absent from the reference", () => {
    const reference = toImageData(200, 200, solidImage(200, 200, [0xee, 0xee, 0xee]), "ref.png");
    const impact = solidImage(200, 200, [0xee, 0xee, 0xee]);
    fillRect(impact, 200, 70, 70, 60, 60, [0xb9, 0xa8, 0xdc]);
    const report = adjudicateScreenshots([reference, toImageData(200, 200, impact, "impact.png")], {
      allowedHueFamilies: ["purple_255_315"],
    });
    expect(report.verdict).toBe("pass");
  });

  it("reports needs_reference for a single-image set without an explicit allowlist", () => {
    const impact = solidImage(200, 200, [0xee, 0xee, 0xee]);
    fillRect(impact, 200, 70, 70, 60, 60, [0xb9, 0xa8, 0xdc]);
    const report = adjudicateScreenshots([toImageData(200, 200, impact, "only.png")]);
    expect(report.verdict).toBe("needs_reference");
    expect(report.violations).toEqual([]);
  });

  it("detects a wide soft luminance halo around an emphasized element", () => {
    const width = 200;
    const height = 150;
    const bg = 217; // #d9d9d9
    const bar = { x: 70, y: 60, w: 60, h: 30 };
    const rgba = solidImage(width, height, [bg, bg, bg]);
    fillRect(rgba, width, bar.x, bar.y, bar.w, bar.h, [10, 10, 10]);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = Math.max(bar.x - x, 0, x - (bar.x + bar.w - 1));
        const dy = Math.max(bar.y - y, 0, y - (bar.y + bar.h - 1));
        const distance = Math.max(dx, dy);
        if (distance === 0 || distance > 25) continue;
        const lift = Math.round(45 * (1 - distance / 26));
        const value = Math.min(255, bg + lift);
        const i = (y * width + x) * 4;
        rgba[i] = value;
        rgba[i + 1] = value;
        rgba[i + 2] = value;
      }
    }
    const report = adjudicateScreenshots([toImageData(width, height, rgba, "halo.png")], {
      allowedHueFamilies: [],
    });
    expect(report.verdict).toBe("fail");
    const glow = report.violations.filter((violation) => violation.type === "glow_violation");
    expect(glow.length).toBeGreaterThan(0);
    expect(glow[0].kind).toBe("halo");
  });

  it("does not report a glow for the same element with hard edges", () => {
    const width = 200;
    const height = 150;
    const bg = 217;
    const rgba = solidImage(width, height, [bg, bg, bg]);
    fillRect(rgba, width, 70, 60, 60, 30, [10, 10, 10]);
    const report = adjudicateScreenshots([toImageData(width, height, rgba, "sharp.png")], {
      allowedHueFamilies: [],
    });
    expect(report.verdict).toBe("pass");
    expect(report.violations.filter((violation) => violation.type === "glow_violation")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MEM-001 pair-03/02 canaries (real evidence screenshots). These PNGs live in
// the repository under benchmark-runs/PRAX-MEM-001/pairs/.
// ---------------------------------------------------------------------------

const CANARY_ROOT = join("benchmark-runs", "PRAX-MEM-001", "pairs");

async function canary(relativePath: string) {
  const data = await readFile(join(process.cwd(), CANARY_ROOT, relativePath));
  return { name: relativePath.split("/").pop()!, data: new Uint8Array(data) };
}

async function canaries(...relativePaths: string[]) {
  return Promise.all(relativePaths.map(canary));
}

describe("adjudicator MEM-001 canaries", () => {
  it("pair-03 arm B (prax): lilac hue coding fails adjudication", async () => {
    const report = adjudicateScreenshots(
      await canaries(
        "pair-03/task2-arm-b-prax/evidence/screenshots/01-small-browse-baseline.png",
        "pair-03/task2-arm-b-prax/evidence/screenshots/02-small-ctrl-click-aggregate.png",
        "pair-03/task2-arm-b-prax/evidence/screenshots/05-small-shift-marquee-aggregate.png",
        "pair-03/task2-arm-b-prax/evidence/screenshots/08-medium-marquee-shared-impact.png",
      ),
    );
    expect(report.verdict).toBe("fail");
    const purple = report.violations.filter(
      (violation) => violation.type === "hue_violation" && violation.family === "purple_255_315",
    );
    expect(purple.length).toBeGreaterThan(0);
    expect(purple.some((violation) => violation.image.startsWith("05-"))).toBe(true);
    expect(purple.every((violation) => violation.pixelTotal >= 100)).toBe(true);
    // No glow false positives on real app screenshots.
    expect(report.violations.filter((violation) => violation.type === "glow_violation")).toEqual([]);
  });

  it("pair-03 arm B medium fixture (07) also fails via the lilac family", async () => {
    const report = adjudicateScreenshots(
      await canaries(
        "pair-03/task2-arm-b-prax/evidence/screenshots/01-small-browse-baseline.png",
        "pair-03/task2-arm-b-prax/evidence/screenshots/07-medium-ctrl-click-aggregate.png",
      ),
    );
    expect(report.verdict).toBe("fail");
    expect(
      report.violations.some(
        (violation) => violation.type === "hue_violation" && violation.family === "purple_255_315",
      ),
    ).toBe(true);
  });

  it("pair-02 arm B (prax, non-color implementation) passes", async () => {
    const report: AdjudicationReport = adjudicateScreenshots(
      await canaries(
        "pair-02/task2-arm-b-prax/evidence/screenshots/01-small-browse.png",
        "pair-02/task2-arm-b-prax/evidence/screenshots/02-small-single-impact.png",
        "pair-02/task2-arm-b-prax/evidence/screenshots/03-small-multi-shared-impact.png",
        "pair-02/task2-arm-b-prax/evidence/screenshots/05-medium-marquee-shared-impact.png",
        "pair-02/task2-arm-b-prax/evidence/screenshots/08-registry-multi-shared-impact.png",
      ),
    );
    expect(report.verdict).toBe("pass");
    expect(report.violations).toEqual([]);
  });

  // KNOWN LIMITATION (MEM-001 pair-03): arm A coded the shared-impact class
  // with amber chips/borders drawn from the app's established accent palette.
  // A deterministic palette analyzer cannot separate that from compliant reuse
  // of the same palette (pair-02 B amber shares are LARGER than A's), so the
  // adjudicator passes these and the blinded human review stays the backstop.
  // Recorded in benchmark-runs/PRAX-MEM-001/review/findings.md.
  it("pair-03 arm A (bare, established-palette amber) passes with the recorded limitation", async () => {
    const report = adjudicateScreenshots(
      await canaries(
        "pair-03/task2-arm-a-bare/evidence/screenshots/multi-select-01-small-idle.png",
        "pair-03/task2-arm-a-bare/evidence/screenshots/multi-select-03-small-union-shared.png",
        "pair-03/task2-arm-a-bare/evidence/screenshots/multi-select-08-small-back-to-idle.png",
        "pair-03/task2-arm-a-bare/evidence/screenshots/multi-select-09-medium-union-shared.png",
      ),
    );
    expect(report.verdict).toBe("pass");
    expect(report.violations).toEqual([]);
    // The warm family presence is still inventoried in the channel report so
    // downstream scoring can see it.
    const union = report.images.find((image) => image.name === "multi-select-03-small-union-shared.png");
    expect(union?.families.some((family) => family.family === "warm_345_60" && family.pixelTotal > 10000)).toBe(true);
  });
});
