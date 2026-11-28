/**
 * `@mc/ui/title`: just what the Title screen draws from this package, so the first screen does not load the settings,
 * credits, sheet and log components (`@mc/ui` registers all of them). Importing it defines the buttons, the press glyph
 * and the chrome icon button the Title elements are made of.
 */
export { McButton } from "../components/mc-button/mc-button.js";
export { McGlyph } from "../components/mc-glyph/mc-glyph.js";
export { McGlyphHint } from "../components/controls/mc-glyph-hint/mc-glyph-hint.js";
export { McHitArea } from "../components/controls/mc-hit-area/mc-hit-area.js";
export { McIconButton } from "../components/controls/mc-icon-button/mc-icon-button.js";
