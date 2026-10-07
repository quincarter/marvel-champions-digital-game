/**
 * docs/phase7-wave7.md §3.61: "+N to that power for this use" (`modifyBasicPower`, docs/phase7-wave2.md §17.4) on a
 * basic recovery. Synthetic cards: "Interrupt: when you use a basic power, get +N to that power for this use."
 *
 * Sources: RRG 1.8 "Recover, Recovery" (p. 36): the alter-ego exhausts and heals damage equal to its REC. The recovery
 * is neither an attack nor an activation, so the bonus is timed to the recovery's own `basicRecovery` event
 * (docs/phase7-wave6.md §3.40), which reads REC as it applies, and ends with it (RRG 1.8 "Lasting Effects", p. 26).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

/** "When you use a basic power, get +`amount` to that power for this use." */
const bonus = (amount: number) =>
  stubAbility(
    `bonus${amount}.interrupt`,
    def({
      trigger: { kind: "interrupt", forced: true, on: { on: "basicPowerUsing", playerIs: "controller" } },
      effects: [{ kind: "modifyBasicPower", amount: { kind: "const", value: amount } }],
    }),
  );
const BONUS_0 = bonus(0);
const BONUS_1 = bonus(1);
const BONUS_3 = bonus(3);
const PLUS_0 = stubSupport({ id: "plus0", cost: 0, abilities: [BONUS_0.ref] });
const PLUS_1 = stubSupport({ id: "plus1", cost: 0, abilities: [BONUS_1.ref] });
const PLUS_3 = stubSupport({ id: "plus3", cost: 0, abilities: [BONUS_3.ref] });
/** "When you make a basic recovery, discard this card instead of healing damage" (wave 6 §3.40). */
const INSTEAD_ABILITY = stubAbility(
  "instead.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicRecovery", playerIs: "controller" } },
    effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
  }),
);
const INSTEAD = stubSupport({ id: "instead", cost: 0, abilities: [INSTEAD_ABILITY.ref] });

const SUPPORTS = [PLUS_0, PLUS_1, PLUS_3, INSTEAD];
const deps = depsOf(BONUS_0, BONUS_1, BONUS_3, INSTEAD_ABILITY);
const recover: Command = { type: "basicRecover", playerId: P1 };
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const damageOf = (state: GameState) => mustInstance(state, identityOf(state)).damage;
const withIdentity = (state: GameState, patch: { damage?: number; exhausted?: boolean }): GameState => {
  const identity = identityOf(state);
  return { ...state, instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), ...patch } } };
};

/** P1's alter-ego (the stub hero: REC 3) with `damage` damage and the given supports in play. */
function start(damage: number, ...supports: readonly (typeof PLUS_1)[]): GameState {
  let state = gameAtFirstTurn({ cards: SUPPORTS, deps, deck: SUPPORTS.map((card) => card.id) });
  for (const support of supports) state = playerCardIntoPlay(state, support.id).state;
  expect(mustPlayer(state, P1).identity.form).toBe("alterEgo");
  expect(characterProfile(state, identityOf(state), deps)?.rec).toBe(3);
  return withIdentity(state, { damage });
}

/** One basic recovery, settled, with the log replayed to the same state. */
function run(state: GameState) {
  const driven = driveSession(startSession(state), deps, [recover]);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

const healed = (events: ReturnType<typeof run>["events"]) =>
  events.flatMap((e) => (e.type === "damageHealed" ? [e.amount] : []));

describe("§3.61 `modifyBasicPower` on a basic recovery", () => {
  it("+0: the recovery heals REC 3", () => {
    const { state, events } = run(start(8, PLUS_0));
    expect(damageOf(state)).toBe(5);
    expect(healed(events)).toEqual([3]);
    expect(state.lastingEffects).toHaveLength(0);
  });

  it("+1: the recovery heals 3 + 1", () => {
    const { state, events } = run(start(8, PLUS_1));
    expect(damageOf(state)).toBe(4);
    expect(healed(events)).toEqual([4]);
  });

  it("+3: the recovery heals 3 + 3", () => {
    const { state, events } = run(start(8, PLUS_3));
    expect(damageOf(state)).toBe(2);
    expect(healed(events)).toEqual([6]);
  });

  it("two bonuses add up: +1 and +3 heal 3 + 4", () => {
    const { state } = run(start(8, PLUS_1, PLUS_3));
    expect(damageOf(state)).toBe(1);
  });

  it("healing stops at no damage: +3 on 4 damage heals 4", () => {
    const { state, events } = run(start(4, PLUS_3));
    expect(damageOf(state)).toBe(0);
    expect(healed(events)).toEqual([4]);
  });

  it("the bonus is on the identity's REC and is timed to the recovery's own event", () => {
    const { events } = run(start(8, PLUS_1));
    const identity = identityOf(start(8, PLUS_1));
    const added = events.flatMap((e) => (e.type === "lastingEffectAdded" ? [e.effect] : []));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ kind: "statModifier", stat: "rec", targets: [identity] });
    expect(added[0]?.duration.kind).toBe("endOfEvent");
    // Added while the power was being used, ended before "after you recover" could see it.
    const order = events.flatMap((e) =>
      e.type === "lastingEffectAdded" || e.type === "damageHealed" || e.type === "lastingEffectEnded" ? [e.type] : [],
    );
    expect(order).toEqual(["lastingEffectAdded", "damageHealed", "lastingEffectEnded"]);
  });

  it("expires with that recovery: REC is 3 again, and the next recovery heals 3 + 1, not 3 + 2", () => {
    const first = run(start(9, PLUS_1)).state;
    expect(damageOf(first)).toBe(5);
    expect(first.lastingEffects).toHaveLength(0);
    expect(characterProfile(first, identityOf(first), deps)?.rec).toBe(3);
    const second = run(withIdentity(first, { exhausted: false })).state;
    expect(damageOf(second)).toBe(1);
    expect(second.lastingEffects).toHaveLength(0);
  });

  it("a recovery whose healing is replaced heals nothing and still ends the bonus", () => {
    const { state, events } = run(start(8, PLUS_3, INSTEAD));
    expect(damageOf(state)).toBe(8);
    expect(healed(events)).toEqual([]);
    expect(state.lastingEffects).toHaveLength(0);
    expect(mustInstance(state, identityOf(state)).exhausted).toBe(true);
  });
});
