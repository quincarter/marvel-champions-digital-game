/**
 * docs/phase7-wave6.md §3.32 and §4.1 Q22: `modifyBasicPower.useStat: "thw"`. A synthetic card shaped like Befuddle
 * (33033: "Interrupt: When a character makes a basic attack against attached minion, that character uses their THW
 * instead of their ATK."), keyed on any basic attack so the test needs no attachment.
 *
 * Q22 (user default): the attack deals THW with its THW modifiers; ATK modifiers do not apply; it is still a basic
 * attack for every other purpose, with the ATK field's consequential damage (RRG 1.8 "Basic Power", p. 10;
 * "Consequential Damage", p. 13).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ALLIES = { categories: ["ally" as const], controller: "you" as const };
/** ATK 1 / THW 3, 2 consequential damage on the ATK field and none on THW. */
const PUNCHER = stubAlly({
  id: "puncher",
  cost: 0,
  atk: 1,
  thw: 3,
  hp: 6,
  consequentialAttack: 2,
  consequentialThwart: 0,
});
/** +5 ATK and +1 THW to your allies: an ATK modifier and a THW modifier. */
const BOOSTS = stubAbility("boosts.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      { stat: "atk", amount: 5, target: ALLIES },
      { stat: "thw", amount: 1, target: ALLIES },
    ],
  },
  effects: [],
});
const TRAINING = stubSupport({ id: "training", cost: 0, abilities: [BOOSTS.ref] });
const BEFUDDLE_INTERRUPT = stubAbility("befuddle.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", attackKind: "basic" } },
  effects: [{ kind: "modifyBasicPower", useStat: "thw" }],
});
const BEFUDDLE = stubSupport({ id: "befuddle", cost: 0, abilities: [BEFUDDLE_INTERRUPT.ref] });
/** "After a character makes a basic attack": a counter here per attack, to show it still is one. */
const TALLY_RESPONSE = stubAbility("tally.response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", attackKind: "basic" } },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "tally", amount: { kind: "const", value: 1 } },
  ],
});
const TALLY = stubSupport({ id: "tally", cost: 0, abilities: [TALLY_RESPONSE.ref] });
const deps: EngineDeps = depsOf(BOOSTS, BEFUDDLE_INTERRUPT, TALLY_RESPONSE);

function start(befuddled: boolean): { state: GameState; puncher: InstanceId; tally: InstanceId } {
  const cards = befuddled ? [PUNCHER, TRAINING, TALLY, BEFUDDLE] : [PUNCHER, TRAINING, TALLY];
  let state = gameAtFirstTurn({ cards, deps, deck: cards.map((c) => c.id) });
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state, puncher: ids[0]!, tally: ids[2]! };
}

const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const attack = (state: GameState, puncher: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: puncher,
  targetInstanceId: villainOf(state),
});

describe('§3.32 `modifyBasicPower.useStat: "thw"`: a basic attack made with THW', () => {
  it("deals THW with THW modifiers, no ATK modifier; still a basic attack; ATK-field consequential damage", () => {
    const { state, puncher, tally } = start(true);
    const { session } = driveSession(startSession(state), deps, [attack(state, puncher)]);
    // THW 3 + 1, not ATK 1 + 5.
    expect(mustInstance(session.state, villainOf(state)).damage).toBe(4);
    // "After … makes a basic attack" still fires.
    expect(mustInstance(session.state, tally).counters["tally"]).toBe(1);
    // The ATK field's consequential damage (2), not the THW field's (0).
    expect(mustInstance(session.state, puncher).damage).toBe(2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("without it, the same basic attack deals ATK with ATK modifiers", () => {
    const { state, puncher, tally } = start(false);
    const { session } = driveSession(startSession(state), deps, [attack(state, puncher)]);
    expect(mustInstance(session.state, villainOf(state)).damage).toBe(6);
    expect(mustInstance(session.state, tally).counters["tally"]).toBe(1);
    expect(mustInstance(session.state, puncher).damage).toBe(2);
  });
});
