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
import { bindInputHints, type InputHints, type InputHintsSnapshot } from "../ui/input-hints.js";
import { glyphHeightFor, scaledGlyphHeight, specsSignature } from "../view/glyph-placement.js";
import { glyphsForShortcut, type GlyphSpec } from "../view/input-glyph-model.js";
import { glyphSetOf, glyphsExpanded } from "../view/input-mode.js";
import { uiSpecOf } from "../view/glyph-ui-spec.js";
import type { ShortcutId } from "../view/input-shortcuts.js";

function specsFor(ids: readonly ShortcutId[], snapshot: InputHintsSnapshot): readonly GlyphSpec[] | null {
  if (glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource) === null) return null;
  const out: GlyphSpec[] = [];
  for (const id of ids) out.push(...(glyphsForShortcut(id, snapshot.state, snapshot.settings, null) ?? []));
  return out.length > 0 ? out : null;
}

export class ControlGlyphs {
  readonly #redraw: () => void;
  readonly #binding: InputHints;
  #snapshot: InputHintsSnapshot | null = null;
  /** What each glyph asked for in the last model, by control: its shortcuts and the control's height. */
  #asked = new Map<string, { readonly ids: readonly ShortcutId[]; readonly height: number }>();
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
    for (const [key, { ids }] of this.#asked) {
      const specs = specsFor(ids, snapshot);
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
  ): ControlGlyph | undefined {
    this.#asked.set(key, { ids, height: controlHeight });
    const snapshot = this.#snapshot;
    const specs = snapshot ? specsFor(ids, snapshot) : null;
    if (!snapshot || !specs) return undefined;
    return {
      specs: specs.map(uiSpecOf),
      height: scaledGlyphHeight(glyphHeightFor(controlHeight), snapshot.settings.glyphSize),
      ground,
      openness: glyphsExpanded(snapshot.state) ? 1 : 0,
      still: snapshot.settings.reducedMotion,
    };
  }

  dispose(): void {
    this.#binding.dispose();
  }
}
