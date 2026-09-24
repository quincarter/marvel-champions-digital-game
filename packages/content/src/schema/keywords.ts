import type { ResourceIconCounts, ResourceIconType, Trait } from "./common.js";

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
 * NOT on the keyword-list page as of this fetch: "Discount", "Prerequisite" and "Starting" (all introduced in Fear No
 * Evil). Their definitions come from the Fear No Evil rulebook (fetched 2026-09-18, not stored in the repo), p. 3
 * "Featured Keywords"; see the shapes below. RRG 1.8 has no entry for any of the three, so each glossary entry is
 * `insert-not-in-repo` and `unverified` (docs/phase7-wave2.md §6.11, §7.5).
 *
 * Checked against RRG 1.8 (Jul 2026) for Phase 7 wave 1 (docs/phase7-wave1.md §1):
 * - Glossary entries exist for "Team-Up" (p. 43), "Teamwork (Trait)" (p. 43),
 *   "Requirement (Resources)" (p. 37) and "Linked (Card Title)" (p. 27).
 * - RRG 1.8 has no "Discount" entry at all.
 * - "Find" (p. 19) is defined as an instruction ("When instructed to find a
 *   card, a player searches each game area..."), not a keyword with a value, so
 *   the `find` shape below is unconfirmed.
 * - "Requirement (Resources)" reads "cannot be played unless each resource of
 *   the specified type is spent". Printed cards name up to three icons, so the
 *   shape counts icons (wave 2, docs/phase7-wave2.md §6.1).
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
  | "linked"
  | "prerequisite"
  | "starting";

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
      /**
       * The Fear No Evil rulebook, "Featured Keywords" (p. 3), and the printed reminder text on every card that has
       * it (Innate Reflexes 60038; Innate Aggression/Perception/Inspiration 61034/61036/61037): "Starting. (You may
       * add this card to your hand before drawing your starting hand.)" No parameters. It is a *setup* keyword: the
       * card is taken from the deck into hand before the opening draw, which is a step the engine does not have yet
       * (docs/phase7-wave2.md §7.5).
       */
      | "starting"
    >
  | (KeywordBase<"retaliate"> & { readonly value: number })
  /**
   * RRG 1.8 "Uses (X 'Type')" (p. 46). `countPerPlayer` is the printed per player icon (RRG 1.8 "Per Player Icon",
   * p. 32: it "multiplies that value by the number of players who started the scenario"), so the card enters play with
   * `count + countPerPlayer × players` counters:
   * - `Uses (2[per_hero] ammo counters).` (Crossbones' Machine Gun 04064) → `{ count: 0, countPerPlayer: 2 }`;
   * - `Uses (1 fury counter, plus 1[per_hero] additional fury counters).` (Fanaticism 16110) → `{ count: 1,
   *   countPerPlayer: 1 }`.
   * docs/phase7-wave3.md §1.3.
   */
  | (KeywordBase<"uses"> & { readonly count: number; readonly countPerPlayer?: number; readonly counterType: string })
  | (KeywordBase<"incite"> & { readonly value: number })
  /**
   * RRG 1.8 "Hinder X" (p. 22): "A card with the hinder X keyword enters play with X threat on it", in addition to any
   * threat it normally enters play with. 88 printed cards scale it by the per player icon (`Hinder 3[per_hero].`, most of
   * The Galaxy's Most Wanted's side schemes), so `perPlayer` holds the multiplier and X is `value + perPlayer × players`
   * (RRG 1.8 "Per Player Icon", p. 32). `Hinder 2[per_hero].` → `{ value: 0, perPlayer: 2 }`; `Hinder 4.` (the expert
   * Campaign Challenge side schemes, 16178b–16182b) → `{ value: 4 }`. docs/phase7-wave3.md §1.3.
   */
  | (KeywordBase<"hinder"> & { readonly value: number; readonly perPlayer?: number })
  | (KeywordBase<"victory"> & { readonly value: number })
  /**
   * RRG 1.8 "Requirement (Resources)" (p. 37): "A card with the requirement keyword cannot be played unless each
   * resource of the specified type is spent while paying for that card's cost", equivalent to "When paying this card's
   * resource cost, you must spend the following resources: [resources]", and it "cannot be played 'ignoring its resource
   * cost'". Cards print one to three icons, repeats included: `Requirement ([mental][mental])` (R&D Facility, 29020;
   * Honed Technique, 28017) and `Requirement ([energy] [mental] [physical])` (Spider-Man ally, 27049 / 52022).
   *
   * `resources` counts each icon printed (`{ mental: 2 }`, `{ energy: 1, mental: 1, physical: 1 }`); every count is a
   * positive whole number and at least one type is listed. `icon` is the wave 1 single-icon spelling, kept only so
   * existing emitters compile: `{ icon: "energy" }` means `{ resources: { energy: 1 } }`. Exactly one of the two is
   * set; read it through `requirementResources`. See docs/phase7-wave2.md §6.1.
   */
  | (KeywordBase<"requirement"> & { readonly resources?: ResourceIconCounts; readonly icon?: ResourceIconType })
  | (KeywordBase<"teamwork"> & { readonly sharedTrait: Trait })
  | (KeywordBase<"find"> & { readonly count?: number })
  /**
   * The Fear No Evil rulebook, "Featured Keywords" (p. 3): "Discount X (trait): When a player plays a card with discount
   * X, its resource cost is reduced by X if that player's identity has the specified trait. If more than one trait is
   * specified and the player's identity has at least one of the specified traits, the cost is reduced by X." Its FAQ
   * (p. 26): "the cost reduction is applied only once if your identity has any number of matching traits."
   *
   * Printed `Discount 1 (Martial Artist).` → `{ value: 1, traits: [MARTIAL ARTIST] }`; `Discount 1 (Attorney or
   * Police).` → `{ value: 1, traits: [ATTORNEY, POLICE] }` (an OR). RRG 1.8 has no Discount entry. See
   * docs/phase7-wave2.md §6.2.
   */
  | (KeywordBase<"discount"> & { readonly value: number; readonly traits: readonly Trait[] })
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
  | (KeywordBase<"linked"> & { readonly cardTitle?: string })
  /**
   * "Prerequisite (form or trait)", the Fear No Evil rulebook, "Featured Keywords" (p. 3). Printed as
   * `Prerequisite ([Defender]).` on Defend Our City (61029, `jj`), a player side scheme. RRG 1.8 has no entry.
   *
   * `traits` is an OR, spelled like `discount`'s; `form` is the identity-form half the rulebook's "form or trait"
   * names, which no emitted card prints yet. At least one of the two is required. **Exactly what the keyword gates
   * is unconfirmed** — this repo does not hold the rulebook — so it is data only and flagged in
   * docs/phase7-wave2.md §4.13. The closest existing shapes are `PlayRestrictions.form` and
   * `PlayRestrictions.requiresIdentityTrait`, which is what it most likely compiles to.
   */
  | (KeywordBase<"prerequisite"> & { readonly traits?: readonly Trait[]; readonly form?: "hero" | "alterEgo" });

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
  "prerequisite",
  "starting",
];

/**
 * The resources a Requirement keyword names, as icon counts (`{ icon }` read as one of that icon). Empty for any other
 * keyword. RRG 1.8 "Requirement (Resources)" (p. 37).
 */
export function requirementResources(keyword: KeywordInstance): ResourceIconCounts {
  if (keyword.name !== "requirement") return {};
  if (keyword.resources !== undefined) return keyword.resources;
  return keyword.icon !== undefined ? { [keyword.icon]: 1 } : {};
}
