/**
 * `Predicate thwartInProgress` (docs/phase7-wave8.md §3.70): the sibling of `attackInProgress` for a thwart, usable as
 * a constant stat modifier's `while`. Synthetic side scheme shaped like "Each [Squad] character gets +1 THW while
 * making a basic thwart against this scheme."
 *
 * Sources: RRG 1.8 "Thwart" (p. 44): a basic thwart removes threat equal to the character's THW, read as the thwart
 * resolves; "Constant Abilities" (p. 12): active while the card is in play and its condition holds.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { InstanceId } from "./ids.js";
import { characterProfile, mustInstance } from "./query.js";
import { evaluate, type EffectContext } from "./select.js";
import type { Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const SQUAD = trait("Squad");
const AGAINST_THIS: Predicate = {
  kind: "thwartInProgress",
  thwarter: { inSlot: "affected" },
  scheme: { self: true },
  basic: true,
};
// "Each Squad character gets +1 THW while making a basic thwart against this scheme."
const DRILL_CONSTANT = stubAbility("drill.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      { stat: "thw", amount: 1, target: { categories: ["identity", "ally"], trait: SQUAD }, while: AGAINST_THIS },
    ],
  },
  effects: [],
} as AbilityDefinition);
const DRILL = stubSideScheme({ id: "drill", startingThreat: 6, abilities: [DRILL_CONSTANT.ref] });
const OTHER = stubSideScheme({ id: "other", startingThreat: 6 });
const CADET = stubAlly({ id: "cadet", cost: 0, atk: 1, thw: 2, hp: 4, traits: [SQUAD] });
const MATE = stubAlly({ id: "mate", cost: 0, atk: 1, thw: 2, hp: 4, traits: [SQUAD] });
const LONER = stubAlly({ id: "loner", cost: 0, atk: 1, thw: 2, hp: 4 });
// "Action: Remove 1 threat from the drill, then place counters on the drill equal to the cadet's THW." Not a thwart.
const PROBE = stubAbility("probe.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "removeThreat", target: { kind: "named", name: "drill" }, amount: { kind: "const", value: 1 } },
    {
      kind: "addCounters",
      target: { kind: "named", name: "drill" },
      counterType: "read",
      amount: { kind: "stat", of: { kind: "named", name: "cadet" }, stat: "thw" },
    },
  ],
});
const PROBE_CARD = stubEvent({ id: "probe", cost: 0, abilities: [PROBE.ref] });
// "Forced Interrupt: When a character thwarts, record the cadet's and the mate's THW on them." Read mid-thwart.
const readThw = (name: string) =>
  ({
    kind: "addCounters",
    target: { kind: "named", name },
    counterType: "thw",
    amount: { kind: "stat", of: { kind: "named", name }, stat: "thw" },
  }) as const;
const WATCH_INTERRUPT = stubAbility("watch.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "thwart" } },
  effects: [readThw("cadet"), readThw("mate")],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(DRILL_CONSTANT, PROBE, WATCH_INTERRUPT);

function table() {
  const base = gameAtFirstTurn({
    cards: [DRILL, OTHER, CADET, MATE, LONER, PROBE_CARD, WATCH],
    deps,
    deck: [CADET.id, MATE.id, LONER.id, PROBE_CARD.id, WATCH.id],
    encounter: [DRILL.id, OTHER.id, ...copiesOf(TREACHERY.id, 20)],
  });
  const cadet = playerCardIntoPlay(base, CADET.id);
  const mate = playerCardIntoPlay(cadet.state, MATE.id);
  const loner = playerCardIntoPlay(mate.state, LONER.id);
  const drill = encounterCardInVillainArea(loner.state, DRILL.id, 6);
  const other = encounterCardInVillainArea(drill.state, OTHER.id, 6);
  return { state: other.state, cadet: cadet.id, mate: mate.id, loner: loner.id, drill: drill.id, other: other.id };
}
const thwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const threat = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;

describe("thwartInProgress as a constant stat modifier's condition", () => {
  it("a Squad character's basic thwart against the scheme removes THW + 1", () => {
    const t = table();
    const after = runCommands(t.state, deps, thwart(t.cadet, t.drill)).state;
    expect(threat(after, t.drill)).toBe(6 - 3);
  });

  it("against another scheme, or by a character without the trait, it removes its THW", () => {
    const t = table();
    expect(threat(runCommands(t.state, deps, thwart(t.cadet, t.other)).state, t.other)).toBe(6 - 2);
    expect(threat(runCommands(t.state, deps, thwart(t.loner, t.drill)).state, t.drill)).toBe(6 - 2);
  });

  it("only the character making the thwart: another Squad character's THW is unchanged while it resolves", () => {
    const t = table();
    const watched = playerCardIntoPlay(t.state, WATCH.id).state;
    const after = runCommands(watched, deps, thwart(t.cadet, t.drill)).state;
    expect(mustInstance(after, t.cadet).counters.thw).toBe(3);
    expect(mustInstance(after, t.mate).counters.thw).toBe(2);
  });

  it("outside a thwart the bonus is not there: the profile reads the printed THW", () => {
    const t = table();
    expect(characterProfile(t.state, t.cadet, deps)?.thw).toBe(2);
    const after = runCommands(t.state, deps, thwart(t.cadet, t.drill)).state;
    expect(characterProfile(after, t.cadet, deps)?.thw).toBe(2);
  });

  it("threat removed by an effect that is no thwart does not turn it on (THW read as 2 meanwhile)", () => {
    const t = table();
    const after = playFree(t.state, deps, PROBE_CARD.id).state;
    expect(threat(after, t.drill)).toBe(5);
    expect(mustInstance(after, t.drill).counters.read).toBe(2);
  });

  it("the predicate itself: false with no thwart on the stack", () => {
    const t = table();
    const context: EffectContext = { selfInstanceId: t.drill, controllerId: null, event: null, bindings: {}, deps };
    expect(evaluate(t.state, { kind: "thwartInProgress" }, context)).toBe(false);
  });
});
