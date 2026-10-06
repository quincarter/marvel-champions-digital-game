/**
 * `NEXT_EVOL_CAMPAIGN_DEFINITION` (NeXt Evolution, MC40) driven through the real runner and a real game at every node
 * (`mut_gen.qa.test.ts`'s shape; `next_evol.test.ts` is the definition's own unit file; docs/phase7-wave7-qa-campaign.md
 * is the write-up). Rules: docs/campaign-modes/markdown/mc40_next_evolution.md ("MC40 p. N") through
 * docs/phase7-wave7.md §1.19-1.21, §2.10, §3.40-3.46 and the §4.1 answers.
 *
 * How a real game is played here, and what is staged. Every game below is built from the composed log
 * (`wave7Scenario` + the composed sets + `createGame`), settled to the first player phase, and then played by the
 * greedy headless driver (`../testing/driver.ts`) one command at a time with step invariants (`checkState`), and its
 * session log is replayed to a deep-equal state. The greedy driver cannot win these games (it loses within a few
 * rounds, `wave7/x23/precon-e2e.test.ts` notes the same) and the games are cut after `PLAY` commands to keep the file
 * fast, so a win is staged, as `mut_gen.qa.test.ts` and `mojo.qa.test.ts` stage theirs:
 *
 * - **Real**: the scheme's defeat. The scheme is put to 1 threat and the first player's real `changeForm` +
 *   `basicThwart` defeat it, so its own When Defeated flips it into its environment and the environment enters play
 *   (campaign.ts; "earned from the real flip"). Every setup instruction, every card the setup moves, every Victory
 *   record is derived by the real runner from the real state.
 * - **Staged by surgery** at the end of the played game: the outcome overridden to a win (`asWin`), the villains under
 *   Routed and the Morlock allies in play (scenario 1), the damage on Hope Summers (scenarios 3, 4), a seat eliminated
 *   (expert). A lost game is the driver's own loss or, when it has not lost within `PLAY` commands, `asLoss`.
 * - **Stand-in logs** (`walk`): a log walked to a node with bare results whose records say what an earlier won game
 *   would have recorded, for the tests that only need a setup (Morlock searches, Hope Summers's choice, players + 1).
 */
import { describe, expect, it } from "vitest";
import { CORE_STARTER_DECKS, type CardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  createCampaignLog,
  createGame,
  replay,
  resolveBetweenGames,
  sessionApply,
  startGameFromLog,
  startSession,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PendingChoice,
} from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { firstLegal, patchInstance, type Picker } from "../testing/harness.js";
import { driveStepwise } from "../testing/staging.js";
import { WAVE7_CARDS, WAVE7_DEPS, wave7Scenario } from "../wave7/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { NEXT_EVOL_CAMPAIGN_DEFINITION as DEF } from "./next_evol.js";

const DEPS: CampaignDeps = { pool: WAVE7_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };
const NODES = ["morlock-siege", "on-the-run", "juggernaut", "mister-sinister", "stryfe"] as const;

/** Commands the driver plays in a real game before the outcome is staged. */
const PLAY = 14;
const SEED = 4242;

/** The log sheet's rows (MC40 p. 24): title, scheme (a face), encounter card, environment (b face). */
const ROWS = {
  "Establish Safehouse": ["40191a", "40201", "40191b"],
  "Mission Prep": ["40193a", "40200", "40193b"],
  "Assemble the Team": ["40190a", "40199", "40190b"],
  "Gear Up": ["40192a", "40203", "40192b"],
  "Practice Maneuvers": ["40194a", "40198", "40194b"],
  "Prepare Defenses": ["40195a", "40202", "40195b"],
} as const;
type Title = keyof typeof ROWS;
const TITLES = Object.keys(ROWS) as Title[];
const BLACK_TOM = "40132";
const WILLOW = "40133";
const HOPE = "40130";
const MORLOCK = "40079";
const MARAUDER_FRONTS = ["40070a", "40071a", "40072a", "40073a", "40074a", "40075a", "40076a"];

// ---------------------------------------------------------------------------------------------------------------
// Campaign helpers
// ---------------------------------------------------------------------------------------------------------------

const DECKS = [
  "core-spider-man-justice",
  "core-captain-marvel-leadership",
  "core-she-hulk-aggression",
  "core-iron-man-aggression",
];
function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no Core starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}
const seatsOf = (players: number): readonly CampaignSeatSetup[] =>
  DECKS.slice(0, players).map((deck, index) => seatFor(deck, index + 1));

function settleBy<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
): { readonly value: T; readonly asked: readonly CampaignPendingChoice[] } {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return { value: result.value, asked };
    asked.push(result.choice);
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: pick(result.choice),
    });
  }
  throw new Error("the runner asked for more than 64 choices");
}

const taking =
  (...titles: string[]) =>
  (choice: CampaignPendingChoice): readonly string[] => [
    titles.find((title) => choice.options.includes(title)) ?? choice.options[0]!,
  ];
const refuse = (choice: CampaignPendingChoice): readonly string[] => {
  throw new Error(`the runner asked "${choice.slot}" where it must not`);
};

function newLog(modes: PlayModes, players = 2, seed = SEED): CampaignLog {
  return createCampaignLog(DEF, {
    id: `next-evol-qa-${seed}`,
    seats: seatsOf(players),
    modes,
    poolVersion: "qa-test",
    seed,
  });
}
const compose = (log: CampaignLog, pick: (choice: CampaignPendingChoice) => readonly string[]) =>
  settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), pick);
const fold = (composed: CampaignLog, result: CampaignGameResult): CampaignLog =>
  settleBy(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    () => [],
  ).value;

type RecordEntry = CampaignGameResult["records"][number];
const bare = (nodeId: string, won: boolean, records: readonly RecordEntry[] = []): CampaignGameResult => ({
  nodeId,
  outcome: won ? "won" : "lost",
  records,
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
});
const listRecord = (
  instructionId: string,
  field: string,
  ids: readonly string[],
  mode: "set" | "append" = "set",
): RecordEntry => ({
  instructionId,
  write: {
    field,
    seatNumber: null,
    mode,
    ...(mode === "append" ? { distinct: true } : {}),
    value: { kind: "cardList", cardIds: ids as readonly CardId[] },
  },
});
const numberRecord = (instructionId: string, field: string, value: number): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "number", value } },
});
const hpRecord = (instructionId: string, seatNumber: number, value: number): RecordEntry => ({
  instructionId,
  write: { field: "remainingHp", seatNumber, mode: "set", value: { kind: "number", value } },
});

/** What a log walked to node `n` (1-based) by stand-in wins records: `plays[i]` = [scheme title, environments earned after it, extra records]. */
function walk(
  modes: PlayModes,
  players: number,
  plays: readonly (readonly [Title, readonly string[], (readonly RecordEntry[])?])[],
  seed = SEED,
): CampaignLog {
  let log = newLog(modes, players, seed);
  for (const [index, [title, earned, extra]] of plays.entries()) {
    const n = index + 1;
    const composed = compose(log, taking(title)).value;
    log = fold(
      composed,
      bare(NODES[index]!, true, [
        ...(extra ?? []),
        ...(earned.length > 0
          ? [listRecord(`mc40.s${n}.victory.environment`, "environmentsEarned", earned, "append")]
          : []),
      ]),
    );
  }
  return log;
}

const shared = (log: CampaignLog, id: string) => log.shared[id];
const listOf = (log: CampaignLog, id: string): readonly string[] => {
  const value = shared(log, id);
  return value?.kind === "cardList" ? (value.cardIds as readonly string[]) : [];
};
const struckOf = (log: CampaignLog): readonly string[] => {
  const value = shared(log, "sideSchemes");
  return value?.kind === "strikeList" ? value.struck : [];
};
const chosenAt = (log: CampaignLog, n: number): string | undefined => {
  const value = shared(log, `sideSchemeScenario${n}`);
  return value?.kind === "choice" ? value.option : undefined;
};
const numberOf = (log: CampaignLog, id: string): number | undefined => {
  const value = shared(log, id);
  return value?.kind === "number" ? value.value : undefined;
};
const removedIds = (log: CampaignLog): readonly string[] =>
  log.removedFromCampaign.map((face) => face.cardId as string);
const offeredTitles = (choices: readonly CampaignPendingChoice[]): readonly string[] =>
  choices.find((choice) => choice.slot === "scheme")?.options ?? [];

// ---------------------------------------------------------------------------------------------------------------
// Real-game helpers
// ---------------------------------------------------------------------------------------------------------------

/** A scenario's game exactly as the campaign card harness builds it (unsettled); `modularSetIds` is the builder's pick. */
function build(composed: CampaignLog, modularSetIds?: readonly string[]) {
  const start = startGameFromLog(DEF, composed);
  const removed = composed.removedFromCampaign.map((face) => face.cardId);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config = wave7Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: [...seat.deck],
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: composed.modes,
    ...(modularSetIds ? { modularSetIds } : {}),
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE7_CARDS, start.encounterSets.deck, removed)],
      setAside: [
        ...(config.setAside ?? []),
        ...cardsOfComposedSets(WAVE7_CARDS, start.encounterSets.setAside, removed),
      ],
      campaign: start.input,
    },
    WAVE7_DEPS,
  );
  if (!created.ok) throw new Error(`${start.nodeId}: setup failed: ${created.error.message}`);
  return { start, state: created.state, events: created.events };
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const nameOf = (s: GameState, id: InstanceId): string => s.cardPool[codeOf(s, id)]?.name ?? codeOf(s, id);
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const everywhere = (s: GameState, code: string): InstanceId[] =>
  Object.values(s.instances)
    .filter((instance) => (instance.cardId as string) === code)
    .map((instance) => instance.instanceId);
const count = (list: readonly string[], code: string): number => list.filter((entry) => entry === code).length;
const encounterDeckCodes = (s: GameState): string[] => codes(s, s.encounterDecks[s.encounterDeckOrder[0]!]!.deck);
const setAsideCodes = (s: GameState): string[] => codes(s, s.encounterSetAside);
const inVillainArea = (s: GameState): string[] => codes(s, s.villainArea);
const activeVillainCode = (s: GameState): string => codeOf(s, s.activeVillainId!);
const tokens = (s: GameState): number => s.mainScheme?.accelerationTokens ?? 0;
const dealtCodes = (s: GameState): string[][] => s.players.map((player) => codes(s, player.dealtEncounter));
const handTotal = (s: GameState): number => s.players.reduce((sum, player) => sum + player.hand.length, 0);
const identityDamage = (s: GameState, seat: number): number =>
  s.instances[s.players[seat - 1]!.identity.instanceId]!.damage;
const damageOf = (s: GameState, code: string): number => s.instances[everywhere(s, code)[0]!]!.damage;
const threatOf = (s: GameState, code: string): number => s.instances[everywhere(s, code)[0]!]!.threat;

/** Answers a `chooseOption` prompt by label, anything else as `firstLegal` does. */
const labeled =
  (label: RegExp): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const hit = choice.options.find((option) => label.test(option.label ?? ""));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

interface Setup {
  readonly composed: CampaignLog;
  readonly start: ReturnType<typeof startGameFromLog>;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/** Composes the next node (the scheme taken is `title`; a retry asks nothing) and settles its game to the first player phase. */
function setup(
  log: CampaignLog,
  title: Title | null,
  options: { readonly pick?: Picker; readonly modular?: readonly string[] } = {},
): Setup {
  const composed = compose(log, title === null ? refuse : taking(title)).value;
  const built = build(composed, options.modular);
  const driven = driveStepwise(WAVE7_DEPS, built.state, options.pick ?? firstLegal);
  expect(driven.state.step.phase).toBe("player");
  return { composed, start: built.start, state: driven.state, events: [...built.events, ...driven.events] };
}

// ---- Step invariants (the observer style of wave7/x23/precon-e2e.test.ts, cut to what a campaign game can break) ----

function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

/** Throws on the first broken invariant: no soft lock, no stall between steps, no card in two zones, no removed card in the game. */
function checkState(s: GameState, removedFromCampaign: readonly string[], where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    if (choice.minSelections > choice.options.length)
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  for (const [id, labels] of zoneIndex(s))
    if (labels.length > 1) fail(`${id} (${nameOf(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  // RRG 1.8 p. 29: a card removed from the campaign is not in any later game.
  for (const code of removedFromCampaign)
    if (everywhere(s, code).length > 0) fail(`${code}, removed from the campaign, is in the game`);
  // At most one copy of each campaign environment / scheme face (each is a single card of the campaign pool).
  for (const row of Object.values(ROWS)) {
    for (const code of [row[0], row[2]]) if (everywhere(s, code).length > 1) fail(`two copies of ${code}`);
  }
}

/** The driver's own answer, except that Hope Summers and a Morlock never defend (the X-23 e2e's policy: losing either loses). */
function ownAnswer(s: GameState, choice: PendingChoice): readonly string[] | null {
  if (choice.prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const allies = ids.filter((id) => {
    if (id === "decline") return false;
    const card = s.cardPool[codeOf(s, id as InstanceId)]!;
    return card.type === "ally" && card.id !== HOPE && card.name !== "Morlock";
  });
  if (allies[0]) return [allies[0]];
  return ids.includes("decline") ? ["decline"] : null;
}

interface Played {
  readonly session: GameSession;
  readonly final: GameState;
  readonly events: readonly GameEvent[];
  readonly commands: number;
}

/**
 * Plays `initial` with `script` first (commands of the staging, each from the state at its turn) and the greedy driver
 * after, `PLAY` driver commands at most, checking every invariant after every command, then proves the session log
 * replays to a deep-equal state (the determinism contract).
 */
function play(
  initial: GameState,
  setupEvents: readonly GameEvent[],
  label: string,
  removedFromCampaign: readonly string[],
  script: ((s: GameState) => Command)[] = [],
  maxDriver = PLAY,
): Played {
  checkState(initial, removedFromCampaign, `${label} start`);
  let session = startSession(initial);
  const events: GameEvent[] = [...setupEvents];
  const queue = [...script];
  let driven = 0;
  let commands = 0;
  while (!session.state.outcome && (queue.length > 0 || driven < maxDriver)) {
    const s = session.state;
    const choice = s.pendingChoice;
    let command: Command | undefined;
    if (!choice && queue.length > 0) command = queue.shift()!(s);
    else {
      const own = choice ? ownAnswer(s, choice) : null;
      if (choice && own)
        command = {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: own,
        };
      else {
        command = playToOutcome(s, WAVE7_DEPS, { maxCommands: 1 }).session.log.commands[0];
        driven++;
      }
    }
    if (!command) throw new Error(`${label}: the driver issued no command`);
    const result = sessionApply(session, command, WAVE7_DEPS);
    if (!result.ok)
      throw new Error(
        `${label}: engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`,
      );
    session = result.session;
    events.push(...result.events);
    commands++;
    checkState(session.state, removedFromCampaign, `${label} command ${commands} ${command.type}`);
  }
  const replayed = replay(session.log, WAVE7_DEPS);
  expect(replayed.ok, `${label}: replay failed`).toBe(true);
  if (replayed.ok) expect(replayed.state, `${label}: the replay is not deep-equal`).toEqual(session.state);
  return { session, final: session.state, events, commands };
}

const activeOf = (s: GameState) => ("activePlayerId" in s.step ? s.step.activePlayerId : s.players[0]!.playerId);

/** The first player's real hero turn that defeats a scheme sitting at 1 threat: change form, then a basic thwart. */
const defeatSchemeScript = (schemeId: InstanceId): ((s: GameState) => Command)[] => [
  (s) => ({ type: "changeForm", playerId: activeOf(s) }),
  (s) => {
    const player = s.players.find((p) => p.playerId === activeOf(s))!;
    return {
      type: "basicThwart",
      playerId: player.playerId,
      thwarterInstanceId: player.identity.instanceId,
      schemeInstanceId: schemeId,
    };
  },
];

const asWin = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((player) => ({ ...player, eliminated: false })),
  outcome: { result: "win", reason: "villainDefeated" },
});
const asLoss = (state: GameState): GameState =>
  state.outcome?.result === "loss" ? state : { ...state, outcome: { result: "loss", reason: "allPlayersDefeated" } };

const resultOf = (composed: CampaignLog, state: GameState, events: readonly GameEvent[]): CampaignGameResult =>
  campaignResultOf(DEF, composed, state, events, WAVE7_DEPS);

interface NodeGame {
  readonly setup: Setup;
  readonly played: Played;
  readonly schemeCode: string;
}

/**
 * One real node: set up, put the chosen scheme at 1 threat when `defeat` and let the real hero turn defeat it (its
 * When Defeated flips it), then drive. `title` null is a retry (nothing is asked).
 */
function playNode(
  log: CampaignLog,
  title: Title | null,
  options: {
    readonly defeat: boolean;
    readonly pick?: Picker;
    readonly modular?: readonly string[];
    readonly maxDriver?: number;
  },
): NodeGame {
  const made = setup(log, title, options);
  const chosenTitle = (title ??
    chosenAt(
      made.composed,
      made.start.nodeId === "morlock-siege" ? 1 : NODES.indexOf(made.start.nodeId as never) + 1,
    )) as Title;
  const schemeCode = ROWS[chosenTitle][0];
  const schemeId = made.state.villainArea.find((id) => codeOf(made.state, id) === schemeCode);
  expect(schemeId, `${chosenTitle} is in play at the start`).toBeDefined();
  const initial = options.defeat ? patchInstance(made.state, schemeId!, { threat: 1 }) : made.state;
  const played = play(
    initial,
    made.events,
    made.start.nodeId,
    made.composed.removedFromCampaign.map((face) => face.cardId as string),
    options.defeat ? defeatSchemeScript(schemeId!) : [],
    options.maxDriver,
  );
  return { setup: made, played, schemeCode };
}

// ---- Staging of the end of a game ----

/** Scenario 1's Victory facts: these villains tucked under Routed, this many Morlocks in play under the first player. */
function withSiegeEnd(state: GameState, defeated: readonly string[], morlocks: number): GameState {
  const routed = state.villainArea.find((id) => nameOf(state, id) === "Routed")!;
  const under = defeated.map((code) => everywhere(state, code)[0]!);
  const allies = state.encounterSetAside.filter((id) => codeOf(state, id) === MORLOCK).slice(0, morlocks);
  expect(allies, "Morlock allies available to stage").toHaveLength(morlocks);
  const first = state.players[0]!;
  return {
    ...state,
    instances: {
      ...state.instances,
      [routed]: { ...state.instances[routed]!, tucked: under },
      ...Object.fromEntries(
        allies.map((id) => [id, { ...state.instances[id]!, controllerId: first.playerId, ownerId: null }]),
      ),
    },
    encounterSetAside: state.encounterSetAside.filter((id) => !allies.includes(id)),
    players: state.players.map((player, index) =>
      index === 0 ? { ...player, playArea: [...player.playArea, ...allies] } : player,
    ),
  };
}
const withHopeDamage = (state: GameState, damage: number): GameState => {
  const hope = everywhere(state, HOPE)[0];
  expect(hope, "Hope Summers is in the game").toBeDefined();
  expect(
    state.players.some((p) => p.playArea.includes(hope!)),
    "Hope Summers is in play",
  ).toBe(true);
  return patchInstance(state, hope!, { damage });
};
const withSeatEliminated = (state: GameState, seat: number): GameState => ({
  ...state,
  players: state.players.map((player, index) => (index === seat - 1 ? { ...player, eliminated: true } : player)),
});

/** The campaign log a won node produces: the played game, staged to a win, its result derived by the real runner. */
function winNode(
  game: NodeGame,
  stage: (state: GameState) => GameState = (s) => s,
): { readonly log: CampaignLog; readonly result: CampaignGameResult; readonly final: GameState } {
  const final = stage(asWin(game.played.final));
  const result = resultOf(game.setup.composed, final, game.played.events);
  return { log: fold(game.setup.composed, result), result, final };
}
function loseNode(game: NodeGame): { readonly log: CampaignLog; readonly result: CampaignGameResult } {
  const final = asLoss(game.played.final);
  const result = resultOf(game.setup.composed, final, game.played.events);
  return { log: fold(game.setup.composed, result), result };
}

// ---------------------------------------------------------------------------------------------------------------
// 1. One full 2-player standard campaign, a real game at every node
// ---------------------------------------------------------------------------------------------------------------

/** The full run, played once and shared (each test below needs the logs it leaves). */
interface FullRun {
  readonly logs: CampaignLog[]; // logs[k] = the log after scenario k+1 was won
  readonly games: NodeGame[];
}
let cachedRun: FullRun | undefined;
const PLAN: readonly Title[] = [
  "Gear Up",
  "Mission Prep",
  "Assemble the Team",
  "Practice Maneuvers",
  "Prepare Defenses",
];

function fullRun(): FullRun {
  if (cachedRun) return cachedRun;
  const logs: CampaignLog[] = [];
  const games: NodeGame[] = [];
  let log = newLog(STANDARD);
  const earned: string[] = [];

  // ---- Scenario 1, Morlock Siege (MC40 p. 9) ----
  {
    const game = playNode(log, PLAN[0]!, { defeat: true });
    games.push(game);
    // The scheme was defeated by the real thwart: its environment is in play, the a face is gone.
    expect(inVillainArea(game.played.final)).toContain("40192b");
    expect(everywhere(game.played.final, "40192a")).toEqual([]);
    const won = winNode(game, (s) => withSiegeEnd(s, ["40070a", "40072a", "40074a"], 3));
    log = won.log;
    logs.push(log);
    earned.push("40192b");
    expect(log.position.nextNodeId).toBe("on-the-run");
    expect(listOf(log, "maraudersDefeated")).toEqual(["40070a", "40072a", "40074a"]);
    expect(numberOf(log, "morlocksSaved")).toBe(3);
    expect(listOf(log, "environmentsEarned")).toEqual(earned);
    expect(struckOf(log)).toEqual(["Gear Up"]);
    expect(chosenAt(log, 1)).toBe("Gear Up");
    expect(listOf(log, "encounterCards")).toEqual(["40203"]);
    expect(log.removedFromCampaign).toEqual([]);
  }

  // ---- Scenario 2, On the Run (MC40 p. 11) ----
  {
    const game = playNode(log, PLAN[1]!, { defeat: true });
    games.push(game);
    const settled = game.setup.state;
    // "remove each villain card recorded under Marauders Defeated from the game" (by title, p. 11): the three are out.
    for (const code of ["40070a", "40072a", "40074a"])
      for (const id of everywhere(settled, code)) expect(settled.removedFromGame, code).toContain(id);
    const drawn = activeVillainCode(settled);
    expect(MARAUDER_FRONTS, "a Marauder is the villain in play").toContain(drawn);
    expect(["40070a", "40072a", "40074a"]).not.toContain(drawn);
    // The earned environment (Geared Up) is in play with its counter, and every enemy has a tough status card.
    expect(inVillainArea(settled)).toEqual(expect.arrayContaining(["40192b", "40193a"]));
    expect(settled.instances[everywhere(settled, "40192b")[0]!]!.counters).toEqual({ pouch: 1 });
    expect(settled.instances[settled.activeVillainId!]!.statuses.tough).toBeGreaterThan(0);
    expect(inVillainArea(game.played.final)).toContain("40193b");
    const won = winNode(game);
    log = won.log;
    logs.push(log);
    earned.push("40193b");
    expect(listOf(log, "environmentsEarned")).toEqual(earned);
    expect(struckOf(log)).toEqual(["Gear Up", "Mission Prep"]);
    expect(listOf(log, "encounterCards")).toEqual(["40203", "40200"]);
    // Scenario 1's Marauders and Morlocks stand: nothing in scenario 2 rewrites them.
    expect(numberOf(log, "morlocksSaved")).toBe(3);
    expect(listOf(log, "maraudersDefeated")).toEqual(["40070a", "40072a", "40074a"]);
  }

  // ---- Scenario 3, Juggernaut (MC40 p. 14) ----
  {
    const game = playNode(log, PLAN[2]!, { defeat: true });
    games.push(game);
    const settled = game.setup.state;
    // Both earned environments are in play, the encounter deck holds the two earlier cards and this scenario's.
    expect(inVillainArea(settled)).toEqual(expect.arrayContaining(["40192b", "40193b", "40190a"]));
    expect(settled.instances[everywhere(settled, "40118")[0]!]!.counters.momentum ?? 0).toBeGreaterThanOrEqual(2);
    expect(dealtCodes(settled).map((cardsDealt) => cardsDealt.length)).toEqual([1, 1]);
    for (const [card] of dealtCodes(settled)) expect([BLACK_TOM, WILLOW]).toContain(card);
    for (const code of ["40203", "40200", "40199"])
      expect(encounterDeckCodes(settled).includes(code) || setAsideCodes(settled).includes(code), code).toBe(true);
    const won = winNode(game, (s) => withHopeDamage(s, 1));
    log = won.log;
    logs.push(log);
    earned.push("40190b");
    expect(numberOf(log, "hopeDamage3")).toBe(1);
    expect(listOf(log, "environmentsEarned")).toEqual(earned);
    expect(struckOf(log)).toEqual(["Gear Up", "Mission Prep", "Assemble the Team"]);
    expect(listOf(log, "encounterCards")).toEqual(["40203", "40200", "40199"]);
  }

  // ---- Scenario 4, Mister Sinister (MC40 p. 16): Hope Summers's 1 damage is placed on her ----
  {
    const game = playNode(log, PLAN[3]!, { defeat: true, pick: labeled(/^Place that damage on Hope Summers/) });
    games.push(game);
    const settled = game.setup.state;
    expect(damageOf(settled, HOPE)).toBe(1);
    expect(inVillainArea(settled)).toEqual(
      expect.arrayContaining(["40192b", "40193b", "40190b", "40194a", "40196"].filter((c) => c !== "40196")),
    );
    expect(inVillainArea(settled)).toContain("40190b");
    const won = winNode(game, (s) => withHopeDamage(s, 2));
    log = won.log;
    logs.push(log);
    earned.push("40194b");
    expect(numberOf(log, "hopeDamage4")).toBe(2);
    expect(numberOf(log, "hopeDamage3")).toBe(1);
    expect(listOf(log, "environmentsEarned")).toEqual(earned);
    expect(struckOf(log)).toEqual(["Gear Up", "Mission Prep", "Assemble the Team", "Practice Maneuvers"]);
    expect(listOf(log, "encounterCards")).toEqual(["40203", "40200", "40199", "40198"]);
  }

  // ---- Scenario 5, Stryfe (MC40 p. 18): the 2 damage becomes threat on Stryfe's Grasp ----
  {
    const game = playNode(log, PLAN[4]!, { defeat: false, pick: labeled(/^Place that much threat/) });
    games.push(game);
    const settled = game.setup.state;
    expect(damageOf(settled, HOPE)).toBe(0);
    // All four earned environments are in play; every scenario's encounter card is shuffled in (five with this one).
    expect(inVillainArea(settled)).toEqual(expect.arrayContaining(["40192b", "40193b", "40190b", "40194b", "40195a"]));
    const won = winNode(game);
    log = won.log;
    logs.push(log);
    expect(log.status).toBe("won");
    expect(log.position.nextNodeId).toBeNull();
    expect(listOf(log, "encounterCards")).toEqual(["40203", "40200", "40199", "40198", "40202"]);
    // Scenario 5's victory has no removal step: the campaign is over (the scheme left undefeated is removed nowhere).
    expect(log.removedFromCampaign).toEqual([]);
  }

  cachedRun = { logs, games };
  return cachedRun;
}

describe("a full standard 2-player campaign: a real game at every node, a different scheme each, the log checked after each (MC40 pp. 6-24)", () => {
  it("plays all five scenarios, each composed from the log, played, replayed and folded back", () => {
    const { logs } = fullRun();
    const last = logs[4]!;
    expect(last.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual(NODES.map((node) => `${node}:won`));
    expect(last.position.resolved).toEqual(Object.fromEntries(NODES.map((node) => [node, "completed"])));
    // Five different schemes were chosen, one per scenario; the sixth was never offered a pick but stays unstruck.
    expect(new Set(NODES.map((_, index) => chosenAt(last, index + 1))).size).toBe(5);
    expect(struckOf(last)).toEqual([...PLAN]);
  }, 120_000);

  it("the offered schemes shrink by one a scenario: all six, then those not chosen previously (MC40 p. 7)", () => {
    const { logs } = fullRun();
    const offers = [newLog(STANDARD), ...logs.slice(0, 4)].map((log) => offeredTitles(compose(log, taking()).asked));
    expect(offers.map((titles) => titles.length)).toEqual([6, 5, 4, 3, 2]);
    expect(offers[1]).not.toContain("Gear Up");
    expect(offers[4]).toEqual(
      TITLES.filter(
        (title) =>
          title !== "Gear Up" &&
          title !== "Mission Prep" &&
          title !== "Assemble the Team" &&
          title !== "Practice Maneuvers",
      ),
    );
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 2. A lost scenario whose chosen scheme was defeated in the lost game (MC40 p. 7; §3.40)
// ---------------------------------------------------------------------------------------------------------------

describe("a lost scenario is retried with the same scheme and nothing earned (MC40 p. 6-7, docs/phase7-wave7.md §3.40)", () => {
  it("scenario 3 lost after its scheme was really defeated: no environment is earned, the retry repeats the pick without asking, earlier earnings stay", () => {
    const { logs } = fullRun();
    const before = logs[1]!;
    const game = playNode(before, "Assemble the Team", { defeat: true });
    // The scheme really flipped in this game ...
    expect(inVillainArea(asLoss(game.played.final))).toContain("40190b");
    // ... and the game is lost.
    const lost = loseNode(game);
    expect(lost.result.outcome).toBe("lost");
    expect(lost.log.status).toBe("active");
    expect(lost.log.position.nextNodeId).toBe("juggernaut");
    expect(lost.log.position.resolved.juggernaut).toBeUndefined();
    expect(lost.log.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "morlock-siege:won",
      "on-the-run:won",
      "juggernaut:lost",
    ]);
    // Nothing earned, nothing struck, nothing removed, scenarios 1-2's earnings kept.
    expect(listOf(lost.log, "environmentsEarned")).toEqual(["40192b", "40193b"]);
    expect(struckOf(lost.log)).toEqual(["Gear Up", "Mission Prep"]);
    expect(listOf(lost.log, "encounterCards")).toEqual(["40203", "40200"]);
    expect(lost.log.removedFromCampaign).toEqual([]);
    expect(numberOf(lost.log, "morlocksSaved")).toBe(3);
    expect(listOf(lost.log, "maraudersDefeated")).toEqual(["40070a", "40072a", "40074a"]);
    expect(numberOf(lost.log, "hopeDamage3")).toBeUndefined();

    // The retry: the same scheme, no prompt (`refuse` throws if asked), written once.
    const retry = playNode(lost.log, null, { defeat: false });
    expect(retry.setup.start.nodeId).toBe("juggernaut");
    expect(chosenAt(retry.setup.composed, 3)).toBe("Assemble the Team");
    expect(struckOf(retry.setup.composed)).toEqual(["Gear Up", "Mission Prep", "Assemble the Team"]);
    expect(listOf(retry.setup.composed, "encounterCards")).toEqual(["40203", "40200", "40199"]);
    // Not carried over from the lost game: the scheme is back on its a face with its full threat, undefeated.
    expect(inVillainArea(retry.setup.state)).toContain("40190a");
    expect(everywhere(retry.setup.state, "40190b")).toEqual([]);
    expect(threatOf(retry.setup.state, "40190a")).toBe(8);
    // And winning it earns it as usual.
    const won = winNode(playNode(lost.log, null, { defeat: true }));
    expect(listOf(won.log, "environmentsEarned")).toEqual(["40192b", "40193b", "40190b"]);
    expect(won.log.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "morlock-siege:won",
      "on-the-run:won",
      "juggernaut:lost",
      "juggernaut:won",
    ]);
  }, 120_000);

  it("a lost scenario 1 repeats its scheme and strike; two losses in a row still ask nothing", () => {
    const game = playNode(newLog(STANDARD), "Practice Maneuvers", { defeat: true });
    const lost = loseNode(game).log;
    expect(struckOf(lost)).toEqual([]);
    expect(listOf(lost, "environmentsEarned")).toEqual([]);
    const second = playNode(lost, null, { defeat: false });
    const twice = loseNode(second).log;
    const third = setup(twice, null);
    expect(chosenAt(third.composed, 1)).toBe("Practice Maneuvers");
    expect(struckOf(third.composed)).toEqual(["Practice Maneuvers"]);
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 3. A scheme not defeated at a win is removed from the campaign for good (MC40 p. 7)
// ---------------------------------------------------------------------------------------------------------------

describe("a scheme not defeated by the time the players win is removed from the campaign and cannot be chosen again (MC40 p. 7)", () => {
  it("is removed at the win, not offered again, and stays removed across a later retry; its encounter card stays", () => {
    // Scenario 1, Establish Safehouse never defeated (no thwart), the game won.
    const first = playNode(newLog(STANDARD), "Establish Safehouse", { defeat: false });
    expect(inVillainArea(first.played.final)).toContain("40191a");
    const afterOne = winNode(first).log;
    expect([...removedIds(afterOne)].sort()).toEqual(["40191a", "40191b"]);
    expect(listOf(afterOne, "environmentsEarned")).toEqual([]);
    expect(listOf(afterOne, "encounterCards")).toEqual(["40201"]); // "even if the players do not defeat the player side scheme"
    expect(struckOf(afterOne)).toEqual(["Establish Safehouse"]);

    // Scenario 2 does not offer it; a different scheme is defeated and the scenario won.
    const composed2 = compose(afterOne, taking("Mission Prep"));
    expect(offeredTitles(composed2.asked)).toEqual(TITLES.filter((title) => title !== "Establish Safehouse"));
    const afterTwo = winNode(playNode(afterOne, "Mission Prep", { defeat: true })).log;
    expect([...removedIds(afterTwo)].sort()).toEqual(["40191a", "40191b"]);
    expect(listOf(afterTwo, "environmentsEarned")).toEqual(["40193b"]);

    // Scenario 3 lost and retried: the removal sticks (the retry's baseline is the node's start, after the removal).
    const third = playNode(afterTwo, "Gear Up", { defeat: false });
    expect(offeredTitles(compose(afterTwo, taking("Gear Up")).asked)).toEqual(
      TITLES.filter((title) => !["Establish Safehouse", "Mission Prep"].includes(title)),
    );
    const lost = loseNode(third).log;
    expect([...removedIds(lost)].sort()).toEqual(["40191a", "40191b"]);
    const retry = playNode(lost, null, { defeat: false });
    expect([...removedIds(retry.setup.composed)].sort()).toEqual(["40191a", "40191b"]);
    // Neither face nor what the environment hands out (the Safehouse, 40197) is anywhere in the retry's game.
    for (const code of ["40191a", "40191b", "40197"]) expect(everywhere(retry.setup.state, code), code).toEqual([]);
    // Won: still removed exactly once, and Establish Safehouse is never in scenarios 4 and 5's offers.
    const afterThree = winNode(playNode(lost, null, { defeat: true })).log;
    expect(removedIds(afterThree).filter((code) => code === "40191a")).toHaveLength(1);
    const fourth = compose(afterThree, taking("Practice Maneuvers"));
    expect(offeredTitles(fourth.asked)).toEqual(["Assemble the Team", "Practice Maneuvers", "Prepare Defenses"]);
  }, 180_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 4. Scenario 2 after a scenario 1 that recorded Marauders and Morlocks (MC40 p. 11)
// ---------------------------------------------------------------------------------------------------------------

describe("scenario 2 reads Marauders Defeated and Morlocks Saved (MC40 p. 11)", () => {
  const siege = (marauders: readonly string[], saved: number, players = 2, seed = SEED): CampaignLog =>
    walk(
      STANDARD,
      players,
      [
        [
          "Gear Up",
          ["40192b"],
          [
            listRecord("mc40.s1.victory.marauders", "maraudersDefeated", marauders),
            numberRecord("mc40.s1.victory.morlocks", "morlocksSaved", saved),
          ],
        ],
      ],
      seed,
    );

  it("the three recorded villains are out of the draw, whichever face was recorded, and the draw is among the four that remain (p. 11)", () => {
    const recorded = ["40071a", "40073b", "40075a"]; // 40073b is the expert face of a standard-mode game's villain
    const removedTitles = recorded.map((code) => WAVE7_CARDS.find((card) => (card.id as string) === code)!.name);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const { state } = setup(siege(recorded, 2, 2, seed), "Mission Prep");
      const drawn = nameOf(state, state.activeVillainId!);
      expect(removedTitles, `seed ${seed}: the villain in play is not a recorded one`).not.toContain(drawn);
      expect(MARAUDER_FRONTS.map((code) => WAVE7_CARDS.find((card) => (card.id as string) === code)!.name)).toContain(
        drawn,
      );
      seen.add(drawn);
    }
    expect(seen.size, "the draw is among more than one of the four that remain").toBeGreaterThan(1);
    // Control: with nothing recorded the same seeds do draw one of those three titles, so the removal is what keeps them out.
    const control = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const { state } = setup(siege([], 2, 2, seed), "Mission Prep");
      control.add(nameOf(state, state.activeVillainId!));
    }
    expect(removedTitles.some((name) => control.has(name))).toBe(true);
  }, 120_000);

  it.each([2, 3, 4])(
    "%i Morlocks saved: that many searches, each adding a card of the player's deck to their hand (p. 11)",
    (saved) => {
      const base = setup(siege(["40071a", "40073a", "40075a"], 0), "Mission Prep");
      const { state } = setup(siege(["40071a", "40073a", "40075a"], saved), "Mission Prep");
      expect(handTotal(state) - handTotal(base.state)).toBe(saved);
      // A search ends in a shuffle: the searched player's deck is the base's minus the cards taken.
      expect(state.players.reduce((sum, p) => sum + p.deck.length, 0)).toBe(
        base.state.players.reduce((sum, p) => sum + p.deck.length, 0) - saved,
      );
    },
    120_000,
  );

  it("fewer than 2 or more than 4: 0 and 1 saved search 0 and 1 times", () => {
    const base = handTotal(setup(siege(["40071a", "40073a", "40075a"], 0), "Mission Prep").state);
    expect(handTotal(setup(siege(["40071a", "40073a", "40075a"], 1), "Mission Prep").state) - base).toBe(1);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 5. Scenarios 3-5: Hope Summers's damage, both options; scenario 5 with every environment earned
// ---------------------------------------------------------------------------------------------------------------

describe("Hope Summers's damage-or-threat choice (MC40 pp. 16, 18)", () => {
  const upToThree = (hope3: number, players = 2): CampaignLog =>
    walk(STANDARD, players, [
      ["Gear Up", ["40192b"]],
      ["Mission Prep", ["40192b", "40193b"]],
      ["Assemble the Team", ["40190b"], [numberRecord("mc40.s3.victory.hope", "hopeDamage3", hope3)]],
    ]);

  it.each([1, 2])(
    "scenario 4 with %i damage recorded: either that damage on Hope Summers or that much threat on Teleported Away",
    (recorded) => {
      const baseline = setup(upToThree(0), "Practice Maneuvers");
      expect(damageOf(baseline.state, HOPE)).toBe(0);
      const prompts: string[][] = [];
      const record: Picker = (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseOption") prompts.push(choice.options.map((o) => o.label ?? ""));
        return firstLegal(s);
      };
      setup(upToThree(recorded), "Practice Maneuvers", { pick: record });
      expect(
        prompts.some(
          (labels) => labels.length === 2 && /Hope Summers/.test(labels[0]!) && /Teleported Away/.test(labels[1]!),
        ),
      ).toBe(true);
      const damage = setup(upToThree(recorded), "Practice Maneuvers", { pick: labeled(/^Place that damage/) });
      const threat = setup(upToThree(recorded), "Practice Maneuvers", { pick: labeled(/^Place that much threat/) });
      expect(damageOf(damage.state, HOPE)).toBe(recorded);
      expect(threatOf(damage.state, "40146")).toBe(threatOf(baseline.state, "40146"));
      expect(damageOf(threat.state, HOPE)).toBe(0);
      expect(threatOf(threat.state, "40146")).toBe(threatOf(baseline.state, "40146") + recorded);
    },
    120_000,
  );

  it("scenario 4 with nothing recorded raises no choice (nothing to place, MC40 p. 16)", () => {
    const prompts: string[][] = [];
    setup(upToThree(0), "Practice Maneuvers", {
      pick: (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseOption") prompts.push(choice.options.map((o) => o.label ?? ""));
        return firstLegal(s);
      },
    });
    expect(prompts.filter((labels) => labels.some((label) => /Hope Summers/.test(label)))).toEqual([]);
  }, 60_000);

  it.each([1, 2])(
    "scenario 5 with every environment earned and %i recorded: Stryfe's Grasp gets 1 per player per environment, plus that threat or that damage on her",
    (recorded) => {
      const four = (hope4: number): CampaignLog => {
        const log = upToThree(1);
        return fold(
          compose(log, taking("Practice Maneuvers")).value,
          bare("mister-sinister", true, [
            listRecord("mc40.s4.victory.environment", "environmentsEarned", ["40194b"], "append"),
            numberRecord("mc40.s4.victory.hope", "hopeDamage4", hope4),
          ]),
        );
      };
      const baseline = setup(four(0), "Prepare Defenses");
      // 4 environments earned (the most scenarios 1-4 can earn), 2 players: 8 threat on the Grasp from the setup step.
      expect(listOf(four(0), "environmentsEarned")).toEqual(["40192b", "40193b", "40190b", "40194b"]);
      expect(inVillainArea(baseline.state)).toEqual(
        expect.arrayContaining(["40192b", "40193b", "40190b", "40194b", "40195a"]),
      );
      const damage = setup(four(recorded), "Prepare Defenses", { pick: labeled(/^Place that damage/) });
      const threat = setup(four(recorded), "Prepare Defenses", { pick: labeled(/^Place that much threat/) });
      expect(damageOf(damage.state, HOPE)).toBe(recorded);
      expect(threatOf(damage.state, "40168a")).toBe(threatOf(baseline.state, "40168a"));
      expect(damageOf(threat.state, HOPE)).toBe(0);
      expect(threatOf(threat.state, "40168a")).toBe(threatOf(baseline.state, "40168a") + recorded);
      // Every environment's counter is back, one per environment (they entered play again this game).
      expect(baseline.state.instances[everywhere(baseline.state, "40190b")[0]!]!.counters).toEqual({ assembly: 1 });
    },
    180_000,
  );
});

// ---------------------------------------------------------------------------------------------------------------
// 6. Expert campaign (MC40 p. 7)
// ---------------------------------------------------------------------------------------------------------------

describe("expert campaign: a seat eliminated in a won scenario rejoins by paying (MC40 p. 7)", () => {
  it("plays five expert scenarios through real games, seat 2 eliminated at the end of each win, rejoining at the next setup with the token (2, 4) or the facedown card (3, 5)", () => {
    let log = newLog(EXPERT);
    const decline = labeled(/^Decline$/);
    let previous: { readonly composed: CampaignLog; readonly result: CampaignGameResult } | undefined;
    for (const [index, title] of PLAN.entries()) {
      const n = index + 1;
      const game = playNode(log, title, { defeat: true, pick: decline, maxDriver: 6 });
      const state = game.setup.state;
      if (previous) {
        // The same setup after the previous win with seat 2 recorded above 0: that seat may decline, so the two games
        // differ by exactly the price of rejoining.
        const alive = setup(
          fold(previous.composed, {
            ...previous.result,
            records: [...previous.result.records, hpRecord(`mc40.s${n - 1}.victory.hp`, 2, 5)],
          }),
          title,
          { pick: decline },
        ).state;
        if (n === 2 || n === 4) {
          expect(tokens(state), `scenario ${n}: one more acceleration token`).toBe(tokens(alive) + 1);
          expect(state.players[1]!.dealtEncounter.length).toBe(alive.players[1]!.dealtEncounter.length);
        } else {
          expect(state.players[1]!.dealtEncounter.length, `scenario ${n}: one more facedown card`).toBe(
            alive.players[1]!.dealtEncounter.length + 1,
          );
          expect(tokens(state)).toBe(tokens(alive));
        }
        expect(identityDamage(state, 2), `scenario ${n}: seat 2 is healed to full`).toBe(0);
        expect(identityDamage(alive, 2), `scenario ${n}: a seat that may decline keeps its damage`).toBeGreaterThan(0);
      }
      const won = winNode(game, (s) => withSeatEliminated(s, 2));
      log = won.log;
      previous = { composed: game.setup.composed, result: won.result };
      if (n < 5) {
        // The eliminated seat recorded nothing; seat 1 recorded its remaining hit points, capped at base.
        expect(log.seats[1]!.fields.remainingHp, `scenario ${n}`).toBeUndefined();
        expect(log.seats[0]!.fields.remainingHp).toMatchObject({ kind: "number" });
      }
    }
    expect(log.status).toBe("won");
  }, 300_000);

  it("a lost expert scenario 5 ends the campaign; a lost standard one is retried (MC40 p. 18)", () => {
    for (const [modes, status] of [
      [EXPERT, "lost"],
      [STANDARD, "active"],
    ] as const) {
      const log = walk(modes, 2, [
        ["Gear Up", ["40192b"]],
        ["Mission Prep", ["40193b"]],
        ["Assemble the Team", ["40190b"]],
        ["Practice Maneuvers", ["40194b"]],
      ]);
      const game = playNode(log, "Prepare Defenses", { defeat: false, maxDriver: 8 });
      const lost = loseNode(game);
      expect(lost.log.status).toBe(status);
      if (status === "lost") {
        expect(lost.log.position.nextNodeId).toBeNull();
        expect(
          lost.log.history.at(-1)?.steps.some((step) => step.instructionId === "mc40.s5.defeat.lose-campaign"),
        ).toBe(true);
      } else {
        expect(lost.log.position.nextNodeId).toBe("stryfe");
        expect(lost.log.history.at(-1)?.outcome).toBe("lost");
      }
    }
  }, 180_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 7. A 4-player leg: Pouches per player, Black Tom and Willows at players + 1, the Morlock searches
// ---------------------------------------------------------------------------------------------------------------

describe("a 4-player leg (MC40 pp. 9, 11, 14)", () => {
  it("scenario 1 sets aside a Pouches per player, scenario 2 searches once per Morlock, scenario 3 deals players + 1 cards", () => {
    let log = newLog(STANDARD, 4);
    const first = playNode(log, "Gear Up", { defeat: true, maxDriver: 6 });
    expect(count(setAsideCodes(first.setup.state), "40196"), "one Pouches per player").toBe(4);
    log = winNode(first, (s) => withSiegeEnd(s, ["40071a", "40073a", "40075a"], 4)).log;
    expect(numberOf(log, "morlocksSaved")).toBe(4);

    const second = playNode(log, "Mission Prep", { defeat: true, maxDriver: 6 });
    const noMorlocks = setup(
      walk(STANDARD, 4, [
        [
          "Gear Up",
          ["40192b"],
          [
            listRecord("mc40.s1.victory.marauders", "maraudersDefeated", ["40071a", "40073a", "40075a"]),
            numberRecord("mc40.s1.victory.morlocks", "morlocksSaved", 0),
          ],
        ],
      ]),
      "Mission Prep",
    ).state;
    expect(handTotal(second.setup.state) - handTotal(noMorlocks), "four searches").toBe(4);
    expect(count(setAsideCodes(second.setup.state), "40196"), "Pouches per player (earned)").toBe(4);
    log = winNode(second).log;

    const third = playNode(log, "Assemble the Team", { defeat: true, maxDriver: 6 });
    const dealt = dealtCodes(third.setup.state);
    expect(dealt.map((cardsDealt) => cardsDealt.length)).toEqual([1, 1, 1, 1]);
    for (const [card] of dealt) expect([BLACK_TOM, WILLOW]).toContain(card);
    const together = [...dealt.flat(), ...encounterDeckCodes(third.setup.state)];
    expect(count(together, BLACK_TOM)).toBe(1);
    expect(count(together, WILLOW)).toBe(4); // 5 cards taken, 4 dealt, 1 shuffled back; the other Willows are in the deck unchanged
    expect(encounterDeckCodes(third.setup.state).filter((c) => c === BLACK_TOM || c === WILLOW)).toHaveLength(1);
  }, 240_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 8. The known gap: a CampaignDefinition cannot name a required modular set (MC40 p. 14)
// ---------------------------------------------------------------------------------------------------------------

describe("Black Tom Cassidy is required for the campaign Juggernaut (MC40 p. 14; the known gap)", () => {
  const atThree = (): CampaignLog =>
    walk(STANDARD, 2, [
      ["Gear Up", ["40192b"]],
      ["Mission Prep", ["40193b"]],
    ]);

  it("passed (the builder's default and an explicit pick agree): each player is dealt one of Black Tom or a Willow", () => {
    for (const modular of [undefined, ["black_tom_cassidy"]] as const) {
      const { state } = setup(atThree(), "Assemble the Team", { ...(modular ? { modular } : {}) });
      expect(
        dealtCodes(state).map((cardsDealt) => cardsDealt.length),
        String(modular),
      ).toEqual([1, 1]);
    }
  }, 60_000);

  it("not passed (another modular set picked): nothing is dealt and nothing fails, so the campaign scenario silently loses Black Tom", () => {
    const { state } = setup(atThree(), "Assemble the Team", { modular: ["bomb_scare"] });
    expect(dealtCodes(state)).toEqual([[], []]);
    expect(count(encounterDeckCodes(state), BLACK_TOM)).toBe(0);
    expect(count(encounterDeckCodes(state), WILLOW)).toBe(0);
  }, 60_000);

  // MC40 p. 14: Black Tom Cassidy "is required when playing Juggernaut in campaign mode". The campaign start (what the
  // builder is handed) names no such set, so nothing makes a game builder include it: owner `game-rules-architect`
  // (a `CampaignNode` field for a required modular set, §3.43).
  it.fails("the campaign's start of scenario 3 names the Black Tom Cassidy set among the sets it requires", () => {
    const start = startGameFromLog(DEF, compose(atThree(), taking("Assemble the Team")).value);
    expect([...start.encounterSets.deck, ...start.encounterSets.setAside]).toContain("black_tom_cassidy");
  });
});
