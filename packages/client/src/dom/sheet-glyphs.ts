/**
 * `SheetGlyphs`: the key and button glyphs of a screen drawn as an `mc-sheet` (`docs/controller-support.md`, decisions
 * 5, 6 and 8). The DOM counterpart of `ui/glyph-hints.ts`: the same shortcuts, specs (`view/input-glyph-model.ts`),
 * placement rules (`view/glyph-placement.ts`), hint size setting and input-set logic, drawn by the shared `mc-glyph`.
 *
 * A scene registers a glyph while it builds its parts (`button`, called where it called `builder.button`), and the
 * hints keep it current without per-frame work: a new input device or setting redraws the scene when something the
 * glyphs show changed (`redraw`), and the mouse moving or resting only flips the glyph's openness, which `mc-glyph`
 * animates itself (CSS, the Phaser glyph's 140ms / 180ms). Nothing is drawn while no keyboard or pad is in use, and
 * never on touch.
 */
import type Phaser from "phaser";
import type { McGlyphGround } from "@mc/ui";
import { layoutGlyph, measureGlyphText } from "@mc/ui/glyph";
import { font, typeRole, type TypeSpec } from "../tokens.js";
import { bindInputHints, type InputHints, type InputHintsSnapshot } from "../ui/input-hints.js";
import {
  glyphBesideLabel,
  glyphHeightFor,
  glyphHangingBelow,
  glyphOutsideButton,
  glyphRect,
  hangIsClear,
  scaledGlyphHeight,
  specsSignature,
} from "../view/glyph-placement.js";
import { glyphsForShortcut, type GlyphSpec } from "../view/input-glyph-model.js";
import { glyphSetOf, glyphsExpanded } from "../view/input-mode.js";
import { uiSpecOf } from "../view/glyph-ui-spec.js";
import type { ShortcutId } from "../view/input-shortcuts.js";
import type { Rect } from "../view/layout.js";
import type { SheetBuilder } from "./sheet-builder.js";

type GlyphSet = "keyboard" | "pad";

/** The specs for several shortcuts side by side, skipping any with no glyph on this input. */
function specsFor(ids: readonly ShortcutId[], snapshot: InputHintsSnapshot): readonly GlyphSpec[] | null {
  const out: GlyphSpec[] = [];
  for (const id of ids) out.push(...(glyphsForShortcut(id, snapshot.state, snapshot.settings, null) ?? []));
  return out.length > 0 ? out : null;
}

export interface SheetGlyphButton {
  readonly key: string;
  readonly rect: Rect;
  readonly label: string;
  readonly look: "primary" | "secondary" | "quiet" | "onInk" | "rail";
  readonly type?: TypeSpec;
  readonly selected?: boolean;
  readonly disabled?: string | true;
  /** The shortcuts the glyph shows (their keys on a keyboard, their buttons on a pad). */
  readonly ids: readonly ShortcutId[];
  readonly ground?: McGlyphGround;
  /** Which shortcuts the glyph shows right now (null: none), when that changes with the screen's state. */
  readonly idsNow?: (set: GlyphSet) => readonly ShortcutId[] | null;
}

interface Registered {
  readonly entry: SheetGlyphButton;
  /** The specs' signature this entry was drawn with (null: it had none), to tell later whether anything changed. */
  drawn: string | null;
}

/** Keys measured in the font `mc-glyph` draws with (`--mc-font-body`). */
const BODY_MEASURE = (label: string, size: number): number =>
  measureGlyphText(label, size, `"${font.body}", sans-serif`);

export class SheetGlyphs {
  readonly #scene: Phaser.Scene;
  readonly #redraw: () => void;
  readonly #obstacles: () => readonly Rect[];
  readonly #binding: InputHints;
  #entries: Registered[] = [];
  #snapshot: InputHintsSnapshot | null = null;
  /** The flags (open, size, reduced motion) the last draw used. */
  #drawnFlags = "";
  #expanded: boolean | null = null;
  #hadGlyph = false;
  #disposed = false;

  /**
   * `redraw` rebuilds the scene's sheet; it is called when what the glyphs show changed. `obstacles` are the rects a
   * hanging glyph must not cover, read when it is placed.
   */
  constructor(scene: Phaser.Scene, redraw: () => void, obstacles: () => readonly Rect[] = () => []) {
    this.#scene = scene;
    this.#redraw = redraw;
    this.#obstacles = obstacles;
    this.#binding = bindInputHints(scene, (snapshot) => {
      this.#snapshot = snapshot;
      if (this.#entries.length === 0) return;
      // Mid-fold the mouse state has not changed: the glyph animates itself, nothing to compute.
      const expanded = glyphsExpanded(snapshot.state);
      const folding = snapshot.openness > 0 && snapshot.openness < 1;
      if (folding && expanded === this.#expanded) return;
      this.#expanded = expanded;
      const now = this.#compose(
        this.#entries.map(({ entry }) => this.#signatureOf(entry, snapshot)),
        this.#flagsOf(snapshot),
      );
      const drawn = this.#compose(
        this.#entries.map((registered) => registered.drawn),
        this.#drawnFlags,
      );
      if (now !== drawn) this.#redraw();
    });
    // Key widths and the word measured before the fonts were in: place again once they are.
    void (typeof document === "undefined" ? undefined : document.fonts?.ready)?.then(() => {
      if (!this.#disposed && this.#hadGlyph) this.#redraw();
    });
  }

  /** Forget every registered glyph: call at the start of the scene's draw. */
  reset(): void {
    this.#entries = [];
    this.#hadGlyph = false;
  }

  /** Re-reads now (the screen's state, a `idsNow`, changed). */
  refresh(): void {
    this.#binding.refresh();
  }

  dispose(): void {
    this.#disposed = true;
    this.#binding.dispose();
  }

  /** How many glyphs are registered (tests). */
  get count(): number {
    return this.#entries.length;
  }

  #specsOf(entry: SheetGlyphButton, snapshot: InputHintsSnapshot): readonly GlyphSpec[] | null {
    const set = glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource);
    if (set === null) return null;
    const ids = entry.idsNow ? entry.idsNow(set) : entry.ids;
    return ids ? specsFor(ids, snapshot) : null;
  }

  #signatureOf(entry: SheetGlyphButton, snapshot: InputHintsSnapshot): string | null {
    const specs = this.#specsOf(entry, snapshot);
    return specs ? specsSignature(specs) : null;
  }

  #flagsOf(snapshot: InputHintsSnapshot): string {
    const { glyphSize, reducedMotion } = snapshot.settings;
    return [glyphsExpanded(snapshot.state), glyphSize, reducedMotion].join("/");
  }

  /** What the glyphs depend on, so an input change that alters none of it redraws nothing. */
  #compose(parts: readonly (string | null)[], flags: string): string {
    // With nothing to show, the mouse moving or resting changes nothing drawn.
    return parts.every((part) => part === null) ? "none" : [flags, ...parts.map((part) => part ?? "")].join("|");
  }

  /**
   * A glyph on its own (a drawn control with no button: a bare close `×`), its left edge at `x`, centered on `y`: the
   * Cancel glyph just after a title. Placed as given; drawn only while a keyboard or pad is in use.
   */
  hint(
    builder: SheetBuilder,
    entry: {
      readonly key: string;
      readonly x: number;
      readonly y: number;
      readonly ids: readonly ShortcutId[];
      readonly height: number;
      readonly ground?: McGlyphGround;
    },
  ): void {
    const registered: Registered = {
      entry: {
        key: entry.key,
        rect: { x: entry.x, y: entry.y, width: 0, height: 0 },
        label: "",
        look: "onInk",
        ids: entry.ids,
      },
      drawn: null,
    };
    this.#entries.push(registered);
    const snapshot = this.#snapshot;
    const specs = snapshot ? this.#specsOf(registered.entry, snapshot) : null;
    if (!snapshot) return;
    this.#drawnFlags = this.#flagsOf(snapshot);
    registered.drawn = specs ? specsSignature(specs) : null;
    if (!specs) return;
    this.#hadGlyph = true;
    builder.glyph({
      x: entry.x,
      y: entry.y,
      specs: specs.map(uiSpecOf),
      height: scaledGlyphHeight(entry.height, snapshot.settings.glyphSize),
      ground: entry.ground ?? "ink",
      openness: glyphsExpanded(snapshot.state) ? 1 : 0,
      still: snapshot.settings.reducedMotion,
      key: `glyph:${entry.key}`,
    });
  }

  /**
   * A glyph hung just below `anchor`, its right edge on the anchor's (a corner button's press glyph), if that spot is
   * clear of the obstacles. Drawn only while a keyboard or pad is in use. The DOM twin of `GlyphHints.hang`.
   */
  hang(
    builder: SheetBuilder,
    entry: {
      readonly key: string;
      readonly anchor: Rect;
      readonly ids: readonly ShortcutId[];
      readonly height: number;
      readonly ground?: McGlyphGround;
    },
  ): void {
    const registered: Registered = {
      entry: {
        key: entry.key,
        rect: entry.anchor,
        label: "",
        look: "onInk",
        ids: entry.ids,
      },
      drawn: null,
    };
    this.#entries.push(registered);
    const snapshot = this.#snapshot;
    if (!snapshot) return;
    const specs = this.#specsOf(registered.entry, snapshot);
    this.#drawnFlags = this.#flagsOf(snapshot);
    registered.drawn = specs ? specsSignature(specs) : null;
    if (!specs) return;
    this.#hadGlyph = true;
    const height = scaledGlyphHeight(entry.height, snapshot.settings.glyphSize);
    const { fullWidth } = layoutGlyph(specs.map(uiSpecOf), height, BODY_MEASURE);
    const point = glyphHangingBelow(entry.anchor, fullWidth, height);
    if (!hangIsClear(glyphRect(point, fullWidth, height), this.#obstacles())) return;
    builder.glyph({
      x: point.x,
      y: point.y,
      specs: specs.map(uiSpecOf),
      height,
      ground: entry.ground ?? "paper",
      openness: glyphsExpanded(snapshot.state) ? 1 : 0,
      still: snapshot.settings.reducedMotion,
      key: `glyph:${entry.key}`,
    });
  }

  /**
   * A button with its glyph beside the word (the pair centered, the word sliding over to make room), or hung just
   * outside when the pair does not fit, or not drawn when that spot would cover something. Call where the scene
   * called `builder.button`.
   */
  button(builder: SheetBuilder, entry: SheetGlyphButton): void {
    const registered: Registered = { entry, drawn: null };
    this.#entries.push(registered);
    const { key, rect, label, look, type, selected, disabled } = entry;
    const plain = (): void =>
      builder.button({
        key,
        rect,
        label,
        look,
        ...(type ? { type } : {}),
        ...(selected ? { selected } : {}),
        ...(disabled !== undefined ? { disabled } : {}),
      });
    const snapshot = this.#snapshot;
    const specs = snapshot ? this.#specsOf(entry, snapshot) : null;
    if (snapshot) {
      this.#drawnFlags = this.#flagsOf(snapshot);
      registered.drawn = specs ? specsSignature(specs) : null;
    }
    if (!snapshot || !specs) {
      plain();
      return;
    }
    const open = glyphsExpanded(snapshot.state);
    const height = scaledGlyphHeight(glyphHeightFor(rect.height), snapshot.settings.glyphSize);
    this.#hadGlyph = true;
    const { fullWidth } = layoutGlyph(specs.map(uiSpecOf), height, BODY_MEASURE);
    // The word's real drawn width, measured in the DOM in the button's own type.
    const word = builder.measure(label, type ?? typeRole.label).width;
    const beside = glyphBesideLabel(
      rect,
      { cx: rect.x + rect.width / 2, width: word, minX: rect.x, maxX: rect.x + rect.width },
      fullWidth,
      fullWidth,
      1,
    );
    let x: number;
    let y: number;
    let shift = 0;
    if (beside) {
      x = beside.x;
      y = beside.y;
      shift = beside.labelShift;
    } else {
      const view = this.#scene.scale.gameSize;
      const point = glyphOutsideButton(rect, fullWidth, height, { x: 0, y: 0, width: view.width, height: view.height });
      if (!hangIsClear(glyphRect(point, fullWidth, height), this.#obstacles())) {
        plain();
        return;
      }
      x = point.x;
      y = point.y;
    }
    // The glyph is decoration; the chord is exposed on the button it presses (real keyboard keys only).
    const keys = specs
      .filter((spec) => spec.kind === "key" && spec.label !== "Hold")
      .map((spec) => (spec.label === "Esc" ? "Escape" : spec.label));
    const keyshortcuts = keys.length ? keys.join("+") : undefined;
    builder.button({
      key,
      rect,
      label,
      look,
      ...(type ? { type } : {}),
      ...(selected ? { selected } : {}),
      ...(disabled !== undefined ? { disabled } : {}),
      // The word makes room only while the glyph is open; folded away it is back where the button put it.
      ...(open ? { labelShift: shift } : {}),
      ...(snapshot.settings.reducedMotion ? { still: true } : {}),
      ...(keyshortcuts ? { keyshortcuts } : {}),
    });
    builder.glyph({
      x,
      y,
      specs: specs.map(uiSpecOf),
      height,
      ground: entry.ground ?? "ink",
      openness: open ? 1 : 0,
      still: snapshot.settings.reducedMotion,
      key: `glyph:${key}`,
    });
  }
}
