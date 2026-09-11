import type { Trait } from "@mc/content";
import type { FrameId, InstanceId, PlayerId } from "./ids.js";
import type { EffectSpec, StatName, TargetQuery, ValueSpec } from "./spec.js";
import type { Bindings, Vars } from "./stack.js";

/**
 * Lasting effects (RRG "Lasting Effects"): an effect that persists for a
 * duration after the ability that created it has resolved. They live in
 * `GameState.lastingEffects` as plain data, are treated like constant
 * abilities while active (the modifier layer reads them on every check), and
 * are removed when their duration ends (or, for "next card" effects, when used).
 */
export type LastingDuration =
  /** "Until the end of the phase" / "this phase". */
  | { readonly kind: "endOfPhase" }
  /** "Until the end of the round" / "this round". */
  | { readonly kind: "endOfRound" }
  /** "Until the end of this attack/activation": ends when that event frame finishes. */
  | { readonly kind: "endOfEvent"; readonly frameId: FrameId };

/** The context a lasting effect evaluates its values and queries in (the ability that created it). */
export interface LastingScope {
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  readonly vars: Vars;
  readonly bindings: Bindings;
}

/**
 * Which cards a lasting effect touches: the fixed cards chosen when it was
 * created (`targets`), or everything matching `affects` right now — a card
 * that starts matching later is affected too (RRG "Lasting Effects").
 */
export interface LastingReach {
  readonly targets: readonly InstanceId[] | null;
  readonly affects: TargetQuery | null;
}

/** What a lasting effect does. Extend this union for new lasting mechanics. */
export type LastingEffectBody =
  /** "Reduce the resource cost of the next card that player plays by N" — consumed by that player's next played card. */
  | { readonly kind: "costReduction"; readonly playerId: PlayerId; readonly amount: number }
  /** "Until the end of the phase, X gets +N STAT". `amount` is re-evaluated on every read. */
  | (LastingReach & {
      readonly kind: "statModifier";
      readonly stat: StatName | "hp" | "handSize";
      readonly amount: ValueSpec;
      readonly scope: LastingScope;
    })
  /** "Gain the [trait] trait until the end of the phase". */
  | (LastingReach & { readonly kind: "traitGrant"; readonly trait: Trait; readonly scope: LastingScope })
  /** A delayed effect ("At the end of the round, …"): fires when its duration ends. */
  | { readonly kind: "delayedEffects"; readonly effects: readonly EffectSpec[]; readonly scope: LastingScope };

export type LastingEffect = LastingEffectBody & {
  readonly id: string;
  readonly duration: LastingDuration;
};
