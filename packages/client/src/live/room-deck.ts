/**
 * Decks in a room (Quin, 2026-11-20: each player brings their own hero and deck), as plain data and pure functions:
 * a player's `Deck` becomes the `RoomDeck` the room carries, a `RoomDeck` becomes a seat of the host's game, and the host
 * judges every seat's deck before Start. The judging takes the card pool as an argument (the app's pool in the worker
 * that runs it, a small one in tests), and nothing here touches a socket, the main thread's stores or `appSession`.
 *
 * The room never reads a deck. Only this check does, on the host's device, against the host's own pool: a guest's
 * claim that a deck is legal is never trusted.
 */
import { isNotReadyCard, type CorePlayer } from "@mc/cards";
import { cardId, type AnyCard, type CoreAspect, type Deck, type DeckContents } from "@mc/content";
import { validateDeck } from "@mc/engine";
import type { DeckRefusalCode, LobbyMod, RoomDeck } from "@mc/sync-worker/room-protocol";
import { MAX_SEAT_DECK_BYTES } from "@mc/sync-worker/room-protocol";
import { poolWithPacks, withRequiredPacks, type PackRuntime } from "../packs/pack-runtime.js";

const clip = (text: string, max: number): string => {
  const points = [...text.trim()];
  return points.length <= max ? points.join("") : points.slice(0, max).join("");
};

/**
 * A saved, imported or precon deck as the room carries it, or null when the list would be over the room's size cap (a
 * deck that large is not a deck). `heroName` is the identity's display name (the lobby shows it without a pool);
 * `packs` are this device's loaded custom packs, which say which ones the deck's hero and cards come from.
 */
export function roomDeckOf(deck: Deck, heroName: string, packs: readonly PackRuntime[]): RoomDeck | null {
  const identity = deck.identityCardId as string;
  const lines = new Map<string, number>();
  for (const { cardId, quantity } of deck.cards) {
    lines.set(cardId as string, (lines.get(cardId as string) ?? 0) + quantity);
  }
  const used = new Set([identity, ...lines.keys()]);
  const mods: LobbyMod[] = packs
    .filter((pack) => pack.cards.some((card) => used.has(card.id as string)))
    .map((pack) => ({ id: pack.id, version: pack.version }));
  const result: RoomDeck = {
    name: clip(deck.name, 80) || "Deck",
    hero: identity,
    heroName: clip(heroName, 80) || identity,
    aspects: deck.aspects.map((a) => a as string),
    cards: [...lines].map(([cardId, quantity]) => ({ cardId, quantity })),
    mods,
  };
  return new TextEncoder().encode(JSON.stringify(result)).length > MAX_SEAT_DECK_BYTES ? null : result;
}

/** A room deck as a seat of the host's game: the same explicit list a saved deck becomes (`corePlayerFromDeck`). */
export function playerOfRoomDeck(deck: RoomDeck): CorePlayer {
  return {
    identityCardId: deck.hero,
    deck: deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
    aspects: deck.aspects as readonly CoreAspect[],
    deckName: deck.name,
  };
}

/** The verdict on one seat's deck. */
export type SeatDeckVerdict =
  | { readonly seat: string; readonly ok: true }
  | { readonly seat: string; readonly ok: false; readonly code: DeckRefusalCode; readonly reason: string };

export interface RoomDeckCheckInput {
  /** The seats in table order, each with its deck, or null when no one has chosen one. */
  readonly seats: readonly { readonly seat: string; readonly deck: RoomDeck | null }[];
  /** The mods the host allowed for the table (`LobbySettings.mods`), by id and version. */
  readonly allowed: readonly LobbyMod[];
  /** The custom packs loaded on the host's device. */
  readonly loaded: readonly PackRuntime[];
  /** The base game's cards (the host's `POOL_CARDS`). */
  readonly basePool: readonly AnyCard[];
}

const list = (items: readonly string[], max = 3): string =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} and ${items.length - max} more`;

/**
 * Judges every seat's deck against the host's pool: legal under `validateDeck` (RRG 1.8 Appendix I), every card known in
 * the host's pool, and mod cards only from a mod the host allowed, installed at the same version as the deck's own.
 * One verdict per seat, in the order given. A refused deck's `reason` is the sentence for that seat's holder alone.
 */
export function checkRoomDecks(input: RoomDeckCheckInput): readonly SeatDeckVerdict[] {
  const { allowed, loaded } = input;
  // Cards from a mod the host did not allow are not in the pool at all, so they read as unknown. A deck that declares
  // such a mod is told so first, in plainer words (below).
  const allowedPacks = loaded.filter((pack) => allowed.some((m) => m.id === pack.id && m.version === pack.version));
  let pool: readonly AnyCard[] | null = null;
  let poolError: string | null = null;
  try {
    pool = poolWithPacks(input.basePool, withRequiredPacks(allowedPacks, loaded), false);
  } catch (cause) {
    poolError = cause instanceof Error ? cause.message : "the allowed custom packs conflict";
  }
  const known = pool ? new Set(pool.map((card) => card.id as string)) : new Set<string>();

  return input.seats.map(({ seat, deck }): SeatDeckVerdict => {
    const refuse = (code: DeckRefusalCode, reason: string): SeatDeckVerdict => ({ seat, ok: false, code, reason });
    if (!deck) return refuse("no-deck", "No deck has been chosen for this seat.");
    for (const ref of deck.mods) {
      const installed = loaded.find((pack) => pack.id === ref.id);
      if (!installed) return refuse("mod-missing", `The host does not have the custom pack "${ref.id}" installed.`);
      if (installed.version !== ref.version) {
        return refuse(
          "mod-version",
          `Your deck uses custom pack "${ref.id}" version ${ref.version}; the host has version ${installed.version}.`,
        );
      }
      if (!allowed.some((m) => m.id === ref.id)) {
        return refuse("mod-not-allowed", `The host has not allowed the custom pack "${ref.id}" for this table.`);
      }
    }
    if (!pool) return refuse("illegal", `The host's custom packs cannot be combined: ${poolError}.`);
    const unknown = [deck.hero, ...deck.cards.map((c) => c.cardId)].filter((id) => !known.has(id));
    if (unknown.length > 0) {
      return refuse("unknown-card", `The host's game does not know ${list([...new Set(unknown)])}.`);
    }
    // The picker never seats a hero whose pack is not finished, whatever the deck's legality (`leadsNotReadyHero`).
    const identity = pool.find((card) => (card.id as string) === deck.hero);
    if (identity && isNotReadyCard(identity)) return refuse("illegal", "This hero's pack is not ready yet.");
    const contents: DeckContents = {
      identityCardId: cardId(deck.hero),
      aspects: deck.aspects as readonly CoreAspect[],
      cards: deck.cards.map((line) => ({ cardId: cardId(line.cardId), quantity: line.quantity })),
    };
    const verdict = validateDeck(contents, pool);
    if (!verdict.ok) {
      const messages = verdict.problems.map((p) => p.message);
      return refuse("illegal", list(messages, 2));
    }
    return { seat, ok: true };
  });
}
