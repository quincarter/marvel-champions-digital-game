import type { ControlGlyph } from "@mc/ui";

/** What the Mod Store's top bar says: the scene's view model fills it in. */
export interface ModStoreHeaderModel {
  /** The Back button's words ("◂ STORE", "◂ TITLE", "◂" on a phone). */
  backLabel: string;
  /** "Mod Store". */
  heading: string;
  /** The small caution tag after the title ("Beta"); empty for none. */
  badge: string;
  /** "3 installed"; empty while none is. */
  installedText: string;
  /** "About mods", or "!" on a phone. */
  aboutLabel: string;
  /** The Cancel glyph hung on Back, and the guide glyph on About (none on touch or a mouse). */
  backGlyph: ControlGlyph | undefined;
  aboutGlyph: ControlGlyph | undefined;
}
