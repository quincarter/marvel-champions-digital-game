/**
 * How strong the phone is, and the screen settings recommended for it (Settings > Display > Screen). Pure: the
 * hardware is read elsewhere (`platform/device-hardware.ts`).
 *
 * Three signals, strongest first:
 *  - Android's media performance class (Android 12+, `Build.VERSION.MEDIA_PERFORMANCE_CLASS`): the OS's own rating of
 *    a phone's tier. 33 or more (an Android 13-class phone or newer) is a high-end phone.
 *  - Memory: the real total from the app, or the page's `navigator.deviceMemory` (capped at 8 and rounded down). A
 *    low-RAM device, or under about 3.5 GB, is low; 7.5 GB or more is high.
 *  - The GPU, by the name WebGL reports: a recent Adreno, Mali-G7x/G7xx, Immortalis or Xclipse is fast; an older
 *    Adreno, a Mali-T or Mali-G3x/G5x, or a PowerVR is slow.
 * A slow GPU or too little memory makes a phone low whatever else it says.
 *
 * The recommendation: a high-end phone draws at its own resolution at the screen's full refresh rate; a mid-range
 * phone draws at 2x (720p on a 360-wide phone, still well past 1x) at 60 fps; a low-end phone draws at 1.5x at 60 fps.
 */
import type { FrameRate, RenderScale } from "../settings.js";

/** What the app (or, failing that, the page) can tell about the phone. Every field may be missing. */
export interface HardwareInfo {
  /** Total memory in MB, from the app. */
  readonly ramMb?: number;
  /** The page's `navigator.deviceMemory`, in GB (rounded down, at most 8). Used when `ramMb` is missing. */
  readonly deviceMemoryGb?: number;
  readonly lowRam?: boolean;
  /** Android's media performance class: 0 for none, else the Android version it meets (30, 31, 33, 34...). */
  readonly performanceClass?: number;
  readonly cores?: number;
  /** The WebGL renderer string, such as "Adreno (TM) 740" or "Mali-G57 MC2". */
  readonly gpu?: string;
  /** The maker and model, and the chip (Android 12+), for the debug log and the row's detail. */
  readonly model?: string;
  readonly soc?: string;
}

export type DeviceTier = "high" | "mid" | "low";
export type GpuClass = "fast" | "slow" | "unknown";

/** A GPU by its WebGL renderer name. */
export function gpuClassOf(renderer: string | undefined): GpuClass {
  if (!renderer) return "unknown";
  const adreno = /Adreno \(TM\) (\d{3})/i.exec(renderer);
  if (adreno) {
    // 640 and up (Snapdragon 855 on) is fast; the 61x-63x mid-range parts are left to the memory to decide.
    const model = Number(adreno[1]);
    return model >= 640 ? "fast" : model >= 600 ? "unknown" : "slow";
  }
  if (/Immortalis|Xclipse|Apple/i.test(renderer)) return "fast";
  const maliG = /Mali-G(\d+)/i.exec(renderer);
  if (maliG) {
    // G71-G78 and the three-digit parts (G610, G710, G715, G720) are fast; G31-G52 are budget parts; G57 and G68 sit
    // between, and the memory decides.
    const series = Number(maliG[1]);
    if ((series >= 71 && series <= 99) || series >= 610) return "fast";
    return series < 57 ? "slow" : "unknown";
  }
  if (/Mali-T|PowerVR|SwiftShader|llvmpipe/i.test(renderer)) return "slow";
  return "unknown";
}

/** The phone's memory in GB, as best known. */
export function memoryGbOf(info: HardwareInfo): number | undefined {
  if (info.ramMb !== undefined && info.ramMb > 0) return info.ramMb / 1024;
  return info.deviceMemoryGb !== undefined && info.deviceMemoryGb > 0 ? info.deviceMemoryGb : undefined;
}

export function deviceTierOf(info: HardwareInfo): DeviceTier {
  const memory = memoryGbOf(info);
  const gpu = gpuClassOf(info.gpu);
  if (info.lowRam === true || (memory !== undefined && memory < 3.5) || gpu === "slow") return "low";
  if ((info.performanceClass ?? 0) >= 33) return "high";
  if (memory !== undefined && memory >= 7.5) return "high";
  // `deviceMemory` reports 8 for anything 8 GB or more; a fast GPU with 6 GB is high-end too.
  if (gpu === "fast" && memory !== undefined && memory >= 5.5) return "high";
  return "mid";
}

export interface ScreenRecommendation {
  readonly tier: DeviceTier;
  readonly renderScale: RenderScale;
  readonly frameRate: FrameRate;
}

export function recommendedScreenOf(info: HardwareInfo): ScreenRecommendation {
  const tier = deviceTierOf(info);
  switch (tier) {
    case "high":
      return { tier, renderScale: "native", frameRate: "screen" };
    case "mid":
      return { tier, renderScale: "2x", frameRate: "60" };
    case "low":
      return { tier, renderScale: "1.5x", frameRate: "60" };
  }
}

/** "8 GB, Adreno 740": what the recommendation went on, for the Settings row and the debug log. */
export function hardwareSummaryOf(info: HardwareInfo): string {
  const parts: string[] = [];
  const memory = memoryGbOf(info);
  if (memory !== undefined) {
    const rounded = Math.round(memory);
    parts.push(info.ramMb === undefined && rounded >= 8 ? "8+ GB" : `${rounded} GB`);
  }
  if (info.gpu) parts.push(gpuShortName(info.gpu));
  return parts.join(", ");
}

/**
 * "Adreno 740" from "Adreno (TM) 740", or from the ANGLE wrapper a WebView may add: "ANGLE (Qualcomm, Adreno (TM) 740,
 * OpenGL ES 3.2)". Driver and API details are dropped.
 */
export function gpuShortName(renderer: string): string {
  const angle = /^ANGLE \([^,]+, (.+?)(?:, [^,()]+)?\)$/.exec(renderer.trim());
  const name = (angle ? angle[1]! : renderer)
    .replace(/\(TM\)/gi, " ")
    .replace(/\(0x[0-9a-f]+\)/gi, " ")
    .replace(/\s(Direct3D|OpenGL|Vulkan|Metal).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return name.length > 32 ? `${name.slice(0, 31)}…` : name;
}

const TIER_LABEL: Readonly<Record<DeviceTier, string>> = { high: "high-end", mid: "mid-range", low: "entry-level" };

export function tierLabelOf(tier: DeviceTier): string {
  return TIER_LABEL[tier];
}
