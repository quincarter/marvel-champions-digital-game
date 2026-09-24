import type { AbilityId, CardId, VillainSideLetter } from "@mc/content";
import type { CampaignCardFace, CampaignWindow, LogWrite } from "./campaign.js";
import type { ChoiceId, FrameId, GameAreaId, InstanceId, PlayerId } from "./ids.js";
import type { PendingChoice } from "./choices.js";
import type { FacedownRole, Form, GameOutcome, GameStep, ZoneId } from "./state.js";
import type { StackFrameKind, WindowTiming } from "./stack.js";
import type { TriggerEvent } from "./trigger-events.js";
import type { LastingEffect } from "./lasting.js";
import type { ResourcePool } from "./resources.js";

export type GameEvent =
  | {
      readonly type: "gameCreated";
      readonly playerIds: readonly PlayerId[];
      readonly firstPlayerId: PlayerId;
      readonly seed: number;
    }
  | { readonly type: "stepChanged"; readonly from: GameStep; readonly to: GameStep }
  | { readonly type: "roundStarted"; readonly round: number }
  | { readonly type: "turnStarted"; readonly playerId: PlayerId }
  | { readonly type: "turnEnded"; readonly playerId: PlayerId }
  | { readonly type: "deckShuffled"; readonly zone: ZoneId; readonly order: readonly InstanceId[] }
  /**
   * A player's deck emptied and was reset (RRG 1.8 "Player Deck", p. 33): the `deckShuffled` just before this made their
   * discard pile the new deck, and the `cardMoved` just after deals them their facedown encounter card, if the encounter
   * deck had one.
   */
  | { readonly type: "playerDeckReset"; readonly playerId: PlayerId }
  | {
      readonly type: "cardMoved";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly from: ZoneId;
      readonly to: ZoneId;
    }
  | { readonly type: "cardDrawn"; readonly playerId: PlayerId; readonly instanceId: InstanceId }
  /**
   * The card just drawn (the `cardDrawn` before this) is an obligation, so it went to the drawing player's play area
   * instead of their hand (RRG 1.8 "Obligation", p. 30; MC10 p. 17). A `cardEntersPlay` announcement follows.
   */
  | { readonly type: "drawnObligationPlaced"; readonly playerId: PlayerId; readonly instanceId: InstanceId }
  | { readonly type: "cardDiscardedFromHand"; readonly playerId: PlayerId; readonly instanceId: InstanceId }
  | {
      readonly type: "cardPlayed";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly resourcesPaid: number;
      readonly paid: ResourcePool;
    }
  | { readonly type: "cardExhausted"; readonly instanceId: InstanceId }
  | { readonly type: "cardReadied"; readonly instanceId: InstanceId }
  /**
   * `fromHeroFormIndex` / `heroFormIndex` are the hero faces before and after (null for alter-ego), present only for an
   * identity with more than one hero face (docs/phase7-wave2.md §3.2), so every other identity logs exactly as before.
   */
  /**
   * A card changed controller because a rule says who controls it: "The first player controls the Milano." when the
   * first player token passes (docs/phase7-wave3.md §3.13).
   */
  | {
      readonly type: "controllerChanged";
      readonly instanceId: InstanceId;
      readonly from: PlayerId | null;
      readonly to: PlayerId;
      readonly reason: "firstPlayer";
    }
  /** A player became a card's owner by taking it (RRG 1.8 "Ownership and Control", p. 31; docs/phase7-wave2.md §3.10). */
  | { readonly type: "ownershipChanged"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /** A scenario deck took its discard pile back, with no penalty (docs/phase7-wave2.md §3.3). */
  | { readonly type: "scenarioDeckReset"; readonly name: string }
  /** A set-aside villain entered play as an additional villain (`addVillain`; docs/phase7-wave2.md §3.4). */
  | {
      readonly type: "villainAdded";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly areaId: GameAreaId | null;
    }
  /** A villain was removed from the game without being defeated (`removeVillain`). */
  | { readonly type: "villainRemoved"; readonly instanceId: InstanceId }
  /** A separate game area was created, or players joined another area (null: the central area; the game is no longer split). */
  | {
      readonly type: "gameAreaCreated";
      readonly areaId: GameAreaId;
      readonly playerIds: readonly PlayerId[];
      readonly schemeInstanceId: InstanceId;
    }
  | {
      readonly type: "gameAreaJoined";
      readonly fromAreaId: GameAreaId;
      readonly intoAreaId: GameAreaId | null;
      readonly playerIds: readonly PlayerId[];
    }
  /** A main scheme stage was revealed from a group of alternatives, or removed from the game. */
  | {
      readonly type: "mainSchemeStageRevealed";
      readonly schemeInstanceId: InstanceId;
      readonly stageIndex: number;
      readonly playerId: PlayerId;
    }
  | {
      readonly type: "mainSchemeStageRemoved";
      readonly schemeInstanceId: InstanceId | null;
      readonly stageIndex: number;
    }
  /** docs/phase7-wave4.md §3.1: an additional form changed; `instanceId` is the form card now showing it. */
  | {
      readonly type: "additionalFormChanged";
      readonly playerId: PlayerId;
      readonly formType: string;
      readonly formName: string;
      readonly instanceId: InstanceId;
    }
  /** A card in play turned facedown (`turnFacedown`) or faceup (`changeAdditionalForm`), docs/phase7-wave4.md §3.1. */
  | { readonly type: "cardTurnedFacedown"; readonly instanceId: InstanceId }
  | { readonly type: "cardTurnedFaceup"; readonly instanceId: InstanceId }
  | {
      readonly type: "formChanged";
      readonly playerId: PlayerId;
      readonly to: Form;
      readonly byEffect?: boolean;
      readonly fromHeroFormIndex?: number | null;
      readonly heroFormIndex?: number | null;
    }
  | {
      readonly type: "damageDealt";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  | {
      readonly type: "damagePrevented";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      /** `reduced`: constant reductions and caps brought it to 0 (docs/phase7-wave3.md §3.15). */
      readonly reason: "tough" | "cancelled" | "effect" | "cannotTakeDamage" | "reduced";
    }
  | { readonly type: "threatPrevented"; readonly schemeInstanceId: InstanceId; readonly amount: number }
  | {
      readonly type: "damagePlaced";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  | { readonly type: "revealCancelled"; readonly instanceId: InstanceId; readonly scope: "whenRevealed" | "allEffects" }
  | { readonly type: "damageHealed"; readonly targetInstanceId: InstanceId; readonly amount: number }
  /** "Set his hit point dial to 1" (Captain America's Helmet): sustained damage set from the remaining hit points, not healed. */
  | {
      readonly type: "hitPointsSet";
      readonly instanceId: InstanceId;
      readonly remaining: number;
      readonly damage: number;
    }
  | {
      readonly type: "statusRemoved";
      readonly instanceId: InstanceId;
      readonly status: "stunned" | "confused" | "tough";
      /** `cannotHave`: stalwart, or a `cannotHaveStatus` rule, began to apply (docs/phase7-wave3.md §3.7). */
      readonly reason:
        | "cancelledAttack"
        | "cancelledSchemeOrThwart"
        | "preventedDamage"
        | "piercing"
        | "effect"
        | "cannotHave";
    }
  | {
      readonly type: "threatPlaced";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  | {
      readonly type: "threatRemoved";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  | {
      readonly type: "enemyActivated";
      readonly enemyInstanceId: InstanceId;
      readonly activation: "attack" | "scheme";
      readonly playerId: PlayerId;
    }
  /** An initiated activation did nothing because the enemy's stat for it is printed "—" (`dashedStatSkipsActivation`). */
  | {
      readonly type: "activationSkipped";
      readonly enemyInstanceId: InstanceId;
      readonly activation: "attack" | "scheme";
      readonly reason: "dashedStat" | "leftPlay";
    }
  /**
   * `outsideActivation`: a card ability dealt this one, not the activation procedure ("give the villain 1 facedown
   * boost card"). RRG 1.8 "Boost, Boost Icon" (p. 11): it "remains facedown on that enemy until that enemy
   * activates", so it is expected *not* to be turned faceup in the villain phase it was dealt in.
   */
  | {
      readonly type: "boostCardDealt";
      readonly enemyInstanceId: InstanceId;
      readonly instanceId: InstanceId;
      readonly outsideActivation?: true;
    }
  /** A boost card's icons, or its "Boost" ability, were cancelled (Attacrobatics, Target Acquired). */
  | { readonly type: "boostCancelled"; readonly instanceId: InstanceId; readonly scope: "icons" | "ability" }
  | {
      readonly type: "boostCardFlipped";
      readonly enemyInstanceId: InstanceId;
      readonly instanceId: InstanceId;
      readonly boostIcons: number;
    }
  | {
      readonly type: "defenderDeclared";
      readonly attackInstanceId: InstanceId;
      readonly defenderInstanceId: InstanceId;
      readonly playerId: PlayerId;
    }
  | { readonly type: "defenseDeclined"; readonly attackInstanceId: InstanceId; readonly playerId: PlayerId }
  /** The declared defender left play before damage: the attack is undefended and targets that player's identity (RRG 1.8 p. 9 step 5). */
  | {
      readonly type: "defenderLeftPlay";
      readonly enemyInstanceId: InstanceId;
      readonly defenderInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
    }
  | {
      readonly type: "attackResolved";
      readonly enemyInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly baseAtk: number;
      readonly boostIcons: number;
      readonly defenseReduction: number;
      readonly damageDealt: number;
    }
  /**
   * An enemy attacked another enemy (`EffectSpec enemyAttacksEnemy`, docs/phase7-wave3.md §3.23): not an activation, so
   * no boost and no defense, and `damageDealt` is the attacker's ATK. `skipped` says why nothing was dealt: the
   * attacker or target left play before the attack resolved, a rule forbids the attack now, or the ATK is "—".
   */
  | {
      readonly type: "enemyAttackedEnemy";
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly damageDealt: number;
      readonly skipped?: "leftPlay" | "cannotAttack" | "dashedStat";
    }
  /**
   * The scheme half of `attackResolved`: how an activation's threat total was arrived at, each term separately, so a
   * client can show "SCH 1 + 2 boost" rather than one number (RRG 1.8 "Scheme (Enemy Activation)", p. 39, and "Boost",
   * p. 11). `baseSch` already includes an `schBonus` on this activation; `threatBonus` is a change to the *threat*
   * rather than to SCH ("reduce the amount of threat placed … by 1"), which is why it is a separate term.
   * `threatPlaced` is what the following `threatPlaced` event carries, floored at 0.
   */
  | {
      readonly type: "schemeResolved";
      readonly enemyInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly baseSch: number;
      readonly boostIcons: number;
      readonly threatBonus: number;
      readonly threatPlaced: number;
    }
  | { readonly type: "characterDefeated"; readonly instanceId: InstanceId; readonly cardId: CardId }
  | { readonly type: "schemeDefeated"; readonly instanceId: InstanceId; readonly cardId: CardId }
  | { readonly type: "villainStageAdvanced"; readonly stageIndex: number; readonly instanceId: InstanceId }
  /** A villain turned to its other face on the same stage (Green Goblin insert, "When the Villain Changes Form"). */
  | {
      readonly type: "villainFlipped";
      readonly instanceId: InstanceId;
      readonly from: VillainSideLetter;
      readonly to: VillainSideLetter;
      /**
       * Present (true) when one of the two faces prints ∞ hit points, so the flip set the dial to the new face's hit
       * points instead of keeping the damage (docs/phase7-wave3.md §3.1). Absent on every other flip, whose log is
       * unchanged.
       */
      readonly hitPointsReset?: true;
    }
  /** A double-sided encounter card turned over; `flipped` is true when its other face is now up. */
  | { readonly type: "cardFlipped"; readonly instanceId: InstanceId; readonly flipped: boolean }
  /** The active counter moved (The Wrecking Crew insert, "The Active Villain"). */
  | {
      readonly type: "activeVillainChanged";
      readonly from: InstanceId;
      readonly to: InstanceId;
      readonly reason: "effect" | "activeVillainDefeated";
    }
  /** `schemeInstanceId` only for a separate game area's own stage (docs/phase7-wave2.md §3.1); absent is the central one. */
  | { readonly type: "mainSchemeCompleted"; readonly stageIndex: number; readonly schemeInstanceId?: InstanceId }
  | { readonly type: "mainSchemeAdvanced"; readonly stageIndex: number; readonly schemeInstanceId?: InstanceId }
  | {
      readonly type: "encounterCardRevealed";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly playerId: PlayerId;
    }
  /** An empty separate deck took its discard pile back and was shuffled, with no penalty (`resetEmptySeparateDecks`). */
  | { readonly type: "separateDeckReset"; readonly playerId: PlayerId; readonly name: string }
  /** `schemeInstanceId` is present only when the token went somewhere other than the central main scheme (§10.3). */
  | { readonly type: "accelerationTokenAdded"; readonly total: number; readonly schemeInstanceId?: InstanceId }
  /** "Place it here instead" (`accelerationTokenDestination`; The Master of Time 2B). */
  | { readonly type: "accelerationTokenRedirected"; readonly from: InstanceId; readonly to: InstanceId }
  | { readonly type: "playerEliminated"; readonly playerId: PlayerId }
  | { readonly type: "firstPlayerChanged"; readonly playerId: PlayerId }
  | { readonly type: "choiceRequested"; readonly choice: PendingChoice }
  | {
      readonly type: "choiceResolved";
      readonly choiceId: ChoiceId;
      readonly playerId: PlayerId;
      readonly selectedOptionIds: readonly string[];
    }
  | {
      readonly type: "framePushed";
      readonly frameId: FrameId;
      readonly frame: StackFrameKind;
      readonly description: string;
    }
  | { readonly type: "framePopped"; readonly frameId: FrameId; readonly frame: StackFrameKind }
  | {
      readonly type: "triggerEvent";
      readonly event: TriggerEvent;
      readonly phase: "initiated" | "resolved" | "cancelled";
    }
  /**
   * A tough status card will prevent this damage, so the interrupts waiting on it get no window (docs/phase7-wave3.md
   * §3.12). Logged only when some interrupt was waiting.
   */
  | { readonly type: "interruptsPreempted"; readonly event: TriggerEvent; readonly reason: "tough" }
  | {
      readonly type: "windowOpened";
      readonly event: TriggerEvent;
      readonly timing: WindowTiming;
      readonly candidates: readonly {
        readonly instanceId: InstanceId;
        readonly abilityId: AbilityId;
        readonly forced: boolean;
      }[];
    }
  | {
      readonly type: "abilityResolved";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly controllerId: PlayerId | null;
    }
  | {
      readonly type: "abilityUseRecorded";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly uses: number;
    }
  | { readonly type: "targetChosen"; readonly slot: string; readonly instanceIds: readonly InstanceId[] }
  | {
      readonly type: "resourcesGenerated";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly amount: number;
      readonly pool: ResourcePool;
    }
  | {
      readonly type: "counterAdded";
      readonly instanceId: InstanceId;
      readonly counterType: string;
      readonly amount: number;
    }
  | {
      readonly type: "counterRemoved";
      readonly instanceId: InstanceId;
      readonly counterType: string;
      readonly amount: number;
    }
  | { readonly type: "statusGiven"; readonly instanceId: InstanceId; readonly status: "stunned" | "confused" | "tough" }
  | { readonly type: "cardDiscardedFromPlay"; readonly instanceId: InstanceId; readonly cardId: CardId }
  | {
      readonly type: "overkillSpilled";
      readonly fromInstanceId: InstanceId;
      readonly toInstanceId: InstanceId;
      readonly amount: number;
    }
  /** Why a `placeThreat` follows a damage event: a constant `excessDamageAsThreat` rule converted excess damage dealt. */
  | {
      readonly type: "excessDamageAsThreat";
      readonly sourceInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
    }
  | { readonly type: "surgeTriggered"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /** A `playCostReduction` ability reduced the cost of a card being played (docs/phase7-wave3.md §3.20). */
  | {
      readonly type: "playCostReduced";
      readonly cardInstanceId: InstanceId;
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly amount: number;
    }
  /** A revealed card gained surge from a `firstRevealGainsSurge` rule as it was revealed (docs/phase7-wave3.md §3.8). */
  | { readonly type: "surgeGranted"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly type: "optionChosen"; readonly label: string; readonly index: number }
  | {
      readonly type: "cardPutIntoPlayFacedown";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly as: FacedownRole["kind"];
    }
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
  | {
      readonly type: "lastingEffectEnded";
      readonly id: string;
      readonly reason: "expired" | "consumed" | "sourceLeftPlay" | "fired";
    }
  /** `patrol`: a thwart by a player a patrol minion is engaged with, against the main scheme (docs/phase7-wave3.md §3.5). */
  | {
      readonly type: "threatRemovalBlocked";
      readonly schemeInstanceId: InstanceId;
      readonly reason: "crisis" | "patrol" | "rule";
    }
  /** A card that "cannot leave play" stayed where it was (RRG 1.8 "'Cannot'", p. 11). */
  | { readonly type: "leavePlayBlocked"; readonly instanceId: InstanceId; readonly reason: "cannotLeavePlay" }
  /**
   * Campaign mode's four trace events (design §6.1). They exist for `rules-qa-engineer`'s replay: with them, the
   * campaign half of a game reads off the event stream the way the rules half already does, and the runner's
   * `campaignResultOf` can be checked against what actually happened rather than against what was asked for.
   *
   * One of a scenario's campaign setup instructions resolved at its window, in printed order. `text` and `citation`
   * are copied from the instruction so the trace reads without the `CampaignDefinition` to hand, exactly as
   * `CampaignStepTrace` does for a between-games step.
   */
  | {
      readonly type: "campaignInstructionResolved";
      readonly instructionId: string;
      readonly window: CampaignWindow;
      readonly text: string;
      readonly citation: string;
    }
  /**
   * A campaign-log field named cards, and which instances they turned out to be (the `campaignLog` `CardSelector`).
   *
   * **Only this read is traced.** `ValueSpec`/`Predicate` reads happen inside `resolveValue`/`evaluate`, which are
   * pure and re-entrant and which legality checks, `preview()` and `why-not.ts` call speculatively many times per
   * command; emitting there would put reads that never happened into the log and make the event stream depend on
   * which questions a client asked. Those reads stay reconstructible instead: the log is frozen in
   * `GameState.campaign.log`, so the same spec against the same state gives the same answer forever.
   */
  | {
      readonly type: "campaignLogRead";
      readonly field: string;
      readonly seatNumber: number | null;
      readonly cardIds: readonly CardId[];
      readonly instanceIds: readonly InstanceId[];
    }
  /** `recordInCampaignLog` resolved: the write as it went into `GameState.campaignWrites`, for the runner to fold in. */
  | { readonly type: "campaignLogWritten"; readonly write: LogWrite }
  /** `removeFromCampaign` resolved (RRG 1.8 p. 29), by face — ruling April 30, 2026 (4). */
  | { readonly type: "campaignCardRemoved"; readonly instanceId: InstanceId; readonly card: CampaignCardFace }
  | { readonly type: "gameEnded"; readonly outcome: GameOutcome };

export type GameEventType = GameEvent["type"];
