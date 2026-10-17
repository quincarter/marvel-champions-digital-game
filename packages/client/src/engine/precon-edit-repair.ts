/**
 * Issue #217: before the fix, the deck builder saved an "edited" precon under the precon's own id and `precon` source.
 * Such a deck shadowed its precon (both rows selected together on Decks, both seated by one tap) and played as the
 * published list, never with its edits. `RepairingDeckStorage` repairs those records the first time the stored decks
 * are listed: each is rewritten as the player's own deck (`repair`, `view/deck-builder-model.ts`'s
 * `repairedStoredDeck`) under a fresh id, or removed when it was identical to its precon. Every other call passes
 * straight through.
 */
import type { Deck, DeckId } from "@mc/content";
import type { DeckStorage } from "./deck-storage.js";

/** What a stored deck becomes: itself (nothing to repair), a replacement under a new id, or `null` (remove it). */
export type StoredDeckRepair = (deck: Deck) => Deck | null;

export class RepairingDeckStorage implements DeckStorage {
  readonly #inner: DeckStorage;
  readonly #repair: StoredDeckRepair;
  #repaired: Promise<void> | null = null;

  constructor(inner: DeckStorage, repair: StoredDeckRepair) {
    this.#inner = inner;
    this.#repair = repair;
  }

  put(deck: Deck): Promise<void> {
    return this.#inner.put(deck);
  }

  get(id: DeckId): Promise<Deck | null> {
    return this.#inner.get(id);
  }

  remove(id: DeckId): Promise<void> {
    return this.#inner.remove(id);
  }

  async list(): Promise<readonly Deck[]> {
    // A failed repair is retried on the next list rather than remembered as done.
    this.#repaired ??= this.#repairAll().catch((error: unknown) => {
      this.#repaired = null;
      throw error;
    });
    await this.#repaired;
    return this.#inner.list();
  }

  async #repairAll(): Promise<void> {
    for (const deck of await this.#inner.list()) {
      const repaired = this.#repair(deck);
      if (repaired === deck) continue;
      // The replacement is written before the old record goes, so a failure between the two never loses the deck.
      if (repaired) await this.#inner.put(repaired);
      await this.#inner.remove(deck.id);
    }
  }
}
