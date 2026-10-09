/**
 * docs/phase7-wave8.md §3.18: `EffectSpec revealNextVillainStage`, the stage change of a villain's defeat with no
 * defeat. A synthetic villain shaped like Apocalypse I to IV (`aoa` 45101a, 45101b, 45102a, 45102b): stages I to III
 * print "Forced Interrupt: When the main scheme is completed, remove all threat from it (ignoring any crisis icons).
 * Flip this card and reveal [the next stage]."
 *
 * Sources: RRG 1.8 "Villain Defeat" (p. 47: "The next sequential stage of the villain deck is revealed. Set the
 * villain's hit point dial as indicated by that stage", and for a stage with the same title "attachments, upgrades,
 * status cards, counters, and non-damage tokens on a villain carry over"), "Toughness" (p. 45), "Stalwart" (p. 40),
 * "Main Scheme, Main Scheme Deck" (p. 27), "Crisis Icon" (p. 14); owner answer Q11 (docs/phase7-wave8.md §4.1): the new
 * stage enters at its full printed hit points.
 */

import { perPlayerOnly, flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { hasKeyword } from "./keywords.js";
import { mustInstance, villainStageOf } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubVillain,
} from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const mainScheme: TargetRef = { kind: "mainScheme" };
const theVillain: TargetRef = { kind: "villain" };

/** Each stage prints its own copy of the interrupt, as the three cards do. */
const nextStage = (stage: string) =>
  stubAbility(`tyrant-${stage}.forced-interrupt`, {
    trigger: { kind: "interrupt", forced: true, on: { on: "mainSchemeCompleting" } },
    effects: [
      { kind: "removeThreat", target: mainScheme, amount: { kind: "threat", of: mainScheme }, ignoreCrisis: true },
      { kind: "revealNextVillainStage", villain: theVillain },
    ],
  });
const NEXT_STAGES = [nextStage("i"), nextStage("ii"), nextStage("iii")] as const;
/** Stage III's When Revealed, to show the new stage is revealed. */
const ARRIVES = stubAbility("tyrant-iii.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addCounters", target: self, counterType: "arrived", amount: { kind: "const", value: 1 } }],
});
/** Answers a defeat-driven stage advance only: it must stay silent here. */
const AFTER_ADVANCE = stubAbility("tyrant.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "addCounters", target: self, counterType: "fell", amount: { kind: "const", value: 1 } }],
});

/** A player card's "When the main scheme would be completed, remove 2 threat from it instead." */
const HOLD = stubAbility("hold.interrupt", {
  trigger: { kind: "interrupt", forced: true, would: true, on: { on: "mainSchemeCompleting" } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "removeThreat", target: mainScheme, amount: { kind: "const", value: 2 } }],
    },
  ],
});
const HOLDER = stubSupport({ id: "holder", cost: 0, abilities: [HOLD.ref] });

const TYRANT = stubVillain({
  id: "tyrant",
  stages: [
    { hp: perPlayerOnly(8), atk: 2, sch: 1, keywords: [{ name: "toughness" }], abilities: [NEXT_STAGES[0].ref] },
    {
      hp: perPlayerOnly(9),
      atk: 2,
      sch: 2,
      keywords: [{ name: "steady" }, { name: "toughness" }],
      abilities: [NEXT_STAGES[1].ref, AFTER_ADVANCE.ref],
    },
    {
      hp: perPlayerOnly(10),
      atk: 3,
      sch: 2,
      keywords: [{ name: "stalwart" }, { name: "toughness" }],
      abilities: [NEXT_STAGES[2].ref, ARRIVES.ref],
    },
    { hp: perPlayerOnly(11), atk: 3, sch: 3, keywords: [{ name: "toughness" }] },
  ],
});
const SCHEME = stubMainScheme({
  id: "age",
  stages: [{ startingThreat: flat(0), targetThreat: flat(5), acceleration: flat(0) }],
});
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, icons: ["crisis"] });
const GEAR = stubAttachment({ id: "gear" });

const THREATEN_ABILITY = stubAbility("threaten.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 5 } }] satisfies EffectSpec[],
});
const THREATEN = stubEvent({ id: "threaten", cost: 0, abilities: [THREATEN_ABILITY.ref] });
/** The bare effect, with no main scheme involved. */
const REVEAL_ABILITY = stubAbility("reveal-next.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealNextVillainStage", villain: theVillain }] satisfies EffectSpec[],
});
const REVEAL = stubEvent({ id: "reveal-next", cost: 0, abilities: [REVEAL_ABILITY.ref] });
const deps: EngineDeps = depsOf(HOLD, ...NEXT_STAGES, ARRIVES, AFTER_ADVANCE, THREATEN_ABILITY, REVEAL_ABILITY);

/** The game with the villain on `stageIndex` of a range ending at `lastStageIndex` (surgery after setup). */
function start(stageIndex: number, players: 1 | 3 = 1, lastStageIndex = 3): GameState {
  const base = gameAtFirstTurn({
    cards: [TYRANT, SCHEME, CRISIS, GEAR, HOLDER, THREATEN, REVEAL],
    deps,
    villain: TYRANT,
    mainScheme: SCHEME,
    players,
    encounter: [CRISIS.id, GEAR.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [HOLDER.id, ...copiesOf(THREATEN.id, 2), ...copiesOf(REVEAL.id, 2)],
  });
  const villainId = base.activeVillainId;
  return {
    ...base,
    villains: base.villains.map((v) => ({ ...v, stageIndex, lastStageIndex })),
    instances: {
      ...base.instances,
      [villainId]: { ...mustInstance(base, villainId), statuses: { stunned: 0, confused: 0, tough: 0 } },
    },
  };
}
const patchVillain = (state: GameState, patch: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    [state.activeVillainId]: { ...mustInstance(state, state.activeVillainId), ...patch },
  },
});
const villain = (state: GameState) => mustInstance(state, state.activeVillainId);
const stageNumber = (state: GameState) => villainStageOf(state, state.activeVillainId).stageNumber;
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

describe("§3.18 revealNextVillainStage", () => {
  it("the main scheme completed at stage II: the threat is removed, stage III is revealed at full hit points, everything on him stays", () => {
    const gear = encounterCardInVillainArea(start(1), GEAR.id);
    const hurt = patchVillain(
      {
        ...gear.state,
        villainArea: gear.state.villainArea.filter((id) => id !== gear.id),
        instances: {
          ...gear.state.instances,
          [gear.id]: { ...mustInstance(gear.state, gear.id), attachedTo: gear.state.activeVillainId },
        },
      },
      {
        damage: 4,
        statuses: { stunned: 0, confused: 1, tough: 0 },
        counters: { mark: 2 },
        attachments: [gear.id],
      },
    );
    const { state: after, events, session } = playFree(hurt, deps, THREATEN.id);
    expect(after.outcome).toBeNull();
    expect(threat(after)).toBe(0);
    expect(after.mainScheme.completed).toBe(false);
    expect(stageNumber(after)).toBe(3);
    // Full printed hit points (Q11): 10 per player, no damage.
    expect(villain(after).damage).toBe(0);
    // Attachments and counters carry over; toughness gives a tough status card; the When Revealed resolved.
    expect(villain(after).attachments).toEqual([gear.id]);
    expect(villain(after).counters).toEqual({ mark: 2, arrived: 1 });
    expect(villain(after).statuses.tough).toBe(1);
    expect(events.filter((e) => e.type === "villainStageRevealed")).toEqual([
      {
        type: "villainStageRevealed",
        instanceId: after.activeVillainId,
        stageIndex: 2,
        fromStageNumber: 2,
        toStageNumber: 3,
        cause: "effect",
      },
    ]);
    // Not a defeat, not a completion, and one stage only: stage III's own copy of the interrupt does not answer the
    // completion stage II's already undid.
    expect(types(events)).not.toContain("mainSchemeCompleted");
    expect(types(events)).not.toContain("characterDefeated");
    expect(types(events)).not.toContain("villainStageAdvanced");
    expect(villain(after).counters["fell"]).toBeUndefined();
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a status card the new stage cannot have is discarded: stage III is stalwart", () => {
    const stunned = patchVillain(start(1), { statuses: { stunned: 1, confused: 1, tough: 0 } });
    const after = playFree(stunned, deps, THREATEN.id).state;
    expect(stageNumber(after)).toBe(3);
    expect(hasKeyword(after, after.activeVillainId, "stalwart", deps)).toBe(true);
    expect(villain(after).statuses).toEqual({ stunned: 0, confused: 0, tough: 1 });
  });

  it("a tough status card he already has is kept, and toughness adds none past the limit of one", () => {
    const tough = patchVillain(start(0), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const after = playFree(tough, deps, THREATEN.id).state;
    expect(stageNumber(after)).toBe(2);
    expect(villain(after).statuses.tough).toBe(1);
  });

  it("'ignoring any crisis icons': with a crisis side scheme in play the threat is still removed", () => {
    const crisis = encounterCardInVillainArea(start(1), CRISIS.id, 3);
    const after = playFree(crisis.state, deps, THREATEN.id).state;
    expect(threat(after)).toBe(0);
    expect(stageNumber(after)).toBe(3);
    expect(after.outcome).toBeNull();
  });

  it("3 players: the new stage's dial is its per-player value, with no damage", () => {
    const hurt = patchVillain(start(1, 3), { damage: 20 });
    const after = playFree(hurt, deps, THREATEN.id).state;
    expect(stageNumber(after)).toBe(3);
    expect(villain(after).damage).toBe(0);
  });

  it("a 'would be completed … instead' interrupt resolves first and leaves the villain's interrupt nothing to hear (RRG 1.8 \"'Would'\", p. 48)", () => {
    const held = playerCardIntoPlay(start(1), HOLDER.id).state;
    const { state: after, events } = playFree(held, deps, THREATEN.id);
    expect(threat(after)).toBe(3);
    expect(stageNumber(after)).toBe(2);
    expect(types(events)).not.toContain("villainStageRevealed");
    expect(after.outcome).toBeNull();
  });

  it("the last stage prints no interrupt: completing the main scheme there loses the game", () => {
    const after = playFree(start(3), deps, THREATEN.id).state;
    expect(after.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("with no next stage in the game's range the effect does nothing", () => {
    const last = patchVillain(start(2, 1, 2), { damage: 3 });
    const { state: after, events } = playFree(last, deps, REVEAL.id);
    expect(stageNumber(after)).toBe(3);
    expect(villain(after).damage).toBe(3);
    expect(types(events)).not.toContain("villainStageRevealed");
  });

  it("the bare effect from any ability: the next stage, full hit points, no defeat", () => {
    const { state: after, events } = playFree(patchVillain(start(0), { damage: 7 }), deps, REVEAL.id);
    expect(stageNumber(after)).toBe(2);
    expect(villain(after).damage).toBe(0);
    expect(types(events)).toContain("villainStageRevealed");
    expect(types(events)).not.toContain("characterDefeated");
  });
});
