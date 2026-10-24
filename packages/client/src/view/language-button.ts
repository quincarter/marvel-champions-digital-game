/**
 * The card language button (#337, `scenes/language-button.ts`) and what it opens (`scenes/language-popup.ts`): the
 * pure parts. The button is a globe and the language's code ("EN", "ES"), never a national flag: a flag names a
 * country, not a language. It sits in the top bar just left of the music button, on every screen that leaves the music
 * button a slot.
 *
 * On the web, where the bundle carries every language, a tap opens a list to pick from. In a native installer, which
 * carries one language, a tap opens "Other languages" instead: why each language is its own download, and where to get
 * the others.
 */
import { CARD_LANGUAGES, CARD_LANGUAGE_NAMES, type CardLanguage } from "../art/card-language.js";
import type { Rect } from "./layout.js";

/** The downloads page, whose files carry the language in their names (`MarvelChampions-1.2.3-ES-Android.apk`). */
export const DOWNLOADS_URL = "https://github.com/quincarter/marvel-champions-digital-game/releases/latest";
/** The production web version, which carries every language. */
export const WEB_VERSION_URL = "https://marvel-champions-digital-game.netlify.app/";

/** "EN", "ES": what the button says beside its globe. */
export function languageCodeOf(language: CardLanguage): string {
  return language.toUpperCase();
}

/** The button's width: a globe and two letters, a little narrower on a phone's crowded bar. */
export function languageButtonWidth(musicSlot: Rect): number {
  return musicSlot.width >= 44 ? 58 : 52;
}

/** The language button's slot: the music button's height, just left of it. */
export function languageSlotBeside(music: Rect, gap = 8): Rect {
  const width = languageButtonWidth(music);
  return { x: music.x - gap - width, y: music.y, width, height: music.height };
}

export type LanguagePopupMode = "menu" | "info";

/**
 * What a tap on the button opens: the list when this bundle carries more than one language on the web, else the
 * "Other languages" note. `forceInfo` is the dev-only `?nativelang` link, to look at the native note in a browser.
 */
export function languagePopupMode(carried: number, native: boolean, forceInfo = false): LanguagePopupMode {
  return !forceInfo && !native && carried > 1 ? "menu" : "info";
}

export interface LanguageMenuLayout {
  readonly box: Rect;
  /** One row per language, in order. */
  readonly rows: readonly Rect[];
}

export const LANGUAGE_MENU_PAD = 6;

/**
 * The dropdown: under the button, its right edge on the button's, kept on screen, wide enough for its widest name
 * (`labelWidth`) and the button itself.
 */
export function languageMenuLayout(
  button: Rect,
  count: number,
  screen: { readonly width: number; readonly height: number },
  rowHeight: number,
  labelWidth: number,
): LanguageMenuLayout {
  const width = Math.min(screen.width - 16, Math.max(button.width + 40, labelWidth + 56));
  const height = count * rowHeight + (count + 1) * LANGUAGE_MENU_PAD;
  const x = Math.max(8, Math.min(button.x + button.width - width, screen.width - 8 - width));
  const y = Math.min(button.y + button.height + 4, Math.max(8, screen.height - 8 - height));
  const rows: Rect[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      x: x + LANGUAGE_MENU_PAD,
      y: y + LANGUAGE_MENU_PAD + i * (rowHeight + LANGUAGE_MENU_PAD),
      width: width - LANGUAGE_MENU_PAD * 2,
      height: rowHeight,
    });
  }
  return { box: { x, y, width, height }, rows };
}

/** A row of the list: the language's own name, with the current one marked in words and shape, not colour. */
export function languageRowLabel(language: CardLanguage, current: CardLanguage): string {
  return language === current ? `✓ ${CARD_LANGUAGE_NAMES[language]}` : CARD_LANGUAGE_NAMES[language];
}

/** "English and Español" / "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The "Other languages" note's paragraphs, for the language this install carries. */
export function otherLanguagesParagraphs(current: CardLanguage): readonly string[] {
  const all = joinNames(CARD_LANGUAGES.map((language) => CARD_LANGUAGE_NAMES[language]));
  const tags = joinNames(CARD_LANGUAGES.map((language) => `-${language.toUpperCase()}-`)).replace(" and ", " or ");
  return [
    `Card art comes in ${all}. This install's card art is in ${CARD_LANGUAGE_NAMES[current]}.`,
    `Each language is its own download: the app carries all of its card art inside it, and GitHub limits each download to 2 GB, so ${all} cannot share one installer.`,
    "Installing another language's download replaces this app and keeps your saves.",
    `On the downloads page, pick the file with ${tags} in its name. The browser version has every language.`,
  ];
}
