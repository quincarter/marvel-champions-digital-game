/**
 * Which pads the game can read in the "standard" button order (`view/gamepad.ts` is positional).
 *
 * A pad reporting `mapping: "standard"` always can, and so can one with no mapping field at all (an old browser).
 * Any other is ignored on the desktop: Chromium and Firefox there hand an unknown pad over in its raw HID order, and a
 * guess would press the wrong things.
 *
 * Android is the exception. Its Chromium (Chrome and the system WebView the Android app runs in) reads pads from
 * Android's own key codes, which already name every button (`KEYCODE_BUTTON_A`, `KEYCODE_DPAD_UP`, ...). A pad it has
 * no table for, such as a handheld's built-in controls (a Retroid Pocket, 2026-11-27), goes through
 * `UnknownGamepadMappings`, which lays those key codes out in the standard order and then reports `mapping: ""`
 * anyway ("These mappings should not be considered standard": `device/gamepad/android/.../GamepadMappings.java`). So
 * on Android an empty mapping is the standard order and is read as one. iOS needs no exception: WebKit reports every
 * extended controller GameController knows as "standard".
 *
 * The exception is Chromium's alone, so it is told by a user agent naming both Android and Chrome: the Android app's
 * WebView, Chrome and the Chromium browsers built on it. Firefox on Android, whose layout code is its own, gets no
 * exception, and neither does Chrome on an Android tablet asking for the desktop site (it sends a Linux user agent).
 *
 * Chromium's buttons and left stick are fully laid out, but its right stick is not always a stick: on a pad without
 * one, a newer Chromium fills those two slots with whatever other axes the pad has (a lone trigger, a throttle). So an
 * unmapped pad's right stick only scrolls once it has been seen at rest (`rightStickTrusted`): an axis that rests
 * pushed, like a throttle at -1, never scrolls. Scrolling only moves the view, never plays anything.
 */

import { SCROLL_DEADZONE } from "./pad-repeat.js";

/** Whether `userAgent` is Chromium's on Android (the app's WebView, Chrome, and browsers built on Chromium). */
export function isAndroidChromium(userAgent: string): boolean {
  return /android/i.test(userAgent) && /\bChrome\/\d/.test(userAgent);
}

/** Whether a pad reporting `mapping` is read in the standard button order on the browser with `userAgent`. */
export function padLayoutUsable(mapping: unknown, userAgent: string): boolean {
  if (typeof mapping !== "string" || mapping === "standard") return true;
  return mapping === "" && isAndroidChromium(userAgent);
}

/** `padLayoutUsable` on this browser. */
export function padLayoutUsableHere(mapping: unknown): boolean {
  return padLayoutUsable(mapping, globalThis.navigator?.userAgent ?? "");
}

/**
 * Whether a pad's right stick may scroll now, given whether it already could. A standard pad's always may; any other
 * pad's may from the first time both axes read at rest, and then for as long as the same pad holds that index.
 */
export function rightStickTrusted(trusted: boolean, mapping: unknown, x: number, y: number): boolean {
  if (trusted || typeof mapping !== "string" || mapping === "standard") return true;
  return Math.hypot(x, y) < SCROLL_DEADZONE;
}
