/**
 * The two coarse facts a room shows about each participant's device (issue #880): the platform they run the game on
 * and the form of the screen. Nothing finer is read or sent (no model, OS version, user agent or exact size).
 *
 * Read once on the main thread, where the shell globals and the screen are visible, and handed to the workers that
 * open room sockets (`LiveRoomIn` init, the replay worker's `watch` request).
 */
import type { RoomDevice } from "@mc/sync-worker/room-protocol";
import { detectPlatform, type Platform } from "./platform.js";
import { currentPlayPlatform, type PlayPlatform } from "./play-platform.js";

export type DeviceForm = RoomDevice["form"];

/** A screen whose shorter side is under this many CSS pixels is a phone; wider, held by hand, is a tablet. */
export const PHONE_SHORT_SIDE_MAX = 600;

/** What the screen says: its shorter side (CSS pixels) and whether the main pointer is a finger. */
export interface ScreenFacts {
  readonly shortSide: number;
  readonly coarsePointer: boolean;
}

/**
 * The native desktop shells are always desktops, whatever size their window is. A phone or tablet platform is one or the
 * other by its screen. A browser is a desktop unless its main pointer is a finger, and then by its screen.
 */
export function deviceFormOf(platform: PlayPlatform, screen: ScreenFacts): DeviceForm {
  if (platform === "windows" || platform === "macos" || platform === "linux") return "desktop";
  const handheld = screen.shortSide < PHONE_SHORT_SIDE_MAX ? "phone" : "tablet";
  if (platform === "android" || platform === "ios") return handheld;
  return screen.coarsePointer ? handheld : "desktop";
}

/** The device for a platform and screen, or undefined when the shell's OS cannot be told (nothing is sent then). */
export function roomDeviceOf(platform: PlayPlatform | null, screen: ScreenFacts): RoomDevice | undefined {
  return platform === null ? undefined : { platform, form: deviceFormOf(platform, screen) };
}

function screenFacts(): ScreenFacts {
  const s = globalThis.screen as { width?: number; height?: number } | undefined;
  const sides = [s?.width, s?.height].filter((n): n is number => typeof n === "number" && n > 0);
  const win = globalThis as { innerWidth?: number; innerHeight?: number };
  const fallback = Math.min(win.innerWidth ?? Infinity, win.innerHeight ?? Infinity);
  return {
    shortSide: sides.length > 0 ? Math.min(...sides) : fallback,
    coarsePointer: globalThis.matchMedia?.("(pointer: coarse)").matches === true,
  };
}

/** This device, for a room's `hello`. Main thread only. */
export function currentRoomDevice(shell: Platform = detectPlatform()): RoomDevice | undefined {
  return roomDeviceOf(currentPlayPlatform(shell), screenFacts());
}
