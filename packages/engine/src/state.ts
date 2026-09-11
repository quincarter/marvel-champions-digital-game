import type { AnyCard, CardId, Trait } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import type { PendingChoice } from "./choices.js";
import type { RngState } from "./rng.js";
import type { StackFrame } from "./stack.js";
import type { LastingEffect } from "./lasting.js";

export type Form = "hero" | "alterEgo";

/** RRG "Status Cards": a character can hold at most one of each type (steady allows a second). */
export interface StatusCounts {
  readonly stunned: number;
  readonly confused: number;
  readonly tough: number;
}

export const NO_STATUSES: StatusCounts = { stunned: 0, confused: 0, tough: 0 };

/**
 * Every zone a card instance can occupy, as data. `attachment` and `boost` are
 * per-instance lists (attachments/boost cards hang off the card they're on),
 * which is why they name a host instance instead of a player or a global pile.
 */
export type ZoneId =
  | { readonly kind: "hand"; readonly playerId: PlayerId }
  | { readonly kind: "deck"; readonly playerId: PlayerId }
  | { readonly kind: "discard"; readonly playerId: PlayerId }
  | { readonly kind: "playArea"; readonly playerId: PlayerId }
  | { readonly kind: "dealtEncounter"; readonly playerId: PlayerId }
  /** Event cards being played: out of play while they resolve (RRG "Event"), then discarded. */
  | { readonly kind: "resolving"; readonly playerId: PlayerId }
  /** A player's set-aside nemesis encounter set (RRG "Nemesis Encounter Set"): out of play. */
  | { readonly kind: "setAside"; readonly playerId: PlayerId }
  /** Cards tucked under another card (RRG "Tuck"): out of play, discarded when the host leaves play. */
  | { readonly kind: "tucked"; readonly hostInstanceId: InstanceId }
  | { readonly kind: "identity"; readonly playerId: PlayerId }
  | { readonly kind: "encounterDeck" }
  | { readonly kind: "encounterDiscard" }
  | { readonly kind: "villainArea" }
  | { readonly kind: "attachment"; readonly hostInstanceId: InstanceId }
  | { readonly kind: "boost"; readonly hostInstanceId: InstanceId }
  | { readonly kind: "victoryDisplay" }
  | { readonly kind: "removedFromGame" };

/**
 * What a facedown card in play is treated as ("put the top card of your deck
 * into play facedown, engaged with you as a Drone minion"): a minion with only
 * these traits, no name, no keywords and no abilities of its own, and printed
 * base stats of 0 (card abilities can set its base stats).
 */
export interface FacedownRole {
  readonly kind: "minion";
  readonly traits: readonly Trait[];
}

export interface CardInstance {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  /** Player whose deck it came from; null for encounter/scenario cards. */
  readonly ownerId: PlayerId | null;
  readonly controllerId: PlayerId | null;
  readonly faceup: boolean;
  readonly exhausted: boolean;
  readonly damage: number;
  readonly threat: number;
  readonly statuses: StatusCounts;
  readonly counters: Readonly<Record<string, number>>;
  readonly attachedTo: InstanceId | null;
  readonly attachments: readonly InstanceId[];
  /** Facedown boost cards given to this enemy for an activation (RRG "Boost"). */
  readonly boostCards: readonly InstanceId[];
  /** Cards tucked under this card (RRG "Tuck"; Highway Robbery's facedown cards). Not in play. */
  readonly tucked: readonly InstanceId[];
  /** Set while this card is in play facedown as something else (a facedown Drone minion). */
  readonly facedownAs: FacedownRole | null;
  readonly engagedWith: PlayerId | null;
}

export interface IdentityState {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  readonly form: Form;
  /** RRG "Form, Change Form": once each round, during that player's own turn. */
  readonly changedFormThisRound: boolean;
}

export interface PlayerState {
  readonly playerId: PlayerId;
  /** Seat order around the table; "clockwise" is ascending seatIndex, wrapping. */
  readonly seatIndex: number;
  readonly identity: IdentityState;
  readonly hand: readonly InstanceId[];
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
  readonly playArea: readonly InstanceId[];
  /** Facedown encounter cards dealt in villain phase step 3, revealed in step 4. */
  readonly dealtEncounter: readonly InstanceId[];
  /** Event cards this player is playing right now (out of play until discarded). */
  readonly resolving: readonly InstanceId[];
  /** This player's set-aside nemesis set (Shadow of the Past brings it in). */
  readonly setAside: readonly InstanceId[];
  readonly eliminated: boolean;
}

export interface VillainState {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  readonly side: "A" | "B";
  readonly stageIndex: number;
  /** The last stage used this game (standard I–II, expert II–III): defeating it wins. */
  readonly lastStageIndex: number;
  readonly defeated: boolean;
}

export interface MainSchemeState {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  readonly stageIndex: number;
  readonly completed: boolean;
  /** RRG "Acceleration Token": carries over when the main scheme advances. */
  readonly accelerationTokens: number;
}

/**
 * Steps that iterate players carry the remaining player order explicitly, so a
 * player being eliminated mid-step can't shift anyone else's place in line.
 */
export type GameStep =
  /** RRG Appendix II step 14, after setup cards and setup abilities have resolved. */
  | { readonly phase: "setup"; readonly kind: "drawStartingHands" }
  | { readonly phase: "setup"; readonly kind: "mulligan"; readonly remainingPlayerIds: readonly PlayerId[] }
  | {
      readonly phase: "player";
      readonly kind: "turn";
      readonly activePlayerId: PlayerId;
      readonly remainingPlayerIds: readonly PlayerId[];
    }
  | { readonly phase: "player"; readonly kind: "endPhaseDiscard"; readonly remainingPlayerIds: readonly PlayerId[] }
  | { readonly phase: "player"; readonly kind: "endPhaseDraw" }
  | { readonly phase: "player"; readonly kind: "endPhaseReady" }
  /** `placed`: step one's threat has been pushed; the step stays current until it (and its responses) resolve. */
  | { readonly phase: "villain"; readonly kind: "placeThreat"; readonly placed?: boolean }
  | {
      readonly phase: "villain";
      readonly kind: "enemyActivations";
      /** null means "pull the next player off `remainingPlayerIds`". */
      readonly currentPlayerId: PlayerId | null;
      readonly remainingPlayerIds: readonly PlayerId[];
      readonly villainActivated: boolean;
      readonly activatedMinionIds: readonly InstanceId[];
    }
  | { readonly phase: "villain"; readonly kind: "dealEncounterCards" }
  | { readonly phase: "villain"; readonly kind: "revealEncounterCards"; readonly remainingPlayerIds: readonly PlayerId[] }
  | { readonly phase: "villain"; readonly kind: "passFirstPlayer" }
  /** `delayedResolved`: "at the end of the round" delayed effects have been fired (RRG "Lasting Effects"). */
  | { readonly phase: "villain"; readonly kind: "endOfRound"; readonly delayedResolved?: boolean }
  | { readonly phase: "gameOver"; readonly kind: "gameOver" };

export type GameOutcome =
  | { readonly result: "win"; readonly reason: "villainDefeated" }
  | { readonly result: "loss"; readonly reason: "mainSchemeCompleted" }
  | { readonly result: "loss"; readonly reason: "allPlayersDefeated" };

export interface GameState {
  readonly round: number;
  readonly step: GameStep;
  readonly firstPlayerId: PlayerId;
  /** Fixed at setup: per-player scaling ignores later eliminations (RRG "Player Elimination"). */
  readonly startingPlayerCount: number;
  readonly players: readonly PlayerState[];
  readonly villain: VillainState;
  readonly mainScheme: MainSchemeState;
  readonly encounterDeck: readonly InstanceId[];
  readonly encounterDiscard: readonly InstanceId[];
  readonly villainArea: readonly InstanceId[];
  readonly victoryDisplay: readonly InstanceId[];
  readonly removedFromGame: readonly InstanceId[];
  readonly instances: Readonly<Record<string, CardInstance>>;
  /** Printed card data, carried in state so a saved game replays without external lookup. */
  readonly cardPool: Readonly<Record<string, AnyCard>>;
  /** Resolution stack; index 0 is resolving now. `step` is phase structure, this is within a step. */
  readonly stack: readonly StackFrame[];
  /** `instanceId:abilityId` → times used, for "Limit X per phase/round" (RRG "Limit"). */
  readonly abilityUses: Readonly<Record<string, number>>;
  /** Effects that outlive the ability that created them (RRG "Lasting Effects"). */
  readonly lastingEffects: readonly LastingEffect[];
  readonly pendingChoice: PendingChoice | null;
  readonly outcome: GameOutcome | null;
  readonly rng: RngState;
  readonly nextInstanceSeq: number;
  readonly nextChoiceSeq: number;
  readonly nextFrameSeq: number;
  readonly nextLastingSeq: number;
}
