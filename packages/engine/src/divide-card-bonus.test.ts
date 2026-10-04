/**
 * docs/phase7-wave6.md §3.80: a divided damage takes the played card's damage bonus (`modifyCardEffect`) once per enemy
 * that takes a share. Ruling, June 25, 2026 (2): Raising Hell paid with Aggressive Energy deals "+1 damage to each
 * enemy damaged by the effect". Synthetic cards shaped like Team Strike (`mut_gen` 32045) and Aggressive Energy
 * (`mut_gen` 32047).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

/** "Deal 6 damage divided as you choose among enemies." */
const strike = stubAbility("strike.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "divide",
      what: "damage",
      amount: { kind: "const", value: 6 },
      among: { categories: ["villain", "minion"] },
      chooser: { kind: "controller" },
    },
  ],
});
/** "When you play an event, increase the amount of damage it deals by 1" (a standing Aggressive Energy). */
const energy = stubAbility("energy.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, damage: { kind: "const", value: 1 } }],
});
const STRIKE = stubEvent({ id: "strike", cost: 0, abilities: [strike.ref] });
const ENERGY = stubSupport({ id: "energy", cost: 0, abilities: [energy.ref] });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 10, boostIcons: 0 });

const deps: EngineDeps = depsOf(strike, energy);

function table(options: { bonus: boolean; minion: boolean }): { state: GameState; thug: InstanceId | null } {
  let state = gameAtFirstTurn({
    cards: [STRIKE, ENERGY, THUG],
    deps,
    deck: [STRIKE.id, ENERGY.id],
    encounter: [...copiesOf(THUG.id, 2), ...copiesOf("treachery" as CardId, 20)],
  });
  if (options.bonus) state = playerCardIntoPlay(state, ENERGY.id).state;
  if (!options.minion) return { state, thug: null };
  const engaged = minionEngagedWith(state, THUG.id);
  return { state: engaged.state, thug: engaged.id };
}

/** Plays the strike for 0 and answers the divide with `shares` (option ids). */
function play(state: GameState, shares: readonly string[]) {
  const given = giveCard(state, P1, STRIKE.id);
  let asked = false;
  const run = runCommandsPicking(
    given.state,
    deps,
    (current) => {
      if (current.pendingChoice?.prompt.kind !== "divide") return defaultPick(current);
      asked = true;
      return shares;
    },
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  );
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return { state: run.state, asked };
}

const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const shares = (id: InstanceId, n: number): string[] => Array.from({ length: n }, (_, i) => `${id}#${i + 1}`);

describe("§3.80 divided damage takes the card's damage bonus once per enemy damaged", () => {
  it("6 split 4 / 2 between two enemies with a +1 bonus: each takes its share + 1", () => {
    const { state: start, thug } = table({ bonus: true, minion: true });
    const villain = activeVillain(start)!.instanceId;
    const { state, asked } = play(start, [...shares(villain, 4), ...shares(thug!, 2)]);
    expect(asked).toBe(true);
    expect([damageOn(state, villain), damageOn(state, thug!)]).toEqual([5, 3]);
  });

  it("all 6 on one of two enemies: + 1 once, and the enemy given no share takes nothing", () => {
    const { state: start, thug } = table({ bonus: true, minion: true });
    const villain = activeVillain(start)!.instanceId;
    const { state } = play(start, shares(villain, 6));
    expect([damageOn(state, villain), damageOn(state, thug!)]).toEqual([7, 0]);
  });

  it("a single enemy takes the whole 6 without a choice, + 1 once", () => {
    const { state: start } = table({ bonus: true, minion: false });
    const villain = activeVillain(start)!.instanceId;
    const { state, asked } = play(start, []);
    expect(asked).toBe(false);
    expect(damageOn(state, villain)).toBe(7);
  });

  it("without a bonus the shares are unchanged", () => {
    const { state: start, thug } = table({ bonus: false, minion: true });
    const villain = activeVillain(start)!.instanceId;
    const { state } = play(start, [...shares(villain, 4), ...shares(thug!, 2)]);
    expect([damageOn(state, villain), damageOn(state, thug!)]).toEqual([4, 2]);
  });
});
