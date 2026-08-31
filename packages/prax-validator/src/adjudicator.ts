import { inflateSync } from "node:zlib";

/**
 * Adversarial evidence adjudication for correction regressions (MEM-001
 * pair-03 finding 3: correction-regression evidence was self-attested).
 *
 * Deterministic screenshot analysis for visual-language corrections:
 * - hue_violation (novel_family): a saturated hue family absent from the
 *   reference (baseline/idle) screenshot reaches element scale (share or
 *   single connected blob) — calibrated so pair-03 arm B's lilac (#b9a8dc)
 *   fails while pair-02 arm B's non-color implementation passes.
 * - hue_violation (rainbow): several non-established families each carry
 *   element-scale blobs in one image (per-type hue coding).
 * - glow_violation (halo): a wide soft luminance band surrounds an
 *   emphasized element (visual signature of large-radius shadows/glows).
 *
 * Known limitation: per-class coding that reuses the app's established
 * accent palette (MEM-001 pair-03 arm A amber chips) is indistinguishable
 * from compliant palette reuse at the pixel level; those cases stay with
 * blinded human review.
 */

export class AdjudicationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AdjudicationError";
  }
}

export interface DecodedImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CHANNELS_BY_COLOR_TYPE: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function decodePng(data: Uint8Array): DecodedImage {
  if (data.length < 8 || !PNG_SIGNATURE.every((byte, index) => data[index] === byte)) {
    throw new AdjudicationError("not a PNG: bad signature");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 0;
  let palette: Uint8Array | undefined;
  const idatChunks: Uint8Array[] = [];
  let sawIend = false;
  while (offset + 8 <= data.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      data[offset + 4]!,
      data[offset + 5]!,
      data[offset + 6]!,
      data[offset + 7]!,
    );
    const bodyStart = offset + 8;
    const bodyEnd = bodyStart + length;
    if (bodyEnd + 4 > data.length) {
      throw new AdjudicationError(`truncated PNG: chunk ${type} exceeds buffer`);
    }
    if (type === "IHDR") {
      if (length < 13) throw new AdjudicationError("truncated PNG: short IHDR");
      width = view.getUint32(bodyStart);
      height = view.getUint32(bodyStart + 4);
      bitDepth = data[bodyStart + 8]!;
      colorType = data[bodyStart + 9]!;
      interlace = data[bodyStart + 12]!;
    } else if (type === "PLTE") {
      palette = data.slice(bodyStart, bodyEnd);
    } else if (type === "IDAT") {
      idatChunks.push(data.slice(bodyStart, bodyEnd));
    } else if (type === "IEND") {
      sawIend = true;
      break;
    }
    offset = bodyEnd + 4;
  }
  if (width === 0 || height === 0) throw new AdjudicationError("truncated PNG: no IHDR");
  if (!sawIend || idatChunks.length === 0) throw new AdjudicationError("truncated PNG: missing IDAT/IEND");
  if (bitDepth !== 8) throw new AdjudicationError(`unsupported PNG bit depth ${bitDepth} (8 expected)`);
  if (interlace !== 0) throw new AdjudicationError("unsupported PNG: interlaced (Adam7)");
  if (CHANNELS_BY_COLOR_TYPE[colorType] === undefined) {
    throw new AdjudicationError(`unsupported PNG color type ${colorType}`);
  }
  if (colorType === 3 && palette === undefined) throw new AdjudicationError("palette PNG without PLTE chunk");
  const channels = CHANNELS_BY_COLOR_TYPE[colorType] as number;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idatChunks.map((chunk) => Buffer.from(chunk))));
  } catch {
    throw new AdjudicationError("corrupt PNG: IDAT does not inflate");
  }
  const stride = width * channels;
  const expected = height * (stride + 1);
  if (raw.length < expected) throw new AdjudicationError("truncated PNG: scanline data short");

  const rgba = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor]!;
    cursor += 1;
    const line = Uint8Array.from(raw.slice(cursor, cursor + stride));
    cursor += stride;
    if (filter === 1) {
      for (let i = channels; i < stride; i += 1) line[i] = (line[i]! + line[i - channels]!) & 0xff;
    } else if (filter === 2) {
      for (let i = 0; i < stride; i += 1) line[i] = (line[i]! + previous[i]!) & 0xff;
    } else if (filter === 3) {
      for (let i = 0; i < stride; i += 1) {
        const left = i >= channels ? line[i - channels]! : 0;
        line[i] = (line[i]! + ((left + previous[i]!) >> 1)) & 0xff;
      }
    } else if (filter === 4) {
      for (let i = 0; i < stride; i += 1) {
        const left = i >= channels ? line[i - channels]! : 0;
        const up = previous[i]!;
        const upLeft = i >= channels ? previous[i - channels]! : 0;
        const pa = Math.abs(up - upLeft);
        const pb = Math.abs(left - upLeft);
        const pc = Math.abs(left + up - 2 * upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        line[i] = (line[i]! + predictor) & 0xff;
      }
    }
    previous = line;
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      if (colorType === 6) {
        rgba[target] = line[source]!;
        rgba[target + 1] = line[source + 1]!;
        rgba[target + 2] = line[source + 2]!;
        rgba[target + 3] = line[source + 3]!;
      } else if (colorType === 2) {
        rgba[target] = line[source]!;
        rgba[target + 1] = line[source + 1]!;
        rgba[target + 2] = line[source + 2]!;
        rgba[target + 3] = 255;
      } else if (colorType === 0 || colorType === 4) {
        rgba[target] = line[source]!;
        rgba[target + 1] = line[source]!;
        rgba[target + 2] = line[source]!;
        rgba[target + 3] = colorType === 4 ? line[source + 1]! : 255;
      } else {
        const index = line[source]! * 3;
        rgba[target] = palette![index]!;
        rgba[target + 1] = palette![index + 1]!;
        rgba[target + 2] = palette![index + 2]!;
        rgba[target + 3] = 255;
      }
    }
  }
  return { width, height, rgba };
}

export interface HueFamily {
  id: string;
  label: string;
  lo: number;
  hi: number;
}

export const HUE_FAMILIES: readonly HueFamily[] = [
  { id: "warm_345_60", label: "345-60deg warm (red/amber)", lo: 345, hi: 60 },
  { id: "green_60_150", label: "60-150deg green", lo: 60, hi: 150 },
  { id: "tealcyan_150_210", label: "150-210deg teal/cyan", lo: 150, hi: 210 },
  { id: "bluenavy_210_255", label: "210-255deg blue/navy", lo: 210, hi: 255 },
  { id: "purple_255_315", label: "255-315deg purple", lo: 255, hi: 315 },
  { id: "magenta_315_345", label: "315-345deg magenta", lo: 315, hi: 345 },
];

function hueFamilyOf(hue: number): HueFamily {
  for (const family of HUE_FAMILIES) {
    if (family.lo < family.hi ? hue >= family.lo && hue < family.hi : hue >= family.lo || hue < family.hi) {
      return family;
    }
  }
  return HUE_FAMILIES[0]!;
}

export interface AdjudicationPolicy {
  /** Minimum max-min RGB distance for a pixel to count as colored (0-255). */
  minChromaPx?: number;
  /** Minimum HSV value for a colored pixel (keeps dark ink out of families). */
  minValue?: number;
  /** Family share of total pixels that alone flags a novel family. */
  familyShareThreshold?: number;
  /** Single connected blob size (px) that alone flags a novel family. */
  minBlobPx?: number;
  /** Non-established families with element-scale blobs in one image that flag rainbow coding. */
  rainbowFamilyCount?: number;
  /** Family pixel total in the reference that establishes the family. */
  referenceFamilyPx?: number;
  /** Family blob size in the reference that establishes the family. */
  referenceBlobPx?: number;
  /** Soft-band width (px) around a core element that indicates a halo. */
  glowBandPx?: number;
  /** Upper bound (px) for a plausible halo; wider soft chains are layout shading. */
  glowBandMaxPx?: number;
  /** Halo region size (px) required for a glow violation. */
  glowRegionPx?: number;
  /** Explicit allowed families; replaces reference derivation when present. */
  allowedHueFamilies?: string[];
}

type ResolvedAdjudicationPolicy = Required<Omit<AdjudicationPolicy, "allowedHueFamilies">> & {
  allowedHueFamilies: string[] | undefined;
};

const DEFAULT_POLICY: ResolvedAdjudicationPolicy = {
  minChromaPx: 18,
  minValue: 0.35,
  familyShareThreshold: 0.0002,
  minBlobPx: 40,
  rainbowFamilyCount: 2,
  referenceFamilyPx: 500,
  referenceBlobPx: 20,
  glowBandPx: 10,
  glowBandMaxPx: 80,
  glowRegionPx: 50,
  allowedHueFamilies: undefined,
};

export interface AdjudicationViolation {
  type: "hue_violation" | "glow_violation";
  kind: "novel_family" | "rainbow" | "halo";
  image: string;
  family?: string;
  pixelTotal: number;
  share: number;
  maxBlobPx: number;
  sampleHex: string[];
  confidence: number;
}

export interface AdjudicationFamilyReport {
  family: string;
  pixelTotal: number;
  share: number;
  maxBlobPx: number;
  blobCount: number;
  sampleHex: string[];
}

export interface AdjudicationImageReport {
  name: string;
  width: number;
  height: number;
  coloredPixels: number;
  coloredShare: number;
  families: AdjudicationFamilyReport[];
  glow: { bandPx: number; haloPx: number; decay: number } | null;
}

export interface AdjudicationReport {
  verdict: "pass" | "fail" | "needs_reference";
  violations: AdjudicationViolation[];
  referenceImage?: string;
  images: AdjudicationImageReport[];
  policy: ResolvedAdjudicationPolicy;
}

interface FamilyAccumulator {
  family: string;
  pixelTotal: number;
  maxBlobPx: number;
  blobCount: number;
  sampleHex: string[];
  mask: Uint8Array;
}

interface ImageAnalysis {
  name: string;
  width: number;
  height: number;
  pixelCount: number;
  coloredPixels: number;
  families: FamilyAccumulator[];
  glow: { bandPx: number; haloPx: number; decay: number } | null;
}

function hex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function analyzeImage(name: string, data: Uint8Array, policy: ResolvedAdjudicationPolicy): ImageAnalysis {
  const image = decodePng(data);
  const { width, height, rgba } = image;
  const pixelCount = width * height;
  const luminance = new Uint8Array(pixelCount);
  const coloredMask = new Uint8Array(pixelCount);
  const families = new Map<string, FamilyAccumulator>();
  let coloredPixels = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const alpha = rgba[offset + 3]!;
    const r = rgba[offset]!;
    const g = rgba[offset + 1]!;
    const b = rgba[offset + 2]!;
    luminance[index] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    if (alpha < 16) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    if (chroma < policy.minChromaPx || max / 255 < policy.minValue) continue;
    coloredPixels += 1;
    coloredMask[index] = 1;
    let hue: number;
    if (max === r) hue = 60 * (((g - b) / chroma) % 6);
    else if (max === g) hue = 60 * ((b - r) / chroma + 2);
    else hue = 60 * ((r - g) / chroma + 4);
    if (hue < 0) hue += 360;
    const family = hueFamilyOf(hue);
    let accumulator = families.get(family.id);
    if (accumulator === undefined) {
      accumulator = {
        family: family.id,
        pixelTotal: 0,
        maxBlobPx: 0,
        blobCount: 0,
        sampleHex: [],
        mask: new Uint8Array(pixelCount),
      };
      families.set(family.id, accumulator);
    }
    accumulator.pixelTotal += 1;
    accumulator.mask[index] = 1;
    if (accumulator.sampleHex.length < 4) {
      accumulator.sampleHex.push(`#${hex(r)}${hex(g)}${hex(b)}`);
    }
  }

  const stack = new Int32Array(pixelCount);
  for (const accumulator of families.values()) {
    const { mask } = accumulator;
    for (let index = 0; index < pixelCount; index += 1) {
      if (mask[index] !== 1) continue;
      accumulator.blobCount += 1;
      let depth = 0;
      stack[depth++] = index;
      mask[index] = 2;
      let size = 0;
      while (depth > 0) {
        const current = stack[--depth] as number;
        size += 1;
        const x = current % width;
        const neighbors = [
          x > 0 ? current - 1 : -1,
          x < width - 1 ? current + 1 : -1,
          current - width,
          current + width,
        ];
        for (const neighbor of neighbors) {
          if (neighbor >= 0 && neighbor < pixelCount && mask[neighbor] === 1) {
            mask[neighbor] = 2;
            stack[depth++] = neighbor;
          }
        }
      }
      if (size > accumulator.maxBlobPx) accumulator.maxBlobPx = size;
    }
  }

  const glow = analyzeGlow(luminance, coloredMask, width, height, policy);
  return { name, width, height, pixelCount, coloredPixels, families: [...families.values()], glow };
}

function analyzeGlow(
  luminance: Uint8Array,
  coloredMask: Uint8Array,
  width: number,
  height: number,
  policy: ResolvedAdjudicationPolicy,
): { bandPx: number; haloPx: number; decay: number } | null {
  const pixelCount = width * height;
  const samples: number[] = [];
  for (let index = 0; index < pixelCount; index += 7) samples.push(luminance[index] ?? 0);
  samples.sort((a, b) => a - b);
  const background = samples[Math.floor(samples.length / 2)] ?? 0;

  const core = new Uint8Array(pixelCount);
  const soft = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const delta = Math.abs((luminance[index] ?? 0) - background);
    if (delta >= 60 || coloredMask[index] === 1) core[index] = 1;
    else if (delta >= 8) soft[index] = 1;
  }

  // Multi-source BFS through the soft band: how far the soft elevation
  // extends from emphasized elements. Antialiasing dies within 1-2 px; a
  // large-radius shadow/glow keeps a continuous band for many pixels.
  const distance = new Int16Array(pixelCount).fill(-1);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (core[index] !== 1 || soft[index] === 1) continue;
    const x = index % width;
    const neighbors = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width];
    for (const neighbor of neighbors) {
      if (neighbor >= 0 && neighbor < pixelCount && soft[neighbor] === 1 && distance[neighbor] === -1) {
        distance[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }
  let maxBand = 0;
  const deltaSum = new Float64Array(pixelCount + 2);
  const deltaCount = new Float64Array(pixelCount + 2);
  while (head < tail) {
    const current = queue[head++] as number;
    const band = distance[current] as number;
    if (band > maxBand) maxBand = band;
    deltaSum[band] = (deltaSum[band] ?? 0) + Math.abs((luminance[current] ?? 0) - background);
    deltaCount[band] = (deltaCount[band] ?? 0) + 1;
    const x = current % width;
    const neighbors = [x > 0 ? current - 1 : -1, x < width - 1 ? current + 1 : -1, current - width, current + width];
    for (const neighbor of neighbors) {
      if (neighbor >= 0 && neighbor < pixelCount && soft[neighbor] === 1 && distance[neighbor] === -1) {
        distance[neighbor] = band + 1;
        queue[tail++] = neighbor;
      }
    }
  }
  let haloPx = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if ((distance[index] ?? -1) >= policy.glowBandPx) haloPx += 1;
  }
  // Radial-decay check: a glow/halo decays with distance from the element;
  // a flat differently-shaded panel keeps a constant offset regardless of
  // distance and is not a halo. This is what keeps multi-tone app layouts
  // (sidebars, inspectors within +-60 of the median) out of the violation.
  const meanOver = (from: number, to: number): number => {
    let sum = 0;
    let count = 0;
    for (let d = from; d <= to; d += 1) {
      sum += deltaSum[d] ?? 0;
      count += deltaCount[d] ?? 0;
    }
    return count === 0 ? 0 : sum / count;
  };
  const decay = maxBand >= policy.glowBandPx
    ? meanOver(1, Math.min(3, maxBand)) - meanOver(Math.max(1, policy.glowBandPx - 2), policy.glowBandPx)
    : 0;
  return { bandPx: maxBand, haloPx, decay };
}

function toImageReport(analysis: ImageAnalysis): AdjudicationImageReport {
  return {
    name: analysis.name,
    width: analysis.width,
    height: analysis.height,
    coloredPixels: analysis.coloredPixels,
    coloredShare: analysis.coloredPixels / analysis.pixelCount,
    families: analysis.families.map((accumulator) => ({
      family: accumulator.family,
      pixelTotal: accumulator.pixelTotal,
      share: accumulator.pixelTotal / analysis.pixelCount,
      maxBlobPx: accumulator.maxBlobPx,
      blobCount: accumulator.blobCount,
      sampleHex: accumulator.sampleHex,
    })),
    glow: analysis.glow,
  };
}

export function adjudicateScreenshots(
  images: Array<{ name: string; data: Uint8Array }>,
  policy?: AdjudicationPolicy,
): AdjudicationReport {
  const resolved: ResolvedAdjudicationPolicy = { ...DEFAULT_POLICY, ...policy };
  const analyses = images.map((image) => analyzeImage(image.name, image.data, resolved));

  if (resolved.allowedHueFamilies === undefined && analyses.length < 2) {
    return {
      verdict: "needs_reference",
      violations: [],
      images: analyses.map(toImageReport),
      policy: resolved,
    };
  }

  let reference: ImageAnalysis | undefined;
  if (analyses.length > 0) {
    reference = analyses.reduce((quietest, candidate) =>
      candidate.coloredPixels < quietest.coloredPixels ? candidate : quietest,
    );
  }
  const established =
    resolved.allowedHueFamilies !== undefined
      ? new Set(resolved.allowedHueFamilies)
      : new Set(
          (reference?.families ?? [])
            .filter(
              (family) =>
                family.pixelTotal >= resolved.referenceFamilyPx || family.maxBlobPx >= resolved.referenceBlobPx,
            )
            .map((family) => family.family),
        );

  const violations: AdjudicationViolation[] = [];
  for (const analysis of analyses) {
    const novelElementFamilies: string[] = [];
    for (const family of analysis.families) {
      if (established.has(family.family)) continue;
      const share = family.pixelTotal / analysis.pixelCount;
      const byShare = family.pixelTotal >= resolved.familyShareThreshold * analysis.pixelCount;
      const byBlob = family.maxBlobPx >= resolved.minBlobPx;
      if (byShare || byBlob) {
        const strength = Math.max(family.maxBlobPx / resolved.minBlobPx, share / resolved.familyShareThreshold);
        violations.push({
          type: "hue_violation",
          kind: "novel_family",
          image: analysis.name,
          family: family.family,
          pixelTotal: family.pixelTotal,
          share,
          maxBlobPx: family.maxBlobPx,
          sampleHex: family.sampleHex,
          confidence: Math.min(1, strength / 4),
        });
      }
      if (byBlob) novelElementFamilies.push(family.family);
    }
    if (novelElementFamilies.length >= resolved.rainbowFamilyCount) {
      const novelFamilies = analysis.families.filter((family) => novelElementFamilies.includes(family.family));
      violations.push({
        type: "hue_violation",
        kind: "rainbow",
        image: analysis.name,
        family: novelElementFamilies.join("+"),
        pixelTotal: novelFamilies.reduce((total, family) => total + family.pixelTotal, 0),
        share: novelFamilies.reduce((total, family) => total + family.pixelTotal, 0) / analysis.pixelCount,
        maxBlobPx: Math.max(...novelFamilies.map((family) => family.maxBlobPx)),
        sampleHex: novelFamilies.flatMap((family) => family.sampleHex.slice(0, 2)),
        confidence: Math.min(1, novelElementFamilies.length / (2 * resolved.rainbowFamilyCount)),
      });
    }
    if (
      analysis.glow !== null &&
      analysis.glow.bandPx >= resolved.glowBandPx &&
      analysis.glow.bandPx <= resolved.glowBandMaxPx &&
      analysis.glow.haloPx >= resolved.glowRegionPx &&
      analysis.glow.decay >= 6
    ) {
      violations.push({
        type: "glow_violation",
        kind: "halo",
        image: analysis.name,
        pixelTotal: analysis.glow.haloPx,
        share: analysis.glow.haloPx / analysis.pixelCount,
        maxBlobPx: analysis.glow.bandPx,
        sampleHex: [],
        confidence: Math.min(1, analysis.glow.bandPx / (3 * resolved.glowBandPx)),
      });
    }
  }

  return {
    verdict: violations.length > 0 ? "fail" : "pass",
    violations,
    ...(resolved.allowedHueFamilies === undefined && reference !== undefined ? { referenceImage: reference.name } : {}),
    images: analyses.map(toImageReport),
    policy: resolved,
  };
}
