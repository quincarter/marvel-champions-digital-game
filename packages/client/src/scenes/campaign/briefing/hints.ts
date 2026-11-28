/**
 * The key and pad glyphs the Briefing buttons carry (`HintGlyph`, what `mc-hint-button` draws beside its word), made from the input
 * hints the scene is bound to (`ui/input-hints.ts`): nothing while only touch is in use, the keyboard or the pad own keys otherwise,
 * folded to a tab while the mouse moves. Back (Cancel), Open issue and a Confirm step (Start, pad only).
 */
import type Phaser from "phaser";
import type { HintGlyph } from "@mc/ui";
import { bindInputHints, type InputHints, type InputHintsSnapshot } from "../../../ui/input-hints.js";
import { glyphHeightFor, scaledGlyphHeight, specsSignature } from "../../../view/glyph-placement.js";
import { glyphsForShortcut, type GlyphSpec } from "../../../view/input-glyph-model.js";
import { glyphSetOf, glyphsExpanded } from "../../../view/input-mode.js";
import { uiSpecOf } from "../../../view/glyph-ui-spec.js";
import type { ShortcutId } from "../../../view/input-shortcuts.js";

export type BriefingHintKey = "back" | "open" | "confirm";

const SPEC: Readonly<Record<BriefingHintKey, { ids: ShortcutId; padOnly: boolean; control: number }>> = {
  back: { ids: "cancel", padOnly: false, control: 44 },
  open: { ids: "pause", padOnly: true, control: 62 },
  confirm: { ids: "pause", padOnly: true, control: 48 },
};

export class BriefingHints {
  #snapshot: InputHintsSnapshot | null = null;
  #signature = "";
  readonly #binding: InputHints;

  /** `onChange` builds the page again when what a glyph shows changed (a new device, a setting), not on every mouse move. */
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

  #signatureNow(): string {
    const snapshot = this.#snapshot;
    if (!snapshot) return "";
    const { glyphSize, reducedMotion } = snapshot.settings;
    const parts = (Object.keys(SPEC) as BriefingHintKey[]).map((key) => {
      const specs = this.#specsOf(key);
      return specs ? specsSignature(specs) : "";
    });
    return [glyphsExpanded(snapshot.state), glyphSize, reducedMotion, ...parts].join("|");
  }

  #specsOf(key: BriefingHintKey): readonly GlyphSpec[] | null {
    const snapshot = this.#snapshot;
    if (!snapshot) return null;
    const set = glyphSetOf(snapshot.state, snapshot.settings.inputGlyphs, snapshot.settings.glyphSource);
    const spec = SPEC[key];
    if (set === null || (spec.padOnly && set !== "pad")) return null;
    const specs = glyphsForShortcut(spec.ids, snapshot.state, snapshot.settings, null);
    return specs && specs.length > 0 ? specs : null;
  }

  /** The glyph for a control now, or null when there is none to show (touch only, or a pad-only hint on a keyboard). */
  glyph(key: BriefingHintKey): HintGlyph | null {
    const snapshot = this.#snapshot;
    const specs = this.#specsOf(key);
    if (!snapshot || !specs) return null;
    return {
      specs: specs.map(uiSpecOf),
      height: scaledGlyphHeight(glyphHeightFor(SPEC[key].control), snapshot.settings.glyphSize),
      ground: "ink",
      expanded: glyphsExpanded(snapshot.state),
      still: snapshot.settings.reducedMotion,
    };
  }
}
