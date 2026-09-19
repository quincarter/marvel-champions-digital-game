import type { Trait } from "../common.js";
import type { KeywordName } from "../keywords.js";

/**
 * Where an attachment (encounter attachment or player upgrade) may be attached.
 * Shared by `AttachmentCard.attachesTo` and `UpgradeCard.attachesTo`.
 *
 * RRG 1.8 "Attach To" (p. 8): the "attach to" phrase "is checked for legality when the card would
 * be attached", and a card that cannot attach and cannot remain where it was is discarded.
 *
 * Phase 2 kinds:
 * - `villain`: "Attach to the villain". In a scenario with one villain, a host that names that villain
 *   ("Attach to Rhino") is also `villain`. With several villains in play, "the villain" means the active
 *   villain (The Wrecking Crew insert, "The Active Villain": "Any card effect that refers to 'the villain'
 *   only refers to the active villain"), and a host that names one of them is `namedVillain`.
 * - `hero` means any hero-form identity; `anyCharacter` is any character in play (identities, allies,
 *   minions, the villain).
 * - `namedCard`: "Attach to the Ultron Drones environment", the in-play card with that exact printed name.
 * - `minionWithHighestPrintedHp`: "Attach to the minion with the highest printed hit points [and without
 *   another <name> attached]". The same host as `superlative` over minions by printed HP, kept because Core
 *   data uses it. When several are tied on an encounter card, the first player chooses (RRG 1.8 "First
 *   Player": "If an encounter card targets a specific player or card, and there are multiple eligible targets,
 *   the first player selects among the eligible options").
 *
 * Phase 7 kinds (examples from wave 1 cards in `wave1.test.ts`):
 * - `namedVillain`: "Attach to Wrecker." when several villains are in play.
 * - `scheme`: "Attach to a scheme." (main or side scheme).
 * - `villainSideScheme`: "Attach to the active villain's side scheme." (Held Hostage), the side scheme whose
 *   `SideSchemeCard.signatureOf` names that villain.
 * - `yourIdentity`: "Attach to your identity card." (All Tied Up, Media Coverage) and, with `form: "hero"`,
 *   "Attach to your hero." (Counterspell). On an encounter card, "your" is the player revealing it (RRG 1.8
 *   "You, Your"); if that identity is not in the named form the card cannot attach. RRG 1.8 FAQ "Counterspell
 *   (#30)": "Because it is unable to meet its condition, simply discard it."
 * - `friendlyCharacter`: "Attach to a friendly character." (Honorary Avenger). RRG 1.8 "Friendly": cards the
 *   players control.
 * - `qualified`: a category narrowed by a trait, a missing trait, or a missing named attachment ("an X-MEN
 *   ally", "a non-ELITE minion", "a Sentinel minion without Stun Beam attached"). At least one qualifier is
 *   required; an unqualified category uses its plain kind.
 * - `superlative`: "the enemy with the highest printed hit points and without another Goblin Glider attached"
 *   (Goblin Glider), and later packs' "the minion with the most remaining hit points", "the enemy with the
 *   lowest ATK". Ties are chosen as for `minionWithHighestPrintedHp`.
 *
 * Phase 7 wave 2 kind:
 * - `ifAble`: "Attach to Yellowjacket, if able. If you cannot, attach to the villain." (Size Increase; Beetle Armor
 *   MK IV, Vibration Resistance) and "Attach to Crossfire. Otherwise, attach to the villain." (Crossfire's Rifle).
 *   `preferred` is tried first; only when it yields no legal host is `otherwise` tried. Both are evaluated when the
 *   card would be attached (RRG 1.8 "Attach To", p. 8). Neither may itself be `ifAble`.
 *
 * Wave 2 schema pass for later packs (docs/phase7-wave2.md §6):
 * - `anyOf`: "Attach to an enemy or scheme." (Acute Tactility, Enhanced Olfaction), "Attach to Greycrow or Harpoon."
 *   (Favored Weapon's preferred host), "Attach to an X-FORCE or X-MEN ally." (Advanced Suit). Every candidate of every
 *   listed host is legal, deduplicated, in the order listed. Neither `ifAble` nor `anyOf` may be listed inside it.
 * - `leader`: "the enemy leader" / "your leader" (Civil War). RRG 1.8 "Leader" (p. 26): "The leader card type follows
 *   the same rules as the villain card type for all purposes." In cooperative play (the only mode built), the Civil War
 *   rulebook, "Playing a Custom Scenario Cooperatively" (p. 6): "The leader in play is called 'the enemy leader.'" and
 *   "A card ability that refers to 'your leader' cannot be resolved." So `enemy` is the villain and `yours` has no
 *   host. Ruling, Jul 9, 2026 (3) answer 2: "Outside Civil War scenarios, 'enemy leader' refers to the villain."
 * - `nonActiveVillain`: "Attach to the villain who is not the active villain." (Direct Assault, `mts`): each villain in
 *   play other than the one with the active counter.
 * - `HostQualifiers.withoutKeyword` / `keyword`: "a non-permanent side scheme" (Containment Strategy, The Direct
 *   Approach). Permanent is a keyword, not a trait, so `withoutTrait` cannot say it.
 * - `HostMeasure` `activationOrder` ("the villain with the highest activation order value", The Sinister Six) and
 *   `traitCount` ("the minion with the most traits", Cyborg Tech).
 *
 * Wave 2 data-pipeline requests (docs/phase7-wave2-data.md Part 3 §5; docs/phase7-wave2.md §7):
 * - `encounterCard`: "Attach to an encounter card in play." (Coordinated Effort 58032) — any card in play on the
 *   encounter side, whatever its type, as opposed to a specific category. RRG 1.8 "Encounter Card" (p. 18).
 * - `SuperlativeHostPool` `ally` and `HostMeasure` `printedCost`: "Attach to the ally with the highest cost without
 *   [this] attached" (Beguiled 25031, 'Pool-ized 44041). The measure is the card's **printed** cost (RRG 1.8
 *   "Printed", p. 35) — a card in play has no other cost, since cost modifiers apply only while it is being played.
 * - `HostQualifiers.titleContains`: "a character with 'Spider' in its title" (Warrior of the Great Web 30029) — a
 *   substring of the **title**, which RRG 1.8 "Subtitle" (p. 41) keeps distinct from the subtitle beneath it, so an
 *   ally's subtitle is not searched. Matched against the title the card is currently showing (a flipped identity's
 *   current face), the same face `namedCard` compares against.
 * - `HostQualifiers.attackedThisTurnBy`: "an enemy that X-23 or Honey Badger attacked this turn" (Puncture Wound
 *   43012) — the one *temporal* qualifier in the pool, listing the card titles whose attacks count. **Data only:**
 *   the engine records no per-turn attack history, so it resolves to no legal host until it does (see
 *   docs/phase7-wave2.md §7.4).
 *
 * A kind the engine cannot resolve yields no legal host, so the attachment is discarded. Card data that uses
 * a kind the engine does not resolve yet must not be marked playable (docs/phase7-wave1.md §3.1).
 */
export type AttachmentHost =
  | { readonly kind: "villain" }
  | { readonly kind: "namedVillain"; readonly name: string }
  | { readonly kind: "mainScheme" }
  | { readonly kind: "sideScheme" }
  | { readonly kind: "scheme" }
  | { readonly kind: "villainSideScheme"; readonly of: "activeVillain" | { readonly villainName: string } }
  | { readonly kind: "hero" }
  | { readonly kind: "yourIdentity"; readonly form?: "hero" | "alterEgo" }
  | { readonly kind: "ally" }
  | { readonly kind: "minion" }
  | { readonly kind: "enemy" }
  | { readonly kind: "anyCharacter" }
  | { readonly kind: "friendlyCharacter" }
  | ({ readonly kind: "qualified"; readonly category: AttachmentHostCategory } & HostQualifiers)
  | { readonly kind: "namedCard"; readonly name: string }
  | { readonly kind: "minionWithHighestPrintedHp"; readonly withoutAttachmentNamed?: string }
  | ({
      readonly kind: "superlative";
      readonly among: SuperlativeHostPool;
      readonly order: "highest" | "lowest";
      readonly measure: HostMeasure;
    } & HostQualifiers)
  | { readonly kind: "ifAble"; readonly preferred: AttachmentHost; readonly otherwise: AttachmentHost }
  | { readonly kind: "anyOf"; readonly hosts: readonly [AttachmentHost, AttachmentHost, ...AttachmentHost[]] }
  | { readonly kind: "leader"; readonly of: "enemy" | "yours" }
  | { readonly kind: "nonActiveVillain" }
  | { readonly kind: "encounterCard" };

export type AttachmentHostKind = AttachmentHost["kind"];

export const ATTACHMENT_HOST_KINDS: readonly AttachmentHostKind[] = [
  "villain",
  "namedVillain",
  "mainScheme",
  "sideScheme",
  "scheme",
  "villainSideScheme",
  "hero",
  "yourIdentity",
  "ally",
  "minion",
  "enemy",
  "anyCharacter",
  "friendlyCharacter",
  "qualified",
  "namedCard",
  "minionWithHighestPrintedHp",
  "superlative",
  "ifAble",
  "anyOf",
  "leader",
  "nonActiveVillain",
  "encounterCard",
];

/** The card categories a `qualified` host narrows. `character` is any character in play. */
export type AttachmentHostCategory = "ally" | "minion" | "enemy" | "character" | "friendlyCharacter" | "sideScheme";

export const ATTACHMENT_HOST_CATEGORIES: readonly AttachmentHostCategory[] = [
  "ally",
  "minion",
  "enemy",
  "character",
  "friendlyCharacter",
  "sideScheme",
];

/**
 * Narrowing clauses shared by `qualified` and `superlative` hosts.
 * - `trait`: "an X-MEN ally" (printed or gained traits, RRG 1.8 "Gains").
 * - `withoutTrait`: "a non-ELITE minion", "without the Aerial trait".
 * - `withoutAttachmentNamed`: "without another Goblin Glider attached", "without a copy of Gene Therapy attached".
 * - `keyword` / `withoutKeyword` (wave 2): "a non-permanent side scheme" is `withoutKeyword: "permanent"`. A keyword
 *   counts whether printed or gained (RRG 1.8 "Gains").
 * - `titleContains`: "a character with 'Spider' in its title" — a case-sensitive substring of the title the card is
 *   currently showing. Not the subtitle: RRG 1.8 "Subtitle" (p. 41) defines it as a separate line "beneath the
 *   title", so "Spider-Man (Miles Morales)" matches on its title and "Hawkeye (Kate Bishop)" does not match "Kate".
 * - `attackedThisTurnBy`: "an enemy that X-23 or Honey Badger attacked this turn" — card titles whose attacks this
 *   turn make an enemy a legal host. **Data only** until the engine records per-turn attack history
 *   (docs/phase7-wave2.md §7.4); an empty list is refused, since it could only mean "no host".
 *
 * Every qualifier is ANDed.
 */
export interface HostQualifiers {
  readonly trait?: Trait;
  readonly withoutTrait?: Trait;
  readonly withoutAttachmentNamed?: string;
  readonly keyword?: KeywordName;
  readonly withoutKeyword?: KeywordName;
  readonly titleContains?: string;
  readonly attackedThisTurnBy?: readonly string[];
}

/** What a `superlative` host ranks candidates among. */
export type SuperlativeHostPool = "minion" | "enemy" | "villain" | "friendlyCharacter" | "ally";

export const SUPERLATIVE_HOST_POOLS: readonly SuperlativeHostPool[] = ["minion", "enemy", "villain", "friendlyCharacter", "ally"];

/**
 * The value a `superlative` host ranks by. `printedHp`/`printedAtk` are the printed values (RRG 1.8 "Printed");
 * a villain's printed hit points carry the per player icon, which "multiplies that value by the number of players
 * who started the scenario" (RRG 1.8 "Per Player Icon"). `remainingHp`, `atk` and `sch` are current values.
 *
 * Wave 2 (docs/phase7-wave2.md §6.7):
 * - `activationOrder`: the villain's printed activation order value (`VillainCard.activationOrder`; The Sinister Six,
 *   whose villains print "Activation Order 1"–"6"). Only with `among: "villain"`; a villain without one is no candidate.
 * - `traitCount`: how many traits the card has, printed or gained (RRG 1.8 "Gains"): "the minion with the most traits".
 *
 * Wave 2 data-pipeline request (docs/phase7-wave2-data.md Part 3 §5):
 * - `printedCost`: the card's printed resource cost ("the ally with the highest cost", Beguiled, 'Pool-ized). A card
 *   in play has no other cost — cost modifiers change what a card costs *to play*, not what it costs once in play —
 *   so this is the printed value (RRG 1.8 "Printed", p. 35), named like `printedHp`/`printedAtk`. A card with no
 *   printed cost is no candidate.
 */
export type HostMeasure = "printedHp" | "remainingHp" | "printedAtk" | "atk" | "sch" | "activationOrder" | "traitCount" | "printedCost";

export const HOST_MEASURES: readonly HostMeasure[] = [
  "printedHp",
  "remainingHp",
  "printedAtk",
  "atk",
  "sch",
  "activationOrder",
  "traitCount",
  "printedCost",
];

/**
 * Stat changes printed in an attachment's stat boxes (Charge +3 ATK, Program
 * Transmitter +1 SCH). The engine applies them as constant modifiers to the
 * host while the attachment is attached.
 */
export interface PrintedStatModifiers {
  readonly atk?: number;
  readonly sch?: number;
  readonly thw?: number;
  readonly hp?: number;
}
