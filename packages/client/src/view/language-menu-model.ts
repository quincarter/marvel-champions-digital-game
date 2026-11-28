/**
 * What the card language pop-up (`scenes/language-popup.ts`) hands its `mc-language-menu` element: the dropdown's rows
 * and where it hangs, or the native install's "Other languages" note, every word in the app's language. Pure.
 */
import type { LanguageMenuModel } from "@mc/ui";
import { CARD_LANGUAGE_NAMES, availableCardLanguages, type CardLanguage } from "../art/card-language.js";
import { t } from "../i18n/translate.js";
import { hit } from "../tokens.js";
import { formFactorFor, type Rect } from "./layout.js";
import {
  languageMenuLayout,
  languageRowLabel,
  otherLanguagesParagraphs,
  type LanguagePopupMode,
} from "./language-button.js";

/** The dim over the screen: light for the dropdown, heavy for the note. */
const LIST_SCRIM = 0.25;
const NOTE_SCRIM = 0.72;

export function languageMenuModelOf(
  mode: LanguagePopupMode,
  anchor: Rect,
  screen: { readonly width: number; readonly height: number },
  current: CardLanguage,
  languages: readonly CardLanguage[] = availableCardLanguages(),
): LanguageMenuModel {
  const form = formFactorFor(screen.width, screen.height);
  const phone = form === "phone" || form === "phoneLandscape";
  if (mode === "menu") {
    const labelWidth = Math.max(...languages.map((language) => CARD_LANGUAGE_NAMES[language].length)) * 10;
    const { box } = languageMenuLayout(anchor, languages.length, screen, hit.target, labelWidth);
    return {
      mode: "list",
      scrim: LIST_SCRIM,
      box,
      rowHeight: hit.target,
      rows: languages.map((language) => ({
        key: language,
        label: languageRowLabel(language, current),
        kind: "onInk",
        selected: language === current,
      })),
      note: null,
      phone,
    };
  }
  return {
    mode: "note",
    scrim: NOTE_SCRIM,
    box: { x: 0, y: 0, width: 0, height: 0 },
    rowHeight: hit.target,
    rows: [],
    phone,
    note: {
      title: t("language.info.title"),
      paragraphs: otherLanguagesParagraphs(current),
      links: [
        { key: "downloads", label: t("language.info.downloads"), kind: "primary" },
        { key: "web", label: t("language.info.web"), kind: "secondary" },
      ],
      close: { key: "close", label: "✕", kind: "quiet" },
    },
  };
}
