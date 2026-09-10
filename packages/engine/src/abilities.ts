import type { AbilityId } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import type { EffectSpec, Predicate, StatName, TargetQuery } from "./spec.js";
import type { Form } from "./state.js";
import type { TriggerEventKind } from "./trigger-events.js";

/**
 * How an ability's card must relate to an event for the ability to trigger.
 * `selfIs` covers "when *this card* is attacked / deals damage / …" and
 * `playerIs` covers "…attacks *you*".
 */
export interface EventPattern {
  readonly on: TriggerEventKind;
  readonly selfIs?: "source" | "target" | "either";
  readonly playerIs?: "controller";
  /** The originally-attacked player rather than the final target (RRG p.9). */
  readonly usesAttackedPlayer?: boolean;
  readonly targetIs?: TargetQuery;
  readonly fromAttack?: boolean;
}

export type AbilityTriggerSpec =
  | { readonly kind: "action"; readonly form?: Form }
  | { readonly kind: "resource" }
  /** `form` is the "Hero Interrupt" / "Alter-Ego Response" gate on the controller. */
  | { readonly kind: "interrupt"; readonly forced: boolean; readonly on: EventPattern; readonly form?: Form }
  | { readonly kind: "response"; readonly forced: boolean; readonly on: EventPattern; readonly form?: Form }
  | { readonly kind: "whenRevealed" }
  | { readonly kind: "whenDefeated" }
  | { readonly kind: "boost" }
  | { readonly kind: "setup" }
  | { readonly kind: "constant"; readonly modifiers: readonly StatModifierSpec[] };

/** A constant ability's stat change. `while` gates it (RRG "Constant Abilities"). */
export interface StatModifierSpec {
  readonly stat: StatName | "hp" | "handSize";
  readonly amount: number;
  readonly target: TargetQuery;
  readonly while?: Predicate;
}

/** What an `action` ability costs to initiate (RRG "Cost"). */
export interface AbilityCost {
  readonly exhaustSelf?: boolean;
  readonly resources?: number;
  readonly spendCounters?: { readonly counterType: string; readonly amount: number };
  readonly damageSelf?: number;
}

export interface AbilityLimit {
  readonly count: number;
  readonly period: "turn" | "phase" | "round";
}

export interface AbilityDefinition {
  readonly trigger: AbilityTriggerSpec;
  readonly cost?: AbilityCost;
  readonly limit?: AbilityLimit;
  readonly effects: readonly EffectSpec[];
  /** Resource abilities only: how many resources triggering this generates. */
  readonly generates?: number;
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
