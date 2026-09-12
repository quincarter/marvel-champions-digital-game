import type { AbilityId, CardId } from "@mc/content";
import type { ChoiceId, FrameId, InstanceId, PlayerId } from "./ids.js";
import type { PendingChoice } from "./choices.js";
import type { Form, GameOutcome, GameStep, ZoneId } from "./state.js";
import type { StackFrameKind, WindowTiming } from "./stack.js";
import type { TriggerEvent } from "./trigger-events.js";
import type { LastingEffect } from "./lasting.js";
import type { ResourcePool } from "./resources.js";

export type GameEvent =
  | { readonly type: "gameCreated"; readonly playerIds: readonly PlayerId[]; readonly firstPlayerId: PlayerId; readonly seed: number }
  | { readonly type: "stepChanged"; readonly from: GameStep; readonly to: GameStep }
  | { readonly type: "roundStarted"; readonly round: number }
  | { readonly type: "turnStarted"; readonly playerId: PlayerId }
  | { readonly type: "turnEnded"; readonly playerId: PlayerId }
  | { readonly type: "deckShuffled"; readonly zone: ZoneId; readonly order: readonly InstanceId[] }
  | { readonly type: "cardMoved"; readonly instanceId: InstanceId; readonly cardId: CardId; readonly from: ZoneId; readonly to: ZoneId }
  | { readonly type: "cardDrawn"; readonly playerId: PlayerId; readonly instanceId: InstanceId }
  | { readonly type: "cardDiscardedFromHand"; readonly playerId: PlayerId; readonly instanceId: InstanceId }
  | { readonly type: "cardPlayed"; readonly playerId: PlayerId; readonly instanceId: InstanceId; readonly cardId: CardId; readonly resourcesPaid: number; readonly paid: ResourcePool }
  | { readonly type: "cardExhausted"; readonly instanceId: InstanceId }
  | { readonly type: "cardReadied"; readonly instanceId: InstanceId }
  | { readonly type: "formChanged"; readonly playerId: PlayerId; readonly to: Form; readonly byEffect?: boolean }
  | { readonly type: "damageDealt"; readonly targetInstanceId: InstanceId; readonly amount: number; readonly sourceInstanceId: InstanceId | null }
  | { readonly type: "damagePrevented"; readonly targetInstanceId: InstanceId; readonly amount: number; readonly reason: "tough" | "cancelled" | "effect" | "cannotTakeDamage" }
  | { readonly type: "threatPrevented"; readonly schemeInstanceId: InstanceId; readonly amount: number }
  | { readonly type: "damagePlaced"; readonly targetInstanceId: InstanceId; readonly amount: number; readonly sourceInstanceId: InstanceId | null }
  | { readonly type: "revealCancelled"; readonly instanceId: InstanceId; readonly scope: "whenRevealed" | "allEffects" }
  | { readonly type: "damageHealed"; readonly targetInstanceId: InstanceId; readonly amount: number }
  | { readonly type: "statusRemoved"; readonly instanceId: InstanceId; readonly status: "stunned" | "confused" | "tough"; readonly reason: "cancelledAttack" | "cancelledSchemeOrThwart" | "preventedDamage" | "piercing" | "effect" }
  | { readonly type: "threatPlaced"; readonly schemeInstanceId: InstanceId; readonly amount: number; readonly sourceInstanceId: InstanceId | null }
  | { readonly type: "threatRemoved"; readonly schemeInstanceId: InstanceId; readonly amount: number; readonly sourceInstanceId: InstanceId | null }
  | { readonly type: "enemyActivated"; readonly enemyInstanceId: InstanceId; readonly activation: "attack" | "scheme"; readonly playerId: PlayerId }
  | { readonly type: "boostCardDealt"; readonly enemyInstanceId: InstanceId; readonly instanceId: InstanceId }
  | { readonly type: "boostCardFlipped"; readonly enemyInstanceId: InstanceId; readonly instanceId: InstanceId; readonly boostIcons: number }
  | { readonly type: "defenderDeclared"; readonly attackInstanceId: InstanceId; readonly defenderInstanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly type: "defenseDeclined"; readonly attackInstanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly type: "attackResolved"; readonly enemyInstanceId: InstanceId; readonly targetInstanceId: InstanceId; readonly baseAtk: number; readonly boostIcons: number; readonly defenseReduction: number; readonly damageDealt: number }
  | { readonly type: "characterDefeated"; readonly instanceId: InstanceId; readonly cardId: CardId }
  | { readonly type: "schemeDefeated"; readonly instanceId: InstanceId; readonly cardId: CardId }
  | { readonly type: "villainStageAdvanced"; readonly stageIndex: number }
  | { readonly type: "mainSchemeCompleted"; readonly stageIndex: number }
  | { readonly type: "mainSchemeAdvanced"; readonly stageIndex: number }
  | { readonly type: "encounterCardRevealed"; readonly instanceId: InstanceId; readonly cardId: CardId; readonly playerId: PlayerId }
  | { readonly type: "accelerationTokenAdded"; readonly total: number }
  | { readonly type: "playerEliminated"; readonly playerId: PlayerId }
  | { readonly type: "firstPlayerChanged"; readonly playerId: PlayerId }
  | { readonly type: "choiceRequested"; readonly choice: PendingChoice }
  | { readonly type: "choiceResolved"; readonly choiceId: ChoiceId; readonly playerId: PlayerId; readonly selectedOptionIds: readonly string[] }
  | { readonly type: "framePushed"; readonly frameId: FrameId; readonly frame: StackFrameKind; readonly description: string }
  | { readonly type: "framePopped"; readonly frameId: FrameId; readonly frame: StackFrameKind }
  | { readonly type: "triggerEvent"; readonly event: TriggerEvent; readonly phase: "initiated" | "resolved" | "cancelled" }
  | {
      readonly type: "windowOpened";
      readonly event: TriggerEvent;
      readonly timing: WindowTiming;
      readonly candidates: readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId; readonly forced: boolean }[];
    }
  | {
      readonly type: "abilityResolved";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly controllerId: PlayerId | null;
    }
  | { readonly type: "abilityUseRecorded"; readonly instanceId: InstanceId; readonly abilityId: AbilityId; readonly uses: number }
  | { readonly type: "targetChosen"; readonly slot: string; readonly instanceIds: readonly InstanceId[] }
  | { readonly type: "resourcesGenerated"; readonly playerId: PlayerId; readonly instanceId: InstanceId; readonly abilityId: AbilityId; readonly amount: number; readonly pool: ResourcePool }
  | { readonly type: "counterAdded"; readonly instanceId: InstanceId; readonly counterType: string; readonly amount: number }
  | { readonly type: "counterRemoved"; readonly instanceId: InstanceId; readonly counterType: string; readonly amount: number }
  | { readonly type: "statusGiven"; readonly instanceId: InstanceId; readonly status: "stunned" | "confused" | "tough" }
  | { readonly type: "cardDiscardedFromPlay"; readonly instanceId: InstanceId; readonly cardId: CardId }
  | { readonly type: "overkillSpilled"; readonly fromInstanceId: InstanceId; readonly toInstanceId: InstanceId; readonly amount: number }
  | { readonly type: "surgeTriggered"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly type: "optionChosen"; readonly label: string; readonly index: number }
  | { readonly type: "cardPutIntoPlayFacedown"; readonly instanceId: InstanceId; readonly playerId: PlayerId; readonly as: "minion" }
  /**
   * RRG "Unique Icon": a card that would have entered play matched one already in play.
   * `disposition` is the RRG's own resolution — a player card's entry simply "has no
   * effect"; a non-villain encounter card "is discarded".
   */
  | {
      readonly type: "uniqueEntryBlocked";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly matchedInstanceId: InstanceId;
      readonly disposition: "noEffect" | "discarded";
    }
  | { readonly type: "lastingEffectAdded"; readonly effect: LastingEffect }
  | { readonly type: "lastingEffectEnded"; readonly id: string; readonly reason: "expired" | "consumed" | "sourceLeftPlay" | "fired" }
  | { readonly type: "threatRemovalBlocked"; readonly schemeInstanceId: InstanceId; readonly reason: "crisis" | "rule" }
  | { readonly type: "gameEnded"; readonly outcome: GameOutcome };

export type GameEventType = GameEvent["type"];
