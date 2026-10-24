/**
 * Glyph hints for the campaign screens (`ui/glyph-hints.ts`), so each screen asks for them in one line.
 *
 * The pad's Start is "forward" on a campaign screen (`FocusRoute`'s `primary`), so a screen's main Continue / Next /
 * Begin button carries Start on a pad and Enter on a keyboard (`forwardHint`). A page-skipping control (the comic's
 * SKIP) carries the pause chord (`skipHint`): Start on a pad, Esc on a keyboard, both of which leave it. Touch shows
 * nothing: `GlyphHints` draws only while a pad or keyboard is the input in use.
 */

import Phaser from "phaser";
import { GlyphHints, specsForShortcuts } from "../../ui/glyph-hints.js";
import type { GlyphGround } from "../../ui/input-glyph.js";
import type { McButton } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";

/** One `GlyphHints` for the scene, disposed when it shuts down. Call `reset()` at the top of every redraw. */
export function createHints(scene: Phaser.Scene, obstacles?: () => readonly Rect[]): GlyphHints {
  const hints = new GlyphHints(scene, obstacles);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hints.dispose());
  return hints;
}

/** Start (pad) or Enter (keyboard) beside a screen's main forward button. */
export function forwardHint(hints: GlyphHints | null, button: McButton, ground: GlyphGround): void {
  if (!hints) return;
  hints.button(button, ["pause"], ground, { when: (set) => set === "pad" });
  hints.button(button, ["activate"], ground, { when: (set) => set === "keyboard" });
}

/** The pause chord (Start, Esc) beside a control that Start / Esc leaves through. */
export function skipHint(hints: GlyphHints | null, button: McButton, ground: GlyphGround): void {
  hints?.button(button, ["pause"], ground);
}

/** LB / RB beside a tab strip's two ends, or `zoneUp` / `zoneDown` on a keyboard. */
export function tabHint(hints: GlyphHints | null, button: McButton, direction: -1 | 1, ground: GlyphGround): void {
  hints?.button(button, [direction === -1 ? "zoneUp" : "zoneDown"], ground);
}

/**
 * LB at the strip's left end and RB at its right end, on a pad (the zone keys on a keyboard). Drawn in the strip's
 * margins, and not at all when a label would sit under one: pass the centre of the two end tabs as `avoid`, and have the
 * scene's obstacles function read the same rects.
 */
export function tabStripHints(hints: GlyphHints | null, strip: Rect, height = 22): void {
  if (!hints) return;
  const size = Math.min(height, Math.max(14, strip.height - 12));
  const y = strip.y + strip.height / 2;
  hints.custom(
    (set, snapshot, layer) => specsForShortcuts(["zonePrevious"], snapshot, set === "pad" ? layer : null),
    size,
    () => ({ x: strip.x + 8, y }),
    { ground: "paper", avoidObstacles: true },
  );
  hints.custom(
    (set, snapshot, layer) => specsForShortcuts(["zoneNext"], snapshot, set === "pad" ? layer : null),
    size,
    ({ width }) => ({ x: strip.x + strip.width - 8 - width, y }),
    { ground: "paper", avoidObstacles: true },
  );
}

/**
 * `forwardHint` for a wide row button whose own label is drawn by the screen (`campaignActionButton`: title top-left, a
 * chevron at the right): the glyph sits inside the button's right end, left of the chevron, when the row is wide enough.
 */
export function forwardHintAtEnd(hints: GlyphHints | null, rect: Rect, ground: GlyphGround, enabled = true): void {
  if (!hints || !enabled || rect.width < 240) return;
  const height = Math.min(26, Math.max(16, rect.height - 24));
  const place = ({ width }: { readonly width: number }) => ({
    x: rect.x + rect.width - 40 - width,
    y: rect.y + rect.height / 2,
  });
  hints.custom(
    (set, snapshot, layer) => (set === "pad" ? specsForShortcuts(["pause"], snapshot, layer) : null),
    height,
    place,
    { ground },
  );
  hints.custom(
    (set, snapshot) => (set === "keyboard" ? specsForShortcuts(["activate"], snapshot) : null),
    height,
    place,
    { ground },
  );
}
