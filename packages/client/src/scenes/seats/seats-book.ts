/**
 * What Take your seats knows about the decks and the table: the deck options validated once per list, each deck's verdict
 * for the active seat (asked of the engine's seat options, never worked out here), the Team-Up insights, the roster's
 * shelves with the hero groups and the Random candidates. The scene owns the draft and the search; this reads them (`draft`
 * is set by the scene before each read) and decides nothing about the screen.
 */
import { deckDisplayName, identityLabelOf } from "../../view/deck-names.js";
import type { AnyCard, Deck } from "@mc/content";
import { HERO_ART, heroArtForIdentity } from "../../art/hero-art.js";
import { packPictureFor } from "../../art/pack-art.js";
import type { Picture } from "../../art/pictures.js";
import type { PromoSet } from "../../art/promo-art.js";
import {
  POOL_VERSION,
  currentCardsById,
  currentDeps,
  currentHeroShelfPacks,
  currentPool,
  currentPoolKey,
} from "../../content/pool.js";
import { isCommunityDeckId, testedDeckLockOf } from "../../view/community-decks-model.js";
import { isCustomCard } from "../../view/custom-content.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import { rankShelvesByScore } from "../../view/deck-search.js";
import { groupShelvesByHero, heroGroupKeyOf, heroPacksOf, type HeroDeckGroup } from "../../view/hero-deck-groups.js";
import { heroTilePicture } from "../../view/hero-art-choice.js";
import {
  heroPassesChips,
  randomHeroCandidatesOf,
  takeableHeroesOf,
  type RandomHeroCandidate,
} from "../../view/hero-random.js";
import { withSelectionPinned } from "../../view/roster-filter.js";
import {
  azShelvesOf,
  cycleShelvesOf,
  withTestedShelf,
  type Shelf,
  type ShelfCandidate,
} from "../../view/roster-shelves.js";
import { pairCatalogOf, seatInsightsOf, type PairCatalog, type SeatInsights } from "../../view/seat-recommendations.js";
import { activeSeatRosterOf, type ActiveSeatRosterEntry } from "../../view/seat-slots.js";
import { seatableDeckOptionsOf, testedCatalog } from "../../view/seatable-decks.js";
import { seatOptions, type SeatOption } from "../../view/seats.js";
import { MAX_SEATS } from "../../view/seats-layout.js";
import type { SetupDraft } from "../../view/setup-draft.js";
import { foldShelves } from "../../view/shelf-folds.js";
import { appSession } from "../../session.js";
import { unlocks } from "../../progression/progression.js";
import type { HeroArt } from "../../settings.js";

/** The Recommended shelf: the first shelf of the roster, at most this many tiles. */
export const REC_LIMIT = 6;
/** The Recommended shelf's id among the roster's shelves: always the first, and only while there is someone to recommend. */
export const REC_SHELF_ID = "recommended";

/** What shuts a deck to this player: a precon's hero, or a tested community deck's hero or card wave. Null when it may be seated. */
export function deckLockOf(deck: Deck): string | null {
  return testedDeckLockOf(deck, testedCatalog(), currentPool(), unlocks()) ?? unlocks().deckLock(deck);
}

/** The pool's Team-Up pairs, derived once: the pool never changes under a running app, but a pack that finishes loading does. */
let pairCatalog: { readonly key: string; readonly catalog: PairCatalog } | null = null;
const seatPairCatalog = (): PairCatalog => {
  const key = currentPoolKey();
  if (pairCatalog?.key !== key) pairCatalog = { key, catalog: pairCatalogOf(currentCardsById()) };
  return pairCatalog.catalog;
};

export interface SeatsBookInput {
  readonly draft: SetupDraft;
  /** The text search's last answer (deck id to score), or null with no search; and the text it answers. */
  readonly ranking: ReadonlyMap<string, number> | null;
  readonly folded: ReadonlySet<string>;
}

export class SeatsBook {
  draft!: SetupDraft;
  ranking: ReadonlyMap<string, number> | null = null;
  folded: ReadonlySet<string> = new Set();
  savedDecks: readonly Deck[] = [];
  /** Each hero shown, with the decks that pass the filters; rebuilt with the shelves. */
  heroGroups: ReadonlyMap<string, HeroDeckGroup<DeckOption>> = new Map();
  /** The hero tiles' art choice, read once a compose: every tile asks. */
  tileArt: { readonly choice: HeroArt; readonly earned: readonly PromoSet[] } = { choice: "game", earned: [] };
  readonly #heroArtCache = new Map<string, Picture | null>();
  #optionsFor: { saved: readonly Deck[]; pool: readonly AnyCard[]; options: readonly DeckOption[] } | null = null;

  /** Every deck's status, validated against the pool once per saved-deck list rather than once per redraw. */
  deckOptions(): readonly DeckOption[] {
    if (this.#optionsFor?.saved !== this.savedDecks || this.#optionsFor.pool !== currentPool()) {
      this.#optionsFor = {
        saved: this.savedDecks,
        pool: currentPool(),
        options: seatableDeckOptionsOf(this.savedDecks, currentPool(), POOL_VERSION, currentDeps()),
      };
    }
    return this.#optionsFor.options;
  }

  /**
   * Legality as if the active seat were empty: picking a new hero for that seat always replaces its occupant, so "N seats
   * is the maximum" and the unique-identity checks are asked against the table without it.
   */
  seatOptionsExcludingActive(deckOptions: readonly DeckOption[]): readonly SeatOption[] {
    const others = this.draft.seats.filter((_, i) => i !== this.draft.activeSeatIndex);
    // A hero the player has not unlocked is shown, dimmed, with what opens it, never hidden.
    return seatOptions(deckOptions, others, currentCardsById(), MAX_SEATS).map((option) => {
      if (option.seated) return option;
      const deck = deckOptions.find((candidate) => (candidate.deck.id as string) === option.deckId);
      const lock = deck ? deckLockOf(deck.deck) : null;
      return lock ? { ...option, blockedBy: lock } : option;
    });
  }

  seating(deckOptions: readonly DeckOption[]): ReadonlyMap<string, SeatOption> {
    return new Map(this.seatOptionsExcludingActive(deckOptions).map((o) => [o.deckId, o]));
  }

  /** The roster's per-deck seating facts for the active seat, as the shelves and the deck submenu read them. */
  activeRoster(deckOptions: readonly DeckOption[]): ReadonlyMap<string, ActiveSeatRosterEntry> {
    return new Map(
      activeSeatRosterOf(
        this.seatOptionsExcludingActive(deckOptions),
        this.draft.seats,
        this.draft.activeSeatIndex,
      ).map((e) => [e.deckId, e]),
    );
  }

  /** Why the table can't be dealt yet: a seated hero that has since been locked again (Settings, Unlocks). */
  tableLock(deckOptions: readonly DeckOption[]): string | null {
    for (const deckId of this.draft.seats) {
      const deck = deckOptions.find((candidate) => (candidate.deck.id as string) === deckId);
      const lock = deck ? deckLockOf(deck.deck) : null;
      if (lock) return `${identityLabelOf(deck!) ?? deckDisplayName(deck!.deck)}: ${lock}`;
    }
    return null;
  }

  groupKeyOf(option: DeckOption): string {
    return heroGroupKeyOf(this.ranking !== null, option.deck.identityCardId as string, option.deck.id as string);
  }

  groupOf(option: DeckOption): HeroDeckGroup<DeckOption> | undefined {
    return this.heroGroups.get(this.groupKeyOf(option));
  }

  /** The hero tiles the Recommended shelf and the detail panel's "why" read: one analysis per redraw. */
  insights(deckOptions: readonly DeckOption[], seating: ReadonlyMap<string, SeatOption>): SeatInsights {
    const seated = this.draft.seats
      .map((id) => deckOptions.find((o) => (o.deck.id as string) === id)?.deck)
      .filter((deck): deck is Deck => deck !== undefined);
    const candidates = takeableHeroesOf(
      deckOptions,
      (deckId) => seating.get(deckId)?.blockedBy ?? null,
      this.draft.heroFilter,
      this.ranking,
    ).map(({ option, shown }) => ({ deck: option.deck, shown }));
    return seatInsightsOf({
      seated,
      activeSeatIndex: this.draft.activeSeatIndex,
      candidates,
      pool: currentCardsById(),
      catalog: seatPairCatalog(),
      limit: REC_LIMIT,
    });
  }

  /** The decks Random may seat: the roster's own checks, the chips and the search, the seat's own hero left out. */
  randomCandidates(
    deckOptions: readonly DeckOption[],
    seating: ReadonlyMap<string, SeatOption>,
    rankedFor: string | null,
  ): readonly RandomHeroCandidate[] {
    const ownDeckId = this.draft.seats[this.draft.activeSeatIndex];
    const own = ownDeckId ? deckOptions.find((o) => (o.deck.id as string) === ownDeckId) : undefined;
    return randomHeroCandidatesOf(
      deckOptions,
      (deckId) => seating.get(deckId)?.blockedBy ?? null,
      this.draft.heroFilter,
      this.ranking,
      own?.deck.identityCardId as string | undefined,
      rankedFor,
    );
  }

  /** The pack shelves: by wave or A to Z, one tile per hero, ranked by the search, folded as the player left them. */
  shelves(
    deckOptions: readonly DeckOption[],
    seating: ReadonlyMap<string, SeatOption>,
    active: ReadonlyMap<string, ActiveSeatRosterEntry>,
  ): readonly Shelf<DeckOption>[] {
    const heroPacks = heroPacksOf(
      deckOptions,
      (option) => option.deck.identityCardId as string,
      (option) => (option.deck.source.kind === "precon" ? (option.deck.source.packCode as string) : null),
    );
    const candidates: ShelfCandidate<DeckOption>[] = withSelectionPinned(
      deckOptions,
      () => true,
      (option) => active.get(option.deck.id as string)?.isActiveSeat ?? false,
    ).map((option) => {
      // A hero's saved and community decks sit on the shelf of the hero's own pack, beside its precons: one tile per hero.
      const packCode = heroPacks.get(option.deck.identityCardId as string) ?? null;
      const chipsOk = heroPassesChips(
        option.deck,
        this.draft.heroFilter,
        seating.get(option.deck.id as string)?.blockedBy ?? null,
      );
      return {
        item: option,
        packCode,
        searchHaystacks: [],
        passesChips: chipsOk && (this.ranking === null || this.ranking.has(option.deck.id as string)),
      };
    });
    const shelves =
      this.draft.heroSortMode === "az"
        ? azShelvesOf(
            candidates,
            "",
            (option) => option.identityName ?? option.deck.name,
            (option) => option.deck.name,
          )
        : cycleShelvesOf(candidates, currentHeroShelfPacks(), "");
    const grouped = groupShelvesByHero(
      withTestedShelf(shelves, (option) => isCommunityDeckId(option.deck.id as string)),
      (option) => this.groupKeyOf(option),
      (option) => {
        const entry = active.get(option.deck.id as string);
        if (entry?.isActiveSeat) return 4;
        if (entry?.seatIndex !== null && entry?.seatIndex !== undefined) return 3;
        const lock = deckLockOf(option.deck);
        return !entry?.blockedBy && !lock ? 2 : !lock ? 1 : 0;
      },
    );
    this.heroGroups = grouped.groups;
    const ranking = this.ranking;
    const ordered = ranking
      ? rankShelvesByScore(grouped.shelves, (option) => ranking.get(option.deck.id as string) ?? 0)
      : grouped.shelves;
    const filter = this.draft.heroFilter;
    const filtering = ranking !== null || !!filter.aspect || !!filter.source || !!filter.playableOnly;
    return foldShelves(ordered, this.folded, filtering);
  }

  /**
   * The hero's own artwork, picked once per visit so a redraw does not reshuffle a hero with several pictures. Card or
   * Promo art (`Settings.heroArt`) goes first.
   */
  heroPictureFor(identityId: string): Picture | null {
    if (isCustomCard(identityId)) return packPictureFor("hero", identityId);
    const { choice, earned } = this.tileArt;
    const chosen = heroTilePicture(choice, currentCardsById().get(identityId), earned, appSession().settings.promoArt);
    if (chosen) return chosen;
    if (!this.#heroArtCache.has(identityId)) {
      this.#heroArtCache.set(identityId, heroArtForIdentity(HERO_ART, identityId, currentPool()));
    }
    return this.#heroArtCache.get(identityId) ?? null;
  }
}
