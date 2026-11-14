/**
 * Shared staging for the wave 9 QA gap tests (`qa-gaps*.qa.test.ts`): one registry for every wave 9 scenario, four
 * distinct Core heroes as seats, and a few readers over the state. Nothing here changes a game; every test drives
 * real commands.
 */
import {
  applyCommand,
  cardOf,
  cardsInPlay,
  createGame,
  mainSchemeStage,
  maxHitPoints,
  legalActions,
  openEvidenceRows,
  outstandingForcedActions,
  replay,
  sessionApply,
  startSession,
  type GameSession,
  scale,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { AOS_EVIDENCE_COMBINATIONS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { mergeRegistries } from "../dsl/index.js";
import { playToOutcome } from "../testing/driver.js";
import { firstLegal, inst, settle, stackEncounterDeck, type Picker } from "../testing/harness.js";
import { WAVE8_ABILITIES } from "../wave8/index.js";
import { AOS_BUILTIN_PACK } from "./aos/pack.js";
import { wave9Scenario, type Wave9ScenarioOptions } from "./setup.js";
import { CAPTAIN_MARVEL, IRON_MAN, SHE_HULK, SPIDER_MAN, codeOf } from "./testing.js";
import { TT_BUILTIN_PACK } from "./tt/pack.js";

export const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE8_ABILITIES, AOS_BUILTIN_PACK.abilities, TT_BUILTIN_PACK.abilities),
};

export const SEATS = [SPIDER_MAN, IRON_MAN, CAPTAIN_MARVEL, SHE_HULK] as const;
export const PLAYER_IDS = ["p1", "p2", "p3", "p4"] as PlayerId[];

export interface OpenOptions {
  readonly seed?: number;
  readonly difficulty?: "standard" | "expert";
  readonly firstPlayerIndex?: number;
  readonly seats?: Wave9ScenarioOptions["players"];
}

/** A scenario past setup: every setup prompt answered with its first option, stopped at the first player phase. */
export function openScenario(scenario: string, players: number, options: OpenOptions = {}): GameState {
  const created = createGame(
    wave9Scenario(scenario, {
      players: options.seats ?? SEATS.slice(0, players),
      seed: options.seed ?? 1,
      ...(options.difficulty ? { difficulty: options.difficulty } : {}),
      ...(options.firstPlayerIndex !== undefined ? { firstPlayerIndex: options.firstPlayerIndex } : {}),
    }),
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

export const mainThreatOf = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;
export const targetThreatOf = (s: GameState): number => scale(mainSchemeStage(s).targetThreat, s.startingPlayerCount);
export const accelerationOf = (s: GameState): number => scale(mainSchemeStage(s).acceleration, s.startingPlayerCount);
export const villainHp = (s: GameState, id: InstanceId = s.activeVillainId): number => maxHitPoints(s, id, DEPS)!;

/** Every card in play (and in the villain area) with this card code. */
export const inPlayAll = (s: GameState, code: string): InstanceId[] =>
  cardsInPlay(s).filter((id) => codeOf(s, id) === code);
export const countersOf = (s: GameState, id: InstanceId): Readonly<Record<string, number>> => inst(s, id).counters;

/** The printed hand size of a player's identity in the form it is in. */
export function handSizeOf(s: GameState, player: PlayerId): number {
  const p = s.players.find((x) => x.playerId === player)!;
  const c = cardOf(s, p.identity.instanceId) as unknown as {
    hero: { handSize: number };
    alterEgo: { handSize: number };
  };
  return p.identity.form === "hero" ? c.hero.handSize : c.alterEgo.handSize;
}

/** Answers the pending prompt with `pick`. */
export function resolveWith(s: GameState, pick: Picker): { state: GameState; events: GameEvent[] } {
  const choice = s.pendingChoice!;
  const r = applyCommand(
    s,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(s) },
    DEPS,
  );
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return { state: r.state, events: [...r.events] };
}

/**
 * Plays rounds with nothing done (every player ends their turn at once, a Forced Action still owed is performed with
 * the engine's own example) until the round counter reaches `untilRound`, or the game ends. Returns the first player
 * seen at the start of each round and every event.
 */
export function idleRounds(
  start: GameState,
  untilRound: number,
  pick: Picker = firstLegal,
): { state: GameState; events: GameEvent[]; firstPlayers: PlayerId[] } {
  let s = start;
  const events: GameEvent[] = [];
  const firstPlayers: PlayerId[] = [s.firstPlayerId];
  let round = s.round;
  for (let guard = 0; s.round < untilRound && !s.outcome && guard < 400; guard++) {
    let next: { state: GameState; events: readonly GameEvent[] };
    if (s.pendingChoice) {
      next = resolveWith(s, pick);
    } else if (s.step.phase === "player" && s.step.kind === "turn") {
      const playerId = s.step.activePlayerId;
      const owed = outstandingForcedActions(s, playerId, DEPS)[0];
      const command: Command = owed ? owed.example : { type: "endTurn", playerId };
      const r = applyCommand(s, command, DEPS);
      if (!r.ok) throw new Error(`${command.type}: ${r.error.code}: ${r.error.message}`);
      next = r;
    } else {
      throw new Error(`stuck at ${s.step.phase}/${s.step.kind}`);
    }
    s = next.state;
    events.push(...next.events);
    if (s.round !== round) {
      round = s.round;
      firstPlayers.push(s.firstPlayerId);
    }
  }
  return { state: s, events, firstPlayers };
}

const GREEDY_CAP = 1200;

/** Seeded greedy games of these scenarios at three players (seed 1) and four (seed 2): see qa-gaps-greedy-*.qa.test.ts. */
export function greedySoak(title: string, scenarios: readonly string[]): void {
  describe(title, () => {
    for (const scenario of scenarios)
      for (const [n, seed] of [
        [3, 1],
        [4, 2],
      ] as const)
        it(`${scenario}, ${n} players, seed ${seed}: plays to an outcome or ${GREEDY_CAP} commands, replays deep-equal`, () => {
          const initial = openScenario(scenario, n, { seed });
          const run = playToOutcome(initial, DEPS, { maxCommands: GREEDY_CAP });
          const end = run.session.state;
          expect(run.outcome !== null || run.commands >= GREEDY_CAP, "an outcome or the cap").toBe(true);
          if (run.outcome) expect(end.pendingChoice, "no prompt left open after the outcome").toBeNull();
          const replayed = replay(run.session.log, DEPS);
          if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
          expect(replayed.state).toEqual(end);
          console.log(
            `GREEDY ${scenario} ${n}p seed ${seed}: ${run.outcome ? `${run.outcome.result}/${(run.outcome as { reason?: string }).reason}` : "cap"} round ${run.rounds} commands ${run.commands}`,
          );
        });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// A purposeful player: the greedy driver's choices, with the basic attack / thwart redirected by a policy
// ---------------------------------------------------------------------------------------------------------------

/**
 * Asks the greedy driver (testing/driver.ts) for its next command from `state` (one command of a fresh run: its per-turn
 * memory is empty, so a Hero Action it already used this turn may be proposed again; the engine refuses what it cannot
 * pay). The same prompts are answered the same way.
 */
export function greedyNext(state: GameState): Command {
  const run = playToOutcome(state, DEPS, { maxCommands: 1 });
  const command = run.session.log.commands[0];
  if (!command) throw new Error("the greedy driver issued nothing");
  return command;
}

export interface GuidedResult {
  readonly session: GameSession;
  readonly outcome: GameState["outcome"];
  readonly commands: number;
  /** The `redirect` hook's view of every turn: (round, command type) pairs, for the report. */
  readonly rounds: number;
}

/**
 * Plays like the greedy driver except that every basic attack or thwart it proposes goes through `redirect`, which may
 * return a different command for the same actor (null keeps the greedy one). The redirect must propose commands the
 * engine accepts; a refused one falls back to the greedy command. Deterministic, and the log replays.
 */
export function playGuided(
  initial: GameState,
  redirect: (state: GameState, proposed: Command) => Command | null,
  maxCommands: number,
  until?: (state: GameState) => boolean,
): GuidedResult {
  let session = startSession(initial);
  let commands = 0;
  while (!session.state.outcome && commands < maxCommands && !until?.(session.state)) {
    const state = session.state;
    let command = greedyNext(state);
    if (command.type === "basicAttack" || command.type === "basicThwart") {
      const alt = redirect(state, command);
      if (alt && applyCommand(state, alt, DEPS).ok) command = alt;
    }
    const result = sessionApply(session, command, DEPS);
    if (!result.ok) throw new Error(`guided ${command.type} refused: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
  }
  return { session, outcome: session.state.outcome, commands, rounds: session.state.round };
}

/**
 * Plays with `decide` first (it may return any command for the current prompt or turn, null to defer to the greedy
 * driver). A command the engine refuses is dropped in favor of the greedy one. Deterministic; the log replays.
 */
export function playPolicy(
  initial: GameState,
  decide: (state: GameState) => Command | null,
  maxCommands: number,
  until?: (state: GameState) => boolean,
): GuidedResult {
  let session = startSession(initial);
  let commands = 0;
  // The greedy driver remembers what it used this turn; a fresh run per command does not, so a free no-op action could be
  // proposed forever. A turn longer than 30 commands is ended instead.
  let turnKey = "";
  let inTurn = 0;
  while (!session.state.outcome && commands < maxCommands && !until?.(session.state)) {
    const state = session.state;
    let command = decide(state);
    if (command && !applyCommand(state, command, DEPS).ok) command = null;
    if (!command && !state.pendingChoice && state.step.phase === "player" && state.step.kind === "turn") {
      const key = `${state.round}:${state.step.activePlayerId}`;
      inTurn = key === turnKey ? inTurn + 1 : 1;
      turnKey = key;
      if (inTurn > 30) command = { type: "endTurn", playerId: state.step.activePlayerId };
    }
    command ??= greedyNext(state);
    const result = sessionApply(session, command, DEPS);
    if (!result.ok) throw new Error(`policy ${command.type} refused: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
  }
  return { session, outcome: session.state.outcome, commands, rounds: session.state.round };
}

/** The `resolveChoice` command that selects these options of the pending prompt. */
export function choose(state: GameState, ...optionIds: readonly string[]): Command {
  const c = state.pendingChoice!;
  return { type: "resolveChoice", playerId: c.playerId, choiceId: c.choiceId, selectedOptionIds: optionIds };
}

// ---------------------------------------------------------------------------------------------------------------
// Driving a single scenario state by commands, with a small prompt plan
// ---------------------------------------------------------------------------------------------------------------

export interface Plan {
  /** Optional triggers whose id contains one of these texts are taken; every other one is declined. */
  readonly take?: readonly string[];
  /** A chooseOption option whose label starts with one of these texts, in order of preference. */
  readonly options?: readonly string[];
  /** Card targets / cards chosen when offered, in order of preference (by instance id). */
  readonly targets?: readonly InstanceId[];
  /** A chooseCards option whose label contains one of these texts. */
  readonly cards?: readonly string[];
  /** Hand cards to pay with (by instance id) when a payment is asked; else this many from the front of the options. */
  readonly payWith?: readonly InstanceId[];
  readonly pay?: number;
  /** The defender declared (instance id); default none. */
  readonly defender?: InstanceId;
  /** Every prompt kind and option label seen, for assertions. */
  readonly seen?: string[];
}

export const planned =
  (plan: Plan = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options;
    plan.seen?.push(`${choice.prompt.kind}: ${offered.map((o) => o.label).join(" | ")}`);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = offered.find((o) => (plan.take ?? []).some((t) => (o.optionId as string).includes(t)));
        return hit ? [hit.optionId] : [];
      }
      case "declareDefender": {
        const hit = plan.defender
          ? offered.find((o) => o.ref.kind === "card" && o.ref.instanceId === plan.defender)
          : undefined;
        return hit ? [hit.optionId] : ["decline"];
      }
      case "chooseOption": {
        for (const wanted of plan.options ?? []) {
          const hit = offered.find((o) => o.label.startsWith(wanted));
          if (hit) return [hit.optionId];
        }
        const decline = offered.find((o) => o.label.startsWith("Do not"));
        return decline ? [decline.optionId] : firstLegal(s);
      }
      case "chooseTarget": {
        for (const target of plan.targets ?? []) {
          const hit = offered.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
          if (hit) return [hit.optionId];
        }
        return firstLegal(s);
      }
      case "chooseCards": {
        for (const wanted of plan.cards ?? []) {
          const hit = offered.find((o) => o.label.includes(wanted));
          if (hit) return [hit.optionId];
        }
        return firstLegal(s);
      }
      case "spendResources":
      case "payForAbility":
      case "payForCard": {
        const hands = offered.map((o) => o.optionId as string).filter((id) => id.startsWith("hand:"));
        if (plan.payWith) return plan.payWith.map((id) => `hand:${id}`).filter((id) => hands.includes(id));
        return hands.slice(0, plan.pay ?? 0);
      }
      default:
        return firstLegal(s);
    }
  };

/** Runs commands in order, answering every prompt by `plan`; the state after and every event. */
export function act(
  state: GameState,
  plan: Plan | Picker,
  ...commands: readonly Command[]
): { state: GameState; events: GameEvent[] } {
  const pick = typeof plan === "function" ? plan : planned(plan);
  let current = state;
  const events: GameEvent[] = [];
  const settleAll = () => {
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 200) throw new Error(`prompts did not settle (${current.pendingChoice.prompt.kind})`);
      const r = resolveWith(current, pick);
      current = r.state;
      events.push(...r.events);
    }
  };
  settleAll();
  for (const command of commands) {
    const r = applyCommand(current, command, DEPS);
    if (!r.ok) throw new Error(`${command.type} refused: ${r.error.code}: ${r.error.message}`);
    current = r.state;
    events.push(...r.events);
    settleAll();
  }
  return { state: current, events };
}

export function ofType<T extends GameEvent["type"]>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

/**
 * Ends every remaining player turn and plays the villain phase with `dealt` as the card(s) dealt (the boost cards the
 * activations draw come first: a dry run counts them, and that many cards of `filler` go on top of the encounter deck
 * ahead of `dealt`). Returns the state in the next player phase, ready for the first player, and the events.
 */
export function villainPhaseDealing(
  state: GameState,
  dealt: readonly string[],
  plan: Plan | Picker = {},
  filler = "01186",
): { state: GameState; events: GameEvent[] } {
  const turns = (s: GameState): Command[] => {
    const step = s.step;
    if (step.phase !== "player" || step.kind !== "turn") throw new Error("not a player turn");
    return [step.activePlayerId, ...step.remainingPlayerIds].map((playerId) => ({ type: "endTurn", playerId }));
  };
  const copies = Object.keys(state.instances).filter(
    (id) => state.instances[id as InstanceId]!.cardId === filler,
  ).length;
  const dry = act(
    stackEncounterDeck(state, ...Array.from({ length: Math.min(copies, 12) }, () => filler)),
    {},
    ...turns(state),
  );
  const firstReveal = dry.events.findIndex((e) => e.type === "encounterCardRevealed");
  const boosts = ofType(firstReveal < 0 ? dry.events : dry.events.slice(0, firstReveal), "boostCardDealt").length;
  const stacked = stackEncounterDeck(state, ...Array.from({ length: boosts }, () => filler), ...dealt);
  return act(stacked, plan, ...turns(state));
}

// ---------------------------------------------------------------------------------------------------------------
// A Baron Zemo player: clears Board Members with their Hero Actions, advances to the accusation only when the evidence
// has narrowed the rows (or the clock forces it); the greedy driver covers everything else
// ---------------------------------------------------------------------------------------------------------------

const MEMBER_ACTIONS = ["50181a", "50182a", "50183a"];

export function zemoDecide(s: GameState): Command | null {
  const ch = s.pendingChoice;
  if (ch) {
    if (ch.prompt.kind === "chooseOption" && ch.options.some((o) => o.label.startsWith("Advance to stage 2A"))) {
      const rows = openEvidenceRows(s, AOS_EVIDENCE_COMBINATIONS).length;
      const danger = mainThreatOf(s) >= targetThreatOf(s) - 6;
      const pick =
        rows <= 2 || danger
          ? ch.options.find((o) => o.label.startsWith("Advance"))!
          : ch.options.find((o) => o.label.startsWith("Do not"))!;
      return choose(s, pick.optionId as string);
    }
    return null;
  }
  if (s.step.phase !== "player" || s.step.kind !== "turn") return null;
  const p = s.step.activePlayerId;
  const player = s.players.find((x) => x.playerId === p)!;
  if (player.identity.form !== "hero") return null; // the greedy driver changes form first
  const acts = legalActions(s, p, DEPS);
  if (acts.kind !== "turn") return null;
  for (const l of acts.legal) {
    if (l.action.kind !== "useAbility") continue;
    const code = s.instances[l.action.instanceId]!.cardId as string;
    if (MEMBER_ACTIONS.includes(code) && (s.instances[l.action.instanceId]!.counters["secret"] ?? 0) > 0)
      return l.example;
  }
  return null;
}
