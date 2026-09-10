import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommands, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubIdentity } from "./testing/fixtures.js";
import { ALLY, findInHand, newGame, newGameAtMulligan, payFor } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");

function choiceCommand(state: GameState): Command {
  const choice = state.pendingChoice;
  if (!choice) throw new Error("no pending choice");
  const selected =
    choice.prompt.kind === "declareDefender"
      ? [choice.options[1]?.optionId ?? "decline"]
      : choice.options.slice(0, Math.max(choice.minSelections, 1)).map((o) => o.optionId);
  return {
    type: "resolveChoice",
    playerId: choice.playerId,
    choiceId: choice.choiceId,
    selectedOptionIds: selected.slice(0, choice.maxSelections),
  };
}

/** Drives a scripted game, auto-answering choices, and records everything into the log. */
function drive(
  session: GameSession,
  scripted: (state: GameState) => readonly Command[],
  deps: EngineDeps = DEFAULT_DEPS,
): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  let current = session;
  const queue = [...scripted(current.state)];
  const events: GameEvent[] = [];
  for (let guard = 0; guard < 400; guard++) {
    const command = current.state.pendingChoice ? choiceCommand(current.state) : queue.shift();
    if (!command) break;
    const result = sessionApply(current, command, deps);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    current = result.session;
    events.push(...result.events);
  }
  return { session: current, events };
}

const script = (state: GameState): readonly Command[] => [
  { type: "changeForm", playerId: p1 },
  {
    type: "playCard",
    playerId: p1,
    cardInstanceId: findInHand(state, p1, ALLY.id),
    payment: payFor(state, p1, 2),
    attachToInstanceId: null,
  },
  {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: mustPlayer(state, p1).identity.instanceId,
    targetInstanceId: state.villain.instanceId,
  },
  { type: "endTurn", playerId: p1 },
  { type: "changeForm", playerId: p2 },
  { type: "endTurn", playerId: p2 },
  { type: "endTurn", playerId: p2 },
  { type: "endTurn", playerId: p1 },
];

test("replaying a recorded log reproduces the exact final state and events", () => {
  const initial = newGame({ players: 2, seed: 99 });
  const played = drive(startSession(initial), script);

  expect(played.session.log.commands.length).toBeGreaterThan(script(initial).length);
  expect(played.session.state.round).toBe(3);

  const replayed = replay(played.session.log);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  expect(replayed.state).toEqual(played.session.state);
  expect(replayed.events).toEqual(played.events);
});

test("replaying a prefix of the log reproduces the matching intermediate state", () => {
  const initial = newGame({ players: 2, seed: 5 });
  const played = drive(startSession(initial), script);
  const commands = played.session.log.commands;

  const halfway = applyCommands(initial, commands.slice(0, 4));
  expect(halfway.ok).toBe(true);
  if (!halfway.ok) return;
  const fromHalfway = applyCommands(halfway.state, commands.slice(4));
  expect(fromHalfway.ok).toBe(true);
  if (!fromHalfway.ok) return;
  expect(fromHalfway.state).toEqual(played.session.state);
});

test("game state survives a JSON round trip unchanged", () => {
  const played = drive(startSession(newGame({ players: 2, seed: 42 })), script);
  const serialized = JSON.parse(JSON.stringify(played.session.state)) as GameState;
  expect(serialized).toEqual(played.session.state);
});

test("a game driven through stack choices replays to the same state and events", () => {
  const counter = stubAbility("mark", {
    trigger: { kind: "response", forced: false, on: { on: "dealDamage", targetIs: { categories: ["hero"] } } },
    effects: [
      { kind: "addCounters", target: { kind: "self" }, counterType: "mark", amount: { kind: "const", value: 1 } },
    ],
  });
  const ward = stubAbility("ward", {
    trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["hero"] } } },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }],
  });
  const deps = depsOf(counter, ward);
  const identity = stubIdentity({
    id: "hero",
    hp: 14,
    atk: 2,
    thw: 2,
    def: 1,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: [counter.ref, ward.ref],
  });

  const initial = newGameAtMulligan({ players: 2, seed: 77, identity, deps });
  const played = drive(
    startSession(initial),
    () => [
      { type: "changeForm", playerId: p1 },
      { type: "endTurn", playerId: p1 },
      { type: "changeForm", playerId: p2 },
      { type: "endTurn", playerId: p2 },
      { type: "endTurn", playerId: p2 },
      { type: "endTurn", playerId: p1 },
    ],
    deps,
  );

  const identityId = mustPlayer(played.session.state, p1).identity.instanceId;
  expect(mustInstance(played.session.state, identityId).counters.mark).toBeGreaterThan(0);

  const replayed = replay(played.session.log, deps);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  expect(replayed.state).toEqual(played.session.state);
  expect(replayed.events).toEqual(played.events);
});

test("a rejected command is not recorded in the session log", () => {
  const session = startSession(newGame());
  const result = sessionApply(session, { type: "endTurn", playerId: p2 });
  expect(result.ok).toBe(false);
  expect(session.log.commands).toHaveLength(0);
});
