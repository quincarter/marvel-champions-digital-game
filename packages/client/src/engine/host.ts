/**
 * The client's only door to the rules.
 *
 * PLAN.md Phase 4: "Phaser is a view, never an authority." Scenes, view models
 * and the session store talk to an `EngineHost` and nothing else — they never
 * import `applyCommand` and never decide legality. Two implementations exist:
 * `WorkerEngineHost` (the game; keeps the engine off the main thread because
 * `legalActions` peaks at ~194 ms in a 4-player Ultron game) and
 * `LocalEngineHost` (Vitest and debugging, same interface, in-thread).
 *
 * Phase 5 note: this async shape is what host- or server-authoritative
 * multiplayer needs, so a network host can replace the worker without the
 * client changing.
 */

import type { CorePlayer, HorsemanSide } from "@mc/cards";
import type { AnyCard, DifficultySetChoice, PlayModes, ScenarioSetupOptions } from "@mc/content";
import type {
  CampaignGameInput,
  Command,
  EngineError,
  GameEvent,
  GameState,
  SealedGameState,
  LegalActions,
  OutsideFacts,
  PlayerId,
  SetupStack,
  TableRules,
} from "@mc/engine";
import type { BackOutTrailEntry } from "../view/back-out.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";
import type { GameRecord } from "./game-record.js";
import type { SaveMeta, SavedGuidedRun } from "./game-storage.js";
import type { RoomPlayRecord } from "./room-play.js";

/**
 * What the session flow collects across the Scenario → Seats → Deck screens.
 *
 * `difficulty` gained `"extreme"` for Breakout's own multi-villain challenge
 * (docs/phase7-wave1.md §2.3, §4.6: version A in play with version B
 * underneath). `villainVersions` overrides `difficulty`'s uniform default
 * per villain, in the scenario's printed order — Breakout only; every other
 * scenario has one villain and reads `difficulty` alone.
 *
 * This is also the save shape (`game-storage.ts`'s `SaveMeta.config`), so every
 * field here has to be additive: `modes` is optional and a save written before
 * it existed carries only `difficulty`, which still resolves to exactly the same
 * mode set.
 */
/** The Four Horsemen's version per villain in printed order (War, Famine, Pestilence, Death): wave 8's own option. */
export type HorsemanSides = readonly [HorsemanSide, HorsemanSide, HorsemanSide, HorsemanSide];

/** The two teams of a Competitive game as a `SessionConfig` carries them (registration first, then resistance). */
export interface CompetitiveSessionTeams {
  readonly teams: readonly [CompetitiveSessionTeam, CompetitiveSessionTeam];
  /** MC56 p. 17's tie-breaks (plan Q9 C, the lobby option; default on). */
  readonly tieBreaks: boolean;
}

export interface CompetitiveSessionTeam {
  /** The team's leader by scenario id (`registration-iron-man`), the leader the other team fights. */
  readonly leaderScenarioId: string;
  /** How many of `SessionConfig.players` are on the team (they follow one another, registration first). */
  readonly playerCount: number;
  /** The scenario the team built for the other: modular sets, main scheme stages and any extra sets. */
  readonly modularSetIds: readonly string[];
  readonly mainSchemeStageIds: readonly string[];
  readonly extraModularSetIds?: readonly string[];
}

export interface SessionConfig {
  readonly scenarioId: string;
  readonly difficulty: "standard" | "expert" | "extreme";
  /**
   * The full RRG 1.8 mode set (`@mc/content`'s `schema/modes.ts`, pp. 28–29), of which `difficulty` is the
   * expert half. Campaign is an orthogonal axis here and nothing reads it yet.
   *
   * **Old saves.** Absent on every save written before this field existed, and absent is not "standard": it
   * means "this config only ever said `difficulty`", so `session-core.ts`'s `scenarioFor` passes `difficulty`
   * through alone and the scenario builder derives the modes from it (`resolveModes`). An old save therefore
   * replays byte-for-byte, and `"extreme"` — a per-villain version choice, not a mode — keeps working because
   * it never becomes a `PlayModes` at all.
   */
  readonly modes?: PlayModes;
  /** Defaults to the scenario's recommended modular set(s) when omitted. */
  readonly modularSetIds?: readonly string[];
  readonly players: readonly CorePlayer[];
  /**
   * Custom content packs this game uses (docs/custom-content-packs.md §7.4), as plain data: their cards, abilities and
   * precon decks, merged into the pool and the engine's deps for this game only. Attached by the host's `start` from
   * the packs loaded on the main thread (`packs/game-packs.ts`), stored with the save so a resume needs no store.
   * Absent for every base-game game and every save written before packs existed.
   */
  readonly packs?: readonly PackRuntime[];
  /**
   * The house rules switched on for this game (docs/custom-content-packs.md §11.11): installed `house-rule` pack ids,
   * chosen in Table setup. `withLoadedPacks` embeds each one in `packs` (so a resume needs it no more than any other
   * pack) and keeps only those it embedded. Absent: no house rule, and every save written before they existed.
   */
  readonly houseRules?: readonly string[];
  /**
   * "Let people watch this game" (issue #876, docs/live-game-rooms.md): the game streams to a live room on the sync
   * Worker. Chosen per game in setup (the `liveWatch` setting only pre-ticks it). It never reaches the rules: the pool
   * and the scenario ignore it, and the live header and replay files leave it out. Absent: not streamed.
   */
  readonly watchable?: true;
  /**
   * The lobby room this game belongs to (issue #880): the room's id, set by `platform/room.ts` `startGame` for the game
   * a host starts from its lobby. The live-room worker attaches a game to the host's lobby room only when this matches
   * (a later single-player game never joins an old lobby). Like `watchable`, it never reaches the rules and the live
   * header and replay files leave it out.
   */
  readonly room?: string;
  /**
   * How a lobby room's game is played (issue #880): `"strict"` takes Undo, Back out and Manual adjust away from the
   * host and the engine host refuses them (`view/room-strict.ts`); `"host"` and absent change nothing. Set by
   * `platform/room.ts` `startGame` from the lobby's rules. Like `room`, it never reaches the rules and the live header
   * and replay files leave it out.
   */
  readonly roomPlayMode?: "strict" | "host";
  /**
   * Who may Undo in a lobby room's game (`LobbyUndo` in the sync worker): `"off"` makes the engine host refuse every
   * rewind (Undo and Back out), `"host"` and `"ask"` allow them on the host's device (a guest's ask is #904). Strict
   * rooms are `"off"` whatever this says. Set by `platform/room.ts` `startGame`; absent changes nothing. Like
   * `roomPlayMode`, it never reaches the rules and the live header and replay files leave it out.
   */
  readonly roomUndo?: "off" | "host" | "ask";
  /**
   * A lobby room's game with Cheats on (the host's lobby setting): the game starts marked adjusted
   * (`SaveMeta.adjusted`, issue #791) so nobody's stats, achievements or unlock points count it, and the host's own
   * Settings > Cheats apply to it (`view/room-strict.ts` `roomCheatsOf`). Absent or false: the host's cheats are
   * unavailable in the room's game. The live header and replay files leave it out (the header carries `adjusted`).
   */
  readonly roomCheats?: boolean;
  /**
   * A Competitive lobby room's game (issue #883): the team of each engine player (`p1`..), from the lobby. The host's
   * proposal judge reads it so a seat of the team whose phase it is not cannot take off-turn actions (a choice addressed
   * to that seat is still answered). Like `room` it never reaches the rules and headers and replay files leave it out;
   * the engine's own two-team setup is what carries teams into the game.
   */
  readonly roomTeams?: Readonly<Record<string, "registration" | "resistance">>;
  /**
   * A Competitive room game (issue #883): the engine players (`p1`..) this device holds, so a competitive result is read
   * for this device's team (`view/team-outcome.ts`). Absent in a hot-seat game, where one device plays both teams. Like
   * `roomTeams` it never reaches the rules, and headers and replay files leave it out.
   */
  readonly localSeats?: readonly string[];
  /**
   * A Civil War Competitive game (issue #883, docs/competitive-mode-plan.md M1): the two teams' scenarios, plain data.
   * `players` is every seat, registration team first; `scenarioId` names the registration team's leader.
   * `scenarioFor` builds the game with `@mc/cards`' `civilWarCompetitive`. Absent in every other game.
   */
  readonly competitive?: CompetitiveSessionTeams;
  /**
   * Set on every lobby room's game (#887): the live header carries it so a watcher's board draws every hand face
   * down, whatever the host's "Host sees every hand" says. The host's own board reads the room's state instead. Replay
   * files leave it out.
   */
  readonly roomHandsHidden?: true;
  /**
   * The lobby revision (`RoomState.rev`) a lobby room's host built this game from. The live stream's first `start`
   * carries it so the room refuses a game built from a lobby that has since changed (`lobby-changed`). Only a new
   * game takes it: the session keeps it apart from the saved config, so a resumed game and the replay and live
   * headers never see it. Absent: the room takes the start as it always has.
   */
  readonly roomLobbyRev?: number;
  readonly seed: number;
  readonly firstPlayerIndex?: number;
  /** Multi-villain scenarios only: each villain's own version, overriding `difficulty` for that one villain. */
  readonly villainVersions?: readonly ("A" | "B" | "extreme")[];
  /**
   * Standard II / Expert II (docs/phase7-wave4.md §4 Q5): a `DifficultySetChoice` replacing the printed Standard/
   * Expert set with one of the matching classification wherever the scenario's own pack has one (The Hood, `hood`
   * `standard_ii`/`expert_ii`). Absent everywhere else — the printed default `CoreScenarioOptions.difficultySets`
   * documents, and `@mc/cards`' own `checkWave4DifficultySets` refuses a set outside its pack's classification.
   */
  readonly difficultySets?: DifficultySetChoice;
  /**
   * Threat per player placed on Gene Pool, 1 to 3, in any game that uses the Infinites set. The three wave 8 setup
   * choices (docs/phase7-wave8.md section 4.1: this, `horsemanSides`, `easierStart`) go straight through `scenarioFor` to
   * the playable builder, which refuses one the scenario does not offer (`playableScenarioOffer` says which). Additive,
   * like `modes`: absent on every save written before they existed, and absent is the default (no Gene Pool threat,
   * the sides the difficulty gives, Apocalypse at stage II). Not `villainVersions`: wave 8's builder takes its own
   * four-sided tuple and ignores that field.
   */
  readonly genePoolThreatPerPlayer?: number;
  /** The Four Horsemen's side per villain, in printed order. */
  readonly horsemanSides?: HorsemanSides;
  /** Apocalypse begins at stage I (standard mode only). */
  readonly easierStart?: boolean;
  /**
   * A Fear No Evil scenario's villain (docs/phase7-wave11-scenarios.md §S3.3, MC60 p. 5): the encounter set id of one of
   * `Scenario.villainOptions`. Absent is the record's default villain, and absent on every other scenario and every older save.
   */
  readonly villainSetId?: string;
  /**
   * A card-keyed villain choice's pick (Shadowland's Dark Protégé, `VillainChoiceOffer.keyedBy` `"card"`): one of
   * `Scenario.villainOptions`' villain cards. Absent is the setup's own seeded random draw, and absent everywhere else.
   */
  readonly villainCardId?: string;
  /** Protection Racket (standard mode): each seat's main scheme card, in seat order. Absent everywhere else. */
  readonly mainSchemePicks?: readonly string[];
  /**
   * The Hood's own seven-of-nine modular encounter set choice (docs/phase7-wave4.md §2.3, §3.18: "Choose 7 modular
   * encounter sets and set them aside — you may choose randomly"). Absent for every other scenario — the scenario
   * builder's own default (the pack's first seven in declaration order) applies.
   */
  readonly setAsideModularSetIds?: readonly string[];
  /**
   * Extra modular sets shuffled into the encounter deck on top of the scenario's own (Longshot, MojoMania insert p. 2:
   * "can be included in any scenario"; never one of the required modular sets). Absent is none — additive, like `modes`.
   */
  readonly extraModularSetIds?: readonly string[];
  /**
   * Modular sets shuffled into the encounter deck beyond the number the scenario calls for (the "Allow extra modular
   * sets" house rule, issue #761). The scenario builders refuse such a pick, so `scenarioFor` adds their cards after the
   * builder runs. Absent is none, and absent on every save written before this field existed.
   */
  readonly houseModularSetIds?: readonly string[];
  /**
   * Optional setup rules the scenario's own rulebook offers, chosen at setup (Tower Defense's setup damage, MC21
   * p. 11, docs/phase7-wave4.md §4 Q4). Absent is none — the same `ScenarioSetupOptions` shape
   * `CoreScenarioOptions.setupOptions` (`@mc/cards`) takes, so this is sent straight through to `scenarioFor`
   * (`session-core.ts`). Additive, like `modes`: absent on every save written before this field existed.
   */
  readonly setupOptions?: ScenarioSetupOptions;
  /**
   * A Civil War leader's main scheme stages (MC56 p. 5): the `printedCardId` of one stage 1 and one stage 2 of the
   * leader's side. Goes to the scenario builder's `mainSchemeStageIds`, which refuses a pair of the other side. Absent
   * is the rulebook's recommended pair, and absent on every other scenario and every older save (additive, like `modes`).
   */
  readonly mainSchemeStageIds?: readonly string[];
  /** The game mode. Only `"cooperative"` is sent here: a competitive game is a room game and carries `competitive` instead; absent is cooperative. */
  readonly gameMode?: "cooperative";
  /**
   * The Civil War builder's blind option: the sets and stages stay hidden until the game reveals them. A display
   * choice only, the engine never reads it; stored so the hiding survives save and resume, and "Play again".
   */
  readonly blind?: boolean;
  /**
   * The Civil War picks are what the builder's Random button rolled and were not edited afterwards. The engine never
   * reads it; stored so Game Over can offer "New random scenario" (docs/phase7-wave10-client.md section 9).
   */
  readonly randomScenario?: boolean;
  /**
   * This game is one scenario of a campaign, as `startGameFromLog` composed it (docs/campaign-mode-design.md §7.1,
   * §10.1). Goes straight into `GameSetupConfig.campaign` (`session-core.ts`'s `scenarioFor`) and therefore into
   * the replay baseline: **a saved campaign game replays without consulting the live `CampaignLog` at all**, which
   * is the property that keeps a campaign log free to keep evolving underneath a game already in progress.
   * Absent for every standalone game — additive, like `modes`.
   */
  readonly campaign?: CampaignGameInput;
  /**
   * `CampaignGameStart.encounterSets` (`startGameFromLog`, `@mc/engine`'s campaign runner): the sets a campaign
   * composed for this attempt, by id, split into cards that join the encounter deck and cards that are set aside
   * (MC16 p. 8 / MC60 p. 9's gathering step). `session-core.ts`'s `scenarioFor` turns these ids into actual cards
   * (`@mc/cards`'s `cardsOfComposedSets`) after `buildScenario` runs, the same way `campaign` itself is attached
   * afterward rather than threaded through the scenario builder's own options.
   *
   * Additive, like `campaign` and `modes`: absent on every save written before this field existed, including a
   * campaign save from before this fix. Such a save has no composed-set cards recorded anywhere else either, so
   * replaying it exactly as before — with none added — is the only baseline-preserving reading; it is not treated
   * as incompatible.
   */
  readonly campaignEncounterSets?: { readonly deck: readonly string[]; readonly setAside: readonly string[] };
  /**
   * `CampaignLog.removedFromCampaign`'s card ids (either face) when this attempt was composed: a removed card is in
   * no composed set (MC32 p. 7's Future Past removals), so `scenarioFor` passes them to `cardsOfComposedSets`.
   * Additive, like `campaignEncounterSets`: absent on every standalone game and on a save from before this field.
   */
  readonly campaignRemovedCards?: readonly string[];
  /**
   * Cards on top of the decks after setup's seeded shuffle (`@mc/engine`'s `SetupStack`; docs/guided-mode.md G1):
   * the tutorial's fixed opening hand and first encounter cards. Not a rules option. Seats are indexes into `players`.
   * Sent straight through `scenarioFor` to `GameSetupConfig.stack`, so it is part of the save and the replay baseline.
   * Plain data (a JSON round trip turns the seat keys into strings, which reads back the same). Additive, like
   * `modes`: absent on every save written before it existed, and absent is an ordinary shuffled game.
   */
  readonly stack?: SetupStack;
  /**
   * This game is a guided run (`docs/guided-mode.md` §3.12) — set by `guide/start-tutorial.ts` and
   * `guide/start-aspect-tryit.ts` right on the `SessionConfig` they hand `SessionStore.start`, so it rides along
   * into `SaveMeta.guided` (`game-storage.ts`) the same way `campaign` rides into `campaignId`. Absent for every
   * plain game, additive like `stack`.
   */
  readonly guided?: SavedGuidedRun;
  /**
   * Facts from outside the game, one entry per seat in seat order (`PlayerSetup.outsideFacts`; docs/phase7-wave7.md
   * §4.1 Q48): the profile's last finished result, stamped by `EngineSessionCore#start` from the game history for a
   * plain game. Stored with the save, so a resume, a replay and an export rebuild the same game. Absent when the
   * history has no finished game and for every guided run, which stays deterministic; additive like `modes`.
   */
  readonly outsideFacts?: readonly OutsideFacts[];
  /**
   * The table's own rules (`GameSetupConfig.tableRules`; today "a hero and an ally with the same name can't both be in
   * play"), as the game was created with them: sent straight through `scenarioFor` into setup, so they are part of the
   * save and the replay baseline. Additive, like `stack`: absent on every save written before the option existed (and
   * for a new game with every option off), which then replays exactly as it was created.
   */
  readonly tableRules?: TableRules;
  /**
   * Epic Multiplayer (issue #882, docs/epic-multiplayer-plan.md): this game is one group of a pod whose coordinator is
   * outside the engine (`PodSetup` `coordinator: "remote"`; `@mc/cards`' `epicGroupScenario`). The group's id is its
   * table's id; `groupIdsInPod` lists every group of its pod in the pod's order. Sent through `scenarioFor` into setup,
   * so it is part of the save, the live header and the replay baseline: a group replays alone, with no coordinator.
   * Absent on every other game.
   */
  readonly epic?: EpicGroupPlacement;
}

/** Where a group sits in an Epic Multiplayer game (`@mc/cards`' `EpicGroupPlacement`, with plain string ids). */
export interface EpicGroupPlacement {
  readonly groupId: string;
  readonly groupIdsInPod: readonly string[];
  readonly groupsInGame: number;
  readonly playersInGame: number;
}

/**
 * Printed card data, sent across the worker boundary once at startup and
 * re-attached to every state the host publishes. Measured at 205 KB with the
 * pool and 68 KB without it, so keeping it out of each update is most of the
 * copying cost.
 */
export type CardPool = Readonly<Record<string, AnyCard>>;

/** The authority's state without the card pool: a save's baseline, as storage and the worker's save reply hold it. */
export type StateWithoutPool = Omit<GameState, "cardPool">;

/**
 * The table's state as it crosses the worker boundary in a snapshot: sealed (`sealForTable`: no hidden pile's cards,
 * no hidden reverse, no sealed campaign value), and everything but the card pool.
 */
export type SealedStateWithoutPool = Omit<SealedGameState, "cardPool">;

/** The table as a command had it at one of its events (`ApplyOptions.recordStates`), as it crosses the worker boundary. */
export interface SealedEventState {
  /** The event's index in the command's `events`. */
  readonly at: number;
  readonly state: SealedStateWithoutPool;
}

/** What a player may do, and who they are. Computed ahead of time by the host. */
export interface LegalActionsFor {
  readonly playerId: PlayerId;
  readonly actions: LegalActions;
}

/**
 * One published state change. `version` is the command count: the store drops
 * any update or query result whose version is older than what it already holds,
 * which is how an out-of-order worker reply can never show stale state.
 */
export interface EngineUpdate {
  readonly version: number;
  /**
   * The state the table may read, card pool re-attached, so every `@mc/engine` query helper works: sealed
   * (`sealForTable`), so it has no hidden pile's cards. The full state stays with the engine session.
   */
  readonly state: SealedGameState;
  /** The events of the command that produced this state; empty for a resumed game's first update. */
  readonly events: readonly GameEvent[];
  /**
   * The command a seat holder proposed in a lobby room and the engine applied on its own (issue #881), when this update
   * is that and not the reply to a dispatch this host made. The store adds it to its trail, which Undo reads.
   */
  readonly remote?: Command;
  /**
   * Legal actions for the player who must act — the active player during a
   * turn, or the player a pending choice is addressed to. Null when nobody
   * needs input (the game is over, or the engine is mid-phase with no choice).
   */
  readonly legal: LegalActionsFor | null;
  /** The game so far, for the game-over screen. Complete even for a resumed game. */
  readonly record: GameRecord;
  /** Set once saving has failed: the game plays on but may not survive a refresh. */
  readonly saveError: string | null;
  /** The game was adjusted by hand or undone past a reveal (`SaveMeta.adjusted`, issue #791). Absent otherwise. */
  readonly adjusted?: true;
  /**
   * The log was cut back to `version` by someone else (the host of a room's game took a move back, issue #881): the
   * store takes this update although its version is lower than the one it holds, as it does a rewind it asked for.
   */
  readonly rewound?: true;
  /** The setup this game came from, for a rematch. */
  readonly config: SessionConfig | null;
  /** The id this game is stored under, or null/absent when it isn't saved (device sync leaves the open game alone). */
  readonly gameId?: string | null;
  /** A resumed game's first update only: every event the replay produced, oldest first, for the board's log. */
  readonly history?: readonly GameEvent[];
  /**
   * A resumed game's first update only: one entry per replayed command, with the events it produced and the RNG draw
   * count around it, exactly what the store records live. It lets Undo and Back out read a resumed game's earlier
   * moves (and stop at their turn boundaries) instead of treating its command count as an empty trail.
   */
  readonly trail?: readonly BackOutTrailEntry[];
  /**
   * The table as the command had it at each of its villain-phase events that changed it, card pool re-attached (issue
   * #386): what the villain phase's replay draws while it is behind the engine. Absent when the command had none.
   */
  readonly states?: readonly { readonly at: number; readonly state: SealedGameState }[];
}

export type DispatchResult =
  | { readonly ok: true; readonly update: EngineUpdate }
  | { readonly ok: false; readonly error: EngineError };

/** A save: the replay baseline plus every command, exactly as `@mc/engine` defines it. */
export interface SavedGame {
  readonly initialState: GameState;
  readonly commands: readonly Command[];
}

export type UpdateListener = (update: EngineUpdate) => void;

/** How a rewind came about, where it matters past the rewind itself. */
export interface RewindOptions {
  /**
   * The rewind takes back a draw, reveal or random pick (an Undo the player acknowledged, issue #791): the
   * game is marked adjusted (`SaveMeta.adjusted`) and stops counting toward achievements and stats.
   */
  readonly adjusted?: boolean;
  /**
   * The command count the target was worked out from. The rewind is refused when the game has moved on from it (a
   * seat's command landed first), so Undo never cuts a move nobody saw; the board then offers Undo again.
   */
  readonly fromVersion?: number;
}

export interface EngineHost {
  /** Creates the game and publishes its first update. */
  start(config: SessionConfig): Promise<EngineUpdate>;
  /** Picks a stored game back up by replaying its log, and publishes where it stands. */
  resume(gameId: string): Promise<EngineUpdate>;
  /** Applies a command. A rejected command leaves the game untouched. */
  dispatch(command: Command): Promise<DispatchResult>;
  /**
   * "Back out" (`view/back-out.ts`): truncates the command log to its first `commandCount` commands and republishes
   * the state that leaves the game in, as if every later command had never been dispatched. The caller is the one
   * that must have already checked this is safe to offer (`view/back-out.ts`'s own rule); this performs the rewind
   * unconditionally.
   */
  rewindTo(commandCount: number, options?: RewindOptions): Promise<EngineUpdate>;
  /** An on-demand query, for a seat that isn't the one the host prefetched. */
  legalActions(playerId: PlayerId): Promise<LegalActions>;
  /**
   * The engine's verdict on a pay step's picks, judged against the full game state where the engine runs (issue
   * #258), with the version it was judged at.
   */
  judgePayment(playerId: PlayerId, payment: PaymentState): Promise<JudgedPayment>;
  /**
   * The same verdict at once, from a host that runs the engine on the calling thread (`LocalEngineHost`,
   * `DevStateHost`); absent on the worker host, whose whole point is that the main thread never runs it.
   */
  judgePaymentNow?(playerId: PlayerId, payment: PaymentState): JudgedPayment;
  /** Every update, including the one `start` returns. Returns an unsubscribe. */
  subscribe(listener: UpdateListener): () => void;
  /** The replayable log, for export. */
  save(): Promise<SavedGame>;
  /** The stored game to offer as "Continue", or null. */
  latestSave(): Promise<SaveMeta | null>;
  /** Every resumable game in progress, newest first, leaving out guided lesson saves (the title's list, #276). */
  activeSaves(): Promise<readonly SaveMeta[]>;
  /**
   * Retires a game the player chose to drop (the title list's Remove, a campaign run started over): marked
   * "abandoned" and stamped as just written so sync carries it. Runs in the engine's own storage owner, so it can't
   * race the game's appends.
   */
  retireSave(gameId: string): Promise<void>;
  /** Every saved game (W9's per-deck record and last played, `view/results-history.ts`). */
  listSaves(): Promise<readonly SaveMeta[]>;
  /**
   * Records how this device played the room game `gameId` (`SaveMeta.roomPlay`, #909) on its save row, in the
   * engine's own storage owner. Absent on hosts that keep no saves of their own (replay, dev state, a seat host).
   */
  recordRoomPlay?(gameId: string, roomPlay: RoomPlayRecord): Promise<void>;
  /**
   * Fills in the card numbers of games finished before the save summary had them, by replaying their logs
   * (`engine/summary-backfill.ts`); resolves to how many games were written.
   */
  backfillSummaries(ids?: readonly string[]): Promise<number>;
  dispose(): void;
}
