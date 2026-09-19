import { flat } from "@mc/content";
import { playerId } from "./ids.js";
import { activeVillain } from "./query.js";
import { stackEntries } from "./stack-view.js";
import { stubMainScheme, stubVillain } from "./testing/fixtures.js";
import { newGame, run, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn = { type: "endTurn", playerId: p1 } as const;
const toHero = { type: "changeForm", playerId: p1 } as const;

const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(40), atk: 2, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(1) }],
});

const atDefense = () => settleUntil(run(newGame({ villain: VILLAIN, mainScheme: SCHEME }), toHero, endTurn), "declareDefender");

/**
 * RRG 1.8 "Attack (Enemy Activation)" step 2 (p. 9): "Declare defender" is a step *of the attack*, so the decision
 * belongs to the procedure frame that is resolving — which is exactly what `PendingChoice.frameId` records.
 */
test("exactly one entry is the open window, and it is the frame the pending choice names", () => {
  const state = atDefense();
  const entries = stackEntries(state);

  const open = entries.filter((entry) => entry.openWindow);
  expect(open).toHaveLength(1);
  expect(open[0]?.frameId).toBe(state.pendingChoice?.frameId);
  expect(open[0]?.kind).toBe("enemyAttack");
  expect(open[0]?.stage).toBe("declareDefender");
});

test("no entry is an open window when nothing is pending", () => {
  const state = newGame({ villain: VILLAIN, mainScheme: SCHEME });
  expect(state.pendingChoice).toBeNull();
  expect(stackEntries(state).some((entry) => entry.openWindow)).toBe(false);
});

// RRG 1.8 "Activation" (p. 6): the activating enemy is what the procedure is about.
test("an activation procedure names its enemy, and the event frame under it names the event", () => {
  const state = atDefense();
  const entries = stackEntries(state);
  const villain = activeVillain(state).instanceId;

  const procedure = entries.find((entry) => entry.kind === "enemyAttack");
  expect(procedure?.subjectInstanceId).toBe(villain);
  expect(procedure?.eventKind).toBeNull();

  const event = entries.find((entry) => entry.kind === "event" && entry.eventKind === "enemyAttack");
  expect(event).toBeDefined();
  // The event frame is where an interrupt's changes to the attack land, so its vars are always readable.
  expect(event?.vars).toBeDefined();
  expect(event?.timing).toBeNull();
});

test("entries are the stack in order, innermost first", () => {
  const state = atDefense();
  const entries = stackEntries(state);

  expect(entries).toHaveLength(state.stack.length);
  expect(entries.map((entry) => entry.depth)).toEqual(state.stack.map((_, index) => index));
  expect(entries.map((entry) => entry.frameId)).toEqual(state.stack.map((frame) => frame.frameId));
});

test("reading the stack changes nothing", () => {
  const state = atDefense();
  const before = structuredClone(state);
  stackEntries(state);
  expect(state).toEqual(before);
});
