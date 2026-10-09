/**
 * docs/phase7-wave8.md §3.37: a damage pool dealt to one character at a time (`EffectSpec assignDamage` with
 * `sequential`, log `damagePoolResolved`).
 *
 * MC45 p. 6, step 4 of a mission attempt: "Deal damage from this pool to enemies at the mission one at a time until
 * there is no damage in the pool or there are no enemies remaining at the mission." / "The [OVERSEER] minion cannot
 * take damage while another minion [is] in the mission area." RRG 1.8 "Damage" (p. 14); "Defeat" (p. 15); "Victory X"
 * (p. 46); "Tough" (p. 45). Each pick is dealt and settled, a defeat included, before the next, which is what lets the
 * pool reach a minion once the one shielding it has fallen in the same step. Synthetic cards only.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const AREA = "mission";
const INTO = { scenarioPlayArea: AREA } as const;
const THERE = { inScenarioPlayArea: AREA } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const find = (name: string): TargetRef => ({ kind: "find", query: { name } });
const MINIONS_THERE: TargetQuery = { categories: ["minion"], ...THERE };

const ERRAND = stubSideScheme({ id: "errand", startingThreat: 5, boostIcons: 0 });
/** "Victory 5. Cannot take damage while another minion is in the area." 5 hit points. */
const OVERSEER_RULE = stubAbility("overseer.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "cannotTakeDamage",
        target: { categories: ["minion"], self: true },
        while: { kind: "exists", query: { categories: ["minion"], ...THERE, self: false } },
      },
    ],
  },
  effects: [],
});
const OVERSEER = stubMinion({
  id: "overseer",
  atk: 0,
  sch: 0,
  hp: 5,
  boostIcons: 0,
  keywords: [{ name: "victory", value: 5 }],
  abilities: [OVERSEER_RULE.ref],
});
const AGENT = stubMinion({ id: "agent", atk: 2, sch: 2, hp: 3, boostIcons: 0 });
/** 4 hit points and toughness. */
const SHELL = stubMinion({ id: "shell", atk: 0, sch: 0, hp: 4, boostIcons: 0, keywords: [{ name: "toughness" }] });
const METER = stubSupport({ id: "meter", cost: 0 });
const meter: TargetRef = { kind: "named", name: METER.name };

const action = (id: string, ...effects: EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const send = (id: string, name: string) =>
  action(id, { kind: "putIntoPlay", card: find(name), controller: you, into: INTO });
const OPEN = action(
  "open",
  { kind: "createScenarioPlayArea", name: AREA, closed: true },
  { kind: "putIntoPlay", card: find(ERRAND.name), controller: you, into: INTO },
  { kind: "putIntoPlay", card: find(METER.name), controller: you },
);
const SEND_OVERSEER = send("send-overseer", OVERSEER.name);
const SEND_AGENT = send("send-agent", AGENT.name);
const SEND_SHELL = send("send-shell", SHELL.name);
/** "Deal N damage to the minions there, one at a time." Then the read-out of what the pool did. */
const pool = (size: number) =>
  action(
    `pool-${size}`,
    { kind: "assignDamage", amount: n(size), among: MINIONS_THERE, chooser: you, sequential: true, bind: "pool" },
    { kind: "addCounters", target: meter, counterType: "dealt", amount: { kind: "var", name: "pool.dealt" } },
    { kind: "addCounters", target: meter, counterType: "lost", amount: { kind: "var", name: "pool.lost" } },
  );
const POOL_0 = pool(0);
const POOL_2 = pool(2);
const POOL_6 = pool(6);
const EVENTS = [OPEN, SEND_OVERSEER, SEND_AGENT, SEND_SHELL, POOL_0, POOL_2, POOL_6];

const SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const TYRANT = stubVillain({ id: "tyrant", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const NOISE = stubTreachery({ id: "noise", boostIcons: 0 });
const deps: EngineDeps = depsOf(OVERSEER_RULE, ...EVENTS.map((e) => e.ability));

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const idOf = (state: GameState, cardId: string): InstanceId => {
  const id = (Object.keys(state.instances) as InstanceId[]).find((key) => state.instances[key]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId}`);
  return id;
};
type Pick = (state: GameState) => readonly string[];
function play(state: GameState, card: { card: { id: CardId } }, pick: Pick = defaultPick) {
  const given = giveCard(state, P1, card.card.id);
  const run = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { state: run.session.state, events: run.events, session: run.session, id: given.id };
}
function start(...sends: readonly { card: { id: CardId } }[]): GameState {
  let state = gameAtFirstTurn({
    cards: [ERRAND, OVERSEER, AGENT, SHELL, METER, NOISE, ...EVENTS.map((e) => e.card)],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    encounter: [ERRAND.id, OVERSEER.id, AGENT.id, SHELL.id, ...copiesOf(NOISE.id, 14)],
    deck: [METER.id, ...EVENTS.map((e) => e.card.id)],
  });
  for (const card of [OPEN, ...sends]) state = play(state, card).state;
  return state;
}
/**
 * Answers the pool's picks from a script of [character, amount], recording what each target choice offered. The
 * amount is asked only when the character has room for more than 1.
 */
function scripted(steps: readonly (readonly [InstanceId, number])[]) {
  const offered: string[][] = [];
  let step = 0;
  const pick: Pick = (state) => {
    const choice = state.pendingChoice!;
    if (choice.prompt.kind === "chooseTarget" && choice.prompt.slot === "assignDamage") {
      offered.push(choice.options.map((o) => o.optionId));
      return [steps[step]![0]];
    }
    if (choice.prompt.kind === "chooseNumber") return [String(steps[step++]![1])];
    return defaultPick(state);
  };
  return { pick, offered };
}
const meterOf = (state: GameState) => {
  const id = mustPlayer(state, P1).playArea.find((candidate) => state.instances[candidate]?.cardId === METER.id);
  return mustInstance(state, id!).counters;
};
const dealtTo = (events: readonly GameEvent[]) =>
  of(events, "damageDealt").map((e) => [e.targetInstanceId, e.amount] as const);

describe("§3.37 a damage pool dealt to one character at a time", () => {
  it("test 1: 6 against a 5-hit-point minion alone: it takes 5 and is defeated into the victory display; 1 is lost", () => {
    const state = start(SEND_OVERSEER);
    const overseer = idOf(state, OVERSEER.id);
    const script = scripted([[overseer, 5]]);
    const run = play(state, POOL_6, script.pick);
    expect(script.offered).toEqual([[overseer]]);
    expect(dealtTo(run.events)).toEqual([[overseer, 5]]);
    expect(locateCard(run.state, overseer)).toEqual({ kind: "victoryDisplay" });
    expect(of(run.events, "damagePoolResolved")).toEqual([
      { type: "damagePoolResolved", playerId: P1, sourceInstanceId: run.id, pool: 6, dealt: 5, lost: 1 },
    ]);
    expect(meterOf(run.state)).toEqual({ dealt: 5, lost: 1 });
    // Not an attack: no attack event, nothing for retaliate or "after … attacks" to answer.
    expect(run.events.some((e) => e.type === "attackResolved" || e.type === "attackAwaitsAbility")).toBe(false);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("the amount is capped at the smaller of the pool and the remaining hit points: 1 to 5 is offered of a pool of 6", () => {
    const state = start(SEND_OVERSEER);
    const overseer = idOf(state, OVERSEER.id);
    const ranges: number[][] = [];
    const run = play(state, POOL_6, (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseNumber") {
        ranges.push([choice.prompt.min, choice.prompt.max]);
        return ["2"];
      }
      if (choice.prompt.kind === "chooseTarget") return [overseer];
      return defaultPick(s);
    });
    // 2 of 6 (room 5), 2 of 4 (room 3), then 1 of 2 (room 1: not asked). 5 dealt in three instances, 1 lost.
    expect(ranges).toEqual([
      [1, 5],
      [1, 3],
    ]);
    expect(dealtTo(run.events)).toEqual([
      [overseer, 2],
      [overseer, 2],
      [overseer, 1],
    ]);
    expect(meterOf(run.state)).toEqual({ dealt: 5, lost: 1 });
  });

  it("test 2: 6 with another minion (3 hit points) there: the shielded one is not offered first; 3 defeat the other, then 3 go to the first", () => {
    const state = start(SEND_OVERSEER, SEND_AGENT);
    const overseer = idOf(state, OVERSEER.id);
    const agent = idOf(state, AGENT.id);
    const script = scripted([
      [agent, 3],
      [overseer, 3],
    ]);
    const run = play(state, POOL_6, script.pick);
    expect(script.offered).toEqual([[agent], [overseer]]);
    expect(dealtTo(run.events)).toEqual([
      [agent, 3],
      [overseer, 3],
    ]);
    // The other minion was defeated and discarded before the second pick was offered.
    expect(cardsInPlay(run.state)).not.toContain(agent);
    expect(locateCard(run.state, agent)?.kind).toBe("encounterDiscard");
    expect(mustInstance(run.state, overseer).damage).toBe(3);
    expect(cardsInPlay(run.state)).toContain(overseer);
    expect(meterOf(run.state)).toEqual({ dealt: 6 });
    const defeated = run.events.findIndex((e) => e.type === "characterDefeated" && e.instanceId === agent);
    const second = run.events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === overseer);
    expect(defeated).toBeGreaterThan(-1);
    expect(defeated).toBeLessThan(second);
  });

  it("test 3: 2 against the same two: 2 to the other minion, which has 1 hit point left; the shielded one is never offered", () => {
    const state = start(SEND_OVERSEER, SEND_AGENT);
    const overseer = idOf(state, OVERSEER.id);
    const agent = idOf(state, AGENT.id);
    const script = scripted([[agent, 2]]);
    const run = play(state, POOL_2, script.pick);
    expect(script.offered).toEqual([[agent]]);
    expect(mustInstance(run.state, agent).damage).toBe(2);
    expect(mustInstance(run.state, overseer).damage).toBe(0);
    expect(of(run.events, "damagePoolResolved")[0]).toMatchObject({ pool: 2, dealt: 2, lost: 0 });
  });

  it("test 4: a pool of 0 asks nothing and is logged as resolved with nothing dealt", () => {
    const state = start(SEND_OVERSEER);
    const run = play(state, POOL_0);
    expect(of(run.events, "choiceRequested")).toEqual([]);
    expect(dealtTo(run.events)).toEqual([]);
    expect(of(run.events, "damagePoolResolved")[0]).toMatchObject({ pool: 0, dealt: 0, lost: 0 });
  });

  it("with no minion there the whole pool is lost", () => {
    const run = play(start(), POOL_6);
    expect(of(run.events, "choiceRequested")).toEqual([]);
    expect(of(run.events, "damagePoolResolved")[0]).toMatchObject({ pool: 6, dealt: 0, lost: 6 });
    expect(meterOf(run.state)).toEqual({ lost: 6 });
  });

  it("each pick is one instance of damage: 1 removes a tough status card and the next 4 defeat the minion; all 5 at once would only remove the card", () => {
    const state = start(SEND_SHELL);
    const shell = idOf(state, SHELL.id);
    expect(mustInstance(state, shell).statuses.tough).toBe(1);
    const careful = play(
      state,
      POOL_6,
      scripted([
        [shell, 1],
        [shell, 4],
      ]).pick,
    );
    expect(cardsInPlay(careful.state)).not.toContain(shell);
    expect(meterOf(careful.state)).toEqual({ dealt: 5, lost: 1 });

    const blunt = play(
      state,
      POOL_6,
      scripted([
        [shell, 4],
        [shell, 2],
      ]).pick,
    );
    // 4 spent on the tough status card, then the last 2 of the pool: 2 damage of 4.
    expect(mustInstance(blunt.state, shell)).toMatchObject({ damage: 2, statuses: { tough: 0 } });
    expect(meterOf(blunt.state)).toEqual({ dealt: 6 });
  });
});
