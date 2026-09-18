import type { ResourceIconType, Trait } from "./common.js";

/**
 * Keyword enumeration sourced from:
 *   https://hallofheroeslcg.com/marvel-champions-lcg-keyword-list/
 * ("Marvel Champions LCG Keyword and Mechanic List", fetched 2026-09-09),
 * cross-referenced against the per-release pages linked from
 * hallofheroes-llms.txt for introducing set/date. This is a community index,
 * not the RRG — per CLAUDE.md, treat it as a pointer; the RRG/FAQ text is
 * authoritative if the engine team finds a discrepancy once these keywords
 * get real rules semantics.
 *
 * Coverage as of the fetched page: Core Set (Guard, Overkill, Peril,
 * Quickstrike, Restricted, Retaliate X, Surge, Toughness, Uses (X "type")),
 * The Rise of Red Skull (Incite X, Permanent, Piercing, Ranged, Setup), The
 * Once and Future Kang (Villainous), Ant-Man (Team-Up), Galaxy's Most Wanted
 * (Amplify, Hinder X, Patrol, Stalwart, Victory X), War Machine (Alliance),
 * The Hood (Steady), Sinister Motives (Requirement), Cyclops (Temporary),
 * Mutant Genesis (Teamwork), NeXt Evolution (Assault; Player Side Scheme is a
 * card type, not a keyword), Age of Apocalypse (Find), Agents of SHIELD
 * (Vulnerable).
 *
 * NOT on the keyword-list page as of this fetch: "Discount" (per the release
 * index, introduced in Fear No Evil). Its full text isn't published yet at
 * the source consulted — represented below as a stub with an optional
 * numeric value so the shape exists, but flagged: do not treat its semantics
 * as confirmed until cross-checked against the actual card/FAQ text.
 *
 * Checked against RRG 1.8 (Jul 2026) for Phase 7 wave 1 (docs/phase7-wave1.md §1):
 * - Glossary entries exist for "Team-Up" (p. 43), "Teamwork (Trait)" (p. 43),
 *   "Requirement (Resources)" (p. 37) and "Linked (Card Title)" (p. 27).
 * - RRG 1.8 has no "Discount" entry at all.
 * - "Find" (p. 19) is defined as an instruction ("When instructed to find a
 *   card, a player searches each game area..."), not a keyword with a value, so
 *   the `find` shape below is unconfirmed.
 * - "Requirement (Resources)" reads "cannot be played unless each resource of
 *   the specified type is spent", so a single `icon` may be too narrow. Confirm
 *   against a printed card before ingesting one.
 * - No wave 1 card prints Team-Up, Teamwork, Requirement, Find or Discount. The
 *   Thor Hero Pack's "Teamwork" (06032) is an event's title, not the keyword.
 *
 * Checked for Phase 7 wave 2, cycle 1 (docs/phase7-wave2.md §1.8): cycle 1 prints Incite X, Permanent, Piercing,
 * Ranged, Setup, Villainous and Team-Up, plus Core keywords. No shape here changes. Team-Up's two names are the
 * printed "Team-Up (Ant-Man and Wasp)." / "Team-Up (Quicksilver and Scarlet Witch)." (12020, 13020, 14018, 15018).
 * Its play half ("cannot be played unless both of the named friendly characters (identity or ally) are in play",
 * RRG 1.8 "Team-Up", p. 43) is not enforced by the engine yet.
 */
export type KeywordName =
  | "guard"
  | "overkill"
  | "peril"
  | "quickstrike"
  | "restricted"
  | "retaliate"
  | "surge"
  | "toughness"
  | "uses"
  | "incite"
  | "permanent"
  | "piercing"
  | "ranged"
  | "setup"
  | "villainous"
  | "teamUp"
  | "amplify"
  | "hinder"
  | "patrol"
  | "stalwart"
  | "victory"
  | "alliance"
  | "steady"
  | "requirement"
  | "temporary"
  | "teamwork"
  | "assault"
  | "find"
  | "vulnerable"
  | "discount"
  | "linked";

interface KeywordBase<N extends KeywordName> {
  readonly name: N;
}

export type KeywordInstance =
  | KeywordBase<
      | "guard"
      | "overkill"
      | "peril"
      | "quickstrike"
      | "restricted"
      | "surge"
      | "toughness"
      | "permanent"
      | "piercing"
      | "ranged"
      | "setup"
      | "villainous"
      | "amplify"
      | "patrol"
      | "stalwart"
      | "alliance"
      | "steady"
      | "temporary"
      | "assault"
      | "vulnerable"
    >
  | (KeywordBase<"retaliate"> & { readonly value: number })
  | (KeywordBase<"uses"> & { readonly count: number; readonly counterType: string })
  | (KeywordBase<"incite"> & { readonly value: number })
  | (KeywordBase<"hinder"> & { readonly value: number })
  | (KeywordBase<"victory"> & { readonly value: number })
  | (KeywordBase<"requirement"> & { readonly icon: ResourceIconType })
  | (KeywordBase<"teamwork"> & { readonly sharedTrait: Trait })
  | (KeywordBase<"find"> & { readonly count?: number })
  /** See file-header note: definition not yet published at the source consulted. */
  | (KeywordBase<"discount"> & { readonly value?: number })
  /**
   * RRG 1.8 "Team-Up" (p. 43): "Team-Up (name 1 and name 2)". The two names are what
   * deckbuilding checks against the identity, so they are data. Optional only because no
   * ingested card carries the keyword yet. `validateDeck` reports a card that has the
   * keyword but no names as `missing_card_data` instead of guessing.
   */
  | (KeywordBase<"teamUp"> & { readonly names?: readonly [string, string] })
  /**
   * RRG 1.8 "Linked (Card Title)" (p. 27): "Cards with the linked keyword cannot be included in
   * any deck. Instead, they are set aside at the start of the game if any deck includes the
   * card that brings the linked cards into play (indicated in the parentheses following the
   * keyword)." `cardTitle` is that parenthesized title.
   */
  | (KeywordBase<"linked"> & { readonly cardTitle?: string });

export const KNOWN_KEYWORD_NAMES: readonly KeywordName[] = [
  "guard",
  "overkill",
  "peril",
  "quickstrike",
  "restricted",
  "retaliate",
  "surge",
  "toughness",
  "uses",
  "incite",
  "permanent",
  "piercing",
  "ranged",
  "setup",
  "villainous",
  "teamUp",
  "amplify",
  "hinder",
  "patrol",
  "stalwart",
  "victory",
  "alliance",
  "steady",
  "requirement",
  "temporary",
  "teamwork",
  "assault",
  "find",
  "vulnerable",
  "discount",
  "linked",
];
