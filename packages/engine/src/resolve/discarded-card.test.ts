/**
 * `needsDiscardedCard` (issue #928): which responses to a discard need the discarded card itself, and so are dropped
 * once another response has moved it. RRG 1.8 "Ability" (p. 4), "Choose" (p. 12), "'Then'" (p. 44).
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "../abilities.js";
import { TOGETHER_TARGETS_SLOT } from "../select.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { lostWithDiscardedCard, needsDiscardedCard } from "./discarded-card.js";

const that: TargetRef = { kind: "eventTarget" };
const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;
const tuck: EffectSpec = { kind: "attach", card: that, to: self, facedown: true };
const draw: EffectSpec = { kind: "draw", player: you, amount: n(1) };
const ability = (effects: readonly EffectSpec[], costEffects?: number): AbilityDefinition => ({
  trigger: { kind: "response", forced: false, on: { on: "cardDiscardedFromDeck", playerIs: "controller" } },
  effects,
  ...(costEffects === undefined ? {} : { costEffects }),
});

describe("needsDiscardedCard", () => {
  it("an effect on that card needs it; a draw does not", () => {
    expect(needsDiscardedCard(ability([tuck]))).toBe(true);
    expect(needsDiscardedCard(ability([draw]))).toBe(false);
  });

  it("every part must need it: 'draw 1 card and attach that card' keeps its draw", () => {
    expect(needsDiscardedCard(ability([draw, tuck]))).toBe(false);
  });

  it("post-'then' text is no part: 'attach that card. Then draw 1 card' needs it", () => {
    expect(needsDiscardedCard(ability([tuck, { kind: "then", effects: [draw] }]))).toBe(true);
  });

  it("a printed cost scripted as leading effects is no part", () => {
    expect(needsDiscardedCard(ability([draw, tuck], 1))).toBe(true);
  });

  it("the cards of a 'together' answer, and a choice among them, are that card", () => {
    const together: TargetRef = { kind: "slot", slot: TOGETHER_TARGETS_SLOT };
    expect(needsDiscardedCard(ability([{ kind: "attach", card: together, to: self, facedown: true }]))).toBe(true);
    const choose: EffectSpec = {
      kind: "chooseCards",
      slot: "picked",
      from: { kind: "ref", ref: together },
      chooser: you,
      min: 1,
      max: 1,
    };
    const attachPicked: EffectSpec = { kind: "attach", card: { kind: "slot", slot: "picked" }, to: self };
    expect(needsDiscardedCard(ability([choose, attachPicked]))).toBe(true);
  });

  it("a branch is judged by what it does, not by what its condition reads", () => {
    const readsThatCard = { kind: "exists", ref: that } as unknown as Extract<EffectSpec, { kind: "if" }>["condition"];
    expect(needsDiscardedCard(ability([{ kind: "if", condition: readsThatCard, then: [draw] }]))).toBe(false);
    expect(needsDiscardedCard(ability([{ kind: "if", condition: readsThatCard, then: [tuck] }]))).toBe(true);
    expect(
      needsDiscardedCard(ability([{ kind: "if", condition: readsThatCard, then: [tuck], otherwise: [draw] }])),
    ).toBe(false);
  });

  it("a 'choose one' is judged option by option: one that needs nothing of the card keeps it", () => {
    const options = (...effects: readonly EffectSpec[]) => effects.map((e, i) => ({ label: `${i}`, effects: [e] }));
    expect(needsDiscardedCard(ability([{ kind: "chooseOne", chooser: you, options: options(draw, tuck) }]))).toBe(
      false,
    );
    expect(needsDiscardedCard(ability([{ kind: "chooseOne", chooser: you, options: options(tuck, tuck) }]))).toBe(true);
  });

  it("a sentence is read inline", () => {
    expect(needsDiscardedCard(ability([{ kind: "sentence", effects: [tuck] }]))).toBe(true);
    expect(needsDiscardedCard(ability([{ kind: "sentence", effects: [draw, tuck] }]))).toBe(false);
  });
});

describe("lostWithDiscardedCard", () => {
  // p1's discard pile holds only "kept": "taken" was moved out of it by an earlier response.
  const state = { players: [{ playerId: "p1", deck: [], discard: ["kept"] }] } as unknown as GameState;
  const discard = (id: string): TriggerEvent =>
    ({
      kind: "cardDiscardedFromDeck",
      instanceId: id,
      playerId: "p1",
      deck: "player",
      fromTop: true,
      sourceInstanceId: "mill",
      at: "discard",
      by: "playerCard",
      how: "effect",
    }) as unknown as TriggerEvent;
  const NEEDS = ability([{ kind: "attach", card: { kind: "slot", slot: TOGETHER_TARGETS_SLOT }, to: self }]);
  const NEEDS_NOT = ability([draw]);
  const deps = { abilities: { needs: NEEDS, "needs-not": NEEDS_NOT } } as never;
  const candidate = (
    abilityId: string,
    together?: readonly TriggerEvent[],
    instanceId = "support",
  ): Parameters<typeof lostWithDiscardedCard>[2] =>
    ({ instanceId, abilityId, ...(together ? { together } : {}) }) as Parameters<typeof lostWithDiscardedCard>[2];

  it("a response whose card is still there is never lost", () => {
    expect(lostWithDiscardedCard(state, deps, candidate("needs"), discard("kept"))).toBe(false);
  });

  it("gone: lost if it needs the card, kept if it does not", () => {
    expect(lostWithDiscardedCard(state, deps, candidate("needs"), discard("taken"))).toBe(true);
    expect(lostWithDiscardedCard(state, deps, candidate("needs-not"), discard("taken"))).toBe(false);
  });

  it("the discarded card's own response is lost once it is gone, whatever it does", () => {
    expect(lostWithDiscardedCard(state, deps, candidate("needs-not", undefined, "taken"), discard("taken"))).toBe(true);
  });

  it("a 'together' answer keeps the cards still there, and is lost only once every card it needs is gone", () => {
    const both = [discard("taken"), discard("kept")];
    expect(lostWithDiscardedCard(state, deps, candidate("needs", both), both[0]!)).toBe(false);
    const gone = [discard("taken"), discard("also-taken")];
    expect(lostWithDiscardedCard(state, deps, candidate("needs", gone), gone[0]!)).toBe(true);
    expect(lostWithDiscardedCard(state, deps, candidate("needs-not", gone), gone[0]!)).toBe(false);
  });
});
