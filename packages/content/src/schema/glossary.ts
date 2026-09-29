import type { KeywordInstance, KeywordName } from "./keywords.js";
import { KNOWN_KEYWORD_NAMES } from "./keywords.js";

/**
 * Player-facing glossary for the Pause & Rules screen (`docs/phase4-screen-gaps.md`
 * §3 W4 "S6", §4 "Keyword glossary wording"). Every definition below is an original
 * paraphrase written for this repo, not a transcription of the RRG's own text — FFG's
 * wording is copyrighted, and §4 settles on "short paraphrase + cite" rather than
 * reproducing the Rules Reference Guide's entries verbatim.
 *
 * Sourcing:
 * - `{ kind: "rrg", page }` cites a real page of `mc_rulesreference_v18_compressed.pdf`
 *   (71 pages total) that this repo actually read for this entry — see the module's own
 *   ingestion notes in git history for how each page was located (the RRG's own two-page
 *   INDEX on pp. 2-3 gives every glossary term's page).
 * - `{ kind: "ruling", date }` cites a dated heading in `marvel-champions-rulings-post-rrg-1-7.md`
 *   (e.g. `"February 28, 2026 - Ruling 4"`, matching that file's own `###` heading text
 *   verbatim so it's directly greppable) whose answer clarifies this keyword/status in a way
 *   that applies generally, not just to the one card the question happened to be about.
 * - `{ kind: "insert-not-in-repo", product }` is for a keyword the schema enumerates that
 *   has no RRG entry at all because it comes from a later product this repo doesn't have
 *   (see `keywords.ts`'s own file-header note on "discount"). Entries sourced this way are
 *   `unverified: true` and must not be trusted as confirmed rules.
 *
 * `conflict` is set on the rare entry where a post-1.7 ruling's answer appears to say the
 * opposite of the RRG's own printed wording for that entry (CLAUDE.md: "Where a ruling and
 * the RRG disagree, ... flag the conflict rather than silently picking one"). Right now
 * that's "quickstrike" only — see its entry.
 *
 * What this module deliberately does NOT cover, and why:
 * - "exhausted", "ready", and "facedown boost card" are real RRG glossary entries (pp. 19,
 *   36, 47) and are genuinely table-visible, but `@mc/content`'s schema has no enum for
 *   any of them today — they're runtime card/instance state that only `@mc/engine` models
 *   (see `packages/engine/src/state.ts`). Per this task's own scope ("include only ones
 *   that exist in the schema today"), and since `@mc/content` must never depend on
 *   `@mc/engine` (CLAUDE.md's `client → cards → engine → content` dependency direction),
 *   they're left out here. A future glossary for those belongs wherever the client reads
 *   engine-facing status/state enums from, not in `@mc/content`.
 * - "villainStages"/card-type enums (Hero, Ally, Event, ...) are not "rules terms" a Pause
 *   screen glossary would list next to keywords/statuses; out of scope.
 *
 * Guided mode's G3a (`docs/guided-mode.md` §4 "Glossary") adds a third `kind`,
 * `"concept"`: basic rules vocabulary (threat, main scheme, thwart, ...) a first-time
 * player needs before "keyword" is even a meaningful word. Concepts follow the same
 * sourcing/paraphrase rules as keywords/statuses above, but — unlike a keyword — a concept
 * is never printed on a card and never gated on the current table/pool, so
 * `view/rules-reference.ts` always surfaces every one of them regardless of scope.
 */

/** Marks which real page of the RRG PDF, which dated ruling, or which un-owned product a definition was checked against. */
export type GlossarySource =
  | { readonly kind: "rrg"; readonly page: number }
  | { readonly kind: "ruling"; readonly date: string }
  | { readonly kind: "insert-not-in-repo"; readonly product: string };

export type GlossaryEntryKind = "keyword" | "status" | "concept";

export interface GlossaryEntry<Id extends string = string> {
  readonly id: Id;
  readonly kind: GlossaryEntryKind;
  /** What a player sees as the term's name (e.g. "Retaliate X", not the schema's "retaliate"). */
  readonly displayName: string;
  /** A short, original, plain-language paraphrase — never FFG's own card-glossary wording. */
  readonly definition: string;
  /** At least one source; a clarifying ruling (if any) comes after the primary RRG/insert source. */
  readonly sources: readonly [GlossarySource, ...GlossarySource[]];
  /** True when no source in `sources` is a confirmed RRG page — the definition is a best-effort placeholder. */
  readonly unverified?: boolean;
  /**
   * Set when a later ruling's answer reads as contradicting the RRG's own text for this entry; see
   * the module header. Implementer-facing: names the exact RRG page and ruling being weighed
   * against each other, for whoever has to pick this back up. Never rendered to a player directly —
   * `playerNote` (below) is the one-liner that is.
   */
  readonly conflict?: string;
  /**
   * The player-facing version of `conflict`: a short, neutral one-liner that says a ruling is
   * unsettled without picking a side or reading like an internal engineering note. Required
   * whenever `conflict` is set (CLAUDE.md: "flag the conflict rather than silently picking one" —
   * a player still deserves to know the table has to agree on something here, just not in
   * "this repo has not picked a side" wording).
   */
  readonly playerNote?: string;
}

/**
 * The three status cards a table can show, per RRG 1.8 "Status Cards" (p. 41). Not
 * imported from `@mc/engine`'s own `STATUS_NAMES` (`packages/engine/src/state.ts`) — that
 * would invert the `client → cards → engine → content` dependency direction. These three
 * literal ids are duplicated here deliberately; keep them in sync with the engine's own
 * enum by hand if a fourth status card is ever added.
 */
export type StatusName = "confused" | "stunned" | "tough";
export const STATUS_NAMES: readonly StatusName[] = ["confused", "stunned", "tough"];

/**
 * Basic-concept glossary ids (guided mode G3a, `docs/guided-mode.md` §4): first-game
 * vocabulary a new player needs before keywords make sense at all — not a keyword or a
 * status card, just an ordinary rules noun/verb the RRG defines on its own glossary page.
 * Kept as a fixed, explicit list (rather than derived from any schema enum) since these
 * concepts aren't backed by a `KeywordName`/`StatusName`-shaped union anywhere in the
 * schema — there's nothing to enumerate them *from*.
 */
export type ConceptId =
  | "threat"
  | "mainScheme"
  | "sideScheme"
  | "acceleration"
  | "thwart"
  | "attack"
  | "resource"
  | "cost"
  | "heroAlterEgoForm"
  | "flip"
  | "recover"
  | "exhaustCost"
  | "defend"
  | "consequentialDamage"
  | "encounterCard"
  | "boost"
  | "villainPhase"
  | "heroPhase"
  | "ally"
  | "aspect"
  | "handSize"
  | "mulligan"
  | "energyResource"
  | "mentalResource"
  | "physicalResource"
  | "wildResource";

export const CONCEPT_IDS: readonly ConceptId[] = [
  "threat",
  "mainScheme",
  "sideScheme",
  "acceleration",
  "thwart",
  "attack",
  "resource",
  "cost",
  "heroAlterEgoForm",
  "flip",
  "recover",
  "exhaustCost",
  "defend",
  "consequentialDamage",
  "encounterCard",
  "boost",
  "villainPhase",
  "heroPhase",
  "ally",
  "aspect",
  "handSize",
  "mulligan",
  "energyResource",
  "mentalResource",
  "physicalResource",
  "wildResource",
];

export type GlossaryId = KeywordName | StatusName | ConceptId;

const KEYWORD_GLOSSARY: Record<KeywordName, GlossaryEntry<KeywordName>> = {
  alliance: {
    id: "alliance",
    kind: "keyword",
    displayName: "Alliance",
    definition:
      "Any player may help pay the cost of a card with this keyword once its controller declares they're playing it, though only that controller is considered to have played it.",
    sources: [{ kind: "rrg", page: 6 }],
  },
  amplify: {
    id: "amplify",
    kind: "keyword",
    displayName: "Amplify",
    definition:
      "Every amplify icon in play adds one extra boost icon to each boost card turned face up during an enemy's activation, for as long as the icon stays in play.",
    sources: [
      { kind: "rrg", page: 7 },
      { kind: "ruling", date: "January 11, 2026 - Ruling 1" },
    ],
  },
  assault: {
    id: "assault",
    kind: "keyword",
    displayName: "Assault",
    definition:
      "A character making a basic thwart against a scheme with this keyword uses its ATK value instead of its THW value for that thwart.",
    sources: [{ kind: "rrg", page: 8 }],
  },
  find: {
    id: "find",
    kind: "keyword",
    displayName: "Find",
    definition:
      "An instruction to search every in-game area a card could be in (play areas, decks, discard piles, set-aside area, etc.) for a specific card; it can't reach facedown cards in play or the victory display, and can't reach a collection outside the current game.",
    sources: [
      { kind: "rrg", page: 19 },
      { kind: "ruling", date: "December 17, 2025 - Ruling 4" },
    ],
  },
  form: {
    id: "form",
    kind: "keyword",
    displayName: "[Type] Form",
    definition:
      'A card with this keyword ("Energy form.", "Mass form.") gives your identity an extra form beside hero and alter-ego while it is face up. Changing it doesn\'t use your once-per-round form change, but it does count as changing form for card effects.',
    sources: [{ kind: "rrg", page: 21 }],
  },
  guard: {
    id: "guard",
    kind: "keyword",
    displayName: "Guard",
    definition: "While a minion with this keyword is engaged with you, none of your cards can attack the villain.",
    sources: [
      { kind: "rrg", page: 21 },
      { kind: "ruling", date: "April 30, 2026 - Ruling 2" },
    ],
  },
  hinder: {
    id: "hinder",
    kind: "keyword",
    displayName: "Hinder X",
    definition:
      "A card with 'Hinder X' enters play carrying X threat already on it, in addition to any starting threat it would normally have.",
    sources: [{ kind: "rrg", page: 22 }],
  },
  incite: {
    id: "incite",
    kind: "keyword",
    displayName: "Incite X",
    definition:
      "When a card with 'Incite X' is revealed, it immediately places X threat on the main scheme — a separate effect from the rest of the card's text, so it still happens even if the rest of the card fails to do anything.",
    sources: [
      { kind: "rrg", page: 24 },
      { kind: "ruling", date: "June 25, 2026 - Ruling 4" },
    ],
  },
  linked: {
    id: "linked",
    kind: "keyword",
    displayName: "Linked (Card Title)",
    definition:
      "Cards named as 'linked' to another card can never be added to a deck by a player. They're only set aside during setup, one set for each deck that includes the named card that brings them in, and never count toward deck size.",
    sources: [
      { kind: "rrg", page: 27 },
      { kind: "ruling", date: "August 3, 2026 - Ruling 4" },
    ],
  },
  overkill: {
    id: "overkill",
    kind: "keyword",
    displayName: "Overkill",
    definition:
      "If an attack with this keyword defeats an ally or minion, any damage beyond what was needed to defeat it spills over onto that ally's controller (their identity) or onto the villain, instead of being wasted.",
    sources: [
      { kind: "rrg", page: 31 },
      { kind: "ruling", date: "January 26, 2026 - Ruling 3" },
    ],
  },
  patrol: {
    id: "patrol",
    kind: "keyword",
    displayName: "Patrol",
    definition: "While a minion with this keyword is engaged with you, none of your cards can thwart the main scheme.",
    sources: [{ kind: "rrg", page: 32 }],
  },
  peril: {
    id: "peril",
    kind: "keyword",
    displayName: "Peril",
    definition:
      "While a card with this keyword is being resolved, the player resolving it can't ask teammates for advice, and everyone else is locked out of playing cards or using abilities — including abilities on the peril card itself, while it's in that player's play area.",
    sources: [
      { kind: "rrg", page: 32 },
      { kind: "ruling", date: "July 9, 2026 - Ruling 3" },
    ],
  },
  permanent: {
    id: "permanent",
    kind: "keyword",
    displayName: "Permanent",
    definition:
      "A card with this keyword is set aside at the start of the game and, once in play, can only be defeated, removed from play, or have its text blanked by something from its own hero/scenario/modular set — nothing outside that set can touch it.",
    sources: [{ kind: "rrg", page: 32 }],
  },
  piercing: {
    id: "piercing",
    kind: "keyword",
    displayName: "Piercing",
    definition:
      "An attack with this keyword discards any tough status card from its target before dealing damage, so a tough status card doesn't stop it.",
    sources: [
      { kind: "rrg", page: 32 },
      { kind: "ruling", date: "January 17, 2026 - Ruling 3" },
    ],
  },
  quickstrike: {
    id: "quickstrike",
    kind: "keyword",
    displayName: "Quickstrike",
    definition: "A minion with this keyword attacks the hero it just engaged, right after engaging them.",
    sources: [
      { kind: "rrg", page: 36 },
      { kind: "ruling", date: "February 28, 2026 - Ruling 4" },
    ],
    conflict:
      "RRG 1.8 p. 36 states quickstrike 'resolves after any When Revealed abilities on that minion are resolved' when the minion is being revealed. The February 28, 2026 - Ruling 4 answer (item 2, the Hellcat example) instead says 'Quickstrike resolves first, followed by When Revealed' for that same case. This repo has not picked a side — implementers should treat the resolution order of quickstrike vs. a revealed minion's own When Revealed ability as unresolved pending a newer FFG clarification, rather than trusting either source alone.",
    playerNote: "Rulings differ on whether Quickstrike's attack happens before or after the minion's When Revealed.",
  },
  ranged: {
    id: "ranged",
    kind: "keyword",
    displayName: "Ranged",
    definition:
      "An attack with this keyword ignores the retaliate keyword — a retaliating character doesn't get to deal damage back from it.",
    sources: [{ kind: "rrg", page: 36 }],
  },
  requirement: {
    id: "requirement",
    kind: "keyword",
    displayName: "Requirement (Resources)",
    definition:
      "A card with this keyword can only be played by actually spending the specific resource type(s) it names as part of its cost — a card that lets a player ignore its resource cost still can't get around this.",
    sources: [{ kind: "rrg", page: 37 }],
  },
  restricted: {
    id: "restricted",
    kind: "keyword",
    displayName: "Restricted",
    definition:
      "A player can never keep more than two restricted cards in play at once; if a third ever ends up in play under their control, they immediately discard down to two of their choice.",
    sources: [{ kind: "rrg", page: 38 }],
  },
  retaliate: {
    id: "retaliate",
    kind: "keyword",
    displayName: "Retaliate X",
    definition:
      "After a character with 'Retaliate X' is attacked, it automatically deals X damage back to whoever attacked it, as long as the character is still in play once the attack finishes resolving.",
    sources: [
      { kind: "rrg", page: 38 },
      { kind: "ruling", date: "February 28, 2026 - Ruling 1" },
    ],
  },
  setup: {
    id: "setup",
    kind: "keyword",
    displayName: "Setup",
    definition:
      "A card with this keyword begins the game already in play, put there during the setup process rather than drawn and played normally.",
    sources: [{ kind: "rrg", page: 40 }],
  },
  stalwart: {
    id: "stalwart",
    kind: "keyword",
    displayName: "Stalwart",
    definition:
      "A character with this keyword can never be stunned or confused — gaining the keyword strips off any stunned/confused status cards it already has, and it can't pick up new ones.",
    sources: [{ kind: "rrg", page: 40 }],
  },
  steady: {
    id: "steady",
    kind: "keyword",
    displayName: "Steady",
    definition:
      "A character with this keyword can hold a second stunned and a second confused status card. It isn't actually stunned/confused (and its attack/scheme/thwart isn't canceled) until it holds two of the matching type at once.",
    sources: [{ kind: "rrg", page: 41 }],
  },
  surge: {
    id: "surge",
    kind: "keyword",
    displayName: "Surge",
    definition:
      "When a card with this keyword is revealed, the same player immediately deals themselves one more facedown encounter card, as a When Revealed effect that can itself be canceled.",
    sources: [
      { kind: "rrg", page: 42 },
      { kind: "ruling", date: "August 3, 2026 - Ruling 3" },
    ],
  },
  teamUp: {
    id: "teamUp",
    kind: "keyword",
    displayName: "Team-Up",
    definition:
      "This keyword names two characters. A player can only include the card in their deck if their identity is one of the two, and can't actually play it unless both named characters are in play at once.",
    sources: [{ kind: "rrg", page: 43 }],
  },
  teamwork: {
    id: "teamwork",
    kind: "keyword",
    displayName: "Teamwork (Trait)",
    definition:
      "When a minion with this keyword enters play and engages a player, if another minion sharing the named trait is already in play, the newly-entered minion immediately activates against that same player.",
    sources: [{ kind: "rrg", page: 43 }],
  },
  temporary: {
    id: "temporary",
    kind: "keyword",
    displayName: "Temporary",
    definition: "A card with this keyword is automatically discarded from play at the end of the round.",
    sources: [{ kind: "rrg", page: 44 }],
  },
  toughness: {
    id: "toughness",
    kind: "keyword",
    displayName: "Toughness",
    definition:
      "A character with this keyword enters play already holding a tough status card, including when it enters play during setup.",
    sources: [
      { kind: "rrg", page: 45 },
      { kind: "ruling", date: "April 30, 2026 - Ruling 3" },
    ],
  },
  uses: {
    id: "uses",
    kind: "keyword",
    displayName: 'Uses (X "Type")',
    definition:
      "A card with this keyword enters play holding X counters of the named type; the card's own ability spends those counters as (part of) its cost, and the card is discarded once its last counter is gone.",
    sources: [{ kind: "rrg", page: 46 }],
  },
  victory: {
    id: "victory",
    kind: "keyword",
    displayName: "Victory X",
    definition:
      "When a card with 'Victory X' would leave play by being defeated (or, for a card with 'Uses', by running out of counters), it goes to the shared victory display instead of a discard pile, where it's worth X victory points.",
    sources: [{ kind: "rrg", page: 46 }],
  },
  villainous: {
    id: "villainous",
    kind: "keyword",
    displayName: "Villainous",
    definition:
      "A character with this keyword is dealt a facedown boost card whenever it uses a basic power; the card is turned face up and its boost icons/ability apply only to that one use. Only the character actually activating gets a boost card this way.",
    sources: [
      { kind: "rrg", page: 47 },
      { kind: "ruling", date: "February 28, 2026 - Ruling 6" },
    ],
  },
  vulnerable: {
    id: "vulnerable",
    kind: "keyword",
    displayName: "Vulnerable",
    definition:
      "A character with this keyword is discarded the instant it becomes stunned or confused, rather than picking up the status card — and this discard isn't counted as that character being defeated.",
    sources: [{ kind: "rrg", page: 48 }],
  },
  discount: {
    id: "discount",
    kind: "keyword",
    displayName: "Discount X (Trait)",
    definition:
      "When you play this card, it costs X less if your identity has the named trait. With more than one trait named, having any one of them is enough, and the reduction still applies only once.",
    // Paraphrased from the Fear No Evil rulebook, "Featured Keywords" (p. 3) and its FAQ (p. 26), fetched 2026-09-18 and
    // read, but not stored in this repo (CLAUDE.md: per-product inserts are not in the repo yet), so it stays flagged.
    sources: [{ kind: "insert-not-in-repo", product: "Fear No Evil rulebook, p. 3" }],
    unverified: true,
  },
  prerequisite: {
    id: "prerequisite",
    kind: "keyword",
    displayName: "Prerequisite (Form or Trait)",
    definition:
      "This card can only be used by a player whose identity is in the named form, or has one of the named traits.",
    // The Fear No Evil rulebook, "Featured Keywords" (p. 3), fetched 2026-09-18 and read but not stored in the repo.
    // RRG 1.8 has no entry, and no printed card carries reminder text for it, so exactly what the keyword gates is
    // still open — docs/phase7-wave2.md §4.13.
    sources: [{ kind: "insert-not-in-repo", product: "Fear No Evil rulebook, p. 3" }],
    unverified: true,
  },
  starting: {
    id: "starting",
    kind: "keyword",
    displayName: "Starting",
    definition:
      "Before you draw your opening hand, you may take this card out of your deck and put it straight into your hand.",
    // Paraphrased from the reminder text printed on every card that has it (Innate Reflexes 60038, Innate Aggression
    // 61034, Innate Perception 61036, Innate Inspiration 61037) and the Fear No Evil rulebook, p. 3. No RRG entry.
    sources: [{ kind: "insert-not-in-repo", product: "Fear No Evil rulebook, p. 3" }],
    unverified: true,
  },
};

const STATUS_GLOSSARY: Record<StatusName, GlossaryEntry<StatusName>> = {
  confused: {
    id: "confused",
    kind: "status",
    displayName: "Confused",
    definition:
      "Cancels a character's very next scheme or thwart attempt: instead of scheming/thwarting, the confused card is discarded (any cost already paid to attempt it, such as exhausting the character, still stands).",
    sources: [
      { kind: "rrg", page: 13 },
      { kind: "ruling", date: "February 28, 2026 - Ruling 5" },
    ],
  },
  stunned: {
    id: "stunned",
    kind: "status",
    displayName: "Stunned",
    definition:
      "Cancels a character's very next attack attempt: instead of attacking, the stunned card is discarded (any cost already paid to attempt it still stands, and the card is still considered to have been played).",
    sources: [
      { kind: "rrg", page: 41 },
      { kind: "ruling", date: "August 13, 2026 - Ruling 1" },
    ],
  },
  tough: {
    id: "tough",
    kind: "status",
    displayName: "Tough",
    definition:
      "Prevents all damage the next time a character with this status would take any — the damage is fully prevented and a tough card is discarded instead, rather than the damage being reduced.",
    sources: [
      { kind: "rrg", page: 44 },
      { kind: "ruling", date: "March 6, 2026 - Ruling 1" },
    ],
  },
};

/**
 * Basic-concept entries for a first-time player (guided mode G3a): plain rules nouns/verbs
 * a new player runs into before "keyword" is even a meaningful word — threat, the two
 * scheme types, the basic powers, paying for cards, and the two phases of a round. Every
 * definition is an original paraphrase, not FFG's own glossary wording, same convention as
 * `KEYWORD_GLOSSARY`/`STATUS_GLOSSARY` above.
 *
 * Unlike keywords, concepts are never filtered by what's printed on the current card pool
 * or table — every one of them is relevant in every game, so `view/rules-reference.ts`
 * surfaces the full set unconditionally (see that module's own concept-entries constant).
 */
const CONCEPT_GLOSSARY: Record<ConceptId, GlossaryEntry<ConceptId>> = {
  threat: {
    id: "threat",
    kind: "concept",
    displayName: "Threat",
    definition:
      "Threat is what piles up on the main scheme and side schemes as the villain phase goes by. If the main scheme's threat reaches its target, the villain wins the game.",
    sources: [{ kind: "rrg", page: 44 }],
  },
  mainScheme: {
    id: "mainScheme",
    kind: "concept",
    displayName: "Main scheme",
    definition:
      "The main scheme is the villain's overall plan for the scenario. It automatically gains threat every villain phase, and heroes can thwart that threat away to buy time.",
    sources: [{ kind: "rrg", page: 27 }],
  },
  sideScheme: {
    id: "sideScheme",
    kind: "concept",
    displayName: "Side scheme",
    definition:
      "A side scheme is an extra objective that shows up next to the main scheme with its own starting threat. You don't have to clear it, but leaving it alone usually costs you.",
    sources: [{ kind: "rrg", page: 40 }],
  },
  acceleration: {
    id: "acceleration",
    kind: "concept",
    displayName: "Acceleration",
    definition:
      "Acceleration is extra threat placed on the main scheme every villain phase, on top of its own printed rate, from acceleration icons and tokens in play.",
    sources: [{ kind: "rrg", page: 5 }],
  },
  thwart: {
    id: "thwart",
    kind: "concept",
    displayName: "Thwart",
    definition:
      "Thwarting is a hero or ally's basic power to remove threat from a scheme. It costs exhausting the character, and removes threat equal to its THW value.",
    sources: [{ kind: "rrg", page: 44 }],
  },
  attack: {
    id: "attack",
    kind: "concept",
    displayName: "Attack",
    definition:
      "Attacking is a hero or ally's basic power to deal damage to an enemy. It costs exhausting the character, and deals damage equal to its ATK value.",
    sources: [{ kind: "rrg", page: 10 }],
  },
  resource: {
    id: "resource",
    kind: "concept",
    displayName: "Resource",
    definition:
      "Resources pay for the cards you play. You make them by discarding a card from your hand for its printed resource icon(s), or with a card's own Resource ability.",
    sources: [{ kind: "rrg", page: 37 }],
  },
  cost: {
    id: "cost",
    kind: "concept",
    displayName: "Cost",
    definition:
      "A cost is whatever you have to pay before a card or ability's effect happens — usually resources to play a card, but sometimes something else, like exhausting a card.",
    sources: [{ kind: "rrg", page: 13 }],
  },
  heroAlterEgoForm: {
    id: "heroAlterEgoForm",
    kind: "concept",
    displayName: "Hero form / alter-ego form",
    definition:
      "Every identity is in one of two forms, shown by which side of the identity card is face up. Each form has its own cards and powers, and you can flip between them once per turn.",
    sources: [{ kind: "rrg", page: 21 }],
  },
  flip: {
    id: "flip",
    kind: "concept",
    displayName: "Flip",
    definition:
      "Flipping a card turns it over to show its other side — most often your identity card changing form, but any double-sided card works the same way.",
    sources: [{ kind: "rrg", page: 20 }],
  },
  recover: {
    id: "recover",
    kind: "concept",
    displayName: "Recover",
    definition:
      "Recovering is your alter-ego's basic power to heal damage. It costs exhausting your alter-ego, and heals hit points equal to your REC value.",
    sources: [{ kind: "rrg", page: 36 }],
  },
  exhaustCost: {
    id: "exhaustCost",
    kind: "concept",
    displayName: "Exhaust (as a cost)",
    definition:
      "Many basic powers and abilities are paid for by exhausting the card using them, rotating it 90 degrees. It can't do that again until something readies it.",
    sources: [{ kind: "rrg", page: 19 }],
  },
  defend: {
    id: "defend",
    kind: "concept",
    displayName: "Defend",
    definition:
      "Defending puts a hero or ally between an enemy's attack and its actual target, so the defender takes the damage instead (reduced by DEF, for a hero's basic defense).",
    sources: [{ kind: "rrg", page: 15 }],
  },
  consequentialDamage: {
    id: "consequentialDamage",
    kind: "concept",
    displayName: "Consequential damage",
    definition:
      "Consequential damage is damage an ally takes automatically right after it attacks or thwarts, shown as small icons under its printed ATK/THW value.",
    sources: [{ kind: "rrg", page: 13 }],
  },
  encounterCard: {
    id: "encounterCard",
    kind: "concept",
    displayName: "Encounter card",
    definition:
      "Encounter cards are the villain side's cards — minions, treacheries, side schemes and the rest — dealt and revealed from the encounter deck to make the heroes' turn harder.",
    sources: [{ kind: "rrg", page: 17 }],
  },
  boost: {
    id: "boost",
    kind: "concept",
    displayName: "Boost",
    definition:
      "A boost card is dealt facedown to the villain when it attacks or schemes, then flipped face up during that activation to add its icons (and sometimes its own effect) to the total. Minions never get boost cards.",
    sources: [{ kind: "rrg", page: 11 }],
  },
  villainPhase: {
    id: "villainPhase",
    kind: "concept",
    displayName: "Villain phase",
    definition:
      "The villain phase is the part of the round where the main scheme gains threat, the villain and its minions activate, and everyone is dealt encounter cards to reveal.",
    sources: [{ kind: "rrg", page: 47 }],
  },
  heroPhase: {
    id: "heroPhase",
    kind: "concept",
    displayName: "Hero phase / player phase",
    // The RRG's own glossary heading is "Player Phase" (p. 34); this repo's UI and players
    // commonly call it the "hero phase" since it's when heroes act, so the entry covers both names.
    definition:
      "The player (hero) phase is the part of the round where each player, in turn order, plays cards and uses their identity's and allies' powers.",
    sources: [{ kind: "rrg", page: 34 }],
  },
  ally: {
    id: "ally",
    kind: "concept",
    displayName: "Ally",
    definition:
      "An ally is a friend or teammate you bring into play to fight alongside you. It attacks, thwarts, or defends by exhausting, the same way your own hero does.",
    sources: [{ kind: "rrg", page: 7 }],
  },
  aspect: {
    id: "aspect",
    kind: "concept",
    displayName: "Aspect",
    definition:
      "An aspect (Aggression, Justice, Leadership, Protection, or 'Pool) is the deckbuilding lane you pick for a deck — it opens up that aspect's cards to fill out your hero's own.",
    sources: [{ kind: "rrg", page: 8 }],
  },
  handSize: {
    id: "handSize",
    kind: "concept",
    displayName: "Hand size",
    definition:
      "Hand size is how many cards you're meant to be holding by the end of the player phase — draw up to it, or discard down to it, before the round moves on.",
    sources: [{ kind: "rrg", page: 21 }],
  },
  // RRG 1.8 Appendix II: Setup, step 15 (p. 51) — not a separate main-glossary entry (there's no standalone
  // "Mulligan" heading in the index), but a first-time player needs the word explained the same as any other
  // basic concept (guided mode G10e part 2, `docs/guided-mode.md` §5.3's opportunistic mulligan tip).
  mulligan: {
    id: "mulligan",
    kind: "concept",
    displayName: "Mulligan",
    definition:
      "The mulligan is a one-time do-over for your opening hand: at the start of the game you can discard any number of the cards you were dealt, then draw that many new ones.",
    sources: [{ kind: "rrg", page: 51 }],
  },
  // The four resource types (guided mode G7's lesson-2 reorder, `docs/guided-mode.md` §4): a card's printed icon
  // only matters when something specifically cares about its type (Black Cat's own text, The Power of Justice) —
  // otherwise any resource pays any cost, wild included.
  energyResource: {
    id: "energyResource",
    kind: "concept",
    displayName: "Energy resource",
    definition:
      "One of the four resource types. An energy icon generates one energy resource when spent — usable for any cost unless something specifically asks for a type.",
    sources: [{ kind: "rrg", page: 18 }],
  },
  mentalResource: {
    id: "mentalResource",
    kind: "concept",
    displayName: "Mental resource",
    definition:
      "One of the four resource types. A mental icon generates one mental resource when spent — usable for any cost unless something specifically asks for a type.",
    sources: [{ kind: "rrg", page: 28 }],
  },
  physicalResource: {
    id: "physicalResource",
    kind: "concept",
    displayName: "Physical resource",
    definition:
      "One of the four resource types. A physical icon generates one physical resource when spent — usable for any cost unless something specifically asks for a type.",
    sources: [{ kind: "rrg", page: 32 }],
  },
  wildResource: {
    id: "wildResource",
    kind: "concept",
    displayName: "Wild resource",
    definition:
      "One of the four resource types. A wild icon generates one resource you assign as energy, mental, physical, or wild when you spend it — the one type that counts as every other type at once.",
    sources: [{ kind: "rrg", page: 48 }],
  },
};

/** Every keyword/status/concept glossary entry, keyword ids first (in `keywords.ts`'s `KNOWN_KEYWORD_NAMES` order), then the three statuses, then the basic concepts (in `CONCEPT_IDS` order). */
export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  ...KNOWN_KEYWORD_NAMES.map((name) => KEYWORD_GLOSSARY[name]),
  ...STATUS_NAMES.map((name) => STATUS_GLOSSARY[name]),
  ...CONCEPT_IDS.map((id) => CONCEPT_GLOSSARY[id]),
];

const GLOSSARY_BY_ID: ReadonlyMap<GlossaryId, GlossaryEntry> = new Map(
  GLOSSARY_ENTRIES.map((entry) => [entry.id as GlossaryId, entry]),
);

/** Look up a single glossary entry by its keyword or status id. Returns `undefined` for an id the glossary doesn't cover. */
export function glossaryEntry(id: GlossaryId): GlossaryEntry | undefined {
  return GLOSSARY_BY_ID.get(id);
}

/**
 * The glossary entries that apply to a card, given the keyword list already on that card
 * (a face's `keywords`, a stage's `keywords`, etc. — every card/face/stage shape in the
 * schema exposes `readonly KeywordInstance[]` the same way). Statuses aren't part of a
 * card's printed keywords, so they're never included here; look them up with
 * `glossaryEntry` directly for whatever a board view's status-card display needs.
 *
 * Entries are returned in the order their keyword first appears on the card, with no
 * duplicates (a card that printed the same keyword twice, which the pool never does,
 * would still only get one entry).
 */
export function glossaryEntriesForKeywords(keywords: readonly KeywordInstance[]): GlossaryEntry[] {
  const seen = new Set<KeywordName>();
  const result: GlossaryEntry[] = [];
  for (const keyword of keywords) {
    if (seen.has(keyword.name)) continue;
    seen.add(keyword.name);
    const entry = KEYWORD_GLOSSARY[keyword.name];
    if (entry) result.push(entry);
  }
  return result;
}
