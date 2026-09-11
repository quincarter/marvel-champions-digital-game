import type { AbilityId, KeywordInstance, Trait } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import type { ResourcePool, ResourceRequirement, TypedResource } from "./resources.js";
import type { EffectSpec, Predicate, StatName, TargetQuery, ValueSpec } from "./spec.js";
import type { Form } from "./state.js";
import type { TriggerEventKind } from "./trigger-events.js";

/**
 * How an ability's card must relate to an event for the ability to trigger.
 * `selfIs` covers "when *this card* is attacked / deals damage / …" and
 * `playerIs` covers "…attacks *you*".
 */
export interface EventPattern {
  /** One event kind, or several: "After Madame Hydra schemes or attacks" → `["enemyScheme", "enemyAttack"]`. */
  readonly on: TriggerEventKind | readonly TriggerEventKind[];
  readonly selfIs?: "source" | "target" | "either";
  readonly playerIs?: "controller";
  /** The originally-attacked player rather than the final target (RRG p.9). */
  readonly usesAttackedPlayer?: boolean;
  readonly targetIs?: TargetQuery;
  /** The event's source must match: "When Rhino attacks" → `{ categories: ["villain"] }`; "When attached enemy attacks" → `{ hostOfSelf: true }`. */
  readonly sourceIs?: TargetQuery;
  readonly fromAttack?: boolean;
  /**
   * Results the event must have produced, read at response time: "after X
   * attacks and damages" → `{ damage: 1 }`, "…and defeats" → `{ defeated: 1 }`,
   * "…undefended" → `{ undefended: 1 }`. Keys are the event's `results`.
   */
  readonly requireResults?: Readonly<Record<string, number>>;
  /** "After you make a basic attack" → `basic`; "(attack)" abilities → `ability`. */
  readonly attackKind?: "basic" | "ability";
}

/**
 * RRG "Labeled Ability": "(attack)" / "(thwart)" / "(defense)". The player's
 * identity performs the labeled action once the ability begins resolving; a
 * stunned (attack) or confused (thwart) identity cancels the whole ability
 * except its costs. A defense label makes the identity the defender of the
 * current enemy attack if it has none (no DEF reduction, no exhaust).
 */
export type AbilityLabel = "attack" | "thwart" | "defense";

export type AbilityTriggerSpec =
  | { readonly kind: "action"; readonly form?: Form }
  /** "Resource:" / "Hero Resource:" — triggered while paying a cost. */
  | { readonly kind: "resource"; readonly form?: Form }
  /** `form` is the "Hero Interrupt" / "Alter-Ego Response" gate on the controller. */
  | { readonly kind: "interrupt"; readonly forced: boolean; readonly on: EventPattern; readonly form?: Form }
  | { readonly kind: "response"; readonly forced: boolean; readonly on: EventPattern; readonly form?: Form }
  | { readonly kind: "whenRevealed" }
  | { readonly kind: "whenDefeated" }
  | { readonly kind: "boost" }
  | { readonly kind: "setup" }
  /** RRG "Special": resolves only when another ability instructs it (`resolveSpecials`; Wakanda Forever!). */
  | { readonly kind: "special" }
  | {
      readonly kind: "constant";
      readonly modifiers?: readonly StatModifierSpec[];
      /** "X gains retaliate 1" — keywords the matching cards gain while this card is in play. */
      readonly keywordGrants?: readonly KeywordGrantSpec[];
      /** "Captain Marvel gains the Aerial trait". */
      readonly traitGrants?: readonly TraitGrantSpec[];
      /** Rule restrictions: "cannot take damage", "threat cannot be removed", ally limit, "must defend with an ally". */
      readonly rules?: readonly RuleSpec[];
      /**
       * "Double the resources this card generates while paying for an
       * [aspect] card" (The Power of X): multiplies this card's printed
       * resources when it is discarded to pay for a card matching the query.
       */
      readonly resourceMultiplier?: { readonly factor: number; readonly whilePayingFor: TargetQuery };
    };

/** A constant ability's stat change. `while` gates it (RRG "Constant Abilities"). */
export interface StatModifierSpec {
  readonly stat: StatName | "hp" | "handSize";
  /**
   * A number, or a value read from game state on every check: "+1 THW for each
   * side scheme in play" (`count`), "X is equal to Titania's remaining hit
   * points" (`remainingHp`), "+1 hand size per Tech upgrade (max 7)" (`scaled`),
   * "+1 DEF (+2 instead if you have the Aerial trait)" (`conditional`).
   */
  readonly amount: number | ValueSpec;
  readonly target: TargetQuery;
  readonly while?: Predicate;
  /**
   * Replace the base value instead of adding: "Each facedown Drone minion has a
   * base SCH of 1, a base ATK of 1, and a base hit points of 1" (Ultron Drones).
   * Additive modifiers still apply on top.
   */
  readonly setBase?: boolean;
}

/** "X gains [keyword]" while the granting card is in play. */
export interface KeywordGrantSpec {
  readonly keyword: KeywordInstance;
  readonly target: TargetQuery;
  readonly while?: Predicate;
}

/** "X gains the [trait] trait" while the granting card is in play. */
export interface TraitGrantSpec {
  readonly trait: Trait;
  readonly target: TargetQuery;
  readonly while?: Predicate;
}

/** Rule restrictions a constant ability imposes (RRG "Cannot" wins over "can"). */
export type RuleSpec =
  /** "X cannot take damage [while …]" (Ultron III, Madame Hydra); `fromSource`: "…from Black Panther upgrades" (Killmonger). */
  | { readonly kind: "cannotTakeDamage"; readonly target: TargetQuery; readonly while?: Predicate; readonly fromSource?: TargetQuery }
  /** "Threat cannot be removed from this scheme" (Countdown to Oblivion). */
  | { readonly kind: "threatCannotBeRemoved"; readonly target: TargetQuery; readonly while?: Predicate }
  /** "Increase your ally limit by N" — for the controller of the card (The Triskelion). */
  | { readonly kind: "allyLimit"; readonly amount: number }
  /** "The engaged player must defend against [attacker]'s attacks with an ally they control, if able" (Melter). */
  | { readonly kind: "mustDefendWithAlly"; readonly attacker: TargetQuery; readonly while?: Predicate };

/** Where a cost may pick a card from (outside play). */
export interface CardZoneQuery {
  readonly zone: "discard" | "hand" | "deck";
  /** Whose zone: the paying player's, or any player's. */
  readonly player: "you" | "any";
  readonly query?: TargetQuery;
}

/**
 * What an ability costs to initiate (RRG "Cost"). Every component is paid at
 * once when the ability is initiated; if any component can't be paid in full,
 * the ability can't be initiated. Cards the player picks as part of a cost are
 * named up front in the command's `costChoices` (keyed by the slot named here)
 * and are bound into the ability's effects under the same slot.
 */
export interface AbilityCost {
  /** "Exhaust [this card] →". */
  readonly exhaustSelf?: boolean;
  /** "Spend a [energy] resource" → `{ energy: 1 }`; "Spend [E][M][P]" → one of each. A number is a generic amount. */
  readonly resources?: number | ResourceRequirement;
  /**
   * "Spend X [energy] resources →": X is every resource in the payment usable
   * as that type (beyond any fixed `resources`), bound to var `bind`.
   */
  readonly resourcesX?: { readonly resource: TypedResource; readonly bind: string; readonly min?: number };
  /** "Remove 1 web counter from it →". */
  readonly spendCounters?: { readonly counterType: string; readonly amount: number };
  /** "Take 1 damage →" (Focused Rage): the controller's identity takes the damage. */
  readonly damageSelf?: number;
  /** "Deal 2 damage to him →" (War Machine): this card takes the damage. */
  readonly damageThisCard?: number;
  /** "Heal 1 damage from Captain Marvel →": the controller's identity must have that much damage to heal. */
  readonly healIdentity?: number;
  /**
   * "Discard [this card] →" (Cosmic Flight, Tenacity, Energy Channel). The
   * card's counters are snapshotted into vars `self.counters.<type>` first, so
   * "for each counter here" still reads them after the discard.
   */
  readonly discardSelf?: boolean;
  /** "Exhaust your hero →" / "Exhaust your identity →" (encounter-card Hero Actions). */
  readonly exhaustIdentity?: boolean;
  /**
   * "Choose and discard 1 card from your hand →" (min 1, max 1) / "Choose and
   * discard up to 5 cards" (min 0, max 5). Picked in `costChoices.discard`;
   * the cards are bound to slot `discard` and their count to var `bind`.
   */
  readonly discardFromHand?: { readonly min: number; readonly max: number; readonly bind?: string };
  /**
   * "Pay the printed cost of an ally in any player's discard pile →" (Make the
   * Call): the card picked in `costChoices[slot]` adds its printed cost to the
   * resource requirement and is bound to `slot`.
   */
  readonly payPrintedCostOf?: { readonly slot: string; readonly from: CardZoneQuery };
}

export interface AbilityLimit {
  readonly count: number;
  readonly period: "turn" | "phase" | "round";
}

/**
 * What a resource ability generates. A bare number is that many wild
 * resources; a pool is typed ("Generate a [mental] resource" → `{ mental: 1 }`);
 * `topCardOfDiscard` copies the printed resources of the top card of the
 * controller's discard pile (Pepper Potts).
 */
export type ResourceGeneration =
  | number
  | Partial<ResourcePool>
  | { readonly kind: "topCardOfDiscard" };

export interface AbilityDefinition {
  readonly trigger: AbilityTriggerSpec;
  readonly cost?: AbilityCost;
  readonly limit?: AbilityLimit;
  readonly label?: readonly AbilityLabel[];
  readonly effects: readonly EffectSpec[];
  /** Resource abilities only. Defaults to 1 wild resource. */
  readonly generates?: ResourceGeneration;
}

/** Ability definitions are engine-side data keyed by the `AbilityId` printed on cards. */
export type AbilityRegistry = Readonly<Record<string, AbilityDefinition>>;

export const NO_ABILITIES: AbilityRegistry = {};

export interface EngineDeps {
  readonly abilities: AbilityRegistry;
}

export const DEFAULT_DEPS: EngineDeps = { abilities: NO_ABILITIES };

/** One ability on one card, as found by the trigger matcher. */
export interface AbilitySource {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  readonly controllerId: PlayerId | null;
  readonly definition: AbilityDefinition;
}

export const abilityUseKey = (instanceId: InstanceId, abilityId: AbilityId): string =>
  `${instanceId}:${abilityId}`;
