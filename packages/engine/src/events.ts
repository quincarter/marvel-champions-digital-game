import type { AbilityId, CardId, CoreAspect, Trait, VillainSideLetter } from "@mc/content";
import type { CampaignCardFace, CampaignWindow, LogWrite } from "./campaign.js";
import type { RulesCardType } from "./card-types.js";
import type { ChoiceId, EncounterDeckId, FrameId, GameAreaId, InstanceId, PlayerId } from "./ids.js";
import type { PendingChoice } from "./choices.js";
import type { FacedownRole, Form, GameOutcome, GameStep, MainSchemeAdvancedBy, ZoneId } from "./state.js";
import type { StackFrameKind, WindowTiming } from "./stack.js";
import type { TriggerEvent } from "./trigger-events.js";
import type { KeywordAbilityName } from "./keyword-abilities.js";
import type { LastingDuration, LastingEffect } from "./lasting.js";
import type { ResourcePool } from "./resources.js";
import type { ReportedFact } from "./outside-facts.js";

/**
 * Ways the text before a "then" can fail to fully resolve (RRG 1.8 "'Then'", p. 44), besides a required choice finding
 * nothing (`choiceFoundNothing`):
 *
 * - `searchFoundNothing`: a search (a `chooseCards` with `min` >= 1, or a `selectCards`, over a deck) found no card,
 *   or a `searchCollection` had no card left outside the game to find;
 * - `lookFoundNothing`: a `lookAt` over a deck had no card to look at (an empty deck);
 * - `discardUntilFoundNothing`: "discard cards from the top of your deck until you discard an X" found no X. Not the
 *   encounter deck: RRG 1.8 "Encounter Deck" (p. 17) says that emptying it this way leaves the ability "fulfilled";
 * - `revealFoundNothing` / `revealCancelled`: "Reveal that card" had no card, or the revealed card's effects were
 *   cancelled ("cancel the effects of that card and discard it");
 * - `nothingToCancel`: a cancel found nothing to cancel, or what it would cancel cannot be cancelled;
 * - `activationDidNotHappen`: "X attacks you" / "X schemes" did not happen: a stunned/confused status cancelled it,
 *   the enemy is not in play, or the activation was skipped or cancelled.
 */
export type PreThenFailure =
  | "searchFoundNothing"
  | "lookFoundNothing"
  | "discardUntilFoundNothing"
  | "revealFoundNothing"
  | "revealCancelled"
  | "nothingToCancel"
  | "activationDidNotHappen"
  /** A swap that could not be completed (`swapRefused`, docs/phase7-wave6.md §3.47). */
  | "swapNotCompleted"
  /** A "find" that found no card (`EffectSpec findCard`, docs/phase7-wave6.md §3.48). */
  | "findFoundNothing"
  /**
   * A card `dealAsEncounterCard` named was not dealt: it cannot leave play, or is not a card that can be dealt
   * (docs/phase7-wave8.md §3.75).
   */
  | "cardNotDealt"
  /**
   * A card `passEncounterCard` named was not passed: it is not facedown in front of the player passing it, or there
   * is no other player to pass it to (docs/phase7-wave8.md §3.75).
   */
  | "cardNotPassed";

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
   * Setup put `stacked` on top of a deck just after shuffling it (`GameSetupConfig.stack`: a tutorial or scripted
   * scenario, never a rules step); `order` is the deck afterward, top first.
   */
  | {
      readonly type: "deckStacked";
      readonly zone: ZoneId;
      readonly stacked: readonly InstanceId[];
      readonly order: readonly InstanceId[];
    }
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
  /**
   * A card was discarded from the top of `playerId`'s deck by card `by`'s effect or cost (null when no card is named),
   * after the `cardMoved` that carried it (docs/phase7-wave7.md §3.55). Logged only in a game whose registry has an
   * ability that triggers on such a discard, so every other game's log is unchanged. `at: "deck"`: the discard emptied
   * the deck, and its reset has shuffled the card into the new one.
   */
  | {
      readonly type: "cardDiscardedFromDeck";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly by: InstanceId | null;
      readonly at: "discard" | "deck";
    }
  /**
   * A response to its discard from `playerId`'s deck took the card away from where the discard put it, so the ability
   * that discarded it no longer counts it among the cards "discarded this way" (ruling, April 30, 2026 - Ruling 4,
   * answer 1; docs/phase7-wave7.md §4.1 Q32). `slot`: the bound set it was dropped from.
   */
  | {
      readonly type: "deckDiscardNotCounted";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly slot: string;
    }
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
      /**
       * `effect`: a card took control of it ("detaches Odin … and takes control of him", docs/phase7-wave4.md §3.8).
       * `attachedTo`: an upgrade attached to a card another player controls is controlled by that player, and goes back
       * to its owner when it moves to a card no other player controls (RRG 1.8 "Ownership and Control", p. 31).
       */
      readonly reason: "firstPlayer" | "effect" | "attachedTo";
    }
  /** A player became a card's owner by taking it (RRG 1.8 "Ownership and Control", p. 31; docs/phase7-wave2.md §3.10). */
  | { readonly type: "ownershipChanged"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /** A scenario deck took its discard pile back, with no penalty (docs/phase7-wave2.md §3.3). */
  | { readonly type: "scenarioDeckReset"; readonly name: string }
  /**
   * Not emitted since 2026-10-03 (docs/phase7-wave6.md §4.1 Q54: a card of a scenario deck with no discard pile that is
   * discarded with no replacement applying goes to the encounter discard pile, an ordinary `cardMoved`). It was logged
   * when such a card went to the bottom of its own deck, facedown, instead of the discard pile `instead`; the type
   * stays so that a log recorded before then still reads.
   */
  | {
      readonly type: "returnedToScenarioDeck";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly name: string;
      readonly instead: ZoneId["kind"];
    }
  /**
   * A player card's ability tried to select, look at or move the cards of a scenario deck that is closed to player card
   * effects, or to put a card into it, and nothing happened (`closedToPlayerCard`; the show deck, MojoMania insert
   * p. 11; docs/phase7-wave6.md §3.66). `instanceIds`: the cards a move left where they were; empty for a selection.
   */
  | {
      readonly type: "scenarioDeckClosed";
      readonly name: string;
      readonly sourceCardId: CardId;
      readonly instanceIds: readonly InstanceId[];
    }
  /** A set-aside villain entered play as an additional villain (`addVillain`; docs/phase7-wave2.md §3.4). */
  | {
      readonly type: "villainAdded";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly areaId: GameAreaId | null;
    }
  /** A villain was removed from the game without being defeated (`removeVillain`). */
  | { readonly type: "villainRemoved"; readonly instanceId: InstanceId }
  /** Counters moved from one card to another (`EffectSpec moveCounters`, docs/phase7-wave5.md §3.3). */
  | {
      readonly type: "countersMoved";
      readonly from: InstanceId;
      readonly to: InstanceId;
      readonly counterType: string;
      readonly amount: number;
    }
  /** A main scheme stage turned to its other face (Venom Goblin's environments; docs/phase7-wave5.md §3.3). */
  | {
      readonly type: "mainSchemeFlippedToOtherFace";
      readonly instanceId: InstanceId;
      readonly from: CardId;
      readonly to: CardId;
      readonly stageIndex: number;
    }
  /** "Set this villain aside" (docs/phase7-wave5.md §3.1): out of play, cleared, in the set-aside area. */
  | { readonly type: "villainSetAside"; readonly instanceId: InstanceId }
  /**
   * A player's permanent cards were set aside before setup step 1 (RRG 1.8 "Permanent", p. 32; docs/phase7-wave6.md
   * §3.74): out of the deck, never shuffled, drawn or mulliganed, in the owner's set-aside area until an ability (a
   * Setup) puts them into play. Emitted once per player with any, right after `gameCreated`.
   */
  | {
      readonly type: "cardsSetAside";
      readonly playerId: PlayerId;
      readonly instanceIds: readonly InstanceId[];
      readonly reason: "permanent";
    }
  /**
   * Linked cards were set aside for a player's deck (RRG 1.8 "Linked (Card Title)", p. 27; docs/phase7-wave7.md §3.75):
   * `forPlayer`'s deck holds a card whose title these cards name, so their product's copies wait in the shared
   * set-aside area (`GameState.encounterSetAside`), owned by nobody until a player takes control of one. One entry per
   * deck that names any, after the `cardsSetAside` entries; `cardIds` and `instanceIds` run in step, one per copy.
   */
  | {
      readonly type: "linkedCardsSetAside";
      readonly forPlayer: PlayerId;
      readonly cardIds: readonly CardId[];
      readonly instanceIds: readonly InstanceId[];
    }
  /**
   * An encounter set joined the game because a setup condition held (`GameSetupConfig.autoIncludedSets`;
   * docs/phase7-wave7.md §3.74): the Dreadpool set when a player chose the 'Pool aspect (Deadpool insert, "Using the
   * 'Pool Aspect"; RRG 1.8 FAQ, p. 64). `because.playerIds` are the seats that declared the aspect, in seat order;
   * `shuffledIn` went into encounter deck `deckId` before its setup shuffle and `setAside` into
   * `GameState.encounterSetAside`. One entry per included set, after the `linkedCardsSetAside` entries; a set whose
   * condition failed logs nothing.
   */
  | {
      readonly type: "encounterSetAutoIncluded";
      readonly setId: string;
      readonly because: {
        readonly kind: "aspectChosen";
        readonly aspect: CoreAspect;
        readonly playerIds: readonly PlayerId[];
      };
      readonly deckId: EncounterDeckId;
      readonly shuffledIn: readonly InstanceId[];
      readonly setAside: readonly InstanceId[];
    }
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
  /**
   * A main scheme's stages were shuffled (docs/phase7-wave6.md §3.18). `order` is the full walk order of stage indexes
   * from now on; like a `deckShuffled` order it is for the replay log, not for the players to see.
   */
  | {
      readonly type: "mainSchemeStagesShuffled";
      readonly schemeInstanceId: InstanceId;
      readonly order: readonly number[];
    }
  /**
   * A main scheme's current stage went to the victory display as `instanceId`, a new out-of-play copy of the card fixed
   * at `stageIndex` (docs/phase7-wave6.md §3.19). The scheme in play is unchanged until it advances.
   */
  | {
      readonly type: "mainSchemeStageToVictoryDisplay";
      readonly schemeInstanceId: InstanceId;
      readonly stageIndex: number;
      readonly instanceId: InstanceId;
    }
  /**
   * A main scheme stage was removed from the game and can never be revealed. With `schemeInstanceId` it is that scheme's
   * own stage, leaving play with it (a separate game area's); with `null` the stage was not showing: an unused
   * alternative, or one picked at random from the main scheme deck (docs/phase7-wave7.md §3.28). A removed card is out
   * of play in the open, so `stageIndex` is public.
   */
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
  /**
   * The villain instance took another card of its title (docs/phase7-wave4.md §3.7): `swap` (RRG 1.8 "'Swap'", p. 42;
   * dial kept) or `advance` (the defeated card went to the victory display or out of the game; dial reset).
   */
  | {
      readonly type: "villainReplaced";
      readonly instanceId: InstanceId;
      readonly fromCardId: CardId;
      readonly toCardId: CardId;
      readonly reason: "swap" | "advance";
    }
  /** An attached card was detached into a play area (`EffectSpec detach`, docs/phase7-wave4.md §3.8). */
  | { readonly type: "cardDetached"; readonly instanceId: InstanceId; readonly from: InstanceId }
  /** A card in play turned facedown (`turnFacedown`) or faceup (`changeAdditionalForm`), docs/phase7-wave4.md §3.1. */
  | { readonly type: "cardTurnedFacedown"; readonly instanceId: InstanceId }
  /** An enemy attack in progress now targets another character (`EffectSpec retargetAttack`; §3.21). */
  | {
      readonly type: "attackRetargeted";
      readonly enemyInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly playerId: PlayerId;
    }
  /**
   * A player's attack in progress now targets another character (`EffectSpec retargetAttack` with `attack: "player"`;
   * docs/phase7-wave7.md §3.66). `fromInstanceId`: the character it was against, which is no longer attacked.
   */
  | {
      readonly type: "playerAttackRetargeted";
      readonly attackerInstanceId: InstanceId;
      readonly fromInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly playerId: PlayerId;
    }
  /** A progressing identity swapped to its next version (`EffectSpec swapIdentity`, docs/phase7-wave5.md §3.23). */
  | {
      readonly type: "identitySwapped";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly fromCardId: CardId;
      readonly toCardId: CardId;
    }
  /**
   * A separated identity's other card flipped with a form change (docs/phase7-wave5.md §3.24): `fromCardId` →
   * `toCardId` are its pool sides. `identityExhausted` / `cardExhausted` are the two instances' states afterwards (the
   * ready state follows the physical card). `movedCounters` / `movedAttachments`, when present, were on it and moved to
   * the identity (docs/phase7-wave5.md §4.1 Q38).
   */
  | {
      readonly type: "separatedCardFlipped";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly fromCardId: CardId;
      readonly toCardId: CardId;
      readonly identityExhausted: boolean;
      readonly cardExhausted: boolean;
      readonly movedCounters?: Readonly<Record<string, number>>;
      readonly movedAttachments?: readonly InstanceId[];
    }
  /** A thwart's additional cost is asked of the thwarting player (`RuleSpec additionalThwartCost`; wave 5 §3.21). */
  | { readonly type: "thwartCostAsked"; readonly schemeInstanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * How a basic thwart's additional-cost question ended (docs/phase7-wave5.md §4.1 Q27, Q30): `paid` (the thwart goes
   * ahead), `declined` (the resources were not spent), `damageNotTaken` (some of a "take damage" cost was prevented or
   * could not be assigned, RRG 1.8 "Cost", p. 13), or `abandoned` (paid, but the thwart was no longer legal; `reason`).
   * Anything but `paid` means no thwart and none of the thwarter's own costs paid.
   */
  | {
      readonly type: "thwartCostSettled";
      readonly playerId: PlayerId;
      readonly schemeInstanceIds: readonly InstanceId[];
      readonly outcome: "paid" | "declined" | "damageNotTaken" | "abandoned";
      readonly reason?: string;
    }
  /**
   * A "take N indirect damage →" cost has been paid or failed (`AbilityCost.indirectDamage`): `taken` is the damage the
   * payer's characters took of `amount`. Short of it, the cost was not paid (RRG 1.8 "Cost", p. 14) and the effects of
   * `instanceId`'s ability do not resolve; the damage taken stays taken.
   */
  | {
      readonly type: "costDamageSettled";
      readonly instanceId: InstanceId | null;
      readonly playerId: PlayerId | null;
      readonly amount: number;
      readonly taken: number;
      readonly paid: boolean;
    }
  /**
   * A "look at the top N cards of the encounter deck, discard M of those cards →" cost (`AbilityCost.encounterLookDiscard`,
   * docs/phase7-wave6.md §3.54) has been paid or failed: `lookedAt` are the cards `playerId` looked at, top first, and
   * `discarded` the ones discarded, in the order they were (top first). Fewer looked-at cards than M to discard means
   * the cost was not paid (RRG 1.8 "Cost", p. 13), nothing was discarded, and the effects of `instanceId`'s ability do
   * not resolve.
   */
  | {
      readonly type: "encounterLookCostSettled";
      readonly instanceId: InstanceId | null;
      readonly playerId: PlayerId | null;
      readonly lookedAt: readonly InstanceId[];
      readonly discarded: readonly InstanceId[];
      readonly paid: boolean;
    }
  /**
   * An "[enemy] attacks you →" cost (`AbilityCost.enemyAttack`, docs/phase7-wave7.md §3.19 (b)) has been paid or
   * failed: `enemyInstanceId`'s attack against `playerId` was made, or (an interrupt canceled it, the enemy left play
   * as it was initiated) it was not, so the cost was not paid (RRG 1.8 "Cost Arrow Icon", p. 14) and the effects of
   * `instanceId`'s ability do not resolve.
   */
  | {
      readonly type: "enemyAttackCostSettled";
      readonly instanceId: InstanceId | null;
      readonly playerId: PlayerId | null;
      readonly enemyInstanceId: InstanceId;
      readonly paid: boolean;
    }
  /** A card would ready and a rule asks its readier for an additional cost first (`RuleSpec readyCost`; §3.19). */
  | { readonly type: "readyCostAsked"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * A set-aside modular set was chosen at random and joined the encounter deck (docs/phase7-wave4.md §3.18): the cards
   * `instanceIds` names, which leaves out one the effect revealed first and one no longer set aside. `placement`
   * (docs/phase7-wave6.md §3.62): `shuffleIn`, shuffled into the whole deck (`instanceIds` in the set's order);
   * `shuffledOnTop`, shuffled on their own and placed on top of it (`instanceIds` from the top down).
   */
  | {
      readonly type: "setAsideModularSetShuffledIn";
      readonly encounterSetId: string;
      readonly instanceIds: readonly InstanceId[];
      readonly placement: "shuffleIn" | "shuffledOnTop";
    }
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
      /** No player dealt it although a player controls its source (`TriggerEvent dealDamage.noPlayer`). */
      readonly noPlayer?: true;
    }
  | {
      readonly type: "damagePrevented";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      /** `reduced`: constant reductions and caps brought it to 0 (docs/phase7-wave3.md §3.15). */
      readonly reason: "tough" | "cancelled" | "effect" | "cannotTakeDamage" | "reduced";
    }
  /**
   * `amount` of a damage event (or of placed damage) was not taken because `maxSustainedDamage` held the target at its
   * cap (docs/phase7-wave6.md §3.3). Not a prevention: no `damagePrevented` accompanies it (§4.1 Q9).
   */
  | { readonly type: "damageCapped"; readonly targetInstanceId: InstanceId; readonly amount: number }
  /**
   * A `doubleDamageTaken` rule doubled the damage a character takes (docs/phase7-wave6.md §3.68): `from` is the damage
   * after every increase and reduction, `to` after doubling (before any per-attack or sustained-damage cap), and
   * `doubledBy` the cards whose rules doubled it, one per doubling.
   */
  | {
      readonly type: "damageDoubled";
      readonly targetInstanceId: InstanceId;
      readonly from: number;
      readonly to: number;
      readonly doubledBy: readonly (InstanceId | null)[];
    }
  /** An interrupt increased a pending damage event by `amount` (`increaseDamage`, docs/phase7-wave4.md §3.52). */
  | { readonly type: "damageIncreased"; readonly targetInstanceId: InstanceId; readonly amount: number }
  | { readonly type: "threatPrevented"; readonly schemeInstanceId: InstanceId; readonly amount: number }
  | {
      readonly type: "damagePlaced";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  | { readonly type: "revealCancelled"; readonly instanceId: InstanceId; readonly scope: "whenRevealed" | "allEffects" }
  | { readonly type: "damageHealed"; readonly targetInstanceId: InstanceId; readonly amount: number }
  /**
   * A heal of damage the target had healed nothing: a `RuleSpec cannotBeHealed` matched it (docs/phase7-wave6.md
   * §3.12, "Robert Kelly cannot be healed by player card effects"). `sourceInstanceId` is the card whose ability, cost
   * or basic power tried to heal it, null when no card did.
   */
  | {
      readonly type: "healBlocked";
      readonly targetInstanceId: InstanceId;
      readonly sourceInstanceId: InstanceId | null;
      readonly amount: number;
    }
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
      readonly reason: StatusDiscardCause;
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
      /** No player removed it although a player controls its source (`TriggerEvent removeThreat.noPlayer`). */
      readonly noPlayer?: true;
    }
  | {
      readonly type: "enemyActivated";
      readonly enemyInstanceId: InstanceId;
      readonly activation: "attack" | "scheme";
      readonly playerId: PlayerId;
    }
  /**
   * An enemy activation that did not begin because a `cannotActivate` rule covers the enemy (docs/phase7-wave6.md
   * §3.34): no `enemyActivated`, no boost card, no status card spent, no interrupt window.
   */
  | {
      readonly type: "activationBlocked";
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
   * A player's attack ended before dealing damage because its attacker left play first (docs/phase7-wave4.md §4 Q20,
   * user decision 2026-09-25: Speed Demon's "(Resolve Speed Demon's attack first.)" defeating the attacking ally). No
   * damage is dealt and nothing hangs off it (no `characterAttacked`, so no retaliate).
   */
  | {
      readonly type: "playerAttackEnded";
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly reason: "attackerLeftPlay";
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
  /**
   * An activation's boost cards were withheld by an interrupt to it ("Do not give Master Mold a boost card for this
   * activation", `modifyAttack.noBoost`, docs/phase7-wave6.md §3.15): its automatic boost card and any additional ones
   * were not dealt. Not logged for an activation an effect started with `boost: false` (its `triggerEvent` says so).
   */
  | {
      readonly type: "boostWithheld";
      readonly enemyInstanceId: InstanceId;
      readonly activation: "attack" | "scheme";
    }
  /** A facedown boost card moved from one card to another (`moveBoostCards`, docs/phase7-wave5.md §3.6). */
  | {
      readonly type: "boostCardMoved";
      readonly instanceId: InstanceId;
      readonly fromInstanceId: InstanceId;
      readonly toInstanceId: InstanceId;
    }
  /** A boost card's icons, or its "Boost" ability, were cancelled (Attacrobatics, Target Acquired). */
  | {
      readonly type: "boostCancelled";
      readonly instanceId: InstanceId;
      readonly scope: "icons" | "ability" | "discarded";
    }
  /**
   * A boost card's icons and "Boost" ability are ignored (`RuleSpec ignoreBoost`, docs/phase7-wave7.md §3.67; RRG 1.8
   * "Ignore", p. 23): it is turned faceup and discarded as usual, adds 0 and resolves no ability. Not a cancel, so no
   * `boostCancelled` goes with it. Logged once per card, after its `boostCardFlipped` (whose `boostIcons` is then 0).
   */
  | { readonly type: "boostIgnored"; readonly enemyInstanceId: InstanceId; readonly instanceId: InstanceId }
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
      /**
       * The ally had been declared by a "(defense)" ability, so that player's hero becomes the defender instead of the
       * attack being undefended (RRG 1.8 FAQ "Mutant Protectors (#17)", p. 63): not a basic defense.
       */
      readonly heroDefends?: true;
    }
  | {
      readonly type: "attackResolved";
      readonly enemyInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly baseAtk: number;
      readonly boostIcons: number;
      readonly defenseReduction: number;
      readonly damageDealt: number;
      /**
       * The enemy `damageDealt` goes to instead of the attacked character (`modifyAttack.damageTo`, Psychic
       * Misdirection; docs/phase7-wave6.md §3.36). Absent when the attack's damage goes to its target.
       */
      readonly damageTo?: InstanceId;
      /**
       * The scheme the attack removed threat from instead of dealing damage (`modifyAttack.removesThreatFrom`,
       * Determined Defense): `damageDealt` is then 0 and `threatInstead` is the amount the attack had calculated,
       * which a `thwart` or `removeThreat` event then takes off the scheme (less when a crisis icon or patrol stops it).
       */
      readonly removesThreatFrom?: InstanceId;
      readonly threatInstead?: number;
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
      /**
       * The activation removed its total from the scheme instead of placing it (`modifyAttack.removesThreat`,
       * docs/phase7-wave6.md §3.35); `threatPlaced` is then 0 and a `removeThreat` event follows.
       */
      readonly removesThreat?: true;
    }
  | { readonly type: "characterDefeated"; readonly instanceId: InstanceId; readonly cardId: CardId }
  | { readonly type: "schemeDefeated"; readonly instanceId: InstanceId; readonly cardId: CardId }
  /**
   * A character kept in play at zero or fewer remaining hit points by a "cannot be defeated" rule is no longer under
   * one (the card granting it left play, its condition ended): the defeat sweep that follows defeats it by the game's
   * rule, with no defeating player and no defeating card (docs/phase7-wave7.md §3.34, §4.1 Q21).
   */
  | { readonly type: "defeatProtectionEnded"; readonly instanceId: InstanceId; readonly cardId: CardId }
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
  /**
   * A card whose other face is a card of its own turned over (`otherFaceId`, docs/phase7-wave4.md §3.10). `typeChanged`:
   * the new face is another card type, so its attachments, tucked cards, status cards and tokens were discarded.
   */
  | {
      readonly type: "cardFlippedToOtherFace";
      readonly instanceId: InstanceId;
      readonly from: CardId;
      readonly to: CardId;
      readonly typeChanged: boolean;
    }
  /** A player's ability tried to discard a card a `playersCannotDiscard` rule protects (docs/phase7-wave4.md §3.44). */
  | { readonly type: "discardRefused"; readonly instanceId: InstanceId }
  /** An ally started (`as: "minion"`) or stopped (`as: null`) being treated as a minion (docs/phase7-wave4.md §3.9). */
  /** A resource ability used in a payment put its own effects on the stack (docs/phase7-wave4.md §3.30). */
  | {
      readonly type: "resourceAbilityEffects";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly playerId: PlayerId;
    }
  /** A pending consequential damage event's amount was changed before it applied (`modifyConsequentialDamage`). */
  | {
      readonly type: "consequentialDamageModified";
      readonly instanceId: InstanceId;
      readonly from: number;
      readonly to: number;
    }
  | { readonly type: "treatedAsChanged"; readonly instanceId: InstanceId; readonly as: "minion" | "ally" | null }
  /** A double-sided encounter card turned over; `flipped` is true when its other face is now up. */
  | { readonly type: "cardFlipped"; readonly instanceId: InstanceId; readonly flipped: boolean }
  /** The active counter moved (The Wrecking Crew insert, "The Active Villain"). */
  | {
      readonly type: "activeVillainChanged";
      readonly from: InstanceId;
      readonly to: InstanceId;
      /** `focusedScheme`: the villain of the main scheme Focused Defense is attached to (docs/phase7-wave4.md §3.2). */
      readonly reason: "effect" | "activeVillainDefeated" | "focusedScheme" | "activationOrder" | "noActiveVillain";
    }
  /** `schemeInstanceId` only for a separate game area's own stage (docs/phase7-wave2.md §3.1); absent is the central one. */
  | { readonly type: "mainSchemeCompleted"; readonly stageIndex: number; readonly schemeInstanceId?: InstanceId }
  | {
      readonly type: "mainSchemeAdvanced";
      readonly stageIndex: number;
      readonly schemeInstanceId?: InstanceId;
      /** What advanced it (`MainSchemeState.advancedBy`, docs/phase7-wave7.md §3.12); absent only in an older log. */
      readonly advancedBy?: MainSchemeAdvancedBy;
    }
  | {
      readonly type: "encounterCardRevealed";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly playerId: PlayerId;
    }
  /**
   * Two cards exchanged locations (`EffectSpec swapCards`, RRG 1.8 "'Swap'", p. 42; docs/phase7-wave6.md §3.47). `how`:
   * `leftAndEntered` (different titles: `outgoing` left play, `incoming` entered play, ready), `sameTitle` (neither left
   * or entered play; the in-play instance kept its state and took the other's card, so `incoming` names the instance now
   * out of play holding the old card), `outOfPlay` (neither was in play). `cardIds` are the two cards' ids as they were.
   */
  | {
      readonly type: "cardsSwapped";
      readonly how: "leftAndEntered" | "sameTitle" | "outOfPlay";
      readonly outgoing: InstanceId;
      readonly incoming: InstanceId;
      readonly cardIds: readonly [CardId, CardId];
    }
  /**
   * A "find" found this card (`EffectSpec findCard`, RRG 1.8 "Find", p. 19; docs/phase7-wave6.md §3.48), logged before
   * it moves. `from`: where it was (absent for a villain or main scheme, which have no zone). `alreadyThere`: it was at
   * the destination already, so it stays as it is. `deckShuffled`: it was in a deck, so each deck searched for it is shuffled
   * after the move (RRG 1.8 "Search", p. 39); one `deckShuffled` per deck follows. A find that found nothing logs no
   * `cardFound`, only the `deckShuffled` of each deck it searched (docs/phase7-wave6.md §4.1 Q77). For a "find X and
   * reveal it" (`revealCard` of a `find` ref, docs/phase7-wave8.md §3.1) `alreadyThere` reads "already in play": the
   * card is revealed where it is and does not enter play.
   */
  | {
      readonly type: "cardFound";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly from?: ZoneId;
      readonly alreadyThere: boolean;
      readonly deckShuffled: boolean;
    }
  /**
   * A facedown encounter card dealt to `fromPlayerId` was passed to `toPlayerId` (`EffectSpec passEncounterCard`,
   * docs/phase7-wave8.md §3.75), logged after its `cardMoved`: it is at the back of `toPlayerId`'s queue, still
   * facedown, and that player reveals it. The card's identity is not on this line (it is facedown).
   */
  | {
      readonly type: "encounterCardPassed";
      readonly instanceId: InstanceId;
      readonly fromPlayerId: PlayerId;
      readonly toPlayerId: PlayerId;
    }
  /**
   * A card found faceup in play was revealed where it is ("find X and reveal it", RRG 1.8 "Find", p. 19;
   * docs/phase7-wave8.md §3.1), logged at the reveal's placement step, after its `encounterCardRevealed`: it does not
   * enter play, so no `cardEntersPlay` follows and a side scheme gains no starting threat. `engaged`: a minion that
   * engaged `playerId` by it (a `cardMoved` to their play area precedes this when it changed play areas); false for a
   * minion already engaged with them and for every other card type, which stays where it is. A reveal whose effects
   * were cancelled logs none.
   */
  | {
      readonly type: "revealedInPlay";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly playerId: PlayerId;
      readonly engaged: boolean;
    }
  /**
   * A swap that could not be completed (RRG 1.8 "'Swap'", p. 42): `missingCard` (a ref named no card, or both the same
   * one), `bothInPlay` (no card swaps two cards in play; not built), `cannotLeavePlay` (the in-play card is permanent and
   * this ability is not of its set, or cannot leave play), `unsupported` (an identity or villain: `swapIdentity`,
   * `swapVillain`), `unique` (the incoming card would break the unique rule).
   */
  | {
      readonly type: "swapRefused";
      readonly reason: "missingCard" | "bothInPlay" | "cannotLeavePlay" | "unsupported" | "unique";
      readonly instanceIds: readonly InstanceId[];
    }
  /** An empty separate deck took its discard pile back and was shuffled, with no penalty (`resetSeparateDeckIfEmpty`). */
  | { readonly type: "separateDeckReset"; readonly playerId: PlayerId; readonly name: string }
  /**
   * A card of a separate deck with no discard pile (Storm's Weather deck) would have gone to `instead` (a discard pile,
   * a hand or another deck) and went back into its own deck, facedown (`noDiscardPileDeckFor`, docs/phase7-wave6.md
   * §3.46, §4.1 Q26). Logged before the move.
   */
  | {
      readonly type: "returnedToSeparateDeck";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly playerId: PlayerId;
      readonly name: string;
      readonly instead: ZoneId["kind"];
    }
  /** `schemeInstanceId` is present only when the token went somewhere other than the central main scheme (§10.3). */
  | { readonly type: "accelerationTokenAdded"; readonly total: number; readonly schemeInstanceId?: InstanceId }
  /** "Place it here instead" (`accelerationTokenDestination`; The Master of Time 2B). */
  | { readonly type: "accelerationTokenRedirected"; readonly from: InstanceId; readonly to: InstanceId }
  /** `grantAdditionalMulligans` (docs/phase7-wave5.md §3.27): the player's extra mulligans now total `extraMulligans`. */
  | { readonly type: "additionalMulligansGranted"; readonly playerId: PlayerId; readonly extraMulligans: number }
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
      /** The "would" interrupts' earlier tier of this window (`trigger.would`, RRG 1.8 "'Would'", p. 48). */
      readonly would?: true;
      readonly candidates: readonly {
        readonly instanceId: InstanceId;
        readonly abilityId: AbilityId;
        readonly forced: boolean;
      }[];
    }
  /**
   * A script raised a named moment (`EffectSpec raiseMoment`, docs/phase7-wave8.md §3.39), for `playerId` as "you".
   * Logged whether or not any ability answers it; when one could, a `triggerEvent` of kind `momentRaised` follows.
   */
  | {
      readonly type: "momentRaised";
      readonly name: string;
      readonly playerId: PlayerId;
      readonly sourceInstanceId: InstanceId | null;
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
  /** `EffectSpec lookAt`: `playerId` looked at these cards (RRG 1.8 "Look, Looked-At", p. 27); nothing moved. */
  | { readonly type: "cardsLookedAt"; readonly playerId: PlayerId; readonly instanceIds: readonly InstanceId[] }
  /**
   * A required choice found nothing to choose (RRG 1.8 "Choose (Game Element)", p. 12), so the text before a "then"
   * did not fully resolve: `thenSkipped` follows for each "then" it gates.
   */
  | { readonly type: "choiceFoundNothing"; readonly slot: string }
  /**
   * The text before a "then" did not fully resolve for a reason other than a required choice finding nothing
   * (`PreThenFailure`; `resolve/then.ts`). `thenSkipped` follows for each "then" it gates. `instanceId`: the card the
   * failed part was about, where there is one (the enemy that did not attack, the card whose reveal was cancelled).
   */
  | { readonly type: "preThenUnresolved"; readonly cause: PreThenFailure; readonly instanceId?: InstanceId }
  /** RRG 1.8 "'Then'" (p. 44): the pre-"then" text did not fully resolve, so the post-"then" text was skipped. */
  | { readonly type: "thenSkipped" }
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
  | {
      readonly type: "statusGiven";
      readonly instanceId: InstanceId;
      readonly status: "stunned" | "confused" | "tough";
      /** `constant`: given by a `keepsGivingStatus` rule between frames (docs/phase7-wave6.md §3.9). */
      readonly reason?: "constant";
    }
  | { readonly type: "cardDiscardedFromPlay"; readonly instanceId: InstanceId; readonly cardId: CardId }
  /**
   * RRG 1.8 "Player Side Scheme Limit" (p. 34): `chosenBy` chose this player side scheme to discard for the limit (the
   * player who played one past it, otherwise the first player). Logged before the discard itself, which is not a defeat.
   */
  | { readonly type: "playerSideSchemeLimitDiscard"; readonly instanceId: InstanceId; readonly chosenBy: PlayerId }
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
  /**
   * An enemy keyword resolved with an effect of its own: teamwork (trait) found another minion with `trait` in play, so
   * the minion that entered play activates against `playerId` (RRG 1.8 "Teamwork (Trait)", p. 43). The activation
   * follows as `enemyActivated`.
   */
  | {
      readonly type: "keywordResolved";
      readonly keyword: "teamwork";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly trait: Trait;
    }
  /**
   * A keyword the engine resolves as its own ability (`keyword-abilities.ts`) resolved on `instanceId`: temporary
   * discarding its card as the round ends (RRG 1.8 "Temporary", p. 44; docs/phase7-wave6.md §3.26). `playerId` is the
   * player resolving it, its card's controller. The discard follows as `cardMoved`.
   */
  | {
      readonly type: "keywordResolved";
      readonly keyword: KeywordAbilityName;
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId | null;
    }
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
  /**
   * `EffectSpec chooseNumber` (docs/phase7-wave6.md §3.69): `playerId` chose `amount`, bound as `<bind>.amount`. Also
   * logged when the range held one number and nobody was asked.
   */
  | { readonly type: "numberChosen"; readonly playerId: PlayerId; readonly bind: string; readonly amount: number }
  /** `EffectSpec chooseCardType` (docs/phase7-wave7.md §3.33): `playerId` chose this card type. */
  | { readonly type: "cardTypeChosen"; readonly playerId: PlayerId; readonly cardType: RulesCardType }
  /**
   * `EffectSpec reportFact` (docs/phase7-wave7.md §3.83): `playerId` reported a fact from outside the game, bound as
   * `<bind>.amount`. `amount` is the number reported, or 1 for yes and 0 for no.
   */
  | {
      readonly type: "factReported";
      readonly playerId: PlayerId;
      readonly fact: ReportedFact;
      readonly bind: string;
      readonly amount: number;
    }
  /**
   * `EffectSpec searchCollection` (docs/phase7-wave7.md §3.81): `ownerId` found `cardId` in their collection, and it
   * joined the game as the new instance `instanceId`, which they own until the game ends (RRG 1.8 "Search", p. 39).
   * The one event that creates a player's card after setup: a replay needs nothing but the choice that led to it.
   */
  | {
      readonly type: "cardAddedFromCollection";
      readonly cardId: CardId;
      readonly instanceId: InstanceId;
      readonly ownerId: PlayerId;
    }
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
  /**
   * A card an effect would put into play did not enter play and stayed where it was. `noLegalHost`: an upgrade with no
   * host its "attach to" text allows (RRG 1.8 "Attach To", p. 8: "the card is not able to be attached, so it remains in
   * its prior state or game area"); a put into play places it as playing it would (RRG 1.8 "Play, Put into Play", p. 32).
   */
  | {
      readonly type: "putIntoPlayRefused";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly reason: "noLegalHost";
    }
  | { readonly type: "lastingEffectAdded"; readonly effect: LastingEffect }
  /**
   * A note recorded on a card's play (`modifyCardEffect.note`, docs/phase7-wave6.md §3.52: "remove up to 3 charge
   * counters → that event deal +1 damage for each counter removed", read by Charged Card). `total` is the note's value
   * after this write (notes of one name add up); it ends with the play.
   */
  /**
   * A played event was given a destination other than the discard pile for when its effects have resolved (`EffectSpec
   * afterResolving`, docs/phase7-wave7.md §3.68). Logged when the destination is written, not when the card moves.
   */
  | { readonly type: "playDestinationSet"; readonly instanceId: InstanceId; readonly to: "hand" }
  /**
   * A played event went to its owner's hand after its effects resolved instead of to the discard pile (§3.68). Logged
   * before the move's own `cardMoved`; no discard is logged, as the card never reached the pile.
   */
  | { readonly type: "playedEventReturned"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | {
      readonly type: "playNoted";
      readonly instanceId: InstanceId;
      readonly name: string;
      readonly value: number;
      readonly total: number;
    }
  /**
   * "That thwart removes 1 additional threat" (`EffectSpec modifyThwart`, docs/phase7-wave6.md §3.55): the thwart in
   * progress (its scheme and thwarter) will remove `extraThreat` more; `total` is its extra after this write (extras
   * add up). `sourceInstanceId`: the card whose ability added it.
   */
  | {
      readonly type: "thwartModified";
      readonly schemeInstanceId: InstanceId;
      readonly thwarterInstanceId: InstanceId;
      readonly extraThreat: number;
      readonly total: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  /** A lasting effect that was waiting on an attack is now scoped to it (`awaitingAttack` → `endOfEvent`). */
  | { readonly type: "lastingEffectRetimed"; readonly id: string; readonly duration: LastingDuration }
  | {
      readonly type: "lastingEffectEnded";
      readonly id: string;
      /** `detached`: its `whileAttached` card is no longer on that host (docs/phase7-wave6.md §3.50, §4.1 Q28). */
      readonly reason: "expired" | "consumed" | "sourceLeftPlay" | "fired" | "detached";
    }
  /** `patrol`: a thwart by a player a patrol minion is engaged with, against the main scheme (docs/phase7-wave3.md §3.5). */
  | {
      readonly type: "threatRemovalBlocked";
      readonly schemeInstanceId: InstanceId;
      readonly reason: "crisis" | "patrol" | "rule";
    }
  /**
   * A card stayed in play when something tried to move or defeat it: it "cannot leave play" (RRG 1.8 "'Cannot'",
   * p. 11), or its Permanent keyword stopped an effect from outside its set or a game rule (`permanent`; RRG 1.8
   * "Permanent", p. 32; `effects.ts` `permanentStopsLeaving`, docs/phase7-wave5.md §4.1 Q46).
   */
  | {
      readonly type: "leavePlayBlocked";
      readonly instanceId: InstanceId;
      readonly reason: "cannotLeavePlay" | "permanent";
    }
  /** A flip effect did nothing to this card: a `cannotFlip` rule names it (docs/phase7-wave7.md §3.64). */
  | { readonly type: "flipBlocked"; readonly instanceId: InstanceId }
  /**
   * One of the scenario's rulebook-printed setup instructions resolved (`GameSetupConfig.scenarioSetupInstructions`;
   * MC21 p. 11's optional Tower Defense setup damage). `text` and `citation` are copied from the instruction so the
   * trace says why the state changed without the setup config to hand.
   */
  | {
      readonly type: "scenarioSetupInstructionResolved";
      readonly instructionId: string;
      readonly text: string;
      readonly citation: string;
    }
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

/**
 * Why status cards were discarded (`GameEvent statusRemoved.reason`, `TriggerEvent statusDiscarded.cause`).
 * `preventedDamage`: a tough card used up by damage; `cannotHave`: stalwart, or a `cannotHaveStatus` rule, began to
 * apply (docs/phase7-wave3.md §3.7); `cost`: paid as an `AbilityCost.discardStatus` (docs/phase7-wave6.md §3.6).
 */
export type StatusDiscardCause =
  | "cost"
  | "cancelledAttack"
  | "cancelledSchemeOrThwart"
  | "preventedDamage"
  | "piercing"
  | "effect"
  | "cannotHave";
