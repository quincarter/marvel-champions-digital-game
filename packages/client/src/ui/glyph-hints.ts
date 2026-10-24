/**
 * `GlyphHints`: the key and button glyphs a scene shows beside its controls (`docs/controller-support.md`, decisions
 * 5 and 6). One per scene.
 *
 * A scene's redraw rebuilds every object, so the hints are registered while it draws (`reset()` first, then `button`,
 * `inline`, `hang`, `rightInRow`) and `bindInputHints` keeps them current without a redraw: a new input device swaps
 * the glyph's keys in place, and the mouse moving or resting only changes each glyph's openness (to nothing while the
 * mouse moves). Nothing runs per frame unless an open/close animation is under way (`ui/input-hints.ts`). No glyph
 * object is built while no keyboard or pad is in use; it is made when one first applies.
 *
 * Where a glyph goes (`view/glyph-placement.ts` has the rules and the tests): right beside its button's word, the pair
 * centered together, the word sliding over to make room; if the pair does not fit inside the button, the glyph hangs
 * just outside it, below or above, and is not drawn at all when that spot would cover another object (`obstacles`).
 * Nothing is ever resized, shortened or wrapped.
 */

import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import {
  glyphBesideLabel,
  glyphHangingBelow,
  glyphHeightFor,
  glyphOutsideButton,
  glyphRect,
  glyphRightInRow,
  hangIsClear,
  legendLayout,
  legendRect,
  legendSegments,
  specsSignature,
  type GlyphPoint,
} from "../view/glyph-placement.js";
import { glyphsForShortcut, type GlyphSpec } from "../view/input-glyph-model.js";
import { glyphSetOf } from "../view/input-mode.js";
import type { PadLayer } from "../view/pad-layer-bindings.js";
import type { ShortcutId } from "../view/input-shortcuts.js";
import type { Rect } from "../view/layout.js";
import { McInputGlyph, type GlyphGround } from "./input-glyph.js";
import { bindInputHints, type InputHints, type InputHintsSnapshot } from "./input-hints.js";
import { textStyle } from "./theme.js";
import type { McButton } from "./widgets.js";

/** Above the table's own objects, below the overlays' scrims (those sit in other scenes). */
const HINT_DEPTH = 950;
const LEGEND_HEIGHT = 22;

export type GlyphSet = "keyboard" | "pad";

interface Placed extends GlyphPoint {
  /** How far the button's word slides to make room (0 when the glyph hangs outside). */
  readonly labelShift?: number;
}

/** What a hint with no shortcut of its own draws: the specs for the input set and hold layer now, or null for none. */
export type CustomSpecs = (
  set: GlyphSet,
  snapshot: InputHintsSnapshot,
  layer: PadLayer | null,
) => readonly GlyphSpec[] | null;

interface Entry {
  readonly ids: readonly ShortcutId[];
  readonly custom: CustomSpecs | null;
  readonly ground: GlyphGround;
  readonly height: number;
  glyph: McInputGlyph | null;
  /** The point for the glyph at its current size, or null to draw nothing (no room, or it would cover something). */
  readonly place: (size: { width: number; full: number; openness: number }) => Placed | null;
  readonly word: Phaser.GameObjects.Text | null;
  /** Only while this holds for the input in use (a glyph must not promise what the key would not do). */
  readonly when: ((set: GlyphSet) => boolean) | null;
  /** Slides the button's word over, or back to 0. */
  readonly shift: ((dx: number) => void) | null;
  signature: string;
}

export interface HintOptions {
  readonly ground?: GlyphGround;
  /** A word drawn after the glyph (the hand caption's "Zones"), shown and hidden with it. */
  readonly word?: Phaser.GameObjects.Text;
  readonly when?: (set: GlyphSet) => boolean;
}

/** The specs for several shortcuts side by side: each one's keys, skipping any with no glyph on this input. */
export function specsForShortcuts(
  ids: readonly ShortcutId[],
  snapshot: InputHintsSnapshot,
  layer: PadLayer | null = null,
): readonly GlyphSpec[] | null {
  const out: GlyphSpec[] = [];
  for (const id of ids) out.push(...(glyphsForShortcut(id, snapshot.state, snapshot.settings, layer) ?? []));
  return out.length > 0 ? out : null;
}

export class GlyphHints {
  readonly #scene: Phaser.Scene;
  #entries: Entry[] = [];
  #listeners: ((snapshot: InputHintsSnapshot) => void)[] = [];
  #snapshot: InputHintsSnapshot | null = null;
  readonly #binding: InputHints;
  #legend: LegendStrip | null = null;
  /** The pad's hold layer (LT / RT), null at rest. Kept across `reset()`: a redraw does not release a trigger. */
  #layer: PadLayer | null = null;
  #legendCard: { readonly rect: Rect; readonly viewport: Rect; readonly cancelMeans: "back" | "pause" } | null = null;
  readonly #obstacles: () => readonly Rect[];

  /** `obstacles`: the rects a hanging glyph must not cover (cards, piles, panels), read when it is placed. */
  constructor(scene: Phaser.Scene, obstacles: () => readonly Rect[] = () => []) {
    this.#scene = scene;
    this.#obstacles = obstacles;
    this.#binding = bindInputHints(scene, (snapshot) => {
      this.#snapshot = snapshot;
      this.#apply();
    });
  }

  /** Forget every registered hint: call just before the scene destroys its children for a redraw. */
  reset(): void {
    this.#entries = [];
    this.#listeners = [];
    this.#legend = null;
  }

  /**
   * A trigger was pulled or let go. While one is held every base hint steps aside (the legend strip too) and only the
   * layer's own glyphs show, each on what its button now presses; on release the base hints return.
   */
  setLayer(layer: PadLayer | null): void {
    if (layer === this.#layer) return;
    this.#layer = layer;
    this.#binding.refresh();
  }

  get layer(): PadLayer | null {
    return this.#layer;
  }

  /** Re-applies now (a setting, or something a `when` reads, changed). */
  refresh(): void {
    this.#binding.refresh();
  }

  dispose(): void {
    this.#binding.dispose();
  }

  /** How many hints are registered (tests and the performance check). */
  get count(): number {
    return this.#entries.length;
  }

  /**
   * Hears the input snapshot on every change, ahead of the glyphs, until the next `reset()`: for a label that
   * depends on the input in use. Called at once if a snapshot already exists.
   */
  onSnapshot(listener: (snapshot: InputHintsSnapshot) => void): void {
    this.#listeners.push(listener);
    if (this.#snapshot) listener(this.#snapshot);
  }

  /** A glyph beside `button`'s word (or hung outside it when the pair does not fit). */
  button(
    button: McButton,
    ids: readonly ShortcutId[],
    ground: GlyphGround = "ink",
    options: Pick<HintOptions, "when"> = {},
  ): void {
    const rect = button.rect;
    const height = glyphHeightFor(rect.height);
    this.#add(ids, ground, height, {
      place: ({ width, full, openness }) => {
        const beside = glyphBesideLabel(rect, button.labelBox, full, width, openness);
        if (beside) return beside;
        // Too narrow for the pair: hung just outside, below the button or above at the screen's edge, if clear.
        const view = this.#scene.scale.gameSize;
        const point = glyphOutsideButton(rect, width, height, { x: 0, y: 0, width: view.width, height: view.height });
        return hangIsClear(glyphRect(point, width, height), this.#obstacles()) ? point : null;
      },
      when: options.when ?? null,
      shift: (dx) => {
        if (button.container.active) button.nudgeLabel(dx);
      },
    });
  }

  /**
   * A glyph drawn from `custom` (no shortcut of its own: a trigger, a layer's button on a card) at `place`. `custom` is
   * asked on every apply with the input set and the hold layer, and decides when the glyph shows. A `word` shows with it.
   */
  custom(
    custom: CustomSpecs,
    height: number,
    place: Entry["place"],
    options: Pick<HintOptions, "ground" | "word"> = {},
  ): void {
    this.#add([], options.ground ?? "ink", height, { place, word: options.word ?? null, custom });
  }

  /** A glyph at a fixed left edge, vertically centered on `y`: the hand caption's "[ ] Zones". */
  inline(x: number, y: number, ids: readonly ShortcutId[], height: number, options: HintOptions = {}): void {
    this.#add(ids, options.ground ?? "ink", height, {
      place: () => ({ x, y }),
      word: options.word ?? null,
      when: options.when ?? null,
    });
  }

  /** A glyph hanging just below `anchor`, its right edge on the anchor's (the chrome's MENU button), if clear. */
  hang(anchor: Rect, ids: readonly ShortcutId[], height: number, options: HintOptions = {}): void {
    this.#add(ids, options.ground ?? "paper", height, {
      place: ({ width }) => {
        const point = glyphHangingBelow(anchor, width, height);
        return hangIsClear(glyphRect(point, width, height), this.#obstacles()) ? point : null;
      },
      when: options.when ?? null,
    });
  }

  /** A glyph on the right edge of a panel's header row (the log's). */
  rightInRow(panel: Rect, top: number, row: number, padX: number, ids: readonly ShortcutId[], height: number): void {
    this.#add(ids, "paper", height, { place: ({ width }) => glyphRightInRow(panel, top, row, width, padX) });
  }

  /**
   * Shows the legend strip beside `card` (where focus is), or hides it for `null`. `cancelMeans` is what Esc / B does
   * right now: "back" out of something, or "pause". An unchanged strip is only moved, never rebuilt.
   */
  legend(card: Rect | null, viewport: Rect, cancelMeans: "back" | "pause" = "back"): void {
    this.#legendCard = card ? { rect: card, viewport, cancelMeans } : null;
    if (!card) {
      this.#legend?.destroy();
      this.#legend = null;
      return;
    }
    this.#syncLegend();
  }

  #add(
    ids: readonly ShortcutId[],
    ground: GlyphGround,
    height: number,
    parts: {
      readonly place: Entry["place"];
      readonly word?: Phaser.GameObjects.Text | null;
      readonly when?: Entry["when"];
      readonly shift?: Entry["shift"];
      readonly custom?: CustomSpecs;
    },
  ): void {
    const word = parts.word ?? null;
    word?.setDepth(HINT_DEPTH).setVisible(false);
    const entry: Entry = {
      ids,
      custom: parts.custom ?? null,
      ground,
      height,
      glyph: null,
      place: parts.place,
      word,
      when: parts.when ?? null,
      shift: parts.shift ?? null,
      signature: "",
    };
    this.#entries.push(entry);
    if (this.#snapshot) this.#applyEntry(entry, this.#snapshot);
  }

  #apply(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    for (const listener of this.#listeners) listener(snapshot);
    for (const entry of this.#entries) this.#applyEntry(entry, snapshot);
    this.#syncLegend();
  }

  #hide(entry: Entry): void {
    entry.glyph?.setVisible(false);
    entry.word?.setVisible(false);
    entry.shift?.(0);
  }

  #applyEntry(entry: Entry, snapshot: InputHintsSnapshot): void {
    // Destroyed by a redraw that did not go through `reset()`: drop it quietly.
    if (entry.glyph && !entry.glyph.active) return;
    const set = glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs);
    const specs =
      set !== null && (entry.when?.(set) ?? true)
        ? entry.custom
          ? entry.custom(set, snapshot, this.#layer)
          : specsForShortcuts(entry.ids, snapshot, set === "pad" ? this.#layer : null)
        : null;
    // Owner rule: while the mouse moves the glyph goes all the way to nothing (it narrows and fades as it goes),
    // rather than resting as a tab. At openness 0 it is hidden from here, so McInputGlyph's own tab look never shows.
    if (!specs || snapshot.openness <= 0.01) {
      this.#hide(entry);
      return;
    }
    // Built only now that a keyboard or pad is in use.
    if (!entry.glyph) {
      entry.glyph = new McInputGlyph(this.#scene, 0, 0, specs, { height: entry.height, ground: entry.ground });
      entry.glyph.setDepth(HINT_DEPTH).setVisible(false);
      entry.signature = specsSignature(specs);
    }
    const glyph = entry.glyph;
    const signature = specsSignature(specs);
    if (signature !== entry.signature) {
      entry.signature = signature;
      glyph.setSpecs(specs);
    }
    glyph.setOpenness(snapshot.openness).setAlpha(snapshot.openness);
    entry.word?.setAlpha(snapshot.openness);
    const placed = entry.place({ width: glyph.glyphWidth, full: glyph.fullWidth, openness: snapshot.openness });
    if (!placed) {
      this.#hide(entry);
      return;
    }
    if (glyph.x !== placed.x || glyph.y !== placed.y) glyph.setPosition(placed.x, placed.y);
    glyph.setVisible(true);
    entry.word?.setPosition(placed.x + glyph.fullWidth + 6, placed.y).setVisible(true);
    entry.shift?.(placed.labelShift ?? 0);
  }

  #syncLegend(): void {
    const target = this.#legendCard;
    const snapshot = this.#snapshot;
    const set = snapshot ? glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs) : null;
    // Under a held trigger the legend gives way (it would sit where the layer's glyphs go).
    if (!target || !snapshot || set === null || (set === "pad" && this.#layer !== null)) {
      this.#legend?.destroy();
      this.#legend = null;
      return;
    }
    const segments = legendSegments(target.cancelMeans);
    const specs = segments.map((segment) => glyphsForShortcut(segment.id, snapshot.state, snapshot.settings));
    const signature = `${set}/${target.cancelMeans}/${specs.map(specsSignature).join(";")}`;
    if (!this.#legend || this.#legend.signature !== signature || !this.#legend.container.active) {
      this.#legend?.destroy();
      this.#legend = new LegendStrip(
        this.#scene,
        signature,
        segments.map((segment, index) => ({ text: segment.text, specs: specs[index] ?? null })),
      );
    }
    this.#legend.place(legendRect(target.rect, this.#legend.size, target.viewport), snapshot.openness);
  }
}

/** The small ink strip above the focused card: each item's glyph and its words. Rebuilt only when the keys change. */
class LegendStrip {
  readonly container: Phaser.GameObjects.Container;
  readonly size: { width: number; height: number };

  constructor(
    scene: Phaser.Scene,
    readonly signature: string,
    items: readonly { readonly text: string; readonly specs: readonly GlyphSpec[] | null }[],
  ) {
    const style = textStyle(typeRole.label, surface.paper.hex);
    const glyphs = items.map((item) =>
      item.specs ? new McInputGlyph(scene, 0, 0, item.specs, { height: 16, ground: "ink" }) : null,
    );
    const texts = items.map((item) => scene.add.text(0, 0, item.text, { ...style }).setOrigin(0, 0.5));
    const { slots, width } = legendLayout(
      items.map((_item, index) => ({ glyphWidth: glyphs[index]?.fullWidth ?? 0, textWidth: texts[index]!.width })),
    );
    this.size = { width, height: LEGEND_HEIGHT };
    const bg = scene.add.graphics();
    bg.fillStyle(surface.ink.hex, 1).fillRect(0, 0, width, LEGEND_HEIGHT);
    bg.lineStyle(1, surface.paper.hex, 0.5).strokeRect(0.5, 0.5, width - 1, LEGEND_HEIGHT - 1);
    const mid = LEGEND_HEIGHT / 2;
    slots.forEach((slot, index) => {
      glyphs[index]?.setPosition(slot.glyphX, mid);
      texts[index]!.setPosition(slot.textX, mid);
    });
    this.container = scene.add.container(0, 0, [bg, ...glyphs.filter((g) => g !== null), ...texts]);
    this.container.setDepth(HINT_DEPTH).setSize(width, LEGEND_HEIGHT);
  }

  place(rect: Rect, openness: number): void {
    if (this.container.x !== rect.x || this.container.y !== rect.y) this.container.setPosition(rect.x, rect.y);
    // The strip fades with the glyphs while the mouse is moving, rather than collapsing to a tab.
    this.container.setAlpha(openness).setVisible(openness > 0.02);
  }

  destroy(): void {
    if (this.container.active) this.container.destroy();
  }
}
