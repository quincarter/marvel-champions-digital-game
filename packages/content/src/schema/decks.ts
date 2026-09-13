import type { CoreAspect } from "./aspects.js";
import { deckId, type CardId, type DeckId, type SetCode, type StarterDeckId } from "./ids.js";
import type { StarterDeck } from "./sets.js";

/**
 * A player deck as plain, serializable data: *what* the deck is, kept apart from
 * *where it came from* (`source`).
 *
 * This type says nothing about legality. A `Deck` may be illegal: saved, edited and
 * shown, but not seated. Whether it is legal is a rules question, answered by the engine
 * (`validateDeck` in `@mc/engine`). Whether this build can play it is a separate question,
 * answered by `unscriptedCards`.
 */
export interface Deck {
  readonly id: DeckId;
  readonly name: string;
  readonly identityCardId: CardId;
  /**
   * The aspect(s) chosen for customization. A list because some identities' deckbuilding
   * requirements choose more than one (see `IdentityDeckbuilding.aspectCount`). Typed as
   * `CoreAspect` rather than a narrower union because imported data is untrusted: an
   * impossible choice such as `"basic"` must reach the validator and be reported, not be
   * silently dropped when the deck is loaded.
   */
  readonly aspects: readonly CoreAspect[];
  /**
   * Every card in the deck, including the identity's signature cards. The identity card itself is excluded (as in
   * `StarterDeck.cards`), and so are the cards of the identity's separate decks (`HeroIdentityCard.separateDecks`,
   * Doctor Strange's Invocation deck): they are not part of the player deck and are built at setup.
   */
  readonly cards: readonly DeckCardEntry[];
  /**
   * The card-pool version this deck was built against. Opaque here: the content pipeline
   * owns how the string is produced. It lets a client notice that errata or a pool update
   * landed under a saved deck, so it can re-validate the deck instead of changing it silently.
   */
  readonly poolVersion: string;
  readonly source: DeckSource;
}

/** One line of a decklist. `cardId` is the MarvelCDB card code (see `decks.test.ts`). */
export interface DeckCardEntry {
  readonly cardId: CardId;
  readonly quantity: number;
}

/** The part of a deck that legality depends on. `validateDeck` takes only this, so provenance can never change a verdict. */
export type DeckContents = Pick<Deck, "identityCardId" | "aspects" | "cards">;

/**
 * Where a deck came from. Timestamps are ISO 8601 strings, supplied by the caller, so the
 * data stays serializable and nothing here reads a clock.
 */
export type DeckSource =
  /** An official pre-built deck, published as a `StarterDeck` record. */
  | { readonly kind: "precon"; readonly packCode: SetCode; readonly starterDeckId: StarterDeckId }
  /**
   * Imported from MarvelCDB. Both references are nullable: a pasted decklist has neither a
   * deck id nor a URL, but it is still an import rather than something the player built.
   */
  | {
      readonly kind: "imported";
      readonly site: "marvelcdb";
      readonly marvelcdbDeckId: string | null;
      readonly url: string | null;
      readonly importedAt: string;
    }
  | { readonly kind: "userBuilt"; readonly createdAt: string };

/** A precon is the precon case of the general deck type. The id is derived from the starter deck id, so it is stable across loads. */
export function deckFromStarterDeck(starter: StarterDeck, poolVersion: string): Deck {
  return {
    id: deckId(`precon:${starter.id}`),
    name: starter.name,
    identityCardId: starter.identityCardId,
    aspects: [...starter.aspects],
    cards: starter.cards.map(({ cardId, quantity }) => ({ cardId, quantity })),
    poolVersion,
    source: { kind: "precon", packCode: starter.packCode, starterDeckId: starter.id },
  };
}
