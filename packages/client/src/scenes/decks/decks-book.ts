/**
 * What Decks & Collection knows about its decks: the list the player sees (precons, saved decks, community decks), each deck
 * status (checked by the worker, never decided here), the selection, and the search over them. The scene and the models read it;
 * every legality and playability fact is the engine view (`view/deck-list-model.ts`).
 */
import type { AnyCard, Deck, HeroIdentityCard } from "@mc/content";
import { communityDecks } from "@mc/cards";
import {
  POOL_VERSION,
  currentCardsById,
  currentDeps,
  currentHeroShelfPacks,
  currentPool,
  currentPoolKey,
  packNameOf,
} from "../../content/pool.js";
import { appSession } from "../../session.js";
import { unlocks } from "../../progression/progression.js";
import { deckUsesCustomCards } from "../../view/custom-content.js";
import {
  communityDeckAsDeck,
  communityOfferMatches,
  communityOffers,
  testedEntryOf,
  testedSearchFieldsOf,
  type CommunityOffer,
} from "../../view/community-decks-model.js";
import { deckDisplayName, identityLabelOf } from "../../view/deck-names.js";
import {
  deckListGroupOf,
  deckListShows,
  reconcileDeckSelection,
  writeLastDeckList,
  type DeckListId,
} from "../../view/deck-list-open.js";
import {
  cachedDeckOption,
  deckOptionOf,
  pendingDeckOption,
  preconDecks,
  primeDeckOption,
  verdictOf,
  type DeckOption,
} from "../../view/deck-list-model.js";
import { sortByRecency } from "../../view/deck-recency.js";
import type { SearchDocument } from "../../view/deck-search.js";
import { heroPacksOf } from "../../view/hero-deck-groups.js";
import { isCommunityDeckId } from "../../view/community-deck-id.js";
import { heroRosterMatches, withSelectionPinned, type RosterFilter } from "../../view/roster-filter.js";
import { aspectLabelOf } from "../../view/seat-slots.js";
import { testedCatalog } from "../../view/seatable-decks.js";
import type { DecksState } from "./decks-state.js";

/** At most this many unchecked decks are checked on the main thread rather than sent to the worker. */
const STATUS_HERE_MAX = 4;

/** One row of the deck list: a deck row (optionally the first of a group, carrying that group label) or the empty-search message. */
export type DeckRow =
  | {
      readonly kind: "deck";
      readonly option: DeckOption;
      readonly groupLabel?: string;
      /** Set on a community deck row (`view/community-decks-model.ts`): a recommendation, not one of the player decks. */
      readonly offer?: CommunityOffer;
    }
  | { readonly kind: "message"; readonly text: string };

export interface BookHooks {
  /** A worker answered: one redraw for the loads that finish together. */
  readonly queueRebuild: () => void;
  readonly rebuild: () => void;
  readonly isActive: () => boolean;
}

/** The group labels words the rows carry. */
export interface GroupLabels {
  readonly precon: string;
  readonly build: string;
  readonly community: string;
}

export class DecksBook {
  readonly #st: DecksState;
  readonly #hooks: BookHooks;

  constructor(st: DecksState, hooks: BookHooks) {
    this.#st = st;
    this.#hooks = hooks;
  }

  /** Precons (fixed order) plus saved decks, most recently changed first: `deckOptionsOf` already puts precons ahead of whatever list it is given. */
  deckOptions(): readonly DeckOption[] {
    return [...preconDecks(POOL_VERSION), ...sortByRecency(this.#st.savedDecks)].map((deck) => this.optionOf(deck));
  }

  /** A deck status if it is known, else a "Checking..." stand-in until the worker answers (`askStatuses`). */
  optionOf(deck: Deck): DeckOption {
    return cachedDeckOption(deck, currentPool(), POOL_VERSION, currentDeps()) ?? pendingDeckOption(deck, currentPool());
  }

  identityOf(deck: Deck): HeroIdentityCard | null {
    const card = currentCardsById().get(deck.identityCardId as string);
    return card?.type === "hero_identity" ? card : null;
  }

  /**
   * Asks the worker for the status of every listed deck that has none yet (precons, saved and community decks, in one
   * message) and redraws once when it answers. With no worker the answer comes back before this returns and nothing is redrawn.
   */
  askStatuses(): void {
    const st = this.#st;
    const listed = [
      ...preconDecks(POOL_VERSION),
      ...st.savedDecks,
      ...communityDecks().map((entry) => communityDeckAsDeck(entry, POOL_VERSION)),
    ];
    // The selected deck (the first row until one is picked) is checked here at once: its pane and "Play this deck" act
    // on it, and a deck still being checked cannot be seated.
    const shownId = st.selectedDeckId ?? st.data.focusDeckId ?? null;
    const shown = shownId === null ? listed[0] : listed.find((deck) => (deck.id as string) === shownId);
    if (shown && cachedDeckOption(shown, currentPool(), POOL_VERSION, currentDeps()) === null) {
      deckOptionOf(shown, currentPool(), POOL_VERSION, currentDeps());
      st.statusEpoch += 1;
    }
    if (st.statusAskedPool !== currentPoolKey()) {
      st.statusAskedPool = currentPoolKey();
      st.statusAsked = new WeakSet<Deck>();
    }
    const unchecked = listed.filter(
      (deck) =>
        !st.statusAsked.has(deck) && cachedDeckOption(deck, currentPool(), POOL_VERSION, currentDeps()) === null,
    );
    // The worker knows the base pool only: a deck with a custom pack cards is checked here, against the loaded packs.
    const custom = unchecked.filter(deckUsesCustomCards);
    for (const deck of custom) deckOptionOf(deck, currentPool(), POOL_VERSION, currentDeps());
    if (custom.length > 0) st.statusEpoch += 1;
    const decks = unchecked.filter((deck) => !deckUsesCustomCards(deck));
    if (decks.length === 0) return;
    // A deck or two (one just imported, saved or copied) is checked here at once, so it never shows "Checking...".
    if (decks.length <= STATUS_HERE_MAX) {
      for (const deck of decks) deckOptionOf(deck, currentPool(), POOL_VERSION, currentDeps());
      st.statusEpoch += 1;
      return;
    }
    for (const deck of decks) st.statusAsked.add(deck);
    st.askingStatuses = true;
    try {
      st.deckSearch.checkDecks(
        decks,
        (asked) => asked.map((deck) => verdictOf(deck, currentPool(), POOL_VERSION, currentDeps())),
        (verdicts) => {
          decks.forEach((deck, at) => primeDeckOption(deck, currentPool(), POOL_VERSION, currentDeps(), verdicts[at]!));
          st.statusEpoch += 1;
          if (!st.askingStatuses && this.#hooks.isActive()) this.#hooks.queueRebuild();
        },
      );
    } finally {
      st.askingStatuses = false;
    }
  }

  /** The community decks (`@mc/cards` catalog), each with whether the player may add it yet. */
  communityOffers(): readonly CommunityOffer[] {
    const st = this.#st;
    const gate = unlocks();
    if (
      st.offersCache?.saved !== st.savedDecks ||
      st.offersCache.gate !== gate ||
      st.offersCache.epoch !== st.statusEpoch
    ) {
      st.offersCache = {
        epoch: st.statusEpoch,
        saved: st.savedDecks,
        gate,
        offers: communityOffers({
          catalog: communityDecks(),
          savedDecks: st.savedDecks,
          pool: currentPool(),
          poolVersion: POOL_VERSION,
          deps: currentDeps(),
          gate,
          optionOf: (deck) => this.optionOf(deck),
        }),
      };
    }
    return st.offersCache.offers;
  }

  /** Shows one list alone (or all three) and remembers it for "Last used" (#755). */
  setList(list: DeckListId | null): void {
    this.#st.deckList = list;
    this.#st.focusPinned = false;
    writeLastDeckList(list);
  }

  /**
   * Settles which deck is selected: the asked-for deck once it exists (saved decks arrive after the first draw, so the first row
   * stands in until then), else the first deck on the list as drawn, and only a deck on the displayed list stays selected.
   */
  settleSelection(
    allOptions: readonly DeckOption[],
    offers: readonly CommunityOffer[],
  ): {
    readonly selected: DeckOption | null;
    readonly offer: CommunityOffer | null;
  } {
    const st = this.#st;
    const wanted = st.data.focusDeckId ?? null;
    const wantedExists = wanted !== null && allOptions.some((o) => (o.deck.id as string) === wanted);
    const showPrecon = appSession().settings.showPreconDecks;
    if (
      st.selectedDeckId === null ||
      !allOptions.some((o) => (o.deck.id as string) === st.selectedDeckId) ||
      (st.fallbackSelection && wantedExists)
    ) {
      // The first deck on the list as it is drawn (a hidden precon or an unopened list is not it); none when the list is empty.
      const firstShown = allOptions.find((o) =>
        o.deck.source.kind === "precon"
          ? deckListShows("precon", st.deckList, showPrecon)
          : deckListShows(isCommunityDeckId(o.deck.id as string) ? "community" : "build", st.deckList, true),
      );
      st.selectedDeckId = (wantedExists ? wanted : (firstShown?.deck.id as string | undefined)) ?? null;
      st.fallbackSelection = !wantedExists;
    }
    // The selection stays only while it is on the displayed list (the asked-for deck excepted, until the list changes).
    const groupOf = (o: DeckOption): DeckListId =>
      deckListGroupOf(o.deck.source.kind === "precon", isCommunityDeckId(o.deck.id as string));
    const groupRank: Record<DeckListId, number> = { precon: 0, build: 1, community: 2 };
    st.selectedDeckId = reconcileDeckSelection(
      st.selectedDeckId,
      allOptions
        .map((o) => ({ id: o.deck.id as string, group: groupOf(o) }))
        .sort((a, b) => groupRank[a.group] - groupRank[b.group]),
      st.deckList,
      showPrecon,
      st.focusPinned ? wanted : null,
    );
    const selected = allOptions.find((o) => (o.deck.id as string) === st.selectedDeckId) ?? null;
    return { selected, offer: offers.find((offer) => offer.option === selected) ?? null };
  }

  /** What the deck search looks in for each deck (view/deck-search.ts): names first, then aspects, source, pack, author and tags, and a community deck write-up last. */
  #documentOf(option: DeckOption, heroPack: string | undefined): SearchDocument {
    const deck = option.deck;
    const identity = currentCardsById().get(deck.identityCardId as string);
    const hero = identity?.type === "hero_identity" ? identity : undefined;
    const entry = testedEntryOf(deck, testedCatalog());
    const sourceWords =
      deck.source.kind === "precon"
        ? ["precon", "preconstructed"]
        : deck.source.kind === "imported"
          ? ["imported"]
          : ["built", "mine"];
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
        ...deck.aspects.map((a) => aspectLabelOf([a])),
        ...sourceWords,
        ...packs.filter((t): t is string => typeof t === "string"),
        ...testedSearchFieldsOf(deck, testedCatalog()),
        ...(entry?.tags ?? []),
      ],
      notes: entry ? [entry.description] : [],
    };
  }

  /** Hands the worker the deck list when it has changed (by id, name and aspects), and re-asks the open query. */
  syncDocuments(allOptions: readonly DeckOption[]): void {
    const st = this.#st;
    const version =
      POOL_VERSION +
      ":" +
      allOptions.map((o) => `${o.deck.id as string}~${o.deck.name}~${o.deck.aspects.join(",")}`).join("|");
    if (version === st.deckDocsVersion) return;
    st.deckDocsVersion = version;
    const heroPacks = heroPacksOf(
      allOptions,
      (option) => option.deck.identityCardId as string,
      (option) => (option.deck.source.kind === "precon" ? (option.deck.source.packCode as string) : null),
    );
    st.deckSearch.setDocuments(
      allOptions.map((option) => this.#documentOf(option, heroPacks.get(option.deck.identityCardId as string))),
      version,
    );
    const text = st.filter.text;
    // After this redraw, not inside it: the answer redraws again.
    if (text.trim() !== "") queueMicrotask(() => this.#hooks.isActive() && this.requestSearch(text));
  }

  /** Asks the worker to rank the decks; the screen redraws when the newest answer arrives. An empty text clears the search at once. */
  requestSearch(text: string): void {
    const st = this.#st;
    if (text.trim() === "") {
      st.deckSearch.cancel();
      st.deckRanking = null;
      this.#hooks.rebuild();
      return;
    }
    st.deckSearch.search(text, (ranked) => {
      if (!this.#hooks.isActive()) return;
      st.deckRanking = new Map(ranked.map((r) => [r.id, r.score]));
      this.#hooks.rebuild();
    });
  }

  /**
   * `allOptions` grouped into Preconstructed / Your decks (recently changed first) / Community, filtered by search and chips,
   * with the selected deck pinned into view even if the filter would otherwise hide it. A group label rides on its own first
   * card rather than a separate full-height row.
   */
  buildRows(
    allOptions: readonly DeckOption[],
    offers: readonly CommunityOffer[],
    labels: GroupLabels,
    noMatch: string,
  ): readonly DeckRow[] {
    const st = this.#st;
    const identityOf = (option: DeckOption): AnyCard | undefined =>
      currentCardsById().get(option.deck.identityCardId as string);
    // The text part of the search is the worker ranking; the chips stay here.
    const chips: RosterFilter = { ...st.filter, text: "" };
    const ranking = st.deckRanking;
    const ranked = (option: DeckOption): boolean => ranking === null || ranking.has(option.deck.id as string);
    const scoreOf = (option: DeckOption): number => ranking?.get(option.deck.id as string) ?? 0;
    const byScore = <T>(items: readonly T[], optionOf: (item: T) => DeckOption): readonly T[] =>
      ranking === null ? items : [...items].sort((a, b) => scoreOf(optionOf(b)) - scoreOf(optionOf(a)));
    const matches = (option: DeckOption): boolean =>
      ranked(option) &&
      heroRosterMatches(option.deck, identityOf(option), chips, option.checking ? "checking" : option.blockedReason);
    const isSelected = (option: DeckOption): boolean => (option.deck.id as string) === st.selectedDeckId;

    // A list chip narrows to that list; a source chip (Imported, Built) narrows to the player own list, so the
    // community group steps aside. Hidden precons stay out (#755) except the one selected, which is never filtered away.
    const showPrecon = appSession().settings.showPreconDecks;
    const preconKind = (o: DeckOption): boolean => o.deck.source.kind === "precon";
    const precons = allOptions.filter(
      (o) => preconKind(o) && (deckListShows("precon", st.deckList, showPrecon) || (!showPrecon && isSelected(o))),
    );
    const saved = deckListShows("build", st.deckList, showPrecon)
      ? allOptions.filter((o) => deckListGroupOf(preconKind(o), isCommunityDeckId(o.deck.id as string)) === "build")
      : [];
    const community = byScore(
      withSelectionPinned(
        st.filter.source || !deckListShows("community", st.deckList, showPrecon) ? [] : offers,
        (offer) =>
          ranked(offer.option) &&
          communityOfferMatches(offer, {
            text: "",
            aspect: st.filter.aspect ?? null,
            availableOnly: st.filter.playableOnly === true,
          }),
        (offer) => isSelected(offer.option),
      ),
      (offer) => offer.option,
    );
    const filteredPrecons = byScore(withSelectionPinned(precons, matches, isSelected), (o) => o);
    const filteredSaved = byScore(withSelectionPinned(saved, matches, isSelected), (o) => o);

    const rows: DeckRow[] = [];
    filteredPrecons.forEach((option, index) =>
      rows.push({ kind: "deck", option, ...(index === 0 ? { groupLabel: labels.precon } : {}) }),
    );
    filteredSaved.forEach((option, index) =>
      rows.push({ kind: "deck", option, ...(index === 0 ? { groupLabel: labels.build } : {}) }),
    );
    community.forEach((offer, index) =>
      rows.push({
        kind: "deck",
        option: offer.option,
        offer,
        ...(index === 0 ? { groupLabel: labels.community } : {}),
      }),
    );
    if (rows.length === 0) rows.push({ kind: "message", text: noMatch });
    return rows;
  }
}
