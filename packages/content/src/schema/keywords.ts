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
  | "discount";

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
      | "teamUp"
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
  | (KeywordBase<"discount"> & { readonly value?: number });

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
];
