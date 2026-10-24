/**
 * The guide's "how to reach these buttons" line, naming the key or button for the input in use
 * (`docs/controller-support.md`, decision 5): "Press G to use these buttons." on a keyboard, "Press X ..." on a pad.
 * The line lives inside the guide panel's and tip toast's own text slots, so it names the key in words (the glyph's
 * own label) rather than drawing a cap there. Before any input, both are named, as the line always did.
 */

import { glyphsForShortcut } from "./input-glyph-model.js";
import type { InputModeState } from "./input-mode.js";
import type { GlyphSettings } from "./input-glyph-model.js";

const FALLBACK = "Press G (or X on a gamepad) to use these buttons.";

export function guideHintText(state: InputModeState, settings: GlyphSettings): string {
  if (state.mode !== "keyboard" && state.mode !== "pad") return FALLBACK;
  // The setting only hides drawn glyphs; the sentence still has to name the key.
  const specs = glyphsForShortcut("guide", state, { ...settings, inputGlyphs: true });
  const label = specs?.map((spec) => spec.label).join(" + ");
  return label ? `Press ${label} to use these buttons.` : FALLBACK;
}
