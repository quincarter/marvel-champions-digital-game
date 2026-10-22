/**
 * The deck building feats an achievement reads (the owner, 2026-10-21): a deck built and saved, a saved deck changed
 * and saved again, and a game started with a deck the player built. Saved decks can be deleted and a game's save does
 * not say which deck a seat came from, so each is noted once, when it happens, and kept ("ever"), like "Unlock
 * everything" (`progression.ts`).
 */
import { notifySaveDataChanged } from "../sync/save-data-changed.js";

export interface DeckFeats {
  /** A new deck was saved from the deck builder. */
  readonly built: boolean;
  /** A deck already in your decks was changed and saved again. */
  readonly edited: boolean;
  /** A game was dealt with a deck the player built in a seat. */
  readonly playedBuilt: boolean;
}

export const NO_DECK_FEATS: DeckFeats = { built: false, edited: false, playedBuilt: false };

const KEY = "mc-deck-feats";

/** What has been noted so far; all false when storage is unreadable. */
export function readDeckFeats(): DeckFeats {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return NO_DECK_FEATS;
    const record = parsed as Record<string, unknown>;
    return {
      built: record.built === true,
      edited: record.edited === true,
      playedBuilt: record.playedBuilt === true,
    };
  } catch {
    return NO_DECK_FEATS;
  }
}

/** Notes a feat for good. True when it was new. */
export function noteDeckFeat(feat: keyof DeckFeats): boolean {
  const feats = readDeckFeats();
  if (feats[feat]) return false;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...feats, [feat]: true }));
    notifySaveDataChanged("progress");
  } catch {
    // Private mode or a full quota: the feat is noted again the next time it happens.
  }
  return true;
}
