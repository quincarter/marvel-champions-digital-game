/**
 * docs/phase7-wave3.md §3.41: `EffectSpec divide.upTo`, "a total of **up to** N … (as you choose)". Synthetic cards
 * shaped like Agile Flight (`stld` 17029): "Hero Action (thwart): Remove a total of up to 5 threat from among schemes
 * (as you choose)."
 *
 * Sources: RRG 1.8 "Choose (Game Element)" (p. 12), "to a maximum of the specified number"; RRG 1.8 "Cost" (p. 14)
 * requires a minimum of one only for a cost, so an effect's "up to" may divide none.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const divideEvent = (id: string, effect: EffectSpec) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [effect] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const UP_TO_5 = divideEvent("flight", {
  kind: "divide",
  what: "threat",
  amount: { kind: "const", value: 5 },
  among: { categories: ["scheme"] },
  chooser: { kind: "controller" },
  upTo: true,
});
/** The same "up to" over side schemes only, so one candidate is possible. */
const UP_TO_3_SIDE = divideEvent("sweep", {
  kind: "divide",
  what: "threat",
  amount: { kind: "const", value: 3 },
  among: { categories: ["sideScheme"] },
  chooser: { kind: "controller" },
  upTo: true,
});
/** "A total of 3" with no "up to" (Inconspicuous): unchanged, a single candidate takes it all without a choice. */
const EXACTLY_3_SIDE = divideEvent("exact", {
  kind: "divide",
  what: "threat",
  amount: { kind: "const", value: 3 },
  among: { categories: ["sideScheme"] },
  chooser: { kind: "controller" },
});
const EVENTS = [UP_TO_5, UP_TO_3_SIDE, EXACTLY_3_SIDE];
const PLOT = stubSideScheme({ id: "plot", startingThreat: 4 });

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const CARDS = [PLOT, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [PLOT.id, PLOT.id];

function table(sideSchemes: 1 | 2): { state: GameState; plots: InstanceId[] } {
  let state = gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, deck: EVENTS.map((e) => e.card.id) });
  const plots: InstanceId[] = [];
  for (let i = 0; i < sideSchemes; i++) {
    const placed = encounterCardInVillainArea(state, PLOT.id, 4);
    state = placed.state;
    plots.push(placed.id);
  }
  const main = state.mainScheme!.instanceId;
  return {
    state: { ...state, instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 6 } } },
    plots,
  };
}

/** Plays `event` for 0 and answers the divide with `shares` (option ids), everything else by default. */
function play(state: GameState, event: { card: { id: CardId } }, shares: readonly string[]) {
  const given = giveCard(state, P1, event.card.id);
  const asked: { min?: number; max?: number } = {};
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "divide") return defaultPick(current);
    asked.min = choice.minSelections;
    asked.max = choice.maxSelections;
    return shares;
  };
  const run = runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
  return { ...run, asked };
}

const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;

describe("§3.41 divide 'up to'", () => {
  it("offers 0 to 5 points and removes exactly the shares chosen", () => {
    const { state: start, plots } = table(2);
    const [a, b] = plots as [InstanceId, InstanceId];
    const main = start.mainScheme!.instanceId;
    const { state, asked, session } = play(start, UP_TO_5, [`${a}#1`, `${a}#2`, `${main}#1`]);
    expect(asked).toEqual({ min: 0, max: 5 });
    expect([threatOn(state, a), threatOn(state, b), threatOn(state, main)]).toEqual([2, 4, 5]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("may divide none: nothing is removed and the event still resolves", () => {
    const { state: start, plots } = table(2);
    const main = start.mainScheme!.instanceId;
    const { state, events } = play(start, UP_TO_5, []);
    expect([...plots.map((id) => threatOn(state, id)), threatOn(state, main)]).toEqual([4, 4, 6]);
    expect(events.some((e) => e.type === "threatRemoved")).toBe(false);
  });

  it("asks even with a single candidate, since how many is the chooser's", () => {
    const { state: start, plots } = table(1);
    const [a] = plots as [InstanceId];
    const { state, asked } = play(start, UP_TO_3_SIDE, [`${a}#1`]);
    expect(asked).toEqual({ min: 0, max: 3 });
    expect(threatOn(state, a)).toBe(3);
  });

  it("without 'up to', a single candidate still takes the full amount with no choice", () => {
    const { state: start, plots } = table(1);
    const [a] = plots as [InstanceId];
    const { state, asked } = play(start, EXACTLY_3_SIDE, []);
    expect(asked).toEqual({});
    expect(threatOn(state, a)).toBe(1);
  });
});
