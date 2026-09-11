import type { AbilityId } from "@mc/content";
import type { ChoiceId, FrameId, InstanceId, PlayerId } from "./ids.js";
import type { ResourceRequirement } from "./resources.js";
import type { WindowTiming } from "./stack.js";
import type { TriggerEvent } from "./trigger-events.js";

/**
 * An enemy attack in progress. Kept for clients that render the defend prompt;
 * the authoritative copy of the attack lives in the `enemyAttack` stack frame.
 */
export interface AttackInProgress {
  readonly enemyInstanceId: InstanceId;
  readonly targetPlayerId: PlayerId;
  readonly targetCharacterInstanceId: InstanceId;
}

export type ChoicePrompt =
  | { readonly kind: "declareDefender"; readonly attack: AttackInProgress }
  | { readonly kind: "discardDownToHandSize"; readonly handSize: number }
  /** RRG Appendix II step 15. */
  | { readonly kind: "mulligan"; readonly handSize: number }
  /** RRG "Activation": the engaged player chooses which of their minions activates next. */
  | { readonly kind: "chooseMinionToActivate" }
  /** RRG "Simultaneous Resolution": the first player orders same-trigger effects. */
  | { readonly kind: "orderTriggers"; readonly event: TriggerEvent; readonly timing: WindowTiming }
  /** Optional interrupts/responses: a controller picks which of theirs to use, in order. */
  | { readonly kind: "chooseTriggers"; readonly event: TriggerEvent; readonly timing: WindowTiming }
  | { readonly kind: "chooseTarget"; readonly slot: string; readonly abilityId: AbilityId | null }
  | { readonly kind: "chooseAttachmentTarget"; readonly instanceId: InstanceId }
  /** Cards outside play (a look at the top of a deck, a search, a discard pile). */
  | { readonly kind: "chooseCards"; readonly slot: string }
  /** "Choose one" among labeled options; option ids are the option indexes. */
  | { readonly kind: "chooseOption" }
  | { readonly kind: "choosePlayer"; readonly slot: string }
  /** Order the Special abilities of a sequence (Wakanda Forever!). */
  | { readonly kind: "orderSpecials" }
  /** Paying for an interrupt/response event played from hand inside a timing window. */
  | {
      readonly kind: "payForCard";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly cost: number;
    }
  /**
   * An optional in-play interrupt/response whose cost includes resources
   * (Black Widow: "exhaust Black Widow and spend a [mental] resource →").
   * Selecting nothing (or too little) declines to trigger it.
   */
  | {
      readonly kind: "payForAbility";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly cost: number;
    }
  /** An effect asks for a payment ("either spend [E][M][P] resources or …"). Selecting nothing (or too little) declines. */
  | { readonly kind: "spendResources"; readonly requirement: ResourceRequirement }
  /** RRG "Ally Limit": the controller discards allies down to their ally limit. */
  | { readonly kind: "discardOverAllyLimit"; readonly limit: number }
  /** RRG "Restricted": the controller discards down to two restricted cards. */
  | { readonly kind: "discardRestricted"; readonly limit: number };

export type ChoiceRef =
  | { readonly kind: "card"; readonly instanceId: InstanceId }
  | { readonly kind: "player"; readonly playerId: PlayerId }
  | { readonly kind: "ability"; readonly instanceId: InstanceId; readonly abilityId: AbilityId }
  | { readonly kind: "none" };

export interface ChoiceOption {
  readonly optionId: string;
  readonly label: string;
  readonly ref: ChoiceRef;
}

/**
 * The engine never calls back into a client. When the rules need input it
 * parks a fully described choice here and waits for a `resolveChoice` command.
 * `frameId` names the stack frame the answer belongs to, or null for a choice
 * owned by the phase structure itself.
 */
export interface PendingChoice {
  readonly choiceId: ChoiceId;
  readonly playerId: PlayerId;
  readonly prompt: ChoicePrompt;
  readonly minSelections: number;
  readonly maxSelections: number;
  readonly options: readonly ChoiceOption[];
  readonly frameId: FrameId | null;
  /** True when the order of the selections is itself the answer. */
  readonly ordered: boolean;
  /**
   * RRG "Peril": a peril card is on the stack, so only `playerId` may decide —
   * no table talk, and no other player may play cards or trigger abilities
   * while this choice is open. The engine only marks it; clients and netcode
   * enforce the social half.
   */
  readonly soleDecider: boolean;
}
