import { activeVillain } from "./query.js";
import { flat } from "@mc/content";
import { applyCommand } from "./engine.js";
import { playerId } from "./ids.js";
import { mustInstance, mustPlayer, remainingHitPoints } from "./query.js";
import { stubIdentity, stubMainScheme, stubVillain } from "./testing/fixtures.js";
import { newGame, resolvePending, run, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn = { type: "endTurn", playerId: p1 } as const;
const toHero = { type: "changeForm", playerId: p1 } as const;

const fragileVillain = stubVillain({ id: "fragile", stages: [{ hp: flat(2), atk: 2, sch: 1 }] });
const twoStageVillain = stubVillain({
  id: "two-stage",
  stages: [
    { hp: flat(2), atk: 2, sch: 1 },
    { hp: flat(20), atk: 3, sch: 2 },
  ],
});

test("defeating the final villain stage wins the game", () => {
  const start = newGame({ villain: fragileVillain });
  const state = run(start, toHero, {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: mustPlayer(start, p1).identity.instanceId,
    targetInstanceId: activeVillain(start).instanceId,
  });
  expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  expect(state.step).toEqual({ phase: "gameOver", kind: "gameOver" });

  const afterEnd = applyCommand(state, endTurn);
  expect(afterEnd.ok).toBe(false);
  if (!afterEnd.ok) expect(afterEnd.error.code).toBe("game_over");
});

test("defeating a non-final villain stage advances instead of ending the game", () => {
  const start = newGame({ villain: twoStageVillain });
  const state = run(start, toHero, {
    type: "basicAttack",
    playerId: p1,
    attackerInstanceId: mustPlayer(start, p1).identity.instanceId,
    targetInstanceId: activeVillain(start).instanceId,
  });
  expect(state.outcome).toBeNull();
  expect(activeVillain(state).stageIndex).toBe(1);
  // RRG "Villain Defeat": excess damage does not carry over.
  expect(remainingHitPoints(state, activeVillain(state).instanceId)).toBe(20);
});

test("completing the final main scheme stage loses the game", () => {
  const doomed = stubMainScheme({
    id: "doomed",
    stages: [{ startingThreat: flat(0), targetThreat: flat(2), acceleration: flat(3) }],
  });
  const state = settle(run(newGame({ mainScheme: doomed }), endTurn));
  expect(state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
});

test("completing a non-final main scheme stage advances and resets threat", () => {
  const twoStage = stubMainScheme({
    id: "two-stage-scheme",
    stages: [
      { startingThreat: flat(0), targetThreat: flat(2), acceleration: flat(3) },
      { startingThreat: flat(1), targetThreat: flat(20), acceleration: flat(1) },
    ],
  });
  const state = settle(run(newGame({ mainScheme: twoStage }), endTurn));
  expect(state.outcome).toBeNull();
  expect(state.mainScheme.stageIndex).toBe(1);
  // stage 2 starting threat 1, then the villain's scheme activation adds SCH 1 + 1 boost icon
  expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(3);
});

test("losing every identity loses the game", () => {
  const glassHero = stubIdentity({
    id: "glass",
    hp: 3,
    atk: 1,
    thw: 1,
    def: 1,
    rec: 1,
    heroHandSize: 6,
    alterEgoHandSize: 6,
  });
  const brute = stubVillain({ id: "brute", stages: [{ hp: flat(50), atk: 5, sch: 1 }] });
  const start = newGame({ identity: glassHero, villain: brute });
  const atDefense = resolvePending(run(start, toHero, endTurn), []);
  expect(atDefense.pendingChoice?.prompt.kind).toBe("declareDefender");

  const state = resolvePending(atDefense, ["decline"]);
  expect(mustPlayer(state, p1).eliminated).toBe(true);
  expect(state.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
});
