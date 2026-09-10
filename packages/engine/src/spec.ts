import type { Trait } from "@mc/content";
import type { PlayerId } from "./ids.js";
import type { Form } from "./state.js";

/**
 * The executable effect vocabulary. The Phase 2 ability DSL compiles down to
 * these; the stack knows how to run them and nothing else. Everything here is
 * plain JSON so an ability definition can be inspected, logged, and replayed.
 */

/** Card categories a target query can filter on. Broader than `AnyCard["type"]` on purpose. */
export type TargetCategory =
  | "character"
  | "enemy"
  | "villain"
  | "minion"
  | "ally"
  | "hero"
  | "alterEgo"
  | "identity"
  | "scheme"
  | "mainScheme"
  | "sideScheme"
  | "upgrade"
  | "support"
  | "attachment";

/** A data filter over card instances. `chooseTarget` and constant modifiers both use it. */
export interface TargetQuery {
  readonly categories?: readonly TargetCategory[];
  /** "you" = the ability's controller, "other" = any other player, "encounter" = no controller. */
  readonly controller?: "you" | "other" | "any" | "encounter";
  readonly engagedWith?: "you" | "any";
  readonly trait?: Trait;
  readonly exhausted?: boolean;
  readonly hasThreat?: boolean;
  readonly damaged?: boolean;
  readonly hasStatus?: "stunned" | "confused" | "tough";
  /** Restrict to (or exclude) the ability's own card. */
  readonly self?: boolean;
  readonly maxPrintedHp?: number;
  /** Only enemies this character is allowed to attack right now (RRG "Guard"). */
  readonly attackableBy?: TargetRef;
}

/** Names one instance without knowing its id at authoring time. */
export type TargetRef =
  | { readonly kind: "self" }
  | { readonly kind: "slot"; readonly slot: string }
  | { readonly kind: "eventSource" }
  | { readonly kind: "eventTarget" }
  | { readonly kind: "villain" }
  | { readonly kind: "mainScheme" }
  | { readonly kind: "identityOf"; readonly player: PlayerRef };

export type PlayerRef =
  | { readonly kind: "controller" }
  | { readonly kind: "eventPlayer" }
  | { readonly kind: "firstPlayer" }
  | { readonly kind: "each" }
  | { readonly kind: "id"; readonly playerId: PlayerId };

export type ValueSpec =
  | { readonly kind: "const"; readonly value: number }
  | { readonly kind: "perPlayer"; readonly base: number; readonly perPlayer: number }
  | { readonly kind: "stat"; readonly of: TargetRef; readonly stat: StatName }
  | { readonly kind: "counters"; readonly of: TargetRef; readonly counterType: string }
  | { readonly kind: "eventAmount" };

export type StatName = "atk" | "thw" | "def" | "rec" | "sch";

export type Predicate =
  | { readonly kind: "form"; readonly player: PlayerRef; readonly form: Form }
  | { readonly kind: "hasStatus"; readonly of: TargetRef; readonly status: "stunned" | "confused" | "tough" }
  | { readonly kind: "exists"; readonly query: TargetQuery }
  | { readonly kind: "counterAtLeast"; readonly of: TargetRef; readonly counterType: string; readonly amount: number }
  | { readonly kind: "damagedAtLeast"; readonly of: TargetRef; readonly amount: number }
  | { readonly kind: "not"; readonly of: Predicate };

export type StatusName = "stunned" | "confused" | "tough";

export type EffectSpec =
  | { readonly kind: "dealDamage"; readonly target: TargetRef; readonly amount: ValueSpec; readonly fromAttack?: boolean }
  | { readonly kind: "heal"; readonly target: TargetRef; readonly amount: ValueSpec }
  | { readonly kind: "placeThreat"; readonly target: TargetRef; readonly amount: ValueSpec }
  | { readonly kind: "removeThreat"; readonly target: TargetRef; readonly amount: ValueSpec }
  | { readonly kind: "draw"; readonly player: PlayerRef; readonly amount: ValueSpec }
  | { readonly kind: "discardFromHand"; readonly player: PlayerRef; readonly amount: ValueSpec; readonly random?: boolean }
  /** Turns the top N encounter cards faceup without revealing them (RRG "Search"). */
  | {
      readonly kind: "revealTopOfEncounterDeck";
      readonly count: number;
      readonly then: "discard" | "returnToTop";
    }
  | { readonly kind: "exhaust"; readonly target: TargetRef }
  | { readonly kind: "ready"; readonly target: TargetRef }
  | { readonly kind: "giveStatus"; readonly target: TargetRef; readonly status: StatusName }
  | { readonly kind: "removeStatus"; readonly target: TargetRef; readonly status: StatusName }
  | { readonly kind: "addCounters"; readonly target: TargetRef; readonly counterType: string; readonly amount: ValueSpec }
  | { readonly kind: "removeCounters"; readonly target: TargetRef; readonly counterType: string; readonly amount: ValueSpec }
  | { readonly kind: "attach"; readonly card: TargetRef; readonly to: TargetRef }
  | { readonly kind: "discardFromPlay"; readonly target: TargetRef }
  | { readonly kind: "putIntoPlay"; readonly card: TargetRef; readonly controller: PlayerRef }
  | { readonly kind: "dealEncounterCard"; readonly player: PlayerRef }
  | { readonly kind: "revealEncounterCard"; readonly player: PlayerRef }
  | { readonly kind: "addAccelerationToken" }
  | { readonly kind: "removeAccelerationToken" }
  /** Parks a `chooseTarget` choice for `chooser` and binds the answer to `slot`. */
  | {
      readonly kind: "chooseTarget";
      readonly slot: string;
      readonly query: TargetQuery;
      readonly chooser: PlayerRef;
      readonly count?: number;
      readonly optional?: boolean;
    }
  | { readonly kind: "if"; readonly condition: Predicate; readonly then: readonly EffectSpec[]; readonly otherwise?: readonly EffectSpec[] }
  /** RRG "Cancel": stops the interrupted event from resolving (its responses do not fire). */
  | { readonly kind: "cancelTriggeringEvent" };
