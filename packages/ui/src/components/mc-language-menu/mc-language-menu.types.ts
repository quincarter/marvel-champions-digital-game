import type { SheetRect } from "../../shared/sheet.types.js";
import type { PopupButton } from "../../shared/popup.types.js";

/** The card language list (a dropdown under the language button), or the native install's "Other languages" note. */
export interface LanguageMenuModel {
  readonly mode: "list" | "note";
  /** The dim over the screen, 0 to 1. */
  readonly scrim: number;
  /** List: where the dropdown sits, in the panel's coordinates. */
  readonly box: SheetRect;
  readonly rowHeight: number;
  /** List: one row per language, the current one marked. */
  readonly rows: readonly PopupButton[];
  /** Note: its words and links. */
  readonly note: LanguageNote | null;
  readonly phone: boolean;
}

export interface LanguageNote {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly links: readonly PopupButton[];
  readonly close: PopupButton;
}
