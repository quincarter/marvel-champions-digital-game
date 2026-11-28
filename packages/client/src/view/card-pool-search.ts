/**
 * The card pool's text search, shared by the deck builder and the Decks screen: the smart filter's `field:value` terms
 * (`pool-query.ts`, #531: `o:2`, `t:event`, `f:justice`, `kw:guard`) narrow the pool on this side, and the free words
 * are ranked off the main thread by the fuzzy, accent-free search worker (`deck-search-client.ts`).
 *
 * What the free words reach: a card's name (and its name in the card language once that language's name table has
 * loaded: `view/card-names.ts`), subtitle, and its English traits, type, aspect, pack and rules text. Names are the
 * only part translated; the terms (`t:`, `kw:`) and their values stay English.
 *
 * `CardPoolSearch` holds the worker client and the newest ranking. A screen gives it the documents the worker ranks
 * (`documents`: the cards the pool offers, with their version) and is told when the ranking changes (`onChange`). Every
 * request is tagged with a generation: an answer for an older text or another language is dropped, and a name table
 * that is still loading never holds back the terms (they filter at once) or lets an older answer through.
 */
import type { AnyCard } from "@mc/content";
import type { CardLanguage } from "../art/card-language.js";
import { DeckSearchClient } from "./deck-search-client.js";
import type { RankedDocument, SearchDocument } from "./deck-search.js";
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

/**
 * Documents already made, by the card they were made from (a pool revision or an updated pack makes new card objects,
 * so an old document is never reused for changed text) and by the language and whether that language's names had
 * loaded (an English-only document made while the names failed is never final).
 */
export type PoolDocumentCache = WeakMap<AnyCard, Map<string, SearchDocument>>;

export const createPoolDocumentCache = (): PoolDocumentCache => new WeakMap();

/** The documents the worker ranks for `cards` in `lang`: each card's names, traits, type and rules text. */
export function poolSearchDocuments(
  cards: readonly AnyCard[],
  lang: CardLanguage,
  packName: (setCode: string) => string | undefined,
  cache?: PoolDocumentCache,
): readonly SearchDocument[] {
  const state = `${lang}:${cardNamesReady(lang) ? "names" : "bare"}`;
  return cards.map((card) => {
    let byState = cache?.get(card);
    const cached = byState?.get(state);
    if (cached) return cached;
    const doc = cardSearchDocumentOf(card, packName(card.setCode as string), localizedNameOf(card.id as string, lang));
    if (cache) {
      if (!byState) cache.set(card, (byState = new Map()));
      byState.set(state, doc);
    }
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

/** The part of `DeckSearchClient` this uses, so a test can stand in for it. */
export interface PoolSearchClient {
  setDocuments(documents: readonly SearchDocument[], version: string): void;
  search(text: string, onResult: (ranked: readonly RankedDocument[]) => void): void;
  cancel(): void;
  destroy(): void;
}

export class CardPoolSearch {
  readonly #host: CardPoolSearchHost;
  readonly #client: PoolSearchClient;
  #ranking: ReadonlyMap<string, number> | null = null;
  #text = "";
  #version: string | null = null;
  #destroyed = false;
  /** Bumped by every request: an answer or a name load that finishes for an older one is dropped. */
  #generation = 0;
  /** The generation whose answer has landed: the free words are pending until it is the current one. */
  #answered = -1;
  /** Languages whose names did not load: the search runs without them (English only) rather than asking forever. */
  readonly #namesGaveUp = new Set<CardLanguage>();
  /** The name load in flight, shared by every request made while it runs. */
  #loading: Promise<void> | null = null;

  constructor(host: CardPoolSearchHost, client: PoolSearchClient = new DeckSearchClient()) {
    this.#host = host;
    this.#client = client;
  }

  /** The text last asked for, `field:value` terms and all. */
  get text(): string {
    return this.#text;
  }

  /** Card id to score for the free words, or null while there are none (then every card the clauses leave is shown) or while they are pending. */
  get ranking(): ReadonlyMap<string, number> | null {
    return this.pending ? null : freeTextOf(this.#text) === "" ? null : this.#ranking;
  }

  /**
   * The text has free words whose answer has not come yet (the names are loading or the worker is ranking): there is no
   * ranking to show for them, and an older text's ranking is never offered in its place. A screen shows no matches (and
   * not "no cards match") until it ends.
   */
  get pending(): boolean {
    return freeTextOf(this.#text) !== "" && this.#answered !== this.#generation;
  }

  /** The pool filter with the text's `field:value` terms as clauses. */
  filterFor(filter: PoolFilter): PoolFilter {
    return withSearchClauses(filter, this.#text);
  }

  /**
   * Asks for the text. Its terms apply at once (the pool redraws now); its free words are ranked by the worker, once the
   * card language's names are in. The previous request is dropped first, so an older answer never lands on newer text.
   */
  request(text: string): void {
    this.#text = text;
    const generation = ++this.#generation;
    // Whatever was on its way answers an older text (or language): it is dropped now, not when the next answer comes.
    this.#client.cancel();
    const free = freeTextOf(text);
    if (free === "") {
      this.#ranking = null;
      this.#host.onChange();
      return;
    }
    // The previous text's ranking is not this text's: it is dropped now, and the words are pending until the worker answers.
    this.#ranking = null;
    const lang = this.#host.language();
    if (!cardNamesReady(lang) && !this.#namesGaveUp.has(lang)) {
      // The new terms filter now; the words are ranked once the names are in.
      this.#host.onChange();
      this.#awaitNames(lang);
      return;
    }
    this.#sendDocuments();
    this.#client.search(free, (ranked) => {
      if (this.#destroyed || !this.#host.alive() || generation !== this.#generation || lang !== this.#host.language())
        return;
      this.#ranking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#answered = generation;
      this.#host.onChange();
    });
    // The terms of the text filter while the worker ranks.
    this.#host.onChange();
  }

  /** One load of `lang`'s names for every request made meanwhile; the newest text is searched when it settles. */
  #awaitNames(lang: CardLanguage): void {
    if (this.#loading) return;
    this.#loading = loadCardNames(lang).then((loaded) => {
      this.#loading = null;
      if (!loaded) this.#namesGaveUp.add(lang);
      if (!this.#destroyed && this.#host.alive()) this.request(this.#text);
    });
  }

  /** The pool the documents come from changed (a deck's aspects, a pack loaded): the open text is ranked again. */
  refresh(): void {
    // A names failure is not final: the next ask tries the table again.
    this.#namesGaveUp.clear();
    if (this.#text.trim() !== "")
      queueMicrotask(() => !this.#destroyed && this.#host.alive() && this.request(this.#text));
  }

  #sendDocuments(): void {
    const { docs, version } = this.#host.documents();
    // The names loading (or not) changes what a document says, so it is part of the version the worker keeps.
    const full = `${version}:${cardNamesReady(this.#host.language()) ? "names" : "bare"}`;
    if (full === this.#version) return;
    this.#version = full;
    this.#client.setDocuments(docs, full);
  }

  /** Forgets the text and the ranking without telling the screen (it is starting over). */
  reset(): void {
    this.#client.cancel();
    this.#generation++;
    this.#answered = -1;
    this.#ranking = null;
    this.#text = "";
    this.#version = null;
    this.#loading = null;
    // The screen is starting over (a new visit): a search ended by `destroy()` answers again.
    this.#destroyed = false;
  }

  /** Ends the worker and forgets the ranking (the screen closed). */
  destroy(): void {
    this.#destroyed = true;
    this.#generation++;
    this.#client.destroy();
    this.#ranking = null;
  }
}
