import type { AnyCard, CardId, Trait } from "@mc/content";
import type { EncounterDeckId, InstanceId, PlayerId } from "./ids.js";
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
  | { readonly kind: "encounterDeck"; readonly deckId: EncounterDeckId }
  | { readonly kind: "encounterDiscard"; readonly deckId: EncounterDeckId }
  /**
   * Scenario cards set aside at setup (RRG 1.8 "Set Aside", p. 39): out of play until an ability brings them in.
   * The Wrecking Crew's signature side schemes wait here for Breakout 1A's "Put … side schemes into play".
   */
  | { readonly kind: "encounterSetAside" }
  /**
   * An identity's separate deck and that deck's own discard pile (the Invocation deck; docs/phase7-wave1.md §3.5).
   * Out of play, owned by that player (RRG 1.8 "Ownership and Control", p. 31).
   */
  | { readonly kind: "separateDeck"; readonly playerId: PlayerId; readonly name: string }
  | { readonly kind: "separateDiscard"; readonly playerId: PlayerId; readonly name: string }
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
 *
 * `blank` is a card that is in play facedown as nothing in particular — "attach 1 card from your hand facedown here"
 * (Bruno Carrelli). It has no title, traits, keywords or abilities while it is facedown; its card type is unchanged,
 * because nothing asks what type a facedown attachment is (docs/phase7-wave1.md §3.13).
 */
export interface FacedownRole {
  readonly kind: "minion" | "blank";
  readonly traits: readonly Trait[];
}

/**
 * Where "discard" sends a card, fixed when the card is created (docs/phase7-wave1.md §3.2).
 *
 * - `player`: its owner's discard pile.
 * - `encounterDeck`: that encounter deck's discard pile. The Wrecking Crew insert, "Multiple Villains and
 *   Encounter Decks": "When an encounter card leaves play, it is placed in the discard pile of its corresponding
 *   encounter deck."
 * - `activeEncounterDeck`: a card with no encounter deck of its own (an obligation, a nemesis set card) goes to
 *   the active villain's discard pile. Ruling, Jan 17, 2026 (5): "once defeated, it is placed in the active
 *   villain's encounter discard pile."
 *
 * - `separateDeck`: its owner's separate deck of that name (the Invocation deck, §3.5). The Doctor Strange insert:
 *   "After that card is resolved, it is placed in a special discard pile that belongs to the INVOCATION deck."
 *
 * With one villain every encounter home is the same deck, so Core behaves exactly as before.
 */
export type CardHome =
  | { readonly kind: "player" }
  | { readonly kind: "encounterDeck"; readonly deckId: EncounterDeckId }
  | { readonly kind: "activeEncounterDeck" }
  | { readonly kind: "separateDeck"; readonly name: string };

export interface CardInstance {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  /** Player whose deck it came from; null for encounter/scenario cards. */
  readonly ownerId: PlayerId | null;
  readonly controllerId: PlayerId | null;
  /** Where "discard" sends this card (see `CardHome`). */
  readonly home: CardHome;
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
  /**
   * A double-sided encounter card showing its other face (`EncounterCardCommon.flipSide`; RRG 1.8 "Flip", p. 20).
   * A villain's face is `VillainState.side` instead. Always false out of play.
   */
  readonly flipped: boolean;
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
  /**
   * Decks this player's identity brings besides the player deck, by name (`HeroIdentityCard.separateDecks`; the
   * Invocation deck). Built and shuffled at setup; empty for every Core identity.
   */
  readonly separateDecks: Readonly<Record<string, SeparateDeckState>>;
  readonly eliminated: boolean;
}

/**
 * One separate deck and its own discard pile (docs/phase7-wave1.md §3.5). The top card's `faceup` follows the
 * identity's `topCardFaceup` after every change (`syncSeparateDeckTop`); an empty deck with cards in its discard is
 * reshuffled at once, with no penalty (`resetEmptySeparateDecks`).
 */
export interface SeparateDeckState {
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
}

export interface VillainState {
  readonly instanceId: InstanceId;
  readonly cardId: CardId;
  readonly side: "A" | "B";
  readonly stageIndex: number;
  /** The last stage used this game (standard I–II, expert II–III): defeating it defeats this villain. */
  readonly lastStageIndex: number;
  /**
   * The last stage has been defeated. RRG 1.8 "Villain Defeat" (p. 47): the stage is removed from the game, so a
   * defeated villain is out of play. With several villains the game goes on until every one is defeated.
   */
  readonly defeated: boolean;
  /** This villain's own encounter deck (every villain of a single-deck scenario shares the one deck). */
  readonly encounterDeckId: EncounterDeckId;
  /**
   * This villain's signature side scheme (The Wrecking Crew insert, "Signature Side Schemes"), or null. The link
   * holds whether the scheme is set aside, in play, or removed from the game.
   */
  readonly signatureSideSchemeId: InstanceId | null;
}

/** One encounter deck and its discard pile (RRG 1.8 "Encounter Deck", p. 17). */
export interface EncounterDeckState {
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
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
  /**
   * RRG 1.8 Appendix II step 16 (p. 51), "Resolve Player Setup Abilities": after the draw (step 14) and the mulligan
   * (step 15). `resolved`: the abilities have been put on the stack and the first round begins once they finish.
   */
  | { readonly phase: "setup"; readonly kind: "playerSetupAbilities"; readonly resolved?: boolean }
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
  /** The only villain's last stage was defeated (RRG 1.8 "Villain Defeat", p. 47). */
  | { readonly result: "win"; readonly reason: "villainDefeated" }
  /** Several villains, and the last undefeated one fell (The Wrecking Crew insert: "If the players defeat all 4 villains, they win the game!"). */
  | { readonly result: "win"; readonly reason: "allVillainsDefeated" }
  | { readonly result: "loss"; readonly reason: "mainSchemeCompleted" }
  | { readonly result: "loss"; readonly reason: "allPlayersDefeated" };

export interface GameState {
  readonly round: number;
  readonly step: GameStep;
  readonly firstPlayerId: PlayerId;
  /** Fixed at setup: per-player scaling ignores later eliminations (RRG "Player Elimination"). */
  readonly startingPlayerCount: number;
  readonly players: readonly PlayerState[];
  /** Every villain of the scenario in printed order, defeated ones included. Single-villain scenarios list one. */
  readonly villains: readonly VillainState[];
  /**
   * The villain with the active counter (The Wrecking Crew insert, "The Active Villain"): the one that activates,
   * the one "the villain" refers to, and whose encounter deck "the encounter deck" is. Scenario state with its own
   * rules rather than an entry in a card's `counters`; changes are logged as `activeVillainChanged`.
   */
  readonly activeVillainId: InstanceId;
  readonly mainScheme: MainSchemeState;
  /** Every encounter deck with its discard pile, keyed by id. `encounterDeckOrder` gives their stable order. */
  readonly encounterDecks: Readonly<Record<string, EncounterDeckState>>;
  readonly encounterDeckOrder: readonly EncounterDeckId[];
  readonly encounterSetAside: readonly InstanceId[];
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
  /**
   * The last observed value of each live `stateCheck` ability's condition, keyed `instanceId:abilityId`, so the
   * ability fires on the change to true and not again while it stays true (`resolve/state-checks.ts`).
   */
  readonly stateChecks: Readonly<Record<string, boolean>>;
  /**
   * Cards played this round, by title, across every player: RRG 1.8 "Max, Maximum" (p. 28), "'Max X per [period]'
   * imposes a maximum number of times that copies of that card can be played", and a cancelled card still counts.
   * Reset when the round ends.
   */
  readonly playedThisRound: Readonly<Record<string, number>>;
  /** Cards played this round keyed `<playerId>:<card type>` ("the first ally played each round"). Reset when the round ends. */
  readonly playedByPlayerThisRound: Readonly<Record<string, number>>;
  readonly pendingChoice: PendingChoice | null;
  readonly outcome: GameOutcome | null;
  readonly rng: RngState;
  readonly nextInstanceSeq: number;
  readonly nextChoiceSeq: number;
  readonly nextFrameSeq: number;
  readonly nextLastingSeq: number;
}
