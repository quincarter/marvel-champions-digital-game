/**
 * Take your seats' text search: the worker (`view/deck-search-client.ts`) ranks the decks for the typed words, and the
 * screen shows the last answer until the next one arrives. `ranking` is null when no search is active; `rankedFor` is the
 * text it answers (Random waits while the field holds another, `searchPending`, #916 review).
 */
import { deckDisplayName, identityLabelOf } from "../../view/deck-names.js";
import { POOL_VERSION, currentCardsById, currentHeroShelfPacks, packNameOf } from "../../content/pool.js";
import { testedEntryOf, testedSearchFieldsOf } from "../../view/community-decks-model.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { DeckSearchClient } from "../../view/deck-search-client.js";
import type { SearchDocument } from "../../view/deck-search.js";
import { heroPacksOf } from "../../view/hero-deck-groups.js";
import { seatSearchWordsOf } from "../../view/seat-search.js";
import { testedCatalog } from "../../view/seatable-decks.js";

/** What the search looks in for each deck: names first, then aspects, source, pack, author and tags, a write-up last. */
function searchDocumentOf(option: DeckOption, heroPack: string | undefined): SearchDocument {
  const deck = option.deck;
  const identity = currentCardsById().get(deck.identityCardId as string);
  const hero = identity?.type === "hero_identity" ? identity : undefined;
  const entry = testedEntryOf(deck, testedCatalog());
  const packs = heroPack
    ? [packNameOf(heroPack), currentHeroShelfPacks().find((p) => p.code === heroPack)?.cycleName]
    : [];
  return {
    id: deck.id as string,
    primary: [
      deck.name,
      deckDisplayName(deck),
      option.identityName,
      identityLabelOf(option),
      hero?.hero.faceName,
      hero?.alterEgo.faceName,
      entry?.heroName,
    ].filter((t): t is string => typeof t === "string"),
    secondary: [
      ...seatSearchWordsOf(deck.aspects, deck.source.kind, entry !== undefined),
      ...packs.filter((t): t is string => typeof t === "string"),
      ...testedSearchFieldsOf(deck, testedCatalog()),
      ...(entry?.tags ?? []),
    ],
    notes: entry ? [entry.description] : [],
  };
}

export class SeatsSearch {
  readonly #client = new DeckSearchClient();
  #docsFor: readonly DeckOption[] | null = null;
  ranking: ReadonlyMap<string, number> | null = null;
  rankedFor: string | null = null;

  /** `again` redraws the screen; `alive` says whether the scene still takes an answer. */
  constructor(
    private readonly again: () => void,
    private readonly alive: () => boolean,
  ) {}

  /** Hands the worker the deck list when it has changed, and re-asks the open query of the new list. */
  sync(deckOptions: readonly DeckOption[], text: string): void {
    if (this.#docsFor === deckOptions) return;
    this.#docsFor = deckOptions;
    const heroPacks = heroPacksOf(
      deckOptions,
      (option) => option.deck.identityCardId as string,
      (option) => (option.deck.source.kind === "precon" ? (option.deck.source.packCode as string) : null),
    );
    const documents = deckOptions.map((option) =>
      searchDocumentOf(option, heroPacks.get(option.deck.identityCardId as string)),
    );
    this.#client.setDocuments(documents, POOL_VERSION + ":" + deckOptions.map((o) => o.deck.id as string).join("|"));
    // After this redraw, not inside it: the answer redraws again.
    if (text.trim() !== "") queueMicrotask(() => this.alive() && this.request(text));
  }

  /** Asks the worker to rank the decks for the text; an empty text clears the search at once. */
  request(text: string): void {
    if (text.trim() === "") {
      this.clear();
      this.again();
      return;
    }
    this.#client.search(text, (ranked) => {
      if (!this.alive()) return;
      this.ranking = new Map(ranked.map((r) => [r.id, r.score]));
      this.rankedFor = text;
      this.again();
    });
  }

  /** No search: drops the answer without redrawing. */
  clear(): void {
    this.#client.cancel();
    this.ranking = null;
    this.rankedFor = null;
  }

  destroy(): void {
    this.#client.destroy();
  }
}
