/**
 * Which platform a game was played on (device sync, issue #276): recorded on a save (`SaveMeta.lastPlayedOn`) so a
 * game list that mixes saves from several linked devices can say where each was last played.
 *
 * A pure function over `detectPlatform()`'s shell and the user agent. A phone browser is still "web": the shell, not
 * the hardware, is what the player runs. The engine worker cannot see the Tauri/Capacitor globals, so the main thread
 * names the platform in the worker's `name` (`engineWorkerName`) and the worker reads it back.
 */
import type { Platform } from "./platform.js";

export type PlayPlatform = "web" | "windows" | "macos" | "linux" | "android" | "ios";

export const PLAY_PLATFORMS: readonly PlayPlatform[] = ["web", "windows", "macos", "linux", "android", "ios"];

export const isPlayPlatform = (value: unknown): value is PlayPlatform =>
  typeof value === "string" && (PLAY_PLATFORMS as readonly string[]).includes(value);

/**
 * `shell` is `detectPlatform()`; `osHint` is `navigator.userAgentData?.platform` when there is one, and the user agent
 * covers the rest. Null when a native desktop shell's OS can't be told (nothing is recorded rather than a guess).
 */
export function playPlatformOf(shell: Platform, userAgent: string, osHint = ""): PlayPlatform | null {
  if (shell === "web") return "web";
  if (shell === "capacitor") return /android/i.test(userAgent) || /android/i.test(osHint) ? "android" : "ios";
  const text = `${osHint} ${userAgent}`;
  if (/android/i.test(text)) return "android";
  if (/iphone|ipad|ipod/i.test(text)) return "ios";
  if (/^win/i.test(osHint) || (osHint === "" && /windows/i.test(userAgent))) return "windows";
  if (/mac/i.test(osHint) || (osHint === "" && /macintosh|mac os x/i.test(userAgent))) return "macos";
  if (/linux|x11|cros/i.test(text)) return "linux";
  return null;
}

const WORKER_NAME = "mc-engine";

/** The engine worker's `name`: "mc-engine", with ":<platform>" when this device's platform is known. */
export const engineWorkerName = (platform: PlayPlatform | null): string =>
  platform === null ? WORKER_NAME : `${WORKER_NAME}:${platform}`;

/** The platform a worker was named for (`engineWorkerName`), or null for any other name. */
export function playPlatformOfWorkerName(name: string): PlayPlatform | null {
  const [base, platform] = name.split(":");
  return base === WORKER_NAME && isPlayPlatform(platform) ? platform : null;
}

interface NavigatorHints {
  readonly userAgent?: string;
  readonly userAgentData?: { readonly platform?: string };
}

/** This device's platform, read where the shell globals are visible (the main thread). */
export function currentPlayPlatform(
  shell: Platform,
  nav: NavigatorHints | undefined = globalThis.navigator as NavigatorHints | undefined,
): PlayPlatform | null {
  return playPlatformOf(shell, nav?.userAgent ?? "", nav?.userAgentData?.platform ?? "");
}
