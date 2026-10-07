/**
 * `Predicate basicPowerIs`: which basic power is being used, read off the `basicPowerUsing` event, so one interrupt to
 * "thwarts or attacks" can give `modifyBasicPower` the matching stat ("add [another character]'s matching power to
 * [this character]'s power for this use").
 *
 * Sources: RRG 1.8 "Basic Power" (p. 10); "Recover, Recovery" (p. 36). Synthetic cards; the stub hero has THW 2, ATK 2,
 * DEF 2, REC 3, the stub ally THW 1, ATK 2, the villain ATK 2 with a 1-icon boost card.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { BasicPowerName, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { ALLY } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const yourIdentity = { kind: "identityOf", player: { kind: "controller" } } as const;
const plus = (power: BasicPowerName | readonly BasicPowerName[], value: number): EffectSpec => ({
  kind: "if",
  condition: { kind: "basicPowerIs", power },
  then: [{ kind: "modifyBasicPower", amount: { kind: "const", value } }],
});

/** "When you use a basic power: a thwart gets +3, an attack +5, a defense +4, a recovery +1 for this use." */
const EACH_ABILITY = stubAbility(
  "each-power.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
    effects: [plus("thwart", 3), plus("attack", 5), plus("defense", 4), plus("recover", 1)],
  }),
);
const EACH = stubSupport({ id: "each-power", cost: 0, abilities: [EACH_ABILITY.ref] });
/** A list names any of its powers: "+2 to a thwart or an attack". */
const EITHER_ABILITY = stubAbility(
  "either-power.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
    effects: [plus(["thwart", "attack"], 2)],
  }),
);
const EITHER = stubSupport({ id: "either-power", cost: 0, abilities: [EITHER_ABILITY.ref] });
/** "When an ally you control thwarts or attacks, add your identity's matching power to its power for this use." */
const MATCHING_ABILITY = stubAbility(
  "matching.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: {
        on: "basicPowerUsing",
        targetIs: { categories: ["ally"], controller: "you" },
        eventIs: { power: ["thwart", "attack"] },
      },
    },
    effects: [
      {
        kind: "if",
        condition: { kind: "basicPowerIs", power: "thwart" },
        then: [{ kind: "modifyBasicPower", amount: { kind: "stat", of: yourIdentity, stat: "thw" } }],
        otherwise: [{ kind: "modifyBasicPower", amount: { kind: "stat", of: yourIdentity, stat: "atk" } }],
      },
    ],
  }),
);
const MATCHING = stubSupport({ id: "matching", cost: 0, abilities: [MATCHING_ABILITY.ref] });
/** "Your identity gets +1 ATK", so its THW (2) and ATK (3) differ. */
const ATK_UP_ABILITY = stubAbility(
  "matching-atk-up.constant",
  def({
    trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 1, target: { categories: ["identity"] } }] },
    effects: [],
  }),
);
const ATK_UP = stubSupport({ id: "matching-atk-up", cost: 0, abilities: [ATK_UP_ABILITY.ref] });
/** "Action: If a basic power is being used, place a `yes` counter here; otherwise a `no` counter." */
const PROBE_ABILITY = stubAbility(
  "probe.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "if",
        condition: { kind: "basicPowerIs", power: ["attack", "thwart", "defense", "recover"] },
        then: [
          { kind: "addCounters", target: { kind: "self" }, counterType: "yes", amount: { kind: "const", value: 1 } },
        ],
        otherwise: [
          { kind: "addCounters", target: { kind: "self" }, counterType: "no", amount: { kind: "const", value: 1 } },
        ],
      },
    ],
  }),
);
const PROBE = stubSupport({ id: "probe", cost: 0, abilities: [PROBE_ABILITY.ref] });

const CARDS = [EACH, EITHER, MATCHING, ATK_UP, PROBE];
const deps = depsOf(EACH_ABILITY, EITHER_ABILITY, MATCHING_ABILITY, ATK_UP_ABILITY, PROBE_ABILITY);
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const patch = (state: GameState, id: InstanceId, change: { threat?: number; damage?: number }): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});

/** The commands through a session (declining to defend unless `pick` says otherwise), the log replayed to the same state. */
function run(
  state: GameState,
  commands: readonly Command[],
  pick?: (state: GameState) => readonly string[],
): GameState {
  const driven = driveSession(startSession(state), deps, commands, pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return driven.session.state;
}
/** P1's first turn with the given cards in play, 10 threat on the main scheme; in hero form unless `alterEgo`. */
function start(cards: readonly { readonly id: (typeof EACH)["id"] }[], alterEgo = false): GameState {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.map((card) => card.id) });
  for (const card of cards) state = playerCardIntoPlay(state, card.id).state;
  if (!alterEgo) state = run(state, [{ type: "changeForm", playerId: P1 }]);
  return patch(state, state.mainScheme.instanceId, { threat: 10 });
}
const thwart = (state: GameState, by: InstanceId = identityOf(state)): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: by,
  schemeInstanceId: state.mainScheme.instanceId,
});
const attack = (state: GameState, by: InstanceId = identityOf(state)): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: by,
  targetInstanceId: state.activeVillainId!,
});
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const villainDamage = (state: GameState) => mustInstance(state, state.activeVillainId!).damage;
const inPlay = (state: GameState, card: { readonly id: string }) =>
  mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === card.id)!;

describe("Predicate basicPowerIs", () => {
  it("a basic thwart: only the thwart branch applies, THW 2 + 3 removes 5 of 10", () => {
    const state = start([EACH]);
    expect(threat(run(state, [thwart(state)]))).toBe(5);
  });

  it("a basic attack: only the attack branch applies, ATK 2 + 5 deals 7", () => {
    const state = start([EACH]);
    expect(villainDamage(run(state, [attack(state)]))).toBe(7);
  });

  it("a basic defense: only the defense branch applies, DEF 2 + 4 stops the villain's 3; without it 1 gets through", () => {
    const defend = (cards: readonly (typeof EACH)[]) => {
      const state = start(cards);
      const hero = identityOf(state);
      const after = run(state, [{ type: "endTurn", playerId: P1 }], (s) =>
        s.pendingChoice?.prompt.kind === "declareDefender"
          ? [hero]
          : (s.pendingChoice?.options.slice(0, s.pendingChoice.minSelections).map((o) => o.optionId) ?? []),
      );
      return mustInstance(after, hero).damage;
    };
    expect(defend([])).toBe(1);
    expect(defend([EACH])).toBe(0);
  });

  it("a basic recovery: only the recovery branch applies, REC 3 + 1 heals 4 of 8", () => {
    const base = start([EACH], true);
    const state = patch(base, identityOf(base), { damage: 8 });
    const after = run(state, [{ type: "basicRecover", playerId: P1 }]);
    expect(mustInstance(after, identityOf(after)).damage).toBe(4);
  });

  it("a list names any of its powers: +2 to a thwart (removes 4) and to an attack (deals 4)", () => {
    const state = start([EITHER]);
    expect(threat(run(state, [thwart(state)]))).toBe(6);
    expect(villainDamage(run(state, [attack(state)]))).toBe(4);
  });

  it("the matching power of another character: an ally's thwart adds the hero's THW 2, its attack the hero's ATK 3", () => {
    const state = start([MATCHING, ATK_UP, ALLY]);
    const ally = inPlay(state, ALLY);
    // Ally THW 1 + hero THW 2 = 3 removed; ally ATK 2 + hero ATK 3 = 5 dealt.
    const thwarted = run(state, [thwart(state, ally)]);
    expect(threat(thwarted)).toBe(7);
    expect(thwarted.lastingEffects).toHaveLength(0);
    const attacked = run(state, [attack(state, ally)]);
    expect(villainDamage(attacked)).toBe(5);
    expect(attacked.lastingEffects).toHaveLength(0);
  });

  it("the hero's own basic powers are not the ally's: nothing is added (THW 2 removes 2, ATK 3 deals 3)", () => {
    const state = start([MATCHING, ATK_UP, ALLY]);
    expect(threat(run(state, [thwart(state)]))).toBe(8);
    expect(villainDamage(run(state, [attack(state)]))).toBe(3);
  });

  it("is false when no basic power is being used", () => {
    const state = start([PROBE]);
    const probe = inPlay(state, PROBE);
    const after = run(state, [
      { type: "useAbility", playerId: P1, cardInstanceId: probe, abilityId: PROBE_ABILITY.ref.id, payment: [] },
    ]);
    expect(mustInstance(after, probe).counters).toMatchObject({ no: 1 });
    expect(mustInstance(after, probe).counters.yes ?? 0).toBe(0);
  });
});
