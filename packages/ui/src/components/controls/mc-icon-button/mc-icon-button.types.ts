import type { ControlGlyph } from "../../../shared/popup.types.js";

/** The pictures an icon button draws. */
export type McIconName = "globe" | "bug" | "note" | "moon" | "sun" | "store" | "discord";

/** The properties of `mc-icon-button`, besides the press ones (`data-stop`, `action`, `holdAction`) every pressable control takes. */
export interface McIconButtonProps {
  readonly icon: McIconName;
  /** Short words beside the picture ("ES" beside the globe). */
  readonly label: string;
  /** What assistive tech and the mouse tooltip say. */
  readonly name: string;
  /** Lit like a hovered button while the thing it opens is open. */
  readonly lit: boolean;
  /** A count hung on the top right corner ("3"). */
  readonly badge: string;
  /** The key or pad glyph hung under it while it has focus. */
  readonly glyph: ControlGlyph | null;
}
