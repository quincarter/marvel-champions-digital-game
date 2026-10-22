/**
 * The engine, driven. Both hosts run exactly this — the worker on its own
 * thread, the local host in-thread — so a game behaves identically in Vitest
 * and in the browser.
 *
 * It owns the one `GameSession` and its log, and after every state change it
 * computes `legalActions` for the player who must act, so highlighting is ready
 * before the player looks (PLAN.md Phase 4, "legal moves are computed ahead of
 * time"). It never touches the DOM, Phaser, or `postMessage`.
 *
 * **Persistence.** With a `GameStorage` it also keeps the game on disk, as a
 * log: the setup config and baseline when a game starts, then each command as
 * it lands. Resuming replays that log through the pure engine, so a game that
 * survives a refresh is the same game to the command, and its `GameRecord` is
 * folded from the same events it would have produced live. The record is never
 * written anywhere — only the log is — so the two can't drift apart.
 *
 * **Setup failures keep their engine error code.** `createGame` refuses an
 * illegal deck with `illegal_deck` and its own per-seat `illegalDecks`
 * (PLAN.md Phase 9: "a client can route it to 'fix this deck'"). Throwing a
 * plain `Error` here would flatten that down to a message string before the
 * client ever saw it, so `start`/`resume` throw `SetupError` instead, which
 * keeps `code` and `illegalDecks` alongside the message. `engine.worker.ts`
 * forwards those two fields on its `failed` reply so a worker-hosted game
 * loses nothing `LocalEngineHost` (same thread, no serialization) keeps for free.
 */

import { cardsOfComposedSets } from "@mc/cards";
import { cardId } from "@mc/content";
import { previousGameFacts } from "./previous-game-facts.js";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION, buildScenario } from "../content/pool.js";
import {
  applyCommand,
  createGame,
  legalActions as queryLegalActions,
  sessionApply,
  startSession,
  type Command,
  type EngineError,
  type EngineErrorCode,
  type GameEvent,
  type GameSession,
  type GameState,
  type IllegalDeck,
  type LegalActions,
  type PlayerId,
  type SealedGameState,
} from "@mc/engine";
import type { BackOutTrailEntry } from "../view/back-out.js";
import { sealForTable } from "../view/hidden-reverse.js";
import type { PaymentState } from "../view/payment-model.js";
import { judgePayment, type JudgedPayment } from "../view/payment-verdict.js";
import { actingPlayer } from "./acting-player.js";
import { CLIENT_VERSION } from "../version.js";
import { buildCommit } from "../view/app-version.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { summarizeGame } from "./game-summary.js";
import {
  isCurrentSchema,
  isNewerSchema,
  SAVE_SCHEMA,
  writtenByNewerApp,
  writtenByOtherBuild,
  type GameStorage,
  type WriterStamp,
  type SaveMeta,
  type SaveStatus,
} from "./game-storage.js";
import type {
  CardPool,
  LegalActionsFor,
  SavedGame,
  SealedStateWithoutPool,
  SessionConfig,
  StateWithoutPool,
} from "./host.js";

/** Shown when a save is from a newer build (a linked device that updated first). */
export const NEWER_SAVE_MESSAGE = "This game was saved by a newer version. Update the game to continue it.";

/** An update as it crosses a thread boundary: no card pool, so it stays ~68 KB. */
export interface Snapshot {
  readonly version: number;
  readonly state: SealedStateWithoutPool;
  readonly events: readonly GameEvent[];
  readonly legal: LegalActionsFor | null;
  /** What the game-over screen reports, folded from every command so far. */
  readonly record: GameRecord;
  /** The setup this game came from, so a rematch can reuse it — for a resumed game too. */
  readonly config: SessionConfig | null;
  /**
   * Set once a write to storage has failed. The game plays on — nothing about
   * the rules depends on the disk — but it may not survive a refresh, and the
   * player should be told rather than find out by losing it.
   */
  readonly saveError: string | null;
  /** The id this game is stored under, or null when it isn't being saved; device sync leaves the open game alone. */
  readonly gameId?: string | null;
  /** A resumed game only: every event the replay produced (setup, then each command), so the board's log can show the game so far. Absent otherwise. */
  readonly history?: readonly GameEvent[];
  /** A resumed game only: each replayed command with its events and RNG draw counts (`EngineUpdate.trail`). */
  readonly trail?: readonly BackOutTrailEntry[];
}

export type CoreDispatch =
  | { readonly ok: true; readonly snapshot: Snapshot }
  | { readonly ok: false; readonly error: EngineError };

/**
 * A setup (`start`/`resume`) refusal, carrying the engine's own `code` and — for
 * `illegal_deck` — which seat and why, rather than only a flattened message. A
 * plain `{ code, illegalDecks }` payload rides alongside this over the worker
 * boundary (`protocol.ts`'s `failed` reply) since a class instance's own fields
 * don't reliably survive structured clone; `WorkerEngineHost` reconstructs a
 * `SetupError` from those two fields so the main thread sees the same shape
 * whether the game runs local or in the worker.
 */
export class SetupError extends Error {
  readonly code: EngineErrorCode;
  readonly illegalDecks: readonly IllegalDeck[] | undefined;

  constructor(engineError: EngineError) {
    super(engineError.message);
    this.name = "SetupError";
    this.code = engineError.code;
    this.illegalDecks = engineError.illegalDecks;
  }
}

export interface CoreOptions {
  /** Omit for a game that lives only as long as the page. */
  readonly storage?: GameStorage | null;
  readonly now?: () => number;
  readonly newId?: () => string;
  /** The build's version (default `CLIENT_VERSION`); a game last written by a newer one is not resumed. */
  readonly appVersion?: string;
  /** The card-pool fingerprint (default `POOL_VERSION`) and build commit (default `buildCommit()`) this build writes. */
  readonly contentVersion?: string;
  readonly build?: string;
}

/** Splits the card pool off a state; the host re-attaches it on the other side. */
const stripPool = (state: GameState): StateWithoutPool => {
  const { cardPool: _cardPool, ...rest } = state;
  return rest;
};

/** The same for the sealed state a snapshot carries. */
const stripSealedPool = (state: SealedGameState): SealedStateWithoutPool => {
  const { cardPool: _cardPool, ...rest } = state;
  return rest;
};

/**
 * The one place a `SessionConfig` becomes a `GameSetupConfig` — shared by `start`, `resume` and the read-only
 * replay cursor, so none of them can disagree about what a save means.
 *
 * `modes` (RRG 1.8's mode set) is spread only when the config carries one. That's the backward-compatible read
 * path for every save written before the field existed: those configs have `difficulty` alone, the builder
 * derives the mode set from it (`@mc/cards`'s `resolveModes`), and the resulting setup is identical to what the
 * save originally replayed against.
 *
 * `campaign` (docs/campaign-mode-design.md §7.1's `CampaignGameInput`) is attached after `buildScenario` runs,
 * never threaded through its options: it becomes `GameSetupConfig.campaign` verbatim, exactly as
 * `createGame({ ...config, campaign: start.input }, deps)` does in the campaign runner's own tests
 * (`@mc/cards`'s `trors.test.ts`). Absent for every standalone game, so its setup is unchanged.
 *
 * `campaignEncounterSets` (`CampaignGameStart.encounterSets`) is folded in the same way, after `buildScenario`:
 * its ids are turned into actual cards (`@mc/cards`'s `cardsOfComposedSets`, against this app's own `POOL_CARDS`,
 * the same pool every scenario is built against) and appended to `encounterDeck`/`setAside`, mirroring exactly
 * what `mts.qa.test.ts`'s `realGame` and `gmw.qa.test.ts`'s own equivalent do for a "real game" test. Absent for
 * every standalone game and for a campaign save written before this field existed, so neither's setup changes.
 */
const scenarioFor = (config: SessionConfig) => {
  const setup = buildScenario(config.scenarioId, {
    difficulty: config.difficulty,
    players: config.players,
    seed: config.seed,
    ...(config.modes ? { modes: config.modes } : {}),
    ...(config.modularSetIds ? { modularSetIds: config.modularSetIds } : {}),
    ...(config.firstPlayerIndex !== undefined ? { firstPlayerIndex: config.firstPlayerIndex } : {}),
    ...(config.villainVersions ? { villainVersions: config.villainVersions } : {}),
    ...(config.difficultySets ? { difficultySets: config.difficultySets } : {}),
    ...(config.genePoolThreatPerPlayer ? { genePoolThreatPerPlayer: config.genePoolThreatPerPlayer } : {}),
    ...(config.horsemanSides ? { horsemanSides: config.horsemanSides } : {}),
    ...(config.easierStart ? { easierStart: true } : {}),
    ...(config.villainSetId ? { villainSetId: config.villainSetId } : {}),
    ...(config.mainSchemePicks ? { mainSchemePicks: config.mainSchemePicks } : {}),
    ...(config.setAsideModularSetIds ? { setAsideModularSetIds: config.setAsideModularSetIds } : {}),
    ...(config.extraModularSetIds ? { extraModularSetIds: config.extraModularSetIds } : {}),
    ...(config.setupOptions ? { setupOptions: config.setupOptions } : {}),
    ...(config.mainSchemeStageIds ? { mainSchemeStageIds: config.mainSchemeStageIds } : {}),
    ...(config.gameMode ? { gameMode: config.gameMode } : {}),
    ...(config.stack ? { stack: config.stack } : {}),
  });
  const seated = config.outsideFacts
    ? {
        ...setup,
        players: setup.players.map((player, seat) =>
          config.outsideFacts![seat] ? { ...player, outsideFacts: config.outsideFacts![seat] } : player,
        ),
      }
    : setup;
  const removed = (config.campaignRemovedCards ?? []).map((id) => cardId(id));
  const withEncounterSets = config.campaignEncounterSets
    ? {
        ...seated,
        encounterDeck: [
          ...seated.encounterDeck,
          ...cardsOfComposedSets(POOL_CARDS, config.campaignEncounterSets.deck, removed),
        ],
        setAside: [
          ...(seated.setAside ?? []),
          ...cardsOfComposedSets(POOL_CARDS, config.campaignEncounterSets.setAside, removed),
        ],
      }
    : seated;
  const withCampaign = config.campaign ? { ...withEncounterSets, campaign: config.campaign } : withEncounterSets;
  return config.tableRules ? { ...withCampaign, tableRules: config.tableRules } : withCampaign;
};

const statusOf = (state: GameState): SaveStatus =>
  state.outcome
    ? state.outcome.result === "win"
      ? "won"
      : // A concession is a real, finished session that resolved to neither a win nor a loss, which is exactly what
        // `abandoned` already means to `view/results-history.ts`: played, but not a result.
        state.outcome.result === "conceded"
        ? "abandoned"
        : "lost"
    : "active";

const describeCause = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** What rebuilding a stored game's replay baseline produces. */
export interface ReplayBaseline {
  /** The stored baseline with a freshly-built card pool re-attached. */
  readonly initialState: GameState;
  /** Setup's own events, not stored — a fresh setup emits the same ones deterministically. */
  readonly setupEvents: readonly GameEvent[];
}

/**
 * Rebuilds a stored game's replay baseline: the same scenario-construction
 * path `resume` uses, so `resume` and a read-only replay (S7, `view/replay-
 * cursor.ts`) can never disagree about what a saved log's baseline is. The
 * card pool isn't stored (`game-storage.ts`), so this always sets the
 * scenario up fresh to get one and attaches it to the *stored* state — the
 * stored commands still replay against the stored baseline, never a freshly
 * generated one.
 *
 * Throws `SetupError` if the scenario itself can no longer be set up (a
 * config referencing content that no longer exists).
 */
export function rebuildBaseline(config: SessionConfig, storedInitialState: StateWithoutPool): ReplayBaseline {
  const fresh = createGame(scenarioFor(config), POOL_DEPS);
  if (!fresh.ok) {
    throw new SetupError({
      ...fresh.error,
      message: `this saved game can no longer be set up: ${fresh.error.message}`,
    });
  }
  return { initialState: { ...storedInitialState, cardPool: fresh.state.cardPool }, setupEvents: fresh.events };
}

export class EngineSessionCore {
  #session: GameSession | null = null;
  /** The command count, which is also the version every update is stamped with. */
  #version = 0;
  #record: GameRecord = emptyRecord();
  readonly #storage: GameStorage | null;
  readonly #now: () => number;
  readonly #newId: () => string;
  /** This build's version: a game last written by a newer one is never resumed here. */
  readonly #appVersion: string;
  /** What this build stamps on a game and compares a game's stamp against. */
  readonly #writer: WriterStamp;
  /** The stored game this session writes to; null when there is no storage or its creation failed. */
  #gameId: string | null = null;
  /**
   * Every write waits for the one before it, so the stored log is in command
   * order whatever the storage does internally.
   */
  #writes: Promise<void> = Promise.resolve();
  #saveError: string | null = null;
  #config: SessionConfig | null = null;

  constructor(options: CoreOptions = {}) {
    this.#storage = options.storage ?? null;
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.#appVersion = options.appVersion ?? CLIENT_VERSION;
    this.#writer = {
      appVersion: this.#appVersion,
      contentVersion: options.contentVersion ?? POOL_VERSION,
      build: options.build ?? buildCommit(),
    };
  }

  /**
   * Stamps the profile's last finished result onto a plain game's config (Git Gud's `wonPreviousGame`, Q48), so it is
   * part of the stored config and the replay baseline. A config that already carries facts keeps them; a guided run
   * (tutorial, Try-it) takes none, so it stays deterministic; no storage or no finished game leaves the config as is.
   */
  async #withHistoryFacts(config: SessionConfig): Promise<SessionConfig> {
    if (!this.#storage || config.outsideFacts || config.guided) return config;
    let saves: readonly SaveMeta[];
    try {
      saves = await this.#storage.list();
    } catch {
      return config;
    }
    const facts = previousGameFacts(saves, config.players.length);
    return facts ? { ...config, outsideFacts: facts } : config;
  }

  /** Builds the Core scenario and runs RRG setup. Throws `SetupError` with the engine's own code and message. */
  async start(given: SessionConfig): Promise<{ readonly cardPool: CardPool; readonly snapshot: Snapshot }> {
    const config = await this.#withHistoryFacts(given);
    const setup = createGame(scenarioFor(config), POOL_DEPS);
    if (!setup.ok) throw new SetupError({ ...setup.error, message: `setup failed: ${setup.error.message}` });

    this.#session = startSession(setup.state);
    this.#config = config;
    this.#version = 0;
    this.#record = recordEvents(emptyRecord(), setup.events, setup.state);
    this.#writes = Promise.resolve();
    this.#saveError = null;
    this.#gameId = null;

    if (this.#storage) {
      const id = this.#newId();
      const at = this.#now();
      const meta: SaveMeta = {
        id,
        schema: SAVE_SCHEMA,
        config,
        createdAt: at,
        updatedAt: at,
        status: "active",
        round: setup.state.round,
        commandCount: 0,
        outcome: null,
        campaignId: config.campaign?.campaignId ?? null,
        campaignNodeId: config.campaign?.nodeId ?? null,
        // `exactOptionalPropertyTypes`: `guided` is absent, not `undefined`, on a plain game (`SaveMeta.guided`'s
        // own doc comment — additive, no `SAVE_SCHEMA` bump).
        ...(config.guided ? { guided: config.guided } : {}),
      };
      try {
        // Awaited, unlike the command writes: a game that isn't recorded yet
        // has nothing for its first command to append to.
        await this.#storage.create(meta, stripPool(setup.state));
        this.#gameId = id;
        if (config.guided) await this.#retireOlderGuided(id, config.guided.kind);
      } catch (cause) {
        this.#saveError = describeCause(cause);
      }
    }

    return { cardPool: setup.state.cardPool, snapshot: this.#snapshot(setup.events) };
  }

  /**
   * A guided run (tutorial, Try-it, lesson) replaces the older one of its kind, so lessons don't pile up now that
   * several games can be in progress (#276). A storage failure here leaves the older run active, which is harmless.
   */
  async #retireOlderGuided(keepId: string, kind: string): Promise<void> {
    // Keyed on `guided.kind` alone, on purpose (owner decision): a new aspect or mechanic Try-it replaces the older
    // one, whichever aspect or mechanic it was, so lessons never pile up.
    const storage = this.#storage;
    if (!storage) return;
    try {
      for (const save of await storage.list()) {
        if (save.id !== keepId && save.status === "active" && save.guided?.kind === kind) {
          await storage.setStatus(save.id, "abandoned");
        }
      }
    } catch {
      // see above
    }
  }

  /**
   * Picks a stored game back up by replaying its log.
   *
   * The card pool isn't stored — it reloads from the bundle — so the scenario
   * is set up again to get it, and the *stored* baseline is what the commands
   * replay against. If any command no longer applies (a card changed under an
   * old save), the game is marked `incompatible` and never offered again,
   * rather than resuming into a state the saved commands never produced.
   */
  async resume(gameId: string): Promise<{ readonly cardPool: CardPool; readonly snapshot: Snapshot }> {
    const storage = this.#storage;
    if (!storage) throw new Error("there is no saved-games storage to resume from");
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("that saved game is no longer there");
    // A save from an older schema is retired deliberately, before any replay is attempted: its baseline state is a
    // shape this engine no longer has, even if its commands would happen to apply.
    // A save from a NEWER build (another linked device) is left exactly as it is: marking it would sync back and
    // hide a game the other device can still play.
    // Likewise a game last written by a newer APP: it may hold commands this build's rules do not know, and replaying
    // or appending would either fail (and mark it incompatible, which syncs) or write over what the newer build made.
    if (isNewerSchema(stored.meta) || writtenByNewerApp(stored.meta, this.#appVersion)) {
      throw new Error(NEWER_SAVE_MESSAGE);
    }
    if (!isCurrentSchema(stored.meta)) {
      await storage.setStatus(gameId, "incompatible");
      throw new Error(
        `this saved game was made by an older version of the game (save format ${stored.meta.schema}; this build reads ${SAVE_SCHEMA}) and can't be continued`,
      );
    }

    let baseline: ReplayBaseline;
    try {
      baseline = rebuildBaseline(stored.meta.config, stored.initialState);
    } catch (cause) {
      // A game another build wrote (other card pool or commit) may simply be one this build cannot read: untouched.
      if (writtenByOtherBuild(stored.meta, this.#writer)) throw new Error(NEWER_SAVE_MESSAGE);
      await storage.setStatus(gameId, "incompatible");
      throw cause;
    }
    const { initialState } = baseline;
    // Setup's own events aren't stored; setup is deterministic from the config,
    // so a fresh setup emits the same ones (the scheme's starting threat among them).
    let record = recordEvents(emptyRecord(), baseline.setupEvents, initialState);
    let state = initialState;
    const history: GameEvent[] = [...baseline.setupEvents];
    const trail: BackOutTrailEntry[] = [];
    for (const [index, command] of stored.commands.entries()) {
      const result = applyCommand(state, command, POOL_DEPS);
      if (!result.ok) {
        if (writtenByOtherBuild(stored.meta, this.#writer)) throw new Error(NEWER_SAVE_MESSAGE);
        await storage.setStatus(gameId, "incompatible");
        throw new Error(
          `this saved game no longer replays (command ${index + 1} of ${stored.commands.length}: ${result.error.message})`,
        );
      }
      trail.push({
        playerId: command.playerId,
        command,
        events: result.events,
        rngDraws: { before: state.rng.draws, after: result.state.rng.draws },
      });
      state = result.state;
      record = recordEvents(record, result.events, state);
      history.push(...result.events);
    }

    this.#session = { state, log: { initialState, commands: stored.commands } };
    this.#config = stored.meta.config;
    this.#version = stored.commands.length;
    this.#record = record;
    this.#gameId = gameId;
    this.#writes = Promise.resolve();
    this.#saveError = null;
    // No events: a resumed game arrives at its position; it doesn't re-animate getting there.
    return { cardPool: initialState.cardPool, snapshot: { ...this.#snapshot([]), history, trail } };
  }

  /**
   * "Back out" (docs/wave4/back-out.md's own doc comment on the client side, `view/back-out.ts`): truncates the
   * command log to its first `commandCount` commands and replays from the stored baseline, as if every command
   * after that had never been dispatched. `commandCount` is a count the *caller* must have picked only from a
   * legality check the client already ran (`view/back-out.ts`'s "no hidden information came to light" rule) —
   * this itself does no such check; it is a pure, unconditional rewind of the log.
   *
   * Rebuilds the baseline the same way `resume` does (a fresh `createGame`, its card pool re-attached to the
   * *stored* initial state) rather than reusing the live session's own pool, so a rewind produces byte-for-byte
   * the same state a save-then-resume at that command count would. Persists the truncated log immediately (when
   * this session has storage), so a reload after backing out does not resurrect the undone commands.
   */
  async rewindTo(commandCount: number): Promise<Snapshot> {
    const session = this.#require();
    const config = this.#config;
    if (!config) throw new Error("no setup config to rewind against");
    if (commandCount < 0 || commandCount > session.log.commands.length) {
      throw new Error(`can't rewind to command ${commandCount} of ${session.log.commands.length}`);
    }
    const truncated = session.log.commands.slice(0, commandCount);
    const baseline = rebuildBaseline(config, stripPool(session.log.initialState));
    let record = recordEvents(emptyRecord(), baseline.setupEvents, baseline.initialState);
    let state = baseline.initialState;
    for (const command of truncated) {
      const result = applyCommand(state, command, POOL_DEPS);
      if (!result.ok) throw new Error(`rewind failed to replay: ${result.error.message}`);
      state = result.state;
      record = recordEvents(record, result.events, state);
    }
    this.#session = { state, log: { initialState: baseline.initialState, commands: truncated } };
    this.#version = truncated.length;
    this.#record = record;

    const storage = this.#storage;
    const gameId = this.#gameId;
    if (storage && gameId) {
      const progress = {
        round: state.round,
        commandCount: truncated.length,
        updatedAt: this.#now(),
        status: statusOf(state),
        outcome: state.outcome,
        summary: summarizeGame(state, record, POOL_DEPS),
      };
      // Chained onto `#writes`, the same queue `#persist` appends onto — a command dispatched just before this
      // rewind may still have an `append` in flight, and truncating ahead of it would let that append land
      // *after* the truncate and silently resurrect the very command this is undoing.
      this.#writes = this.#writes
        .then(() => storage.truncate(gameId, truncated.length, progress))
        .catch((cause: unknown) => {
          this.#saveError ??= describeCause(cause);
        });
      await this.#writes;
    }

    return this.#snapshot([]);
  }

  dispatch(command: Command): CoreDispatch {
    const session = this.#require();
    const result = sessionApply(session, command, POOL_DEPS);
    if (!result.ok) return { ok: false, error: result.error };
    this.#session = result.session;
    this.#version += 1;
    this.#record = recordEvents(this.#record, result.events, result.session.state);
    this.#persist(command, this.#version - 1, result.session.state);
    return { ok: true, snapshot: this.#snapshot(result.events) };
  }

  legalActions(playerId: PlayerId): LegalActions {
    return queryLegalActions(this.#require().state, playerId, POOL_DEPS);
  }

  /**
   * Judges a pay step's picks against the full state (issue #258): the table only holds the sealed one, and this is
   * the costly half of paying, so it runs here, off the main thread, tagged with the version it was judged at.
   */
  judgePayment(playerId: PlayerId, payment: PaymentState): JudgedPayment {
    return { version: this.#version, verdict: judgePayment(this.#require().state, playerId, payment, POOL_DEPS) };
  }

  /**
   * The stored game to offer as "Continue", or null. A game saved under an older `SAVE_SCHEMA` is retired on the
   * way — marked `incompatible` and skipped — so it is never offered and then fails to replay.
   */
  async latestSave(): Promise<SaveMeta | null> {
    const storage = this.#storage;
    if (!storage) return null;
    // Newest first: a current game is offered, an older-schema one is retired on the way, and one from a newer
    // build is skipped untouched.
    const active = (await storage.list()).filter((meta) => meta.status === "active");
    for (const meta of active.sort((a, b) => b.updatedAt - a.updatedAt)) {
      // Continue never offers a game this build cannot play; the games list shows it as "update to continue".
      if (isNewerSchema(meta) || writtenByNewerApp(meta, this.#appVersion)) continue;
      if (isCurrentSchema(meta)) return meta;
      await storage.setStatus(meta.id, "incompatible");
    }
    return null;
  }

  /**
   * Every game in progress that this build can resume, newest first, for the title's "In-progress games" list
   * (#276). Guided lesson saves (`meta.guided`) are left out: they are teaching runs, not games to come back to.
   * A save under an older `SAVE_SCHEMA` is retired on the way, as `latestSave` does.
   */
  async activeSaves(): Promise<readonly SaveMeta[]> {
    const storage = this.#storage;
    if (!storage) return [];
    const found: SaveMeta[] = [];
    for (const meta of await storage.list()) {
      if (meta.status !== "active" || meta.guided) continue;
      if (isNewerSchema(meta)) continue;
      // Returned for a newer-app game too (untouched): the list rows it as "update to continue" (`gameRowsOf`).
      if (isCurrentSchema(meta)) found.push(meta);
      else await storage.setStatus(meta.id, "incompatible");
    }
    return found;
  }

  /**
   * Retires a game the player chose to drop: "abandoned", stamped as written now so device sync carries the change.
   * Done here, where the game's appends are, so a retirement and a write can't interleave from two threads.
   */
  async retireSave(gameId: string): Promise<void> {
    await this.#storage?.setStatus(gameId, "abandoned", this.#now());
  }

  /**
   * Every saved game, for `view/results-history.ts` (S4/W9's per-scenario and per-deck records). Unlike
   * `latestSave`, this doesn't retire anything: an old-schema `active` save that's merely *listed* here (not
   * offered as "Continue") stays exactly as `GameStorage.list()` returned it — `latestSave` above is the one place
   * that decides an unresumable active save is `incompatible`, and it runs on its own schedule regardless of
   * whether this was ever called.
   */
  async listSaves(): Promise<readonly SaveMeta[]> {
    const storage = this.#storage;
    return storage ? storage.list() : [];
  }

  save(): SavedGame {
    const { log } = this.#require();
    return { initialState: log.initialState, commands: log.commands };
  }

  /** Resolves once every write queued so far has settled. */
  flushed(): Promise<void> {
    return this.#writes;
  }

  get version(): number {
    return this.#version;
  }

  #persist(command: Command, seq: number, state: GameState): void {
    const storage = this.#storage;
    const gameId = this.#gameId;
    // After a failed write every later command would be out of order, so stop.
    if (!storage || !gameId || this.#saveError) return;
    const progress = {
      round: state.round,
      commandCount: seq + 1,
      updatedAt: this.#now(),
      status: statusOf(state),
      outcome: state.outcome,
      summary: summarizeGame(state, this.#record, POOL_DEPS),
    };
    this.#writes = this.#writes
      .then(() => storage.append(gameId, seq, command, progress))
      .catch((cause: unknown) => {
        // The first failure is the cause; the out-of-order rejections that
        // follow it are only consequences, so they don't overwrite it.
        this.#saveError ??= describeCause(cause);
      });
  }

  #snapshot(events: readonly GameEvent[]): Snapshot {
    const { state } = this.#require();
    const toAct = actingPlayer(state);
    return {
      version: this.#version,
      // What the table may read (`sealForTable`): a double-sided card whose other face no player may look at is named
      // by its stand-in (docs/phase7-wave9.md §3.54), a hidden pile is its size (§3.29 (a)) and the campaign log's
      // sealed values are emptied (§3.75), so none of it leaves the engine session. Legal actions are computed from
      // the full state, here.
      state: stripSealedPool(sealForTable(state)),
      events,
      legal: toAct ? { playerId: toAct, actions: queryLegalActions(state, toAct, POOL_DEPS) } : null,
      record: this.#record,
      saveError: this.#saveError,
      config: this.#config,
      gameId: this.#gameId,
    };
  }

  #require(): GameSession {
    if (!this.#session) throw new Error("the engine session has not been started");
    return this.#session;
  }
}
