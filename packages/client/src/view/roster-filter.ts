/**
 * The plain-TS filter model behind every searchable, scrollable roster
 * (docs/phase4-screen-gaps.md §2 "S8"): Title's scenario picker and hero
 * seat picker today, the Decks screen's deck list and W9's deck list later.
 *
 * Matching is case- and accent-insensitive, and true on an empty query (a
 * blank search field shows everything). Every filter function here takes the
 * query as its last argument and a list of "haystacks" — the fields S8 lists
 * per roster kind — so a caller only has to say *what* a row's searchable
 * text is; this module is the one place that decides *how* two strings match.
 *
 * **Quick filters** (S8): `RosterFilter` carries one optional field per chip,
 * each `&&`ed onto the text match rather than replacing it — a chip narrows
 * what the search already found, it doesn't compete with it.
 * - **Heroes:** `aspect` (the deck's own chosen aspect(s), `Deck.aspects` —
 *   not a per-card aspect), `source` (`Deck.source.kind`), and `playableOnly`
 *   ("playable now": hide a seat the engine currently blocks). `playableOnly`
 *   needs to know *why* a deck is blocked, which isn't a fact about the deck
 *   itself — `view/seats.ts` already computes it per seating — so
 *   `heroRosterMatches` takes it as a separate `blockedBy` argument rather
 *   than reading it off `Deck`. This is a *display* filter: a row hidden by
 *   `playableOnly` is still exactly as blocked or seatable as it was: nothing
 *   here changes `DeckOption`/`SeatOption`, it only decides what's drawn.
 * - **Scenarios:** `product` (`Scenario.packCode`). `@mc/content` has no
 *   `Cycle`/`Pack` data wired into the app pool yet (`pool.ts`), so "or
 *   cycle" isn't buildable today; `scenarioProductsOf` derives the chip list
 *   from whatever pack codes are actually present, which grows on its own as
 *   packs are added.
 */

/** Strips accents and case, so "café" matches "cafe" and "ENERGY" matches "energy". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** True when `query` (trimmed, normalized) is empty, or found in any of `haystacks`. */
export function matchesSearch(haystacks: readonly (string | null | undefined)[], query: string): boolean {
  const q = normalizeSearch(query.trim());
  if (q === "") return true;
  return haystacks.some((h) => h != null && normalizeSearch(h).includes(q));
}

/** The roster filter's shape: the text search plus S8's quick-filter chips, one optional field each. */
export interface RosterFilter {
  readonly text: string;
  /** Heroes only: the deck's own chosen aspect(s) (`Deck.aspects`). `null`/absent = every aspect. */
  readonly aspect?: CoreAspect | null;
  /** Heroes only: `Deck.source.kind`. `null`/absent = every source. */
  readonly source?: DeckSourceKind | null;
  /** Heroes only: hide a deck the engine currently blocks (`heroRosterMatches`'s own `blockedBy` argument carries the actual reason). */
  readonly playableOnly?: boolean;
  /** Scenarios only: `Scenario.packCode`. `null`/absent = every product. */
  readonly product?: string | null;
}

export const EMPTY_ROSTER_FILTER: RosterFilter = { text: "" };

// ---------------------------------------------------------------------------------------------------------------
// The two rosters Title builds today (docs/phase4-screen-gaps.md §2 S8): the hero seat picker and the scenario
// picker. Kept in this module rather than in `scenes/title.ts` so they're testable without a canvas and reusable
// once W2 splits Title into its own Scenario select / Take your seats screens.
// ---------------------------------------------------------------------------------------------------------------
import type { AnyCard, CoreAspect, Deck, DeckSource, HeroIdentityCard, Scenario } from "@mc/content";
import { CHOOSABLE_ASPECTS } from "@mc/engine";

export type DeckSourceKind = DeckSource["kind"];

/**
 * S8: "hero name, alter-ego name, deck name, aspect and source", narrowed by
 * the aspect/source/playable-now chips. `blockedBy` is `view/seats.ts`'s own
 * verdict for this deck at the current seating — null when it can be seated
 * (or is already seated); only `playableOnly` reads it.
 */
export function heroRosterMatches(deck: Deck, identity: AnyCard | undefined, filter: RosterFilter, blockedBy: string | null = null): boolean {
  const hero = identity?.type === "hero_identity" ? (identity as HeroIdentityCard) : undefined;
  if (!matchesSearch([deck.name, hero?.hero.faceName, hero?.alterEgo.faceName, ...deck.aspects, deck.source.kind], filter.text)) return false;
  if (filter.aspect && !deck.aspects.includes(filter.aspect)) return false;
  if (filter.source && deck.source.kind !== filter.source) return false;
  if (filter.playableOnly && blockedBy !== null) return false;
  return true;
}

/**
 * S8: "villain name, scenario name, product or pack, and encounter set name", narrowed by the product chip.
 * `villains` is every villain a search should be able to find this row by — one, for every scenario but Breakout;
 * all four (Wrecker, Thunderball, Piledriver, Bulldozer), for a `multipleVillains` scenario, so searching "wrecker"
 * still finds Breakout even though its row no longer names Wrecker specifically (`scenes/title.ts`'s own row
 * builds a crew-scoped subtitle instead, PLAN.md's "Wrecker can't be played from Title").
 */
export function scenarioRosterMatches(scenario: Scenario, villains: readonly (AnyCard | undefined)[], encounterSetNames: readonly string[], filter: RosterFilter): boolean {
  if (!matchesSearch([scenario.name, ...villains.map((villain) => villain?.name), scenario.packCode, ...encounterSetNames], filter.text)) return false;
  if (filter.product && (scenario.packCode as string) !== filter.product) return false;
  return true;
}

/**
 * Pins the selected item(s) into a filtered list even when the filter itself
 * would have excluded them (PLAN.md, "a Title filter can hide the selected
 * scenario while it stays selected" — clearing the scenario search after
 * typing something that didn't match the currently-chosen scenario left the
 * roster with no visibly-selected row at all, even though a game with that
 * scenario would still start). `items` is the *unfiltered* source list, so a
 * pinned item keeps its natural position rather than always jumping to the
 * top or bottom — "pinned" here means "exempted from the filter", not
 * "reordered".
 */
export function withSelectionPinned<T>(items: readonly T[], matches: (item: T) => boolean, isSelected: (item: T) => boolean): readonly T[] {
  return items.filter((item) => matches(item) || isSelected(item));
}

/** The aspect chips a Heroes roster shows: only aspects some deck in `decks` actually uses (`CHOOSABLE_ASPECTS`' own order), so the row never offers an aspect nothing is built in. */
export function heroAspectsOf(decks: readonly Deck[]): readonly CoreAspect[] {
  const present = new Set(decks.flatMap((deck) => deck.aspects));
  return CHOOSABLE_ASPECTS.filter((aspect) => present.has(aspect));
}

/** The product chips a Scenario roster shows: every distinct `packCode` present, in first-seen (pool) order. */
export function scenarioProductsOf(scenarios: readonly Scenario[]): readonly string[] {
  const seen: string[] = [];
  for (const scenario of scenarios) {
    const code = scenario.packCode as string;
    if (!seen.includes(code)) seen.push(code);
  }
  return seen;
}
