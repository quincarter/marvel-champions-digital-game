import type { Trait } from "../common.js";

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
    } & HostQualifiers);

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
 */
export interface HostQualifiers {
  readonly trait?: Trait;
  readonly withoutTrait?: Trait;
  readonly withoutAttachmentNamed?: string;
}

/** What a `superlative` host ranks candidates among. */
export type SuperlativeHostPool = "minion" | "enemy" | "villain" | "friendlyCharacter";

export const SUPERLATIVE_HOST_POOLS: readonly SuperlativeHostPool[] = ["minion", "enemy", "villain", "friendlyCharacter"];

/**
 * The value a `superlative` host ranks by. `printedHp`/`printedAtk` are the printed values (RRG 1.8 "Printed");
 * a villain's printed hit points carry the per player icon, which "multiplies that value by the number of players
 * who started the scenario" (RRG 1.8 "Per Player Icon"). `remainingHp`, `atk` and `sch` are current values.
 */
export type HostMeasure = "printedHp" | "remainingHp" | "printedAtk" | "atk" | "sch";

export const HOST_MEASURES: readonly HostMeasure[] = ["printedHp", "remainingHp", "printedAtk", "atk", "sch"];

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
