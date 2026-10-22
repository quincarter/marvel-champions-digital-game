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
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";
import type { GameRecord } from "./game-record.js";
import type { SaveMeta, SavedGuidedRun } from "./game-storage.js";

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
  /** The game mode. Only `"cooperative"` is ever sent (competitive is shown as coming soon); absent is cooperative. */
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
   * Legal actions for the player who must act — the active player during a
   * turn, or the player a pending choice is addressed to. Null when nobody
   * needs input (the game is over, or the engine is mid-phase with no choice).
   */
  readonly legal: LegalActionsFor | null;
  /** The game so far, for the game-over screen. Complete even for a resumed game. */
  readonly record: GameRecord;
  /** Set once saving has failed: the game plays on but may not survive a refresh. */
  readonly saveError: string | null;
  /** The setup this game came from, for a rematch. */
  readonly config: SessionConfig | null;
  /** A resumed game's first update only: every event the replay produced, oldest first, for the board's log. */
  readonly history?: readonly GameEvent[];
  /**
   * A resumed game's first update only: one entry per replayed command, with the events it produced and the RNG draw
   * count around it, exactly what the store records live. It lets Undo and Back out read a resumed game's earlier
   * moves (and stop at their turn boundaries) instead of treating its command count as an empty trail.
   */
  readonly trail?: readonly BackOutTrailEntry[];
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
  rewindTo(commandCount: number): Promise<EngineUpdate>;
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
  /** Every saved game (W9's per-deck record and last played, `view/results-history.ts`). */
  listSaves(): Promise<readonly SaveMeta[]>;
  dispose(): void;
}
