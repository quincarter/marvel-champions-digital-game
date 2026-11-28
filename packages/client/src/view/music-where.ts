/**
 * Where a song plays, in the player's language. The jukebox builds each song's `where` in English
 * (`progression/extras.ts`: "Battle · Absorbing Man · Victory · Core Set"); the music player reads it back through
 * this, which turns the fixed words ("Battle", "Victory", "Title screen", ...) into the current language and leaves
 * the villain, campaign and pack names as they are.
 */
import { t, type MessageKey } from "../i18n/translate.js";
import type { CardLanguage } from "../art/card-language.js";

const WORDS: ReadonlyMap<string, MessageKey> = new Map([
  ["Title screen", "music.where.title"],
  ["Any battle", "music.where.anyBattle"],
  ["Battle", "music.where.battle"],
  ["Victory", "music.where.victory"],
  ["Defeat", "music.where.defeat"],
  ["Interlude", "music.where.interlude"],
  ["Finale", "music.where.finale"],
  ["Any victory", "music.where.anyVictory"],
  ["Any defeat", "music.where.anyDefeat"],
]);

/** `where` with its fixed English words in `lang` (the current language by default). */
export function localizedWhere(where: string, lang?: CardLanguage): string {
  return where
    .split(" · ")
    .map((part) => {
      const key = WORDS.get(part);
      return key ? t(key, undefined, lang) : part;
    })
    .join(" · ");
}
