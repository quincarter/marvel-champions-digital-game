/**
 * The card pool's text search, shared by the deck builder and the Decks screen: the smart filter's `field:value` terms
 * (`pool-query.ts`, #531: `o:2`, `a:justice`, `t:event`, `kw:guard`) narrow the pool on this side, and the free words
 * are ranked off the main thread by the fuzzy, accent-free search worker (`deck-search-client.ts`).
 *
 * `CardPoolSearch` holds the worker client and the newest ranking. A screen gives it the documents the worker ranks
 * (`documents`: the cards the pool offers, with their version) and is told when the ranking changes (`onChange`).
 */
import type { AnyCard } from "@mc/content";
import type { CardLanguage } from "../art/card-language.js";
import { DeckSearchClient } from "./deck-search-client.js";
import type { SearchDocument } from "./deck-search.js";
import { cardNamesReady, loadCardNames, localizedNameOf } from "./card-names.js";
import { cardSearchDocumentOf } from "./card-search-document.js";
import type { PoolFilter } from "./deck-builder-model.js";
import { parsePoolQuery } from "./pool-query.js";

/** `filter` plus the search's `field:value` terms as clauses the pool applies; the worker answers the free words. */
export function withSearchClauses(filter: PoolFilter, search: string): PoolFilter {
  const clauses = parsePoolQuery(search).clauses;
  return clauses.length > 0 ? { ...filter, clauses } : filter;
}

/** The free words of a search, for the search worker; its `field:value` terms filter without it. */
export const freeTextOf = (text: string): string => parsePoolQuery(text).text.trim();

/** The documents the worker ranks for `cards` in `lang`: each card's names, traits, type and rules text. */
export function poolSearchDocuments(
  cards: readonly AnyCard[],
  lang: CardLanguage,
  packName: (setCode: string) => string | undefined,
  cache?: Map<string, SearchDocument>,
): readonly SearchDocument[] {
  return cards.map((card) => {
    const id = card.id as string;
    const key = `${id}:${lang}`;
    const cached = cache?.get(key);
    if (cached) return cached;
    const doc = cardSearchDocumentOf(card, packName(card.setCode as string), localizedNameOf(id, lang));
    cache?.set(key, doc);
    return doc;
  });
}

/** What a screen gives a `CardPoolSearch`. */
export interface CardPoolSearchHost {
  /** The screen is still up (an answer for a screen that has gone is dropped). */
  readonly alive: () => boolean;
  /** The language the names are searched in. */
  readonly language: () => CardLanguage;
  /** The cards the worker ranks, and a version that changes when they do. Asked once the language's names are loaded. */
  readonly documents: () => { readonly docs: readonly SearchDocument[]; readonly version: string };
  /** The ranking changed or was cleared: the pool goes back to its top and is drawn again. */
  readonly onChange: () => void;
}

export class CardPoolSearch {
  readonly #host: CardPoolSearchHost;
  readonly #client = new DeckSearchClient();
  #ranking: ReadonlyMap<string, number> | null = null;
  #text = "";
  #version: string | null = null;
  #destroyed = false;

  constructor(host: CardPoolSearchHost) {
    this.#host = host;
  }

  /** The text last asked for, `field:value` terms and all. */
  get text(): string {
    return this.#text;
  }

  /** Card id to score for the free words, or null while there are none (then every card the clauses leave is shown). */
  get ranking(): ReadonlyMap<string, number> | null {
    return freeTextOf(this.#text) === "" ? null : this.#ranking;
  }

  /** The pool filter with the text's `field:value` terms as clauses. */
  filterFor(filter: PoolFilter): PoolFilter {
    return withSearchClauses(filter, this.#text);
  }

  /** Asks for the text: its free words are ranked by the worker; its terms apply at once, so the pool redraws now too. */
  request(text: string): void {
    this.#text = text;
    const free = freeTextOf(text);
    if (free === "") {
      this.#client.cancel();
      this.#ranking = null;
      this.#host.onChange();
      return;
    }
    // The card language's names load on first use (English needs none); the search runs once they are in.
    const lang = this.#host.language();
    if (!cardNamesReady(lang)) {
      void loadCardNames(lang).then(() => {
        // The field may have changed (or been cleared) while the names loaded: ask for what it holds now.
        if (!this.#destroyed && this.#host.alive()) this.request(this.#text);
      });
      return;
    }
    this.#sendDocuments();
    this.#client.search(free, (ranked) => {
      if (this.#destroyed || !this.#host.alive()) return;
      this.#ranking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#host.onChange();
    });
    // The terms of the text filter while the worker ranks.
    this.#host.onChange();
  }

  /** The pool the documents come from changed (a deck's aspects, a pack loaded): the open text is ranked again. */
  refresh(): void {
    if (this.#text.trim() !== "")
      queueMicrotask(() => !this.#destroyed && this.#host.alive() && this.request(this.#text));
  }

  #sendDocuments(): void {
    const { docs, version } = this.#host.documents();
    if (version === this.#version) return;
    this.#version = version;
    this.#client.setDocuments(docs, version);
  }

  /** Forgets the text and the ranking without telling the screen (it is starting over). */
  reset(): void {
    this.#client.cancel();
    this.#ranking = null;
    this.#text = "";
    this.#version = null;
  }

  /** Ends the worker and forgets the ranking (the screen closed). */
  destroy(): void {
    this.#destroyed = true;
    this.#client.destroy();
    this.#ranking = null;
  }
}
