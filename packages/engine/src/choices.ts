import type { AbilityId } from "@mc/content";
import type { InPlayCostMode } from "./abilities.js";
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
  /**
   * "Each Masters of Evil minion attacks …": one effect makes several enemies
   * attack or scheme, one at a time; the first player orders them (RRG "First Player").
   */
  | { readonly kind: "orderEnemies"; readonly activation: "attack" | "scheme" }
  /** RRG "Simultaneous Resolution": the first player orders same-trigger effects. */
  | { readonly kind: "orderTriggers"; readonly event: TriggerEvent; readonly timing: WindowTiming }
  /**
   * RRG 1.8 "Each Player" (p. 17): "If the effect does not specify what order the players resolve the effect in,
   * the first player decides the order." Ordering which players receive dealt encounter cards (ruling, Jan 26, 2026
   * (4) answer 3). The selections are player ids, in the order they resolve.
   */
  | { readonly kind: "orderPlayers"; readonly reason: "dealEncounterCards" }
  /**
   * "Put the others back in any order" (Heimdall): the selections are the cards, in the order they go back on top of
   * the deck. RRG 1.8 "Deck" (p. 15): a deck's order changes only when a card instructs it.
   *
   * `to: "encounterDeckBottom"` (docs/phase7-wave3.md §3.48): the cards going to the bottom of the encounter deck. Both
   * piles read the way the deck will: the first card selected is the highest of its pile, so the last card selected
   * for the bottom becomes the deck's bottom card.
   */
  | { readonly kind: "orderCards"; readonly to: "encounterDeckTop" | "encounterDeckBottom" }
  /**
   * "Place the rest on the top and/or bottom of the encounter deck" (docs/phase7-wave3.md §3.48): select the cards that
   * go to the bottom; every card not selected goes on top. Any number may be selected, none included. Each pile of two
   * or more cards is then ordered (`orderCards`).
   */
  | { readonly kind: "chooseBottomCards"; readonly deck: "encounterDeck" }
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
  /**
   * A cost paid with cards in play whose cards are the player's choice, asked inside a timing window before the
   * payment (`InPlayCostPick`; docs/phase7-wave4.md §3.17): "exhaust an [Avenger] character and a [Guardian] character"
   * asks once per slot. Options are the candidates; selecting fewer than `min` backs out of the card or ability.
   */
  | {
      readonly kind: "chooseCostCards";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly slot: string;
      readonly mode: InPlayCostMode;
    }
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
  | { readonly kind: "discardRestricted"; readonly limit: number }
  /**
   * RRG 1.8 "Indirect Damage" (p. 24): divide `amount` among these characters, at most `caps[instanceId]` each (its
   * remaining hit points). Options are `<instanceId>#<n>` for n = 1…cap; each selected option is 1 damage to that
   * character, and exactly `amount` must be selected.
   */
  | { readonly kind: "assignIndirectDamage"; readonly amount: number; readonly caps: Readonly<Record<string, number>> }
  /**
   * `EffectSpec divide` (docs/phase7-wave2.md §3.7): split `amount` among the options' cards. Options are
   * `<instanceId>#<n>` for n = 1…amount; each selected option is 1 point to that card, and exactly `amount` are selected.
   */
  | { readonly kind: "divide"; readonly what: "damage" | "threat"; readonly amount: number };

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
 * Why this player is the one deciding. There is no villain player: the
 * encounter side's procedure is forced, and every decision it leaves open
 * belongs to a player by rule (docs/phase3-encounter-ai.md).
 *
 * - `player`: the player's own decision — their cards, their defense, their
 *   payments, a "choose" on an ability they are resolving (RRG "Choose").
 * - `firstPlayerTargets`: an encounter card targets a player or card and several
 *   are eligible, so the first player selects on the encounter card's behalf
 *   (RRG "First Player").
 * - `firstPlayerOrders`: effects that would resolve simultaneously; the first
 *   player orders them (RRG "First Player", "Simultaneous Resolution").
 */
export type DecisionAuthority = "player" | "firstPlayerTargets" | "firstPlayerOrders";

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
  /** Whose decision this is by rule; anything but `player` is made on the encounter side's behalf. */
  readonly authority: DecisionAuthority;
}
