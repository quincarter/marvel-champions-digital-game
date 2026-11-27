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
 * Android is told by its user agent, which the Android app's WebView always sends. Chrome on an Android tablet asking
 * for the desktop site sends a Linux one instead, and an unmapped pad there stays ignored.
 */

/** Whether `userAgent` is Android's. */
export function isAndroidAgent(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

/** Whether a pad reporting `mapping` is read in the standard button order on the browser with `userAgent`. */
export function padLayoutUsable(mapping: unknown, userAgent: string): boolean {
  if (typeof mapping !== "string" || mapping === "standard") return true;
  return mapping === "" && isAndroidAgent(userAgent);
}

/** `padLayoutUsable` on this browser. */
export function padLayoutUsableHere(mapping: unknown): boolean {
  return padLayoutUsable(mapping, globalThis.navigator?.userAgent ?? "");
}
