import type { AbilityId } from "@mc/content";
import type { ChoiceId, InstanceId, PlayerId } from "./ids.js";

/**
 * One source of resources toward a cost: a card discarded from hand, or a
 * "Resource" ability triggered while paying (RRG "Cost", "Resource Ability").
 */
export type Payment =
  | { readonly fromHand: InstanceId }
  | { readonly ability: { readonly instanceId: InstanceId; readonly abilityId: AbilityId } };

/**
 * Cards picked as part of a non-resource cost, keyed by the slot the cost
 * names (`discard` for "choose and discard N cards", the `payPrintedCostOf`
 * slot for "pay the printed cost of an ally in a discard pile"). Costs are
 * paid when the ability is initiated, so every choice is made up front.
 */
export type CostChoices = Readonly<Record<string, readonly InstanceId[]>>;

/**
 * Every command names the player issuing it so authority can be checked here
 * rather than in a client (and so the netcode layer has one thing to validate).
 */
export type Command =
  | { readonly type: "changeForm"; readonly playerId: PlayerId }
  | {
      readonly type: "playCard";
      readonly playerId: PlayerId;
      readonly cardInstanceId: InstanceId;
      readonly payment: readonly Payment[];
      /** Required for upgrades that attach to something other than your identity; ignored otherwise. */
      readonly attachToInstanceId: InstanceId | null;
      readonly costChoices?: CostChoices;
      /** "Play under any player's control": who will control the card (defaults to the player). */
      readonly controllerId?: PlayerId;
    }
  | {
      readonly type: "useAbility";
      readonly playerId: PlayerId;
      readonly cardInstanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly payment: readonly Payment[];
      readonly costChoices?: CostChoices;
    }
  | {
      readonly type: "basicAttack";
      readonly playerId: PlayerId;
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      /** For a basic power with an additional cost ("you must discard 1 card"; `basicPowerCosts`). */
      readonly payment?: readonly Payment[];
      readonly costChoices?: CostChoices;
    }
  | {
      readonly type: "basicThwart";
      readonly playerId: PlayerId;
      readonly thwarterInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly payment?: readonly Payment[];
      readonly costChoices?: CostChoices;
    }
  | { readonly type: "basicRecover"; readonly playerId: PlayerId }
  | { readonly type: "endTurn"; readonly playerId: PlayerId }
  /**
   * Give up the game, for the whole table. **Not an RRG rule** — the RRG has no concede rule at all, so this is a
   * digital-implementation affordance and its shape is our decision, written down here rather than implied:
   *
   * - It is a *command*, not a client-side flag, because a `GameLog` is `{ initialState, commands }` and `replay()` is
   *   the only definition of what a saved game was. A client-only "abandoned" marker would replay to a live,
   *   unfinished game while the save claimed it was over.
   * - **Any seated, non-eliminated player may concede, and it ends the game for the whole table**, because a co-op
   *   table shares one outcome. If a future build wants every seat to confirm first, that is a client/netcode wrapper
   *   that gathers confirmations and then issues this one command — not engine behaviour.
   */
  | { readonly type: "concede"; readonly playerId: PlayerId }
  | {
      readonly type: "resolveChoice";
      readonly playerId: PlayerId;
      readonly choiceId: ChoiceId;
      readonly selectedOptionIds: readonly string[];
    };

export type CommandType = Command["type"];
