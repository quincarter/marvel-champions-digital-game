/**
 * `needsDiscardedCard` (issue #928): which responses to a discard need the discarded card itself, and so are dropped
 * once another response has moved it. RRG 1.8 "Ability" (p. 4), "Choose" (p. 12), "'Then'" (p. 44).
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "../abilities.js";
import { TOGETHER_TARGETS_SLOT } from "../select.js";
import type { EffectSpec, Predicate, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { lostWithDiscardedCard, needsDiscardedCard, stillDiscardedTargets } from "./discarded-card.js";

const that: TargetRef = { kind: "eventTarget" };
const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;
const tuck: EffectSpec = { kind: "attach", card: that, to: self, facedown: true };
const draw: EffectSpec = { kind: "draw", player: you, amount: n(1) };
/** "That card is there": `anyIn(eventTarget)` in the card DSL. */
const thatCardThere: Predicate = { kind: "compare", left: { kind: "refCount", of: that }, op: "atLeast", right: n(1) };
const readsVar = { kind: "compare", left: { kind: "var", name: "x" }, op: "atLeast", right: n(1) } as Predicate;
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

  it("an amount read from that card is not what needs it: '1 plus that card's cost' still draws", () => {
    const plusCost: EffectSpec = {
      kind: "draw",
      player: you,
      amount: { kind: "sum", values: [n(1), { kind: "printedCost", of: that }] },
    };
    expect(needsDiscardedCard(ability([plusCost]))).toBe(false);
    const forEachIcon: EffectSpec = {
      kind: "addCounters",
      target: self,
      counterType: "threat",
      amount: { kind: "totalPrintedResources", cards: that, types: ["mental"] },
    };
    expect(needsDiscardedCard(ability([forEachIcon]))).toBe(false);
  });

  it("a union of card selectors needs it only when every alternative does", () => {
    const union = (...refs: readonly TargetRef[]): EffectSpec => ({
      kind: "moveCards",
      cards: { kind: "anyOf", of: refs.map((ref) => ({ kind: "ref", ref }) as const) },
      to: "hand",
    });
    expect(needsDiscardedCard(ability([union(that, self)]))).toBe(false);
    expect(needsDiscardedCard(ability([union(that, that)]))).toBe(true);
  });

  it("an exclusion of that card is no operand ('each other enemy')", () => {
    const others: EffectSpec = {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["enemy"], excluding: that } },
      amount: n(1),
    };
    expect(needsDiscardedCard(ability([others]))).toBe(false);
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

  it("a branch needs the card when each branch that could run does", () => {
    const always: Predicate = { kind: "not", of: thatCardThere };
    // Untold (no `judge`), either branch could run.
    expect(needsDiscardedCard(ability([{ kind: "if", condition: always, then: [draw] }]))).toBe(false);
    expect(needsDiscardedCard(ability([{ kind: "if", condition: always, then: [tuck] }]))).toBe(true);
    expect(needsDiscardedCard(ability([{ kind: "if", condition: always, then: [tuck], otherwise: [draw] }]))).toBe(
      false,
    );
  });

  it("a var set for later effects is no part of its own", () => {
    const snapshot: EffectSpec = { kind: "setVar", name: "before", value: n(1) };
    expect(needsDiscardedCard(ability([snapshot, tuck]))).toBe(true);
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
    // Forced: the classifier alone, with no valid-target judgment (`abilityLacksValidTarget` needs a whole game).
    ({ instanceId, abilityId, forced: true, ...(together ? { together } : {}) }) as Parameters<
      typeof lostWithDiscardedCard
    >[2];

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

  it("a condition on that card is read with the real evaluator, 'that card' naming nothing", () => {
    const registry = {
      abilities: {
        ifThere: ability([{ kind: "if", condition: thatCardThere, then: [draw] }]),
        ifNotThere: ability([{ kind: "if", condition: { kind: "not", of: thatCardThere }, then: [draw] }]),
        tuckElseDraw: ability([{ kind: "if", condition: thatCardThere, then: [tuck], otherwise: [draw] }]),
        drawElseTuck: ability([{ kind: "if", condition: thatCardThere, then: [draw], otherwise: [tuck] }]),
        bound: ability([
          { kind: "if", condition: { kind: "and", of: [thatCardThere, readsVar] } as Predicate, then: [draw] },
        ]),
      },
    } as never;
    const gone = discard("taken");
    expect(lostWithDiscardedCard(state, registry, candidate("ifThere"), gone)).toBe(true);
    expect(lostWithDiscardedCard(state, registry, candidate("ifNotThere"), gone)).toBe(false);
    expect(lostWithDiscardedCard(state, registry, candidate("tuckElseDraw"), gone)).toBe(false);
    expect(lostWithDiscardedCard(state, registry, candidate("drawElseTuck"), gone)).toBe(true);
    // Reads a var the ability binds as it resolves: not told yet, so its draw keeps it.
    expect(lostWithDiscardedCard(state, registry, candidate("bound"), gone)).toBe(false);
  });

  it("a condition is not read now behind a cost or an earlier part, which can change it before it is reached", () => {
    const ifThere: EffectSpec = { kind: "if", condition: thatCardThere, then: [draw] };
    const registry = {
      abilities: {
        costly: { ...ability([ifThere]), cost: { exhaustSelf: true } },
        scriptedCost: ability([draw, ifThere], 1),
        later: ability([{ kind: "addCounters", target: self, counterType: "seen", amount: n(0) }, ifThere]),
      },
    } as never;
    for (const id of ["costly", "scriptedCost", "later"])
      expect(lostWithDiscardedCard(state, registry, candidate(id), discard("taken"))).toBe(false);
  });

  it("a 'choose one' option whose condition now reads false cannot be chosen", () => {
    const options = (drawWhen?: Predicate) => [
      { label: "attach", effects: [tuck] },
      { label: "draw", ...(drawWhen ? { condition: drawWhen } : {}), effects: [draw] },
    ];
    const registry = {
      abilities: {
        open: ability([{ kind: "chooseOne", chooser: you, options: options() }]),
        barred: ability([{ kind: "chooseOne", chooser: you, options: options(thatCardThere) }]),
      },
    } as never;
    expect(lostWithDiscardedCard(state, registry, candidate("open"), discard("taken"))).toBe(false);
    expect(lostWithDiscardedCard(state, registry, candidate("barred"), discard("taken"))).toBe(true);
    // Every option's condition reads false: nothing can be chosen.
    const none = {
      abilities: {
        none: ability([
          {
            kind: "chooseOne",
            chooser: you,
            options: [
              { label: "a", condition: thatCardThere, effects: [draw] },
              { label: "b", condition: thatCardThere, effects: [draw] },
            ],
          },
        ]),
      },
    } as never;
    expect(lostWithDiscardedCard(state, none, candidate("none"), discard("taken"))).toBe(true);
  });

  it("a 'together' answer keeps the cards still there, and is lost only once every card it needs is gone", () => {
    const both = [discard("taken"), discard("kept")];
    expect(lostWithDiscardedCard(state, deps, candidate("needs", both), both[0]!)).toBe(false);
    const gone = [discard("taken"), discard("also-taken")];
    expect(lostWithDiscardedCard(state, deps, candidate("needs", gone), gone[0]!)).toBe(true);
    expect(lostWithDiscardedCard(state, deps, candidate("needs-not", gone), gone[0]!)).toBe(false);
  });
});

describe("stillDiscardedTargets", () => {
  it("binds a together answer's cards still in the discard pile, not those a response moved", () => {
    const state = { players: [{ playerId: "p1", deck: [], discard: ["kept"] }] } as unknown as GameState;
    const discard = (id: string) =>
      ({ kind: "cardDiscardedFromDeck", instanceId: id, playerId: "p1", at: "discard" }) as unknown as TriggerEvent;
    expect(stillDiscardedTargets(state, [discard("taken"), discard("kept")])).toEqual(["kept"]);
  });
});
