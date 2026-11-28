/**
 * The key and pad glyphs Choose a scenario's buttons carry (`HintGlyph`, what `mc-hint-button` draws beside its word), made
 * from the input hints the scene is bound to (`ui/input-hints.ts`): nothing while only touch is in use, the keyboard's or the
 * pad's own keys otherwise, folded to a tab while the mouse moves. The DOM twin of the Phaser `GlyphHints` this screen
 * used through `SheetGlyphs`.
 */
import type Phaser from "phaser";
import type { HintGlyph } from "@mc/ui";
import { bindInputHints, type InputHints, type InputHintsSnapshot } from "../../ui/input-hints.js";
import { glyphHeightFor, scaledGlyphHeight, specsSignature } from "../../view/glyph-placement.js";
import { glyphsForShortcut, type GlyphSpec } from "../../view/input-glyph-model.js";
import { glyphSetOf, glyphsExpanded } from "../../view/input-mode.js";
import { uiSpecOf } from "../../view/glyph-ui-spec.js";
import type { ShortcutId } from "../../view/input-shortcuts.js";

/** The glyphs this screen draws: Back (Cancel), the Filters button (Inspect, pad only), Choose heroes (Start, pad only) and the View hint. */
export type ScenarioHintKey = "back" | "filters" | "next" | "peek";

const SPEC: Readonly<
  Record<ScenarioHintKey, { ids: ShortcutId; padOnly: boolean; control: number; ground: "ink" | "paper" }>
> = {
  back: { ids: "cancel", padOnly: false, control: 44, ground: "ink" },
  filters: { ids: "inspect", padOnly: true, control: 44, ground: "paper" },
  next: { ids: "pause", padOnly: true, control: 52, ground: "ink" },
  peek: { ids: "peek", padOnly: true, control: 44, ground: "paper" },
};

export class ScenarioHints {
  #snapshot: InputHintsSnapshot | null = null;
  #signature = "";
  readonly #binding: InputHints;

  /** `onChange` redraws the screen when what a glyph shows changed (a new device, a setting), not on every mouse move. */
  constructor(scene: Phaser.Scene, onChange: () => void) {
    this.#binding = bindInputHints(scene, (snapshot) => {
      this.#snapshot = snapshot;
      const now = this.#signatureNow();
      if (now === this.#signature) return;
      this.#signature = now;
      onChange();
    });
  }

  dispose(): void {
    this.#binding.dispose();
  }

  /** Re-reads now (the focused part changed, a setting did). */
  refresh(): void {
    this.#binding.refresh();
  }

  #signatureNow(): string {
    const snapshot = this.#snapshot;
    if (!snapshot) return "";
    const { glyphSize, reducedMotion } = snapshot.settings;
    const parts = (Object.keys(SPEC) as ScenarioHintKey[]).map((key) => {
      const specs = this.#specsOf(key);
      return specs ? specsSignature(specs) : "";
    });
    return [glyphsExpanded(snapshot.state), glyphSize, reducedMotion, ...parts].join("|");
  }

  #specsOf(key: ScenarioHintKey): readonly GlyphSpec[] | null {
    const snapshot = this.#snapshot;
    if (!snapshot) return null;
    const set = glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource);
    const spec = SPEC[key];
    if (set === null || (spec.padOnly && set !== "pad")) return null;
    const specs = glyphsForShortcut(spec.ids, snapshot.state, snapshot.settings, null);
    return specs && specs.length > 0 ? specs : null;
  }

  /** The glyph for a control now, or null when there is none to show (touch only, or a pad-only hint on a keyboard). */
  glyph(key: ScenarioHintKey): HintGlyph | null {
    const snapshot = this.#snapshot;
    const specs = this.#specsOf(key);
    if (!snapshot || !specs) return null;
    return {
      specs: specs.map(uiSpecOf),
      height: scaledGlyphHeight(glyphHeightFor(SPEC[key].control), snapshot.settings.glyphSize),
      ground: SPEC[key].ground,
      expanded: glyphsExpanded(snapshot.state),
      still: snapshot.settings.reducedMotion,
    };
  }
}
