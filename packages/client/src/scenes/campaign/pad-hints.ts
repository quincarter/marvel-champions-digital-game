/**
 * Glyph hints for the campaign screens (`ui/glyph-hints.ts`), so each screen asks for them in one line.
 *
 * The pad's Start is "forward" on a campaign screen (`FocusRoute`'s `primary`), so a screen's main Continue / Next /
 * Begin button carries Start on a pad (`forwardHint`). A page-skipping control (the comic's
 * SKIP) carries the pause chord (`skipHint`): Start on a pad, Esc on a keyboard, both of which leave it. Touch shows
 * nothing: `GlyphHints` draws only while a pad or keyboard is the input in use.
 */

import Phaser from "phaser";
import { GlyphHints, specsForShortcuts } from "../../ui/glyph-hints.js";
import type { GlyphGround } from "../../ui/input-glyph.js";
import { textStyle } from "../../ui/theme.js";
import { surface, typeRole } from "../../tokens.js";
import type { ShortcutId } from "../../view/input-shortcuts.js";
import type { McButton } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";

/** One `GlyphHints` for the scene, disposed when it shuts down. Call `reset()` at the top of every redraw. */
export function createHints(scene: Phaser.Scene, obstacles?: () => readonly Rect[]): GlyphHints {
  const hints = new GlyphHints(scene, obstacles);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hints.dispose());
  return hints;
}

/**
 * Start beside a screen's main forward button, on a pad only. One hint per button on purpose: a second one on the same
 * button (a keyboard one) hides itself while the pad is in use and slides the button's label back under the first one's
 * glyph (`GlyphHints#hide` resets the shift). The keyboard's Enter / Space press the same button through the route's
 * `primary`, so it needs no glyph of its own here.
 */
export function forwardHint(hints: GlyphHints | null, button: McButton, ground: GlyphGround): void {
  hints?.button(button, ["pause"], ground, { when: (set) => set === "pad" });
}

/**
 * A beside the button that A (or Enter) presses on a screen where Start does something else (skips the whole
 * sequence): the comic's NEXT, the reveal button.
 */
export function advanceHint(hints: GlyphHints | null, button: McButton, ground: GlyphGround): void {
  hints?.button(button, ["activate"], ground);
}

/** The pause chord (Start, Esc) beside a control that Start / Esc leaves through. */
export function skipHint(hints: GlyphHints | null, button: McButton, ground: GlyphGround): void {
  hints?.button(button, ["pause"], ground);
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

/**
 * A row of glyph-and-word chips (A Add, Y Inspect, B Back) just above a focused card. `GlyphHints#legend` always adds
 * "hold to zoom" to Inspect, which is not true on a screen whose Y only opens the sheet, so this draws its own from
 * ordinary hint entries. Register it once per redraw, after `hints.reset()`; `setAnchor` moves it (null hides it) and
 * refreshes the hints.
 */
export class CardLegend {
  #anchor: Rect | null = null;
  readonly #fulls: number[] = [];
  readonly #words: Phaser.GameObjects.Text[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly hints: GlyphHints,
    items: readonly { readonly id: ShortcutId; readonly text: string }[],
  ) {
    const height = 20;
    const gap = 14;
    items.forEach((item, index) => {
      const word = scene.add
        .text(0, 0, item.text, {
          ...textStyle(typeRole.label, surface.paper.hex),
          backgroundColor: surface.ink.css,
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0, 0.5);
      this.#words.push(word);
      hints.custom(
        (set, snapshot, layer) => specsForShortcuts([item.id], snapshot, set === "pad" ? layer : null),
        height,
        (size) => {
          const anchor = this.#anchor;
          this.#fulls[index] = size.full;
          if (!anchor) return null;
          let x = anchor.x + 6;
          for (let before = 0; before < index; before += 1) {
            x += (this.#fulls[before] ?? 0) + 6 + (this.#words[before]?.width ?? 0) + gap;
          }
          return { x, y: Math.max(height / 2 + 2, anchor.y - height / 2 - 2) };
        },
        { ground: "ink", word },
      );
    });
  }

  setAnchor(rect: Rect | null): void {
    this.#anchor = rect;
    this.hints.refresh();
  }
}
