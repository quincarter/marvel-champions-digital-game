import type { AnyCard, CardId, Trait, VillainSideLetter } from "@mc/content";
import type { CampaignGameInput, CampaignInGameWrites, CampaignWindow } from "./campaign.js";
import type { EncounterDeckId, GameAreaId, InstanceId, PlayerId } from "./ids.js";
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

/** Every status card type in the game, in RRG 1.8 "Status Cards" (p. 42) order. */
export const STATUS_NAMES = ["confused", "stunned", "tough"] as const satisfies readonly (keyof StatusCounts)[];

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
  /**
   * A scenario's own separate deck and its discard pile (docs/phase7-wave2.md §3.3; `Scenario.separateDecks`): the
   * Experimental Weapons deck, the side-scheme deck. Out of play, owned by nobody.
   */
  | { readonly kind: "scenarioDeck"; readonly name: string }
  | { readonly kind: "scenarioDiscard"; readonly name: string }
  /**
   * A scenario's own out-of-play game area (docs/phase7-wave3.md §3.14): Infiltrate the Museum's The Collection, "an
   * out-of-play game area shared by all players and specific to this scenario. Cards in The Collection follow the
   * standard rules for out-of-play cards" (MC16 p. 10). Created by the scenario's setup (`createScenarioArea`).
   */
  | { readonly kind: "scenarioArea"; readonly name: string }
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
  | { readonly kind: "separateDeck"; readonly name: string }
  /** A card of a scenario deck with a discard pile of its own (the side-scheme deck; docs/phase7-wave2.md §3.3). */
  | { readonly kind: "scenarioDeck"; readonly name: string };

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
  /**
   * Which hero face is up while in hero form: 0 is the identity's `hero`, n is `additionalHeroForms[n - 1]` (a
   * three-sided identity's inside face; docs/phase7-wave2.md §3.2). Null in alter-ego form. `form` is kept beside it so
   * every reader that only asks "hero or alter-ego" is unchanged.
   */
  readonly heroFormIndex: number | null;
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
  /** The face up: A or B, or C on the inside of a three-sided villain (`VillainSideLetter`). */
  readonly side: VillainSideLetter;
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

/**
 * One scenario deck and its discard pile, with the rules its `ScenarioSeparateDeck` states (docs/phase7-wave2.md §3.3).
 * `discardPile: "encounter"` cards keep an encounter-deck home, so a discard goes to the encounter discard pile ("After a
 * card from the Experimental Weapons deck enters play, it is considered to be part of the encounter deck"); `"own"` cards
 * are homed to this deck and go to its discard pile.
 */
export interface ScenarioDeckState {
  readonly deck: readonly InstanceId[];
  readonly discard: readonly InstanceId[];
  readonly discardPile: "own" | "encounter";
  readonly whenEmpty: "reshuffleDiscardWithoutPenalty" | "remainsEmpty";
  /** Which encounter-deck cards form it (`ScenarioSeparateDeck.contents`); read by `buildScenarioDeck`. */
  readonly contents: { readonly encounterSetIds?: readonly string[]; readonly cardType?: "side_scheme" };
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
 * One separate game area (docs/phase7-wave2.md §3.1; The Once and Future Kang insert, "Playing With Separate Game
 * Areas"). Created by a card ability ("Create your own game area and place this scheme in it"), never at setup.
 *
 * - `playerIds`: the players in it. A player's own cards (identity, play area, engaged minions and their attachments)
 *   are in their area.
 * - `mainScheme`: the area's own main scheme stage, an instance of the scenario's main scheme card at one of its
 *   alternative stages (Kang's stage 3), or null once a card has removed it ("Remove the Chronopolis from the game").
 * - `villainIds` / `activeVillainId`: the villains in it ("Add Kang (Immortus) to the game area"); "the villain" in this
 *   area is `activeVillainId`.
 * - `sideSchemeIds`: side schemes that belong to it (in the shared `villainArea` zone like every side scheme).
 *
 * Everything else in play, environments above all (RRG 1.8 FAQ "The Once and Future Kang Scenario Pack", p. 60:
 * "Environment cards are considered to be in all players' game areas"), and the central stage (`GameState.mainScheme`,
 * "Stage 2B remains in play in a central location and its text remains active for all players") is in every area.
 */
export interface GameAreaState {
  readonly areaId: GameAreaId;
  readonly playerIds: readonly PlayerId[];
  readonly mainScheme: MainSchemeState | null;
  readonly villainIds: readonly InstanceId[];
  readonly activeVillainId: InstanceId | null;
  readonly sideSchemeIds: readonly InstanceId[];
  /** Stages this area had and a card removed ("Remove the Chronopolis from the game"), so their text still knows its area. */
  readonly formerSchemeIds: readonly InstanceId[];
}

/**
 * Scenario rules the engine applies itself, fixed at setup from the scenario data (`GameSetupConfig`).
 *
 * - `victory`: `"finalVillainStage"` is RRG 1.8 "Villain Defeat" (p. 47); `"cardAbility"` means only an ability wins
 *   (`winGame`; Kang (III): "When Defeated: The players win the game."), so defeating every villain does not
 *   (docs/phase7-wave2.md §1.8, §3.4).
 * - `separateGameAreas`: whether card abilities may split the players into areas (`Scenario.separateGameAreas`).
 */
export interface ScenarioRules {
  readonly victory: "finalVillainStage" | "cardAbility";
  readonly separateGameAreas: boolean;
}

/**
 * Steps that iterate players carry the remaining player order explicitly, so a
 * player being eliminated mid-step can't shift anyone else's place in line.
 */
export type GameStep =
  /**
   * A campaign's own setup instructions for this scenario, at one of RRG Appendix II's five printed windows
   * (`CampaignWindow`, resolved in `CAMPAIGN_WINDOW_ORDER`). **Campaign games only**: a game created without
   * `GameSetupConfig.campaign` never reaches this step or `scenarioSetup`, and its step sequence is unchanged.
   */
  | { readonly phase: "setup"; readonly kind: "campaignWindow"; readonly window: CampaignWindow }
  /**
   * RRG 1.8 Appendix II steps 6-12 (p. 51): shuffle the decks, place starting threat, put setup cards into play,
   * resolve the scenario's own setup abilities. A flow step only in a campaign game, where `beforeScenarioSetup`
   * instructions have to resolve *before* it; otherwise `createGame` runs the same code inline as it always has.
   */
  | { readonly phase: "setup"; readonly kind: "scenarioSetup" }
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
  | {
      readonly phase: "villain";
      readonly kind: "revealEncounterCards";
      readonly remainingPlayerIds: readonly PlayerId[];
    }
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
  | { readonly result: "loss"; readonly reason: "allPlayersDefeated" }
  /**
   * A player gave up (the `concede` command). A third result kind rather than a widened `loss`: the RRG has no
   * concede rule, so calling a concession a defeat would import a rules meaning the game does not have — and would
   * quietly turn it into a loss in a win/loss record. Readers that only distinguish "win" from "not win" are
   * unaffected; readers that record a result should treat this as played-but-unresolved.
   *
   * It carries a `reason` like every other outcome so `GameOutcome.reason` stays total for the readers that switch
   * on it, plus `byPlayerId` for the seat that gave up.
   */
  | { readonly result: "conceded"; readonly reason: "playerConceded"; readonly byPlayerId: PlayerId };

/** One reveal in `GameState.revealedThisRound`. `phase` is the phase it happened in (a round has one of each). */
export interface RevealRecord {
  readonly instanceId: InstanceId;
  readonly playerId: PlayerId;
  readonly phase: GameStep["phase"];
}

/** One attack in `GameState.attackedThisTurn`: who made it, and the title they were showing when they did. */
export interface AttackRecord {
  readonly attackerInstanceId: InstanceId;
  readonly attackerTitle: string;
}

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
  /**
   * The main scheme: with separate game areas, the central stage outside every area (docs/phase7-wave2.md §3.1); each
   * area's own stage is its `GameAreaState.mainScheme`.
   */
  readonly mainScheme: MainSchemeState;
  /** Separate game areas, in creation order. Empty while the players share one game area (every scenario but Kang). */
  readonly gameAreas: readonly GameAreaState[];
  readonly nextGameAreaSeq: number;
  /**
   * Stage indexes of the main scheme card that can no longer be revealed: an alternative stage already revealed, or one
   * removed from the game ("Remove any unused stage 3 schemes from the game", The Master of Time 2A).
   */
  readonly spentMainSchemeStages: readonly number[];
  /**
   * Main scheme stages revealed by `revealMainSchemeStage` whose A side is still resolving, before `createGameArea`
   * places them in an area ("Create your own game area and place this scheme in it"). Not in play.
   */
  readonly revealedMainSchemes: readonly MainSchemeState[];
  readonly scenarioRules: ScenarioRules;
  /** Every encounter deck with its discard pile, keyed by id. `encounterDeckOrder` gives their stable order. */
  readonly encounterDecks: Readonly<Record<string, EncounterDeckState>>;
  readonly encounterDeckOrder: readonly EncounterDeckId[];
  readonly encounterSetAside: readonly InstanceId[];
  /** Scenario decks by name (docs/phase7-wave2.md §3.3). Empty for every scenario that has none. */
  readonly scenarioDecks: Readonly<Record<string, ScenarioDeckState>>;
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
  /** Cards played this phase, by title, across every player: "Max 1 per phase." (Maximum Velocity). Reset when a phase ends. */
  readonly playedThisPhase: Readonly<Record<string, number>>;
  /** Cards played this round keyed `<playerId>:<card type>` ("the first ally played each round"). Reset when the round ends. */
  readonly playedByPlayerThisRound: Readonly<Record<string, number>>;
  /**
   * Who attacked whom **this turn**, keyed by the attacked character and listing each attack's attacker with the title
   * it showed when it attacked, each pair once, in attack order: "Attach to an enemy that X-23 or Honey Badger attacked
   * this turn" (Puncture Wound 43012; `HostQualifiers.attackedThisTurnBy`, docs/phase7-wave2.md §11.3, §14).
   *
   * - **Written** by every attack, player-made or enemy-made, at the `characterAttacked` event (the one place both
   *   paths go through) — but only while a player's turn is in progress, since outside one there is no "this turn"
   *   (RRG 1.8 "Player Phase" / "Player Turn", p. 34; the same reading as `LastingUntil "endOfTurn"`, §13.3).
   * - **Cleared** when each turn begins and when it ends, so the villain phase and the end-of-phase steps see an empty
   *   record rather than the last player's.
   * - **The title is the attacker's at attack time**, read from an identity's faceup side (`titleShowing`): "that
   *   X-23 attacked" is a fact about the attack, and RRG 1.8 "Identity" (p. 23) has a title name "only … the identity
   *   with that title, and not … the other side of the card". So an identity that attacked as X-23 and then changed
   *   to Laura Kinney still attacked as X-23, and nothing an alter-ego does is recorded under the hero's title.
   */
  readonly attackedThisTurn: Readonly<Record<string, readonly AttackRecord[]>>;
  /**
   * Every card revealed this round, in order, with who revealed it and in which phase (RRG 1.8 "Reveal", p. 37): "The
   * first [Technique] attachment revealed each round gains surge" (Nebula I–III, `gmw`), "The first treachery the engaged
   * player reveals each villain phase gains surge" (Mister Knife, `stld`). Written by every reveal whatever is in play,
   * because "the first" counts cards revealed before the rule's card arrived; emptied when the round ends. Absent until a
   * game's first reveal, so a freshly set-up game serializes as before. docs/phase7-wave3.md §3.8.
   */
  readonly revealedThisRound?: readonly RevealRecord[];
  /**
   * The scenario's own out-of-play game areas by name (`ZoneId scenarioArea`; The Collection, docs/phase7-wave3.md
   * §3.14), each in the order cards entered it. Absent until a scenario creates one, so other games serialize as before.
   */
  readonly scenarioAreas?: Readonly<Record<string, readonly InstanceId[]>>;
  /**
   * The campaign this game is a scenario of, exactly as the runner composed it (design §7.1) — **frozen**: nothing
   * in a game ever writes here. Because it lands in the replay baseline, a saved campaign game replays without
   * consulting the campaign log at all, which is what lets the log keep evolving underneath saved games.
   *
   * **Absent, not null, outside a campaign** (with `campaignWrites`, which is present exactly when this is): a
   * standalone game's serialized state is byte for byte what it was before campaign mode existed, so every save
   * written until now still replays.
   */
  readonly campaign?: CampaignGameInput;
  /** What this game has written back to the campaign so far (design §6.1). Present exactly when `campaign` is. */
  readonly campaignWrites?: CampaignInGameWrites;
  readonly pendingChoice: PendingChoice | null;
  readonly outcome: GameOutcome | null;
  readonly rng: RngState;
  readonly nextInstanceSeq: number;
  readonly nextChoiceSeq: number;
  readonly nextFrameSeq: number;
  readonly nextLastingSeq: number;
}
