import type { ControlGlyph } from "@mc/ui";

/** Which layout the screen is in: the wide one, or a phone's (a shorter bar, a "!" for About mods, no BETA tag). */
export type ModStoreSize = "wide" | "phone";

export interface McModStoreHeaderProps {
  size: ModStoreSize;
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
