/**
 * Where decks live between visits: precons need no storage (they're derived
 * from `CORE_STARTER_DECKS` fresh every time — see `view/deck-list-model.ts`),
 * but an imported or user-built `Deck` has to survive a refresh.
 *
 * A **separate database** from `mc-saves` (`game-storage.ts`), on purpose:
 * PLAN.md's boundary here is "a versioned store that cannot break `mc-saves`
 * resume", and the cheapest way to guarantee that is to never open the same
 * database at all. `mc-saves` resume replays a log against this build's
 * engine; nothing about that path touches, or should be able to touch, deck
 * storage.
 *
 * **Surviving a card-pool update.** A `Deck` records the pool version it was
 * built against (`Deck.poolVersion`, `@mc/content`). This module stores decks
 * exactly as given — it does not re-validate or rewrite them — so "does this
 * deck's pool version match today's pool" and "is it still legal" are read
 * questions for the caller (`view/deck-list-model.ts`, which calls
 * `validateDeck`), asked fresh every time a deck is shown rather than baked in
 * at save time. That's what keeps a pool update from silently changing a
 * saved deck: nothing here ever overwrites `poolVersion` or `cards` on read.
 *
 * Two implementations share one contract test, the same shape as
 * `game-storage.test.ts`: `MemoryDeckStorage` for Vitest and the default
 * in-app store, `IdbDeckStorage` for the browser.
 */
import type { Deck, DeckId } from "@mc/content";

export interface DeckStorage {
  /** Inserts or overwrites a deck by id (an edit in the builder is a `put`, not a new row). */
  put(deck: Deck): Promise<void>;
  get(id: DeckId): Promise<Deck | null>;
  /** Every saved deck (imported and user-built; precons are never stored here). Most recently touched first is the caller's job — this returns storage order. */
  list(): Promise<readonly Deck[]>;
  remove(id: DeckId): Promise<void>;
}

/**
 * The in-memory store. Values pass through `structuredClone` on the way in
 * and out, exactly as IndexedDB does, so a test can't pass by accident on a
 * shared reference the real storage would never hand back.
 */
export class MemoryDeckStorage implements DeckStorage {
  readonly #decks = new Map<string, Deck>();

  async put(deck: Deck): Promise<void> {
    this.#decks.set(deck.id as string, structuredClone(deck));
  }

  async get(id: DeckId): Promise<Deck | null> {
    const found = this.#decks.get(id as string);
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<readonly Deck[]> {
    return structuredClone([...this.#decks.values()]);
  }

  async remove(id: DeckId): Promise<void> {
    this.#decks.delete(id as string);
  }
}
