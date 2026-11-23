/**
 * Headless smoke games for a pack (docs/custom-content-packs.md §11.2 `mc-pack test`) on the real engine, played by the
 * cards package's greedy driver (`playToOutcome`, what the sample packs' own tests and the precon e2e tests use):
 *
 * - the pack's hero precons against a Core scenario;
 * - each of the pack's scenarios, with a base precon (`SMOKE_BASE_DECK`) and the scenario's recommended modular set;
 * - each of the pack's modular encounter sets, with a base precon at the Core scenario, picked as its modular set;
 * - each of the pack's campaigns, with a base precon, through the real campaign runner (between-games setup, a played
 *   game, the result folded into the log) at every node, until the campaign ends (`playCampaign`).
 *
 * A game fails on an engine error, an illegal command, a game with no
 * outcome inside the command budget (stuck), a prompt left open at the end, or a replay of its log that does not
 * reproduce the same state.
 *
 * Node-only only because of `node:util`'s deep equality; nothing here touches the disk.
 */
import { isDeepStrictEqual } from "node:util";
import { PLAYABLE_DEPS } from "@mc/cards";
import { playToOutcome } from "@mc/cards/testing";
import { CORE_SCENARIOS, CORE_STARTER_DECKS, PLAYABLE_CARDS, type Scenario, type StarterDeck } from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  createCampaignLog,
  createGame,
  replay,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignLog,
  type CampaignRunnerResult,
  type EngineDeps,
  type GameEvent,
  type GameState,
} from "@mc/engine";
import type { PackCampaign } from "./campaigns.js";
import {
  campaignDepsWithPacks,
  campaignGameWithPacks,
  gameDepsWithPack,
  packCampaignRecords,
  packModularSetChoices,
  packScenarioRecords,
  scenarioWithPacks,
} from "./game.js";
import type { PackInput } from "./validate.js";

/** The base precon a pack with no hero deck of its own is played with. */
export const SMOKE_BASE_DECK = "core-spider-man-justice";
export const SMOKE_SCENARIOS: readonly string[] = CORE_SCENARIOS.map((s) => String(s.id));

export interface SmokeOptions {
  /** Games per deck, seeded 1..games. Default 3. */
  readonly games?: number;
  /** A Core scenario id (`rhino`, `klaw`, `ultron`). Default `rhino`. */
  readonly scenario?: string;
  /** The driver's command budget per game; a game that runs past it is stuck. Default 4000. */
  readonly maxCommands?: number;
  /**
   * Fail a pack campaign when every seed loses at the same node, since the staged wins then hide that the node may be
   * unwinnable. Off by default: the greedy driver is weak (it loses the Core scenarios too), so on it every campaign
   * would fail; turn it on with a stronger driver or a scenario built to be easy.
   */
  readonly failOnAlwaysLost?: boolean;
  /** Called after each game, for progress output. */
  readonly onGame?: (game: SmokeGame) => void;
}

export interface SmokeGame {
  /** The deck seated: a pack precon's id, or the base precon's. */
  readonly deck: string;
  /** The scenario played: a Core scenario's id or one of the pack's. */
  readonly scenario: string;
  /** The pack's modular set picked at the scenario in this game, when the game is about one. */
  readonly modularSet?: string;
  /** The pack campaign this game was played in, and its node (`scenario` is then the node's scenario). */
  readonly campaign?: string;
  readonly node?: string;
  /** `"expert"` for a pack scenario's expert-mode game; absent is standard. */
  readonly difficulty?: "expert";
  readonly seed: number;
  readonly ok: boolean;
  /** `win (villainDefeated)`, `loss (mainSchemeCompleted)`, ...; absent when the game failed before it ended. */
  readonly outcome?: string;
  readonly rounds: number;
  readonly commands: number;
  /** Why the game failed. */
  readonly error?: string;
  /** The pack's own cards played, or revealed from its encounter sets, in this game. */
  readonly packCardsPlayed: readonly string[];
}

export interface SmokeResult {
  readonly ok: boolean;
  readonly scenario: string;
  readonly games: readonly SmokeGame[];
  /** Not failures: what the run could not cover (a hero with no deck, no pack card played). */
  readonly notes: readonly string[];
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** One kind of smoke game: who sits, at which scenario, with which modular pick. Each is played once per seed. */
export interface SmokePlan {
  /** The deck seated: a pack precon's id, or the base precon's. */
  readonly name: string;
  /** The pack precon seated; absent seats `SMOKE_BASE_DECK`. */
  readonly deck?: StarterDeck;
  readonly scenario: string;
  /** The pack's modular set this plan is about. */
  readonly modularSet?: string;
  readonly difficulty?: "expert";
  /** The modular sets to pick; absent is the scenario's recommendation. */
  readonly modularSetIds?: readonly string[];
}

/** What `smokeTestPack` plays for a pack: its game plans and its campaigns, each once per seed `1..games`. */
export interface SmokeSchedule {
  readonly scenario: string;
  readonly games: number;
  readonly maxCommands: number;
  readonly plans: readonly SmokePlan[];
  readonly campaigns: readonly PackCampaign[];
  /** Not failures: what the plans could not cover (a hero with no deck). */
  readonly notes: readonly string[];
}

/**
 * Plans a pack's smoke run without playing it, so a caller (a test file) can play each game on its own: the pack's hero
 * precons at the Core scenario, each of its scenarios standard and expert, each of its modular sets at the Core
 * scenario, and each of its campaigns. Throws on bad options.
 */
export function smokeSchedule(pack: PackInput, options: SmokeOptions = {}): SmokeSchedule {
  const games = options.games ?? 3;
  const scenario = options.scenario ?? "rhino";
  const maxCommands = options.maxCommands ?? 4000;
  if (!Number.isInteger(games) || games < 1) throw new Error("games must be a whole number of at least 1");
  if (!SMOKE_SCENARIOS.includes(scenario))
    throw new Error(`unknown scenario "${scenario}" (one of ${SMOKE_SCENARIOS.join(", ")})`);

  const notes: string[] = [];
  const packDecks: readonly StarterDeck[] = pack.decks ?? [];
  const plans: SmokePlan[] = packDecks.map((deck) => ({ name: String(deck.id), deck, scenario }));
  if (plans.length === 0 && pack.cards.some((card) => card.type === "hero_identity"))
    notes.push("the pack has a hero but no deck in decks/: add its precon so mc-pack test can play it");
  const ownScenarios: readonly Scenario[] = packScenarioRecords([pack]);
  for (const record of ownScenarios) {
    plans.push({ name: SMOKE_BASE_DECK, scenario: String(record.id) });
    plans.push({ name: SMOKE_BASE_DECK, scenario: String(record.id), difficulty: "expert" });
  }
  const baseRecord = CORE_SCENARIOS.find((candidate) => String(candidate.id) === scenario);
  for (const set of baseRecord ? packModularSetChoices(baseRecord, [pack]) : [])
    plans.push({ name: SMOKE_BASE_DECK, scenario, modularSet: String(set.id), modularSetIds: [String(set.id)] });
  if (plans.length === 0) {
    notes.push(
      `the pack has no hero deck, scenario or modular set of its own, so a base precon (${SMOKE_BASE_DECK}) played ` +
        `${scenario} with the pack's cards in the pool`,
    );
    plans.push({ name: SMOKE_BASE_DECK, scenario });
  }
  return { scenario, games, maxCommands, plans, campaigns: packCampaignRecords([pack]), notes };
}

/** The pack's own cards played, or revealed from its encounter sets, among a game's events. */
const packCardsIn = (events: readonly GameEvent[], prefix: string): string[] => [
  ...new Set(
    events.flatMap((e) =>
      (e.type === "cardPlayed" || e.type === "encounterCardRevealed") && String(e.cardId).startsWith(prefix)
        ? [String(e.cardId)]
        : [],
    ),
  ),
];

/**
 * Plays one smoke game of `plan` at `seed` to an outcome and replays its log. `deps` is
 * `gameDepsWithPack(PLAYABLE_DEPS, pack)`, made once by the caller for all of the pack's games. Never throws for a
 * broken pack: the game says what failed.
 */
export function playSmokeGame(
  pack: PackInput,
  deps: EngineDeps,
  plan: SmokePlan,
  seed: number,
  maxCommands = 4000,
): SmokeGame {
  const base = {
    deck: plan.name,
    scenario: plan.scenario,
    ...(plan.modularSet ? { modularSet: plan.modularSet } : {}),
    ...(plan.difficulty ? { difficulty: plan.difficulty } : {}),
    seed,
  };
  try {
    const seat = plan.deck
      ? {
          identityCardId: plan.deck.identityCardId,
          ...(plan.deck.aspects ? { aspects: plan.deck.aspects } : {}),
          deck: plan.deck.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
        }
      : { starterDeckId: SMOKE_BASE_DECK };
    const config = scenarioWithPacks(
      plan.scenario,
      {
        players: [seat],
        seed,
        difficulty: plan.difficulty ?? "standard",
        ...(plan.modularSetIds ? { modularSetIds: plan.modularSetIds } : {}),
      },
      [pack],
    );
    const created = createGame(config, deps);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const run = playToOutcome(created.state, deps, { maxCommands });
    const state = run.session.state;
    const replayed = replay(run.session.log, deps);
    let error: string | undefined;
    if (run.outcome === null) error = `stuck: no outcome after ${run.commands} commands (round ${run.rounds})`;
    else if (state.pendingChoice !== null) error = "a prompt was still open when the game ended";
    else if (!replayed.ok) error = `the game's log does not replay: ${replayed.error.message}`;
    else if (!isDeepStrictEqual(replayed.state, state)) error = "the game's log replays to a different state";
    return {
      ...base,
      rounds: run.rounds,
      commands: run.commands,
      ok: error === undefined,
      ...(run.outcome ? { outcome: `${run.outcome.result} (${run.outcome.reason})` } : {}),
      ...(error !== undefined ? { error } : {}),
      packCardsPlayed: replayed.ok ? packCardsIn(replayed.events, `x.${pack.manifest.id}.`) : [],
    };
  } catch (caught) {
    return { ...base, ok: false, rounds: 0, commands: 0, error: errorText(caught), packCardsPlayed: [] };
  }
}

/**
 * Plays a pack campaign once per seed `1..games` through `playCampaign`. With `failOnAlwaysLost`, adds a failed game
 * when every seed lost at the same node.
 */
export function smokeTestCampaign(
  pack: PackInput,
  campaign: PackCampaign,
  deps: EngineDeps,
  options: Pick<SmokeOptions, "games" | "maxCommands" | "failOnAlwaysLost"> = {},
): { readonly games: readonly SmokeGame[]; readonly notes: readonly string[] } {
  const seeds = options.games ?? 3;
  const games: SmokeGame[] = [];
  const notes: string[] = [`campaign ${campaign.id}: ${CAMPAIGN_DRIVER_LIMITS}`];
  const lostAt: (string | null)[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const run = playCampaign(pack, campaign, seed, deps, options.maxCommands ?? 4000);
    lostAt.push(run.lostAt);
    notes.push(...run.notes);
    games.push(...run.games);
  }
  const first = lostAt[0];
  if (options.failOnAlwaysLost && first !== null && first !== undefined && lostAt.every((node) => node === first)) {
    games.push({
      deck: SMOKE_BASE_DECK,
      scenario: campaign.record.scenarioIds[campaign.definition.graph.nodes.findIndex((n) => n.id === first)] ?? "",
      campaign: campaign.id,
      node: first,
      seed: 0,
      ok: false,
      rounds: 0,
      commands: 0,
      error: `every seed lost at node "${first}": the greedy driver never won it, so the later nodes were reached only with staged wins`,
      packCardsPlayed: [],
    });
  }
  return { games, notes };
}

/** Plays `options.games` headless games per deck the pack can field. Never throws for a broken pack. */
export function smokeTestPack(pack: PackInput, options: SmokeOptions = {}): SmokeResult {
  const schedule = smokeSchedule(pack, options);
  const notes = [...schedule.notes];
  const deps = gameDepsWithPack(PLAYABLE_DEPS, pack);
  const results: SmokeGame[] = [];
  const record = (game: SmokeGame): void => {
    results.push(game);
    options.onGame?.(game);
  };
  for (const plan of schedule.plans)
    for (let seed = 1; seed <= schedule.games; seed++)
      record(playSmokeGame(pack, deps, plan, seed, schedule.maxCommands));
  for (const campaign of schedule.campaigns) {
    const run = smokeTestCampaign(pack, campaign, deps, { ...options, games: schedule.games });
    notes.push(...run.notes);
    for (const game of run.games) record(game);
  }
  if (results.length > 0 && results.every((game) => game.packCardsPlayed.length === 0))
    notes.push("no game played or revealed one of the pack's own cards; try more games (--games)");
  return { ok: results.every((g) => g.ok), scenario: schedule.scenario, games: results, notes };
}

/**
 * What `playCampaign` cannot cover, said once per campaign in the notes (and in docs/custom-content-packs.md §11.10).
 */
export const CAMPAIGN_DRIVER_LIMITS =
  "the greedy driver wins or loses on its own, so a Defeat block runs only if a game is lost (and a node that is always won never runs it); " +
  "optional between-games choices are declined; every other choice takes its first options; and an instruction behind a `when` gate or mode that is false in these runs is not exercised";

/** Answers every between-games choice with its first options (none for an optional one), until the step list settles. */
function settleCampaign<T>(step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return result.value;
    const { instructionId, slot, seatNumber, optional, options, count } = result.choice;
    answers.push({ instructionId, slot, seatNumber, picked: optional ? [] : options.slice(0, count) });
  }
  throw new Error("the campaign runner kept asking questions");
}

/** Whether a campaign log holds a value in any of its fields, shared or a seat's. */
const hasWrittenField = (log: CampaignLog): boolean =>
  Object.keys(log.shared).length > 0 || log.seats.some((seat) => Object.keys(seat.fields).length > 0);

/**
 * Plays one pack campaign headlessly with `SMOKE_BASE_DECK` at seat 1, through the real runner: each node is composed
 * (`resolveBetweenGames`), played to an outcome by the greedy driver, replayed, and its result folded into the log
 * (`campaignResultOf`, `applyCampaignResult`, so the Victory or Defeat instructions run). A lost game is allowed: the
 * loss policy runs, and because the game would repeat from the same seed, the node is then advanced with a staged win so
 * the rest of the campaign is still covered (and a note says so). The run fails on an engine error, a game that fails
 * the checks a scenario smoke game does, a campaign still open after every node had its turns, or one that ends with
 * none of its declared log fields written.
 */
export function playCampaign(
  pack: PackInput,
  campaign: PackCampaign,
  seed: number,
  deps: EngineDeps,
  maxCommands: number,
): {
  readonly games: readonly SmokeGame[];
  readonly notes: readonly string[];
  /** The first node a real game was lost at in this run, or null when every game was won. */
  readonly lostAt: string | null;
} {
  const definition = campaign.definition;
  const games: SmokeGame[] = [];
  const notes: string[] = [];
  let lostAt: string | null = null;
  const budget = definition.graph.nodes.length * 3 + 2;
  const failure = (node: string, scenario: string, error: string): SmokeGame => ({
    deck: SMOKE_BASE_DECK,
    scenario,
    campaign: campaign.id,
    node,
    seed,
    ok: false,
    rounds: 0,
    commands: 0,
    error,
    packCardsPlayed: [],
  });
  const starter = CORE_STARTER_DECKS.find((deck) => String(deck.id) === SMOKE_BASE_DECK);
  if (!starter) throw new Error(`no starter deck "${SMOKE_BASE_DECK}"`);
  const prefix = `x.${pack.manifest.id}.`;
  const campaignDeps = campaignDepsWithPacks(PLAYABLE_CARDS, [pack]);
  let nodeId = "(start)";
  let scenario = "(campaign)";
  try {
    let log = createCampaignLog(definition, {
      id: `smoke-${campaign.id}-${seed}`,
      seats: [
        {
          seatNumber: 1,
          identityCardId: starter.identityCardId,
          deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
        },
      ],
      modes: { campaign: { campaignId: definition.campaignId } },
      poolVersion: "smoke",
      seed,
    });
    for (let turn = 0; turn < budget && log.status === "active"; turn++) {
      const before = log;
      const composed = settleCampaign((answers) =>
        resolveBetweenGames(definition, before, campaignDeps, before.modes, answers),
      );
      const start = startGameFromLog(definition, composed);
      nodeId = start.nodeId;
      scenario = String(start.scenarioId);
      const created = createGame(campaignGameWithPacks(start, [pack]), deps);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const run = playToOutcome(created.state, deps, { maxCommands });
      const state = run.session.state;
      const replayed = replay(run.session.log, deps);
      let error: string | undefined;
      if (run.outcome === null) error = `stuck: no outcome after ${run.commands} commands (round ${run.rounds})`;
      else if (state.pendingChoice !== null) error = "a prompt was still open when the game ended";
      else if (!replayed.ok) error = `the game's log does not replay: ${replayed.error.message}`;
      else if (!isDeepStrictEqual(replayed.state, state)) error = "the game's log replays to a different state";
      const events: readonly GameEvent[] = replayed.ok ? replayed.events : [];
      const played = [
        ...new Set(
          events.flatMap((e) =>
            (e.type === "cardPlayed" || e.type === "encounterCardRevealed") && String(e.cardId).startsWith(prefix)
              ? [String(e.cardId)]
              : [],
          ),
        ),
      ];
      games.push({
        deck: SMOKE_BASE_DECK,
        scenario,
        campaign: campaign.id,
        node: nodeId,
        seed,
        ok: error === undefined,
        ...(run.outcome ? { outcome: `${run.outcome.result} (${run.outcome.reason})` } : {}),
        ...(error !== undefined ? { error } : {}),
        rounds: run.rounds,
        commands: run.commands,
        packCardsPlayed: played,
      });
      if (error !== undefined) return { games, notes, lostAt };
      const result = campaignResultOf(definition, composed, state, events, deps);
      log = settleCampaign((answers) =>
        applyCampaignResult(definition, composed, result, { at: 1 }, campaignDeps, answers),
      );
      if (result.outcome === "lost") lostAt ??= nodeId;
      if (result.outcome === "lost" && log.status === "active") {
        // The loss policy ran. A retry replays the same seed, so stage a win at the same node to reach the rest.
        const lost = log;
        const again = settleCampaign((answers) =>
          resolveBetweenGames(definition, lost, campaignDeps, lost.modes, answers),
        );
        // The lost game's own writes were folded above; clear them so the staged result does not fold them twice.
        const staged = {
          ...state,
          outcome: { result: "win", reason: "villainDefeated" },
          campaignWrites: { logWrites: [], removedFromCampaign: [] },
        } as GameState;
        const stagedResult = campaignResultOf(definition, again, staged, events, deps);
        log = settleCampaign((answers) =>
          applyCampaignResult(definition, again, stagedResult, { at: 1 }, campaignDeps, answers),
        );
        notes.push(`campaign ${campaign.id} seed ${seed}: lost at "${nodeId}", then advanced with a staged win`);
      }
    }
    if (log.status === "active") {
      games.push(failure(nodeId, scenario, `the campaign was still open after ${budget} games`));
    } else if (definition.logFields.length > 0 && !hasWrittenField(log)) {
      games.push(failure(nodeId, scenario, "the campaign ended with none of its log fields written"));
    }
  } catch (caught) {
    games.push(failure(nodeId, scenario, errorText(caught)));
  }
  return { games, notes, lostAt };
}
