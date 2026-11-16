/**
 * The Decks screen's three lists (issue #755): the preconstructed decks, the player's own ("Your decks": built and
 * imported) and the community decks. Which of them it opens on is a setting; the precons can be hidden from it.
 * Pure: the scene draws, this decides. Hiding precons covers the Decks screen's browse list only, never Take your
 * seats, which must always have a deck to pick.
 */
import type { DeckListOnOpen } from "../settings.js";

export type DeckListId = "precon" | "build" | "community";

export const DECK_LIST_IDS: readonly DeckListId[] = ["precon", "build", "community"];

/** The list left open last, kept apart from the settings record: it changes on every tap, not by the player's choice of a setting. */
export const DECK_LIST_LAST_KEY = "mc-deck-list-last";

/**
 * The one list to open on, or null for every list together. Last used reads `last` (a list never left open is all).
 * Preconstructed while the precons are hidden opens on all, so the screen never opens on a list that is not there.
 */
export function openingDeckList(
  setting: DeckListOnOpen,
  last: DeckListId | null,
  showPrecon: boolean,
): DeckListId | null {
  const wanted: DeckListId | null = setting === "all" ? null : setting === "last" ? last : setting;
  return wanted === "precon" && !showPrecon ? null : wanted;
}

/**
 * The list state a visit to the Decks screen starts with. A scene instance is reused between visits, so `create()`
 * sets every field from this, the pin included: a tap on a list chip in an earlier visit un-pins the requested deck,
 * and that must not carry into the next visit's `focusDeckId` (Codex on #778). A deck asked for by id opens on every
 * list and is pinned; otherwise the setting decides the list.
 */
export function freshDeckVisit(
  focusDeckId: string | null | undefined,
  setting: DeckListOnOpen,
  last: DeckListId | null,
  showPrecon: boolean,
): { readonly deckList: DeckListId | null; readonly focusPinned: boolean; readonly fallbackSelection: boolean } {
  return {
    deckList: focusDeckId ? null : openingDeckList(setting, last, showPrecon),
    focusPinned: true,
    fallbackSelection: false,
  };
}

/** Is `group` drawn while `list` (null: all) is the one chosen, and the precons shown or hidden? */
export function deckListShows(group: DeckListId, list: DeckListId | null, showPrecon: boolean): boolean {
  if (group === "precon" && !showPrecon) return false;
  return list === null || list === group;
}

/** The list chips, left to right: Preconstructed leaves when hidden. */
export function deckListChips(showPrecon: boolean): readonly { readonly id: DeckListId; readonly text: string }[] {
  return [
    ...(showPrecon ? [{ id: "precon" as const, text: "Preconstructed" }] : []),
    { id: "build" as const, text: "Your decks" },
    { id: "community" as const, text: "Community" },
  ];
}

/** A chip tapped: its list opens alone, and tapping the open one goes back to all. */
export function nextDeckList(current: DeckListId | null, tapped: DeckListId): DeckListId | null {
  return current === tapped ? null : tapped;
}

type ListStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): ListStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The stored last list; anything unknown, or nothing, is null (all). */
export function readLastDeckList(storage: ListStorage | null = browserStorage()): DeckListId | null {
  try {
    const raw = storage?.getItem(DECK_LIST_LAST_KEY) ?? null;
    return DECK_LIST_IDS.find((id) => id === raw) ?? null;
  } catch {
    return null;
  }
}

/** Remembers the list now open (null: all). Storage that refuses the write is no error: it holds for this visit. */
export function writeLastDeckList(list: DeckListId | null, storage: ListStorage | null = browserStorage()): void {
  try {
    storage?.setItem(DECK_LIST_LAST_KEY, list ?? "all");
  } catch {
    // Private mode or a full quota.
  }
}

/**
 * Which deck stays selected once the list shown changes or the rows rebuild (Codex on #778). The selection stays only
 * while it is on the displayed list (or is `pinnedId`, a deck asked for by id, which opens on every list); otherwise
 * the first displayed deck is selected, or nothing when the list is empty, so the details pane and the deck actions
 * never target a deck that is not drawn. `options` are all known decks in display order, with the list group each is in.
 */
export function reconcileDeckSelection(
  selectedId: string | null,
  options: readonly { readonly id: string; readonly group: DeckListId }[],
  list: DeckListId | null,
  showPrecon: boolean,
  pinnedId: string | null = null,
): string | null {
  const shown = (o: { readonly group: DeckListId }): boolean => deckListShows(o.group, list, showPrecon);
  const current = options.find((o) => o.id === selectedId);
  if (current && (shown(current) || current.id === pinnedId)) return current.id;
  return options.find(shown)?.id ?? null;
}

/** The list group a deck belongs to: one rule for the rows drawn and for the selection, so they cannot disagree. */
export function deckListGroupOf(isPrecon: boolean, isCommunity: boolean): DeckListId {
  return isPrecon ? "precon" : isCommunity ? "community" : "build";
}

/** The ids the chosen list displays, in display order (precons, own, community). */
export function displayedDeckIds(
  options: readonly { readonly id: string; readonly group: DeckListId }[],
  list: DeckListId | null,
  showPrecon: boolean,
): readonly string[] {
  return DECK_LIST_IDS.flatMap((group) =>
    options.filter((o) => o.group === group && deckListShows(group, list, showPrecon)).map((o) => o.id),
  );
}
