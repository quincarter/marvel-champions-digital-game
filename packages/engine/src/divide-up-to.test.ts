/**
 * docs/phase7-wave3.md §3.41: `EffectSpec divide.upTo`, "a total of **up to** N … (as you choose)". Synthetic cards
 * shaped like Agile Flight (`stld` 17029): "Hero Action (thwart): Remove a total of up to 5 threat from among schemes
 * (as you choose)."
 *
 * §4 Q16, decided by the user on 2026-09-23: an effect's "up to N" chooses at least one whenever something can be
 * targeted (unless a printed "may" makes it optional), so Agile Flight removes at least 1 threat whenever a scheme holds
 * threat it can lose, and 0 only when none does. Only valid targets are offered (RRG 1.8 "Target", p. 43).
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
  it("offers 1 to 5 points and removes exactly the shares chosen", () => {
    const { state: start, plots } = table(2);
    const [a, b] = plots as [InstanceId, InstanceId];
    const main = start.mainScheme!.instanceId;
    const { state, asked, session } = play(start, UP_TO_5, [`${a}#1`, `${a}#2`, `${main}#1`]);
    expect(asked).toEqual({ min: 1, max: 5 });
    expect([threatOn(state, a), threatOn(state, b), threatOn(state, main)]).toEqual([2, 4, 5]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("refuses 0 while threat can be removed, with one scheme or with several (§4 Q16)", () => {
    const two = table(2).state;
    expect(() => play(two, UP_TO_5, [])).toThrow(/rejected/);
    const one = table(1);
    expect(() => play(one.state, UP_TO_3_SIDE, [])).toThrow(/rejected/);
    // The minimum is 1: a single point is enough.
    const [a] = one.plots as [InstanceId];
    expect(threatOn(play(one.state, UP_TO_3_SIDE, [`${a}#1`]).state, a)).toBe(3);
  });

  it("offers only schemes it can remove threat from; with none, nothing is asked and nothing happens", () => {
    const { state: start, plots } = table(2);
    const [a, b] = plots as [InstanceId, InstanceId];
    const main = start.mainScheme!.instanceId;
    const emptied: GameState = {
      ...start,
      instances: { ...start.instances, [a]: { ...mustInstance(start, a), threat: 0 } },
    };
    let offered: readonly string[] = [];
    const given = giveCard(emptied, P1, UP_TO_5.card.id);
    runCommandsPicking(
      given.state,
      deps,
      (current) => {
        const choice = current.pendingChoice;
        if (choice?.prompt.kind !== "divide") return defaultPick(current);
        offered = choice.options.map((o) => o.optionId.slice(0, o.optionId.lastIndexOf("#")));
        return [`${b}#1`];
      },
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    );
    expect(new Set(offered)).toEqual(new Set([b, main]));
    // No side scheme holds threat: the side-scheme-only division has no valid target and removes nothing.
    const bare: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [a]: { ...mustInstance(start, a), threat: 0 },
        [b]: { ...mustInstance(start, b), threat: 0 },
      },
    };
    const { asked, events } = play(bare, UP_TO_3_SIDE, []);
    expect(asked).toEqual({});
    expect(events.some((e) => e.type === "threatRemoved")).toBe(false);
  });

  it("asks even with a single candidate, since how many is the chooser's", () => {
    const { state: start, plots } = table(1);
    const [a] = plots as [InstanceId];
    const { state, asked } = play(start, UP_TO_3_SIDE, [`${a}#1`]);
    expect(asked).toEqual({ min: 1, max: 3 });
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
