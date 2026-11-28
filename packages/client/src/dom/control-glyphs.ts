/**
 * The key and button glyphs of a pop-up built from custom elements (`@mc/ui`'s `ControlGlyph`): the same shortcuts,
 * specs, hint size and input-set logic `SheetGlyphs` uses for a sheet, handed to the elements as plain data. An element
 * hangs the glyph under its control; nothing is drawn while no keyboard or pad is in use, and never on touch.
 *
 * A scene asks for a control's glyph while it builds its model (`glyph`), and is told to build it again (`redraw`) when
 * what the glyphs show changed: a new input device or setting.
 */
import type Phaser from "phaser";
import type { ControlGlyph, McGlyphGround } from "@mc/ui";
import { layoutGlyph, measureGlyphText } from "@mc/ui/glyph";
import { font } from "../tokens.js";
import { bindInputHints, type InputHints, type InputHintsSnapshot } from "../ui/input-hints.js";
import { glyphHeightFor, scaledGlyphHeight, specsSignature } from "../view/glyph-placement.js";
import { glyphsForShortcut, type GlyphSpec } from "../view/input-glyph-model.js";
import { glyphSetOf, glyphsExpanded } from "../view/input-mode.js";
import { uiSpecOf } from "../view/glyph-ui-spec.js";
import type { ShortcutId } from "../view/input-shortcuts.js";

/** The specs for the input set in use, for a control whose glyph differs by set (a pad's trigger, a chord). */
export type ControlSpecs = (set: "keyboard" | "pad", snapshot: InputHintsSnapshot) => readonly GlyphSpec[] | null;

/** Keys measured in the font `mc-glyph` draws with (`--mc-font-body`). */
const BODY_MEASURE = (label: string, size: number): number =>
  measureGlyphText(label, size, `"${font.body}", sans-serif`);

function specsFor(
  ids: readonly ShortcutId[],
  snapshot: InputHintsSnapshot,
  custom?: ControlSpecs,
): readonly GlyphSpec[] | null {
  const set = glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource);
  // A control whose glyph differs by input set (a pad's trigger, a key chord) says which itself.
  if (custom) return set === null ? null : custom(set, snapshot);
  if (set === null) return null;
  const out: GlyphSpec[] = [];
  for (const id of ids) out.push(...(glyphsForShortcut(id, snapshot.state, snapshot.settings, null) ?? []));
  return out.length > 0 ? out : null;
}

export class ControlGlyphs {
  readonly #redraw: () => void;
  readonly #binding: InputHints;
  #snapshot: InputHintsSnapshot | null = null;
  /** What each glyph asked for in the last model, by control: its shortcuts and the control's height. */
  #asked = new Map<
    string,
    { readonly ids: readonly ShortcutId[]; readonly height: number; readonly custom?: ControlSpecs }
  >();
  #drawn = "";

  constructor(scene: Phaser.Scene, redraw: () => void) {
    this.#redraw = redraw;
    this.#binding = bindInputHints(scene, (snapshot) => {
      this.#snapshot = snapshot;
      if (this.#asked.size === 0) return;
      if (this.#signature(snapshot) !== this.#drawn) this.#redraw();
    });
  }

  #signature(snapshot: InputHintsSnapshot): string {
    const parts: string[] = [glyphsExpanded(snapshot.state) ? "open" : "shut", String(snapshot.settings.glyphSize)];
    for (const [key, { ids, custom }] of this.#asked) {
      const specs = specsFor(ids, snapshot, custom);
      parts.push(`${key}=${specs ? specsSignature(specs) : ""}`);
    }
    return parts.join("|");
  }

  /** Forget every glyph asked for: call at the start of building a model. */
  reset(): void {
    this.#asked = new Map();
  }

  /** Call once the model is built, so a later device change is compared with what it drew. */
  settled(): void {
    this.#drawn = this.#snapshot ? this.#signature(this.#snapshot) : "";
  }

  /** The glyph for the control `key` showing `ids`, hung under it, or undefined while none shows. */
  glyph(
    key: string,
    ids: readonly ShortcutId[],
    ground: McGlyphGround,
    controlHeight: number,
    place: "inside" | "left" = "inside",
    /** The specs by input set, in place of `ids` (a pad's trigger, a chord that differs by set). */
    custom?: ControlSpecs,
  ): ControlGlyph | undefined {
    this.#asked.set(key, { ids, height: controlHeight, ...(custom ? { custom } : {}) });
    const snapshot = this.#snapshot;
    const specs = snapshot ? specsFor(ids, snapshot, custom) : null;
    if (!snapshot || !specs) return undefined;
    const height = scaledGlyphHeight(glyphHeightFor(controlHeight), snapshot.settings.glyphSize);
    const uiSpecs = specs.map(uiSpecOf);
    return {
      specs: uiSpecs,
      width: layoutGlyph(uiSpecs, height, BODY_MEASURE).fullWidth,
      height,
      ground,
      openness: glyphsExpanded(snapshot.state) ? 1 : 0,
      still: snapshot.settings.reducedMotion,
      place,
    };
  }

  /** The last input snapshot (the device, the settings), for a screen that places glyphs of its own. */
  get snapshot(): InputHintsSnapshot | null {
    return this.#snapshot;
  }

  dispose(): void {
    this.#binding.dispose();
  }
}
