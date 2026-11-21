/**
 * `needsDiscardedCard` (issue #928): which responses to a discard need the discarded card itself, and so are dropped
 * once another response has moved it. RRG 1.8 "Ability" (p. 4), "Choose" (p. 12), "'Then'" (p. 44).
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "../abilities.js";
import { TOGETHER_TARGETS_SLOT } from "../select.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import { needsDiscardedCard } from "./discarded-card.js";

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

  it("a sentence is read inline", () => {
    expect(needsDiscardedCard(ability([{ kind: "sentence", effects: [tuck] }]))).toBe(true);
    expect(needsDiscardedCard(ability([{ kind: "sentence", effects: [draw, tuck] }]))).toBe(false);
  });
});
