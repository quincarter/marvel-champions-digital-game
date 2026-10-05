/**
 * A modifier whose amount is another stat of the card it modifies: "she gets +X THW for this thwart, where X is equal
 * to her ATK." `ValueSpec stat` reads that one stat (`characterStat`), never the whole profile, so the THW modifier
 * does not read the THW it is part of (it used to: `RangeError: Maximum call stack size exceeded`).
 *
 * Source: RRG 1.8 "Lasting Effects" (p. 26): "Lasting effects update whenever the game state updates", so the amount
 * is read live rather than stored as a number when the effect is created.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import { characterProfile, characterStat, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;
const statOf = (stat: "atk" | "thw") => ({ kind: "stat", of: yourIdentity, stat }) as const;

/** "When you make a basic thwart, get +X THW for this thwart, where X is your ATK"; for an attack, X is your THW. */
const CROSS_ABILITY = stubAbility(
  "cross.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
    effects: [
      {
        kind: "if",
        condition: { kind: "basicPowerIs", power: "thwart" },
        then: [{ kind: "modifyBasicPower", amount: statOf("atk") }],
        otherwise: [{ kind: "modifyBasicPower", amount: statOf("thw") }],
      },
    ],
  }),
);
const CROSS = stubSupport({ id: "cross", cost: 0, abilities: [CROSS_ABILITY.ref] });
/** "Your hero gets +1 ATK." */
const ATK_UP_ABILITY = stubAbility(
  "atk-up.constant",
  def({
    trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 1, target: { categories: ["identity"] } }] },
    effects: [],
  }),
);
const ATK_UP = stubSupport({ id: "atk-up", cost: 0, abilities: [ATK_UP_ABILITY.ref] });
/** "Action: Until the end of the phase, your identity gets +X THW, where X is its ATK." */
const SURGE_ABILITY = stubAbility(
  "thw-surge.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "modifyStatUntil", stat: "thw", amount: statOf("atk"), target: yourIdentity, until: "endOfPhase" },
    ],
  }),
);
const SURGE = stubSupport({ id: "thw-surge", cost: 0, abilities: [SURGE_ABILITY.ref] });
/** "Action: Until the end of the phase, your identity gets +1 ATK." */
const PUMP_ABILITY = stubAbility(
  "atk-pump.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "modifyStatUntil",
        stat: "atk",
        amount: { kind: "const", value: 1 },
        target: yourIdentity,
        until: "endOfPhase",
      },
    ],
  }),
);
const PUMP = stubSupport({ id: "atk-pump", cost: 0, abilities: [PUMP_ABILITY.ref] });

const CARDS = [CROSS, ATK_UP, SURGE, PUMP];
const deps = depsOf(CROSS_ABILITY, ATK_UP_ABILITY, SURGE_ABILITY, PUMP_ABILITY);
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const withThreat = (state: GameState, threat: number): GameState => {
  const id = state.mainScheme.instanceId;
  return { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } } };
};

/** P1 in hero form (the stub hero: THW 2, ATK 2), 10 threat on the main scheme, the given supports in play. */
function start(...supports: readonly (typeof CROSS)[]): GameState {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.map((card) => card.id) });
  for (const support of supports) state = playerCardIntoPlay(state, support.id).state;
  state = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
  expect(mustPlayer(state, P1).identity.form).toBe("hero");
  return withThreat(state, 10);
}
/** The commands through a session, with the log replayed to the same state. */
function run(state: GameState, ...commands: readonly Command[]): GameState {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return driven.session.state;
}
const thwart = (state: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(state),
  schemeInstanceId: state.mainScheme.instanceId,
});
const attack = (state: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(state),
  targetInstanceId: state.activeVillainId!,
});
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;

describe("a stat modifier whose amount is another stat of the same character", () => {
  it("+X THW for this thwart, X her ATK: THW 2 + ATK 2 removes 4 of 10 threat, and the bonus ends with the thwart", () => {
    const state = start(CROSS);
    const after = run(state, thwart(state));
    expect(threat(after)).toBe(6);
    expect(after.lastingEffects).toHaveLength(0);
    expect(characterProfile(after, identityOf(after), deps)).toMatchObject({ thw: 2, atk: 2 });
  });

  it("X counts her ATK modifiers: with +1 ATK the thwart removes 2 + 3 = 5", () => {
    const state = start(CROSS, ATK_UP);
    expect(threat(run(state, thwart(state)))).toBe(5);
  });

  it("+X ATK for this attack, X her THW: ATK 2 + THW 2 deals 4 to the villain", () => {
    const state = start(CROSS);
    const after = run(state, attack(state));
    expect(mustInstance(after, after.activeVillainId!).damage).toBe(4);
  });

  it("the amount stays live (RRG p. 26): a later +1 ATK raises the THW bonus from 2 to 3", () => {
    const base = start(SURGE, PUMP);
    const hero = identityOf(base);
    const surge = mustPlayer(base, P1).playArea.find((id) => mustInstance(base, id).cardId === SURGE.id)!;
    const pump = mustPlayer(base, P1).playArea.find((id) => mustInstance(base, id).cardId === PUMP.id)!;
    const use = (cardInstanceId: typeof surge, abilityId: typeof SURGE_ABILITY.ref.id): Command => ({
      type: "useAbility",
      playerId: P1,
      cardInstanceId,
      abilityId,
      payment: [],
    });
    const surged = run(base, use(surge, SURGE_ABILITY.ref.id));
    expect(characterProfile(surged, hero, deps)).toMatchObject({ thw: 4, atk: 2 });
    expect(characterStat(surged, hero, "thw", deps)).toBe(4);
    const pumped = run(surged, use(pump, PUMP_ABILITY.ref.id));
    expect(characterProfile(pumped, hero, deps)).toMatchObject({ thw: 5, atk: 3 });
    expect(threat(run(pumped, thwart(pumped)))).toBe(5);
  });

  it("`characterStat` is `characterProfile`'s value for each stat, and undefined for a card with no stats", () => {
    const state = start(ATK_UP);
    const hero = identityOf(state);
    const profile = characterProfile(state, hero, deps)!;
    for (const stat of ["atk", "thw", "def", "rec", "sch"] as const) {
      expect(characterStat(state, hero, stat, deps)).toBe(profile[stat]);
    }
    expect(characterStat(state, hero, "atk", deps)).toBe(3);
    expect(characterStat(state, state.mainScheme.instanceId, "atk", deps)).toBeUndefined();
  });
});
