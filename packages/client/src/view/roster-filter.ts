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
 * **Quick filters** (S8: chip filters for aspect/source/"playable now" on
 * heroes, product/cycle on scenarios) are deliberately not built this pass —
 * only the text search is. `RosterFilter` is still shaped for them: `text` is
 * one field among what will eventually be several, so adding e.g. `aspect`
 * later is a new optional field and a new `&&` clause in the matcher, not a
 * reshape of anything that already calls this module.
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

/**
 * The roster filter's shape. Only `text` is wired this pass; the rest are
 * placeholders for S8's quick-filter chips (aspect/source/"playable now" for
 * heroes; product/cycle for scenarios) so those can be added as new optional
 * fields without changing every call site that builds one.
 */
export interface RosterFilter {
  readonly text: string;
}

export const EMPTY_ROSTER_FILTER: RosterFilter = { text: "" };

// ---------------------------------------------------------------------------------------------------------------
// The two rosters Title builds today (docs/phase4-screen-gaps.md §2 S8): the hero seat picker and the scenario
// picker. Kept in this module rather than in `scenes/title.ts` so they're testable without a canvas and reusable
// once W2 splits Title into its own Scenario select / Take your seats screens.
// ---------------------------------------------------------------------------------------------------------------
import type { AnyCard, Deck, HeroIdentityCard, Scenario } from "@mc/content";

/** S8: "hero name, alter-ego name, deck name, aspect and source". */
export function heroRosterMatches(deck: Deck, identity: AnyCard | undefined, filter: RosterFilter): boolean {
  const hero = identity?.type === "hero_identity" ? (identity as HeroIdentityCard) : undefined;
  return matchesSearch(
    [deck.name, hero?.hero.faceName, hero?.alterEgo.faceName, ...deck.aspects, deck.source.kind],
    filter.text,
  );
}

/** S8: "villain name, scenario name, product or pack, and encounter set name". */
export function scenarioRosterMatches(scenario: Scenario, villain: AnyCard | undefined, encounterSetNames: readonly string[], filter: RosterFilter): boolean {
  return matchesSearch([scenario.name, villain?.name, scenario.packCode, ...encounterSetNames], filter.text);
}
