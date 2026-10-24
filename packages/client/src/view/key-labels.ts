/**
 * Key cap labels by the user's keyboard layout. Shortcuts match by physical position (`KeyboardEvent.code`), so on AZERTY
 * the key under the left hand's W is printed Z; where the browser exposes the layout (`navigator.keyboard.getLayoutMap()`,
 * Chromium) the glyph says what is printed, otherwise it falls back to the QWERTY label.
 */

let layout: ReadonlyMap<string, string> | null = null;
let requested = false;

/** Reads the layout once, in the background; glyphs built after it resolves use it. Safe to call anywhere. */
export function primeKeyLabels(): void {
  if (requested) return;
  requested = true;
  const keyboard = (
    globalThis as { navigator?: { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } } }
  ).navigator?.keyboard;
  void keyboard
    ?.getLayoutMap?.()
    .then((map) => {
      layout = map;
    })
    .catch(() => undefined);
}

/** Tests: set the layout map directly (null to clear). */
export function setKeyLayoutForTest(map: ReadonlyMap<string, string> | null): void {
  layout = map;
  requested = true;
}

/** The printed letter for a `Key*` code under the user's layout, or null (fall back to the QWERTY cap). */
export function keyLabelOfCode(code: string): string | null {
  primeKeyLabels();
  if (!layout || !/^Key[A-Z]$/.test(code)) return null;
  const printed = layout.get(code);
  return printed && /^[a-zA-Z]$/.test(printed) ? printed.toUpperCase() : null;
}
