/**
 * The campaign runner (design §7, §11 step 4): headless, deterministic, and the only thing that ever changes a
 * `CampaignLog`.
 *
 * Four functions make one loop:
 *
 * ```
 * CampaignLog ──resolveBetweenGames──▶ CampaignLog with an `attempt`
 *                                          │  startGameFromLog ──▶ createGame({ …, campaign })
 *                                          │                                   play / save / resume
 *                                          └──────── campaignResultOf ──▶ applyCampaignResult ──▶ CampaignLog'
 * ```
 *
 * **Re-entry is re-running.** A between-games step list that reaches a `choose` with no recorded answer returns
 * that choice as plain data and changes nothing; the caller answers it and calls the same function again with the
 * enlarged answer list, and the whole list runs from the beginning. Nothing partial is ever persisted, so
 * `(log, answers)` is the complete input — which is exactly why a campaign replays from its seed plus the answers
 * its history recorded, and why a client cannot reroll a `random` op by reloading.
 *
 * No campaign and no card is named here. Every rulebook citation is an example of the *shape* being interpreted.
 */

import type { CardId, PlayModes, ScenarioId } from "@mc/content";
import type {
  CampaignAttempt,
  CampaignDefinition,
  CampaignGameInput,
  CampaignGameResult,
  CampaignGrant,
  CampaignHistoryEntry,
  CampaignInstruction,
  CampaignLog,
  CampaignLogSnapshot,
  CampaignLogView,
  CampaignNode,
  CampaignSeat,
  CampaignSeatInput,
  LogValue,
  LogWrite,
  ResolvedInstruction,
} from "../campaign.js";
import { CAMPAIGN_LOG_SCHEMA, CAMPAIGN_WINDOW_ORDER } from "../campaign.js";
import { EngineInvariantError } from "../errors.js";
import { createRng, nextUint32 } from "../rng.js";
import { applyLogWrite, fieldDefOf, snapshotOf, workingOf, workingOfSnapshot, type CampaignWorkingLog } from "./log.js";
import {
  availableNodeIds,
  campaignAnswerMap,
  campaignChoiceKey,
  evaluateCampaignPredicate,
  runCampaignInstructions,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignPendingChoice,
  type CampaignRun,
  type CampaignRunPhase,
} from "./ops.js";

export type { CampaignChoiceAnswer, CampaignChoiceKey, CampaignDeps, CampaignPendingChoice } from "./ops.js";
export { CAMPAIGN_ACCEPT, campaignChoiceKey } from "./ops.js";
export { campaignResultOf } from "./result.js";

/**
 * Either the runner finished the step list, or it needs one answer first.
 *
 * Deliberately one choice at a time rather than "every choice that is currently open": a later choice's options
 * can depend on an earlier choice (a campaign set excludes what was just granted), so offering them all at once
 * would offer options that are already wrong.
 */
export type CampaignRunnerResult<T> =
  | { readonly kind: "done"; readonly value: T }
  | { readonly kind: "pending"; readonly choice: CampaignPendingChoice };

/** The reserved instruction id of the runner's own "which scenario next?" prompt (MC60 p. 9 step 4). */
export const CAMPAIGN_NEXT_NODE_INSTRUCTION = "campaign.nextNode";

// ------------------------------------------------------------------------------------------------------------
// Creating a log
// ------------------------------------------------------------------------------------------------------------

export interface CampaignSeatSetup {
  /** 1-based, and the campaign log's own numbering (MC10 p. 17), not the table order. */
  readonly seatNumber: number;
  readonly identityCardId: CardId;
  /** The campaign's own **copy** of the deck (design Q5): editing the standalone deck never changes a campaign. */
  readonly deck: CampaignSeat["deck"];
}

export interface CampaignLogSetup {
  readonly id: string;
  readonly seats: readonly CampaignSeatSetup[];
  /** Campaign-level modes, in practice `campaign.expertCampaign`. Per-scenario modes are chosen per attempt. */
  readonly modes: PlayModes;
  /** `@mc/content`'s pool version, so errata landing under a running campaign is detected rather than applied. */
  readonly poolVersion: string;
  /** The campaign RNG seed. Every `random` op in the whole campaign derives from it. */
  readonly seed: number;
}

/** A fresh log at the start of a campaign, positioned on the first node a `linear` graph plays. */
export function createCampaignLog(definition: CampaignDefinition, setup: CampaignLogSetup): CampaignLog {
  const first = definition.graph.kind === "linear" ? (definition.graph.nodes[0]?.id ?? null) : null;
  return {
    schema: CAMPAIGN_LOG_SCHEMA,
    id: setup.id,
    campaignId: definition.campaignId,
    definitionVersion: definition.version,
    poolVersion: setup.poolVersion,
    modes: setup.modes,
    seats: setup.seats.map((seat) => ({
      seatNumber: seat.seatNumber,
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      grants: [],
      fields: {},
    })),
    shared: {},
    hidden: {},
    removedFromCampaign: [],
    position: { nextNodeId: first, resolved: {}, progress: {} },
    seed: setup.seed,
    rng: createRng(setup.seed),
    history: [],
    status: "active",
  };
}

// ------------------------------------------------------------------------------------------------------------
// Shared plumbing
// ------------------------------------------------------------------------------------------------------------

function newRun(
  definition: CampaignDefinition,
  deps: CampaignDeps,
  modes: PlayModes,
  answers: readonly CampaignChoiceAnswer[],
  phase: CampaignRunPhase,
  working: CampaignWorkingLog,
  nodeId: string,
  records: ReadonlyMap<string, readonly LogWrite[]> = new Map(),
  sittingOut: readonly number[] = [],
): CampaignRun {
  return {
    definition,
    deps,
    modes,
    answers: campaignAnswerMap(answers),
    phase,
    records,
    sittingOut,
    working,
    nodeId,
    steps: [],
    pending: null,
    instructions: [],
    composedVillain: null,
    composedEncounterSets: { deck: [], setAside: [] },
    slots: new Map(),
    instructionId: "",
    writes: [],
    choices: [],
    removed: [],
    grants: [],
    seatScope: null,
  };
}

const nodeOf = (definition: CampaignDefinition, nodeId: string): CampaignNode => {
  const node = definition.graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new EngineInvariantError(`campaign ${definition.campaignId} has no node "${nodeId}"`);
  return node;
};

/** Writes the working log back over the log it came from. The identity fields a runner never touches stay put. */
const withWorking = (log: CampaignLog, working: CampaignWorkingLog): CampaignLog => ({
  ...log,
  seats: working.seats,
  shared: working.shared,
  hidden: working.hidden,
  removedFromCampaign: working.removedFromCampaign,
  position: { nextNodeId: working.nextNodeId, resolved: working.resolved, progress: working.progress },
  rng: working.rng,
  status: working.status,
});

/**
 * MC32 p. 5's "use it or lose it": a `thisGame` grant is in the deck "for that game", so it leaves both the
 * grant list and the deck when the game ends — whatever the outcome, because the game happened either way.
 */
function expireThisGameGrants(working: CampaignWorkingLog): void {
  working.seats = working.seats.map((seat) => {
    const expiring = seat.grants.filter((grant) => grant.permanence === "thisGame");
    if (expiring.length === 0) return seat;
    const owed = new Map<string, number>();
    for (const grant of expiring) owed.set(grant.cardId, (owed.get(grant.cardId) ?? 0) + 1);
    return {
      ...seat,
      deck: {
        ...seat.deck,
        cards: seat.deck.cards.flatMap((line) => {
          const back = owed.get(line.cardId) ?? 0;
          const left = line.quantity - back;
          return left > 0 ? [{ ...line, quantity: left }] : [];
        }),
      },
      grants: seat.grants.filter((grant) => grant.permanence !== "thisGame"),
    };
  });
}

// ------------------------------------------------------------------------------------------------------------
// Between games: composing the next scenario
// ------------------------------------------------------------------------------------------------------------

/**
 * The instructions a `kind: "instructionList"` log field adds to this node (MC27 p. 22's reputation track, the
 * only place a box makes the instruction list itself a function of the log).
 *
 * Shared fields first, then each seat's, in seat order, and each id once: an instruction that resolved twice
 * because two seats named it would place its threat twice, and no rulebook prints that. Flagged as the engine's
 * reading rather than a printed rule.
 */
function conditionalInstructions(
  definition: CampaignDefinition,
  working: CampaignWorkingLog,
): readonly CampaignInstruction[] {
  const named: string[] = [];
  const collect = (fields: Readonly<Record<string, LogValue>>): void => {
    for (const [field, value] of Object.entries(fields)) {
      if (value.kind !== "instructionList") continue;
      if (fieldDefOf(definition, field).type.kind !== "instructionList") continue;
      named.push(...value.ids);
    }
  };
  collect(working.shared);
  collect(working.hidden);
  for (const seat of working.seats) collect(seat.fields);
  return [...new Set(named)].map((id) => {
    const instruction = definition.conditionalInstructions?.[id];
    if (!instruction) {
      throw new EngineInvariantError(
        `campaign ${definition.campaignId} log names conditional instruction "${id}", which it does not declare`,
      );
    }
    return instruction;
  });
}

/** Every log field an `EffectSpec` tree reads, found structurally so no spec shape has to be enumerated here. */
function fieldsReadBy(effects: unknown, found: Set<string> = new Set()): ReadonlySet<string> {
  if (Array.isArray(effects)) {
    for (const item of effects) fieldsReadBy(item, found);
    return found;
  }
  if (effects !== null && typeof effects === "object") {
    const record = effects as Record<string, unknown>;
    if (record.kind === "campaignLog" && typeof record.field === "string") found.add(record.field);
    for (const value of Object.values(record)) fieldsReadBy(value, found);
  }
  return found;
}

/**
 * The frozen view a game reads.
 *
 * A `hidden` field (MC50 p. 5's A.I.M. envelope) is included only when one of *this* game's instructions reads
 * it: the envelope stays shut otherwise, and the view lands in the save's replay baseline, so anything put here
 * is readable forever.
 */
function logViewFor(
  definition: CampaignDefinition,
  working: CampaignWorkingLog,
  instructions: readonly ResolvedInstruction[],
): CampaignLogView {
  const read = fieldsReadBy(instructions.map((instruction) => instruction.effects));
  const shared: Record<string, LogValue> = { ...working.shared };
  for (const field of read) {
    const value = working.hidden[field];
    if (value !== undefined && fieldDefOf(definition, field).hidden) shared[field] = value;
  }
  return {
    shared,
    perSeat: working.seats.map((seat) => ({ seatNumber: seat.seatNumber, fields: { ...seat.fields } })),
  };
}

const seatInputOf = (seat: CampaignSeat): CampaignSeatInput => ({
  seatNumber: seat.seatNumber,
  identityCardId: seat.identityCardId,
  deck: seat.deck.cards.flatMap((line) => Array.from({ length: line.quantity }, () => line.cardId)),
  aspects: seat.deck.aspects,
  grantedCardIds: seat.grants.map((grant) => grant.cardId),
});

const windowIndex = (instruction: ResolvedInstruction): number => CAMPAIGN_WINDOW_ORDER.indexOf(instruction.window);

/**
 * Composes the next game.
 *
 * For a `choice` graph the order is the printed one (MC60 p. 9): the graph's `beforeChoice` block first, then the
 * node, then that node's `composition`, then its setup. `logBefore` is taken before any of it, so
 * `retryBaseline: "nodeStart"` restores the log to before the whole between-games block — including the
 * progression draw, which then re-runs from the restored RNG and reproduces itself exactly.
 */
export function resolveBetweenGames(
  definition: CampaignDefinition,
  log: CampaignLog,
  deps: CampaignDeps,
  modes: PlayModes = log.modes,
  answers: readonly CampaignChoiceAnswer[] = [],
): CampaignRunnerResult<CampaignLog> {
  if (log.definitionVersion !== definition.version) {
    throw new EngineInvariantError(
      `campaign log ${log.id} was written against definition version ${log.definitionVersion}, not ${definition.version}`,
    );
  }
  if (log.status !== "active") throw new EngineInvariantError(`campaign ${log.id} is ${log.status}, not active`);
  if (log.attempt) throw new EngineInvariantError(`campaign ${log.id} already has a game in progress`);

  const working = workingOf(log);
  const logBefore = snapshotOf(working, log.definitionVersion);
  const run = newRun(definition, deps, modes, answers, "beforeGame", working, "");

  const graph = definition.graph;
  if (graph.kind === "choice") {
    runCampaignInstructions(run, graph.beforeChoice);
    if (run.pending) return { kind: "pending", choice: run.pending };
    if (run.working.status !== "active") return { kind: "done", value: withWorking(log, run.working) };
  }

  const chosen = chooseNode(run, answers);
  if (chosen.kind !== "node") return chosen.result(log, run);
  run.nodeId = chosen.nodeId;
  const node = nodeOf(definition, chosen.nodeId);

  runCampaignInstructions(run, node.composition ?? []);
  if (run.pending) return { kind: "pending", choice: run.pending };
  runCampaignInstructions(run, [
    ...(definition.everyNodeSetup ?? []),
    ...conditionalInstructions(definition, run.working),
    ...node.setup,
  ]);
  if (run.pending) return { kind: "pending", choice: run.pending };
  if (run.working.status !== "active") return { kind: "done", value: withWorking(log, run.working) };

  const instructions = [...run.instructions].sort((a, b) => windowIndex(a) - windowIndex(b));
  // The in-game seed comes out of the campaign's own RNG, so a game is not a second, unrecorded source of randomness.
  const [seed, rng] = nextUint32(run.working.rng);
  run.working.rng = rng;

  const input: CampaignGameInput = {
    campaignId: definition.campaignId,
    nodeId: node.id,
    definitionVersion: definition.version,
    modes,
    log: logViewFor(definition, run.working, instructions),
    instructions,
    removedFromCampaign: run.working.removedFromCampaign,
    seats: run.working.seats.map(seatInputOf),
    seed,
  };
  const attempt: CampaignAttempt = {
    nodeId: node.id,
    modes,
    logBefore,
    steps: run.steps,
    input,
    composedVillain: run.composedVillain,
    composedEncounterSets: run.composedEncounterSets,
  };
  return { kind: "done", value: { ...withWorking(log, run.working), attempt } };
}

type NodeChoice =
  | { readonly kind: "node"; readonly nodeId: string }
  | {
      readonly kind: "other";
      readonly result: (log: CampaignLog, run: CampaignRun) => CampaignRunnerResult<CampaignLog>;
    };

/**
 * Which node is played next.
 *
 * A `linear` graph plays the next unresolved node (MC10 p. 3: "in numerical order"). A `choice` graph offers the
 * available ones (MC60 p. 8), takes the only one when there is only one, and falls to the `finale` once nothing
 * else is available and its condition holds (MC60 p. 9 step 4). With neither, every node is resolved and the
 * campaign ends — `won` if every node was completed, `lost` otherwise, which is only the fallback for a box that
 * did not print an `endCampaign` instruction of its own (MC45 p. 20 is why the op exists).
 */
function chooseNode(run: CampaignRun, answers: readonly CampaignChoiceAnswer[]): NodeChoice {
  if (run.working.nextNodeId !== null) return { kind: "node", nodeId: run.working.nextNodeId };
  const graph = run.definition.graph;
  const unresolved = availableNodeIds(run, "unresolved");
  if (graph.kind === "linear") {
    const next = unresolved[0];
    return next === undefined ? { kind: "other", result: finish } : { kind: "node", nodeId: next };
  }
  const available = availableNodeIds(run, "available");
  if (available.length === 1) return { kind: "node", nodeId: available[0] as string };
  if (available.length === 0) {
    const finale = graph.finale;
    if (finale && unresolved.includes(finale.nodeId) && evaluateCampaignPredicate(run, finale.when)) {
      return { kind: "node", nodeId: finale.nodeId };
    }
    return { kind: "other", result: finish };
  }
  const key = { instructionId: CAMPAIGN_NEXT_NODE_INSTRUCTION, slot: "node", seatNumber: null };
  const answer = answers.find((candidate) => campaignChoiceKey(candidate) === campaignChoiceKey(key));
  const picked = answer?.picked[0];
  if (picked !== undefined && available.includes(picked)) return { kind: "node", nodeId: picked };
  return {
    kind: "other",
    result: () => ({
      kind: "pending",
      choice: {
        ...key,
        text: "Choose which scenario to play next.",
        citation: "RRG 1.8 p. 29",
        chooser: "group",
        options: available,
        count: 1,
        optional: false,
      },
    }),
  };
}

/** Every node is resolved and no instruction said otherwise: the campaign is over. */
const finish = (log: CampaignLog, run: CampaignRun): CampaignRunnerResult<CampaignLog> => {
  const won = run.definition.graph.nodes.every((node) => run.working.resolved[node.id] === "completed");
  run.working.status = won ? "won" : "lost";
  run.working.nextNodeId = null;
  return { kind: "done", value: withWorking(log, run.working) };
};

// ------------------------------------------------------------------------------------------------------------
// Starting the game
// ------------------------------------------------------------------------------------------------------------

/** Everything a caller needs to build a `GameSetupConfig` for the attempt the log is holding. */
export interface CampaignGameStart {
  readonly nodeId: string;
  readonly node: CampaignNode;
  readonly modes: PlayModes;
  /** Goes straight into `GameSetupConfig.campaign`, and from there into the game's replay baseline. */
  readonly input: CampaignGameInput;
  /** The node's fixed scenario, or null for a `composed` node whose pieces are the two fields below. */
  readonly scenarioId: ScenarioId | null;
  /** MC60 p. 9 step 5's chosen villain, as the `composeVillain` op named it. */
  readonly villain: string | null;
  /**
   * MC60 p. 9 step 6's / MC16 p. 8's gathered sets, as the `composeEncounterSets` ops named them, in order, split
   * by `into`: `deck` cards belong in `GameSetupConfig.encounterDeck` before it is shuffled, `setAside` cards in
   * `GameSetupConfig.setAside` (design note on `composeEncounterSets`, above).
   */
  readonly encounterSets: { readonly deck: readonly string[]; readonly setAside: readonly string[] };
}

export function startGameFromLog(definition: CampaignDefinition, log: CampaignLog): CampaignGameStart {
  const attempt = log.attempt;
  if (!attempt) throw new EngineInvariantError(`campaign ${log.id} has no game composed to start`);
  const node = nodeOf(definition, attempt.nodeId);
  return {
    nodeId: attempt.nodeId,
    node,
    modes: attempt.modes,
    input: attempt.input,
    scenarioId: node.scenario.kind === "fixed" ? node.scenario.scenarioId : null,
    villain: attempt.composedVillain,
    encounterSets: attempt.composedEncounterSets,
  };
}

// ------------------------------------------------------------------------------------------------------------
// After the game
// ------------------------------------------------------------------------------------------------------------

export interface CampaignResultMeta {
  /** Epoch milliseconds, supplied by the caller. The engine never reads a clock, so a replay is reproducible. */
  readonly at: number;
  /** The saved game this attempt was played as, so the campaign browser can replay it. */
  readonly gameId?: string | null;
}

const recordsByInstruction = (result: CampaignGameResult): ReadonlyMap<string, readonly LogWrite[]> => {
  const map = new Map<string, LogWrite[]>();
  for (const record of result.records) {
    const list = map.get(record.instructionId) ?? [];
    list.push(record.write);
    map.set(record.instructionId, list);
  }
  return map;
};

/**
 * The elimination policy's rejoin write (design §4.6b), run after the node's own Victory instructions so it
 * overrides anything they wrote for the seat. A `record` step whose writes `campaignResultOf` computed under the
 * policy's id; it only exists when a seat sat out, so an ordinary win's trace is unchanged.
 */
const rejoinInstruction = (
  definition: CampaignDefinition,
  sittingOut: readonly number[],
): readonly CampaignInstruction[] => {
  const policy = definition.elimination;
  if (!policy?.rejoinAtPrintedHitPoints || sittingOut.length === 0) return [];
  return [
    {
      id: policy.id,
      text: policy.text,
      citation: policy.citation,
      ...(policy.whenModes ? { whenModes: policy.whenModes } : {}),
      step: { kind: "record", writes: [] },
    },
  ];
};

/** Folds the writes a *game* made into the log. They stick whatever the outcome (RRG 1.8 p. 29; design §6.2). */
function applyInGameWrites(
  definition: CampaignDefinition,
  working: CampaignWorkingLog,
  result: CampaignGameResult,
): void {
  for (const write of result.logWrites) applyLogWrite(definition, working, write);
  for (const face of result.removedFromCampaign) {
    if (
      !working.removedFromCampaign.some((existing) => existing.cardId === face.cardId && existing.face === face.face)
    ) {
      working.removedFromCampaign = [...working.removedFromCampaign, face];
    }
  }
}

/** A won node is completed whether or not the box printed "check the Completed box", then the graph advances. */
function advanceAfterWin(run: CampaignRun): void {
  if (run.working.status !== "active") {
    run.working.nextNodeId = null;
    return;
  }
  if (run.working.resolved[run.nodeId] === undefined) {
    run.working.resolved = { ...run.working.resolved, [run.nodeId]: "completed" };
  }
  const nodes = run.definition.graph.nodes;
  const unresolved = nodes.filter((node) => run.working.resolved[node.id] === undefined);
  if (unresolved.length === 0) {
    run.working.status = nodes.every((node) => run.working.resolved[node.id] === "completed") ? "won" : "lost";
    run.working.nextNodeId = null;
    return;
  }
  // A `choice` graph asks again next time (MC60 p. 9 step 4); a linear one simply moves on (MC10 p. 3).
  run.working.nextNodeId = run.definition.graph.kind === "linear" ? (unresolved[0]?.id ?? null) : null;
}

/**
 * Folds a finished game into the log (design §7.2).
 *
 * On a **win**: the game's own writes, then the node's victory instructions, then the graph advances.
 *
 * On a **loss**: the log is restored to `LossPolicy.retryBaseline` — `"nodeStart"`, the snapshot
 * `resolveBetweenGames` took before this attempt's instructions ran — and then three things are put back on top,
 * because RRG 1.8 p. 29 keeps a removal "even if players retry the scenario wherein that card was removed" and
 * design Q6 reads an in-game log write and a printed DEFEAT instruction the same way: every `removeFromCampaign`
 * (from the game *and* from this node's between-games steps), every in-game `recordInCampaignLog` write, and
 * whatever the `defeat` instructions write. Everything else — a reward chosen during the node, units spent during
 * it, a side scheme picked for it — is rolled back, which is MC40 p. 7's "they must choose the same player side
 * scheme … even if they defeated it during a game they lost".
 */
export function applyCampaignResult(
  definition: CampaignDefinition,
  log: CampaignLog,
  result: CampaignGameResult,
  meta: CampaignResultMeta,
  deps: CampaignDeps,
  answers: readonly CampaignChoiceAnswer[] = [],
): CampaignRunnerResult<CampaignLog> {
  const attempt = log.attempt;
  if (!attempt) throw new EngineInvariantError(`campaign ${log.id} has no game in progress to resolve`);
  if (result.nodeId !== attempt.nodeId) {
    throw new EngineInvariantError(
      `a result for campaign node "${result.nodeId}" cannot resolve the attempt at "${attempt.nodeId}"`,
    );
  }
  const node = nodeOf(definition, attempt.nodeId);
  const records = recordsByInstruction(result);
  const won = result.outcome === "won";

  let working = workingOf(log);
  if (!won) {
    const removed = [...working.removedFromCampaign];
    working = workingOfSnapshot(attempt.logBefore, log.status);
    working.removedFromCampaign = removed;
  }
  expireThisGameGrants(working);
  applyInGameWrites(definition, working, result);

  const sittingOut = won ? (result.sittingOut ?? []) : [];
  const run = newRun(
    definition,
    deps,
    attempt.modes,
    answers,
    "afterGame",
    working,
    attempt.nodeId,
    records,
    sittingOut,
  );
  const instructions: readonly CampaignInstruction[] = won
    ? [...(definition.everyNodeVictory ?? []), ...node.victory, ...rejoinInstruction(definition, sittingOut)]
    : definition.loss.retry === "byInstruction"
      ? [...(node.defeat ?? []), ...(definition.loss.everyNodeDefeat ?? [])]
      : [];
  runCampaignInstructions(run, instructions);
  if (run.pending) return { kind: "pending", choice: run.pending };

  if (won) advanceAfterWin(run);
  else if (run.working.status === "active") {
    // MC10 p. 3: "they may reset the scenario and try again". A node the DEFEAT instructions marked resolved
    // (MC60's third progression mark) is not replayed; a `choice` graph then asks for the next node again.
    run.working.nextNodeId =
      run.working.resolved[attempt.nodeId] === undefined
        ? attempt.nodeId
        : definition.graph.kind === "linear"
          ? (definition.graph.nodes.find((candidate) => run.working.resolved[candidate.id] === undefined)?.id ?? null)
          : null;
    if (run.working.nextNodeId === null && definition.graph.nodes.every((n) => run.working.resolved[n.id])) {
      run.working.status = definition.graph.nodes.every((n) => run.working.resolved[n.id] === "completed")
        ? "won"
        : "lost";
    }
  }

  const entry: CampaignHistoryEntry = {
    nodeId: attempt.nodeId,
    modes: attempt.modes,
    outcome: result.outcome,
    gameId: meta.gameId ?? null,
    logBefore: attempt.logBefore,
    steps: [...attempt.steps, ...run.steps],
    at: meta.at,
  };
  const { attempt: _finished, ...rest } = log;
  return {
    kind: "done",
    value: { ...withWorking(rest, run.working), history: [...log.history, entry] },
  };
}

/** The snapshot a retry restores, exposed so a client can show "this is where the scenario began". */
export const retryBaselineOf = (log: CampaignLog): CampaignLogSnapshot | null => log.attempt?.logBefore ?? null;

/** Grants a seat currently holds, for the deck-edit screen and for `DeckContext` (design §8). */
export const grantsOf = (log: CampaignLog, seatNumber: number): readonly CampaignGrant[] =>
  log.seats.find((seat) => seat.seatNumber === seatNumber)?.grants ?? [];
