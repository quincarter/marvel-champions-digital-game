/**
 * docs/phase7-wave4.md §3.41: "the total ATK of those allies" — `ValueSpec stat` with `total` sums over every card its
 * ref names (Mass Attack, `mts` 21016; Fastball Special, `wolv` 35023; Partnership of Pain, `sm` 27111).
 */

import { describe, expect, it } from "vitest";
import { NO_ABILITIES } from "./abilities.js";
import { resolveValue } from "./select.js";
import { stubAlly } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const deps = { abilities: NO_ABILITIES };
const A = stubAlly({ id: "a", cost: 0, atk: 2, thw: 1, hp: 3 });
const B = stubAlly({ id: "b", cost: 0, atk: 3, thw: 1, hp: 3 });

describe("§3.41 a stat totalled over several cards", () => {
  it("sums with `total`, reads the first card without it", () => {
    let state = gameAtFirstTurn({ cards: [A, B], deps, deck: [A.id, B.id] });
    const a = playerCardIntoPlay(state, A.id);
    const b = playerCardIntoPlay(a.state, B.id);
    state = b.state;
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: { pair: [a.id, b.id] }, deps };
    const of = { kind: "slot", slot: "pair" } as const;
    expect(resolveValue(state, { kind: "stat", of, stat: "atk", total: true }, context, deps)).toBe(5);
    expect(resolveValue(state, { kind: "stat", of, stat: "atk" }, context, deps)).toBe(2);
  });
});

describe("§3.47 a product of values read now", () => {
  it("multiplies its parts: N per player × a live count", () => {
    const state = gameAtFirstTurn({ cards: [A, B], deps, deck: [A.id, B.id] });
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
    const perHero = { kind: "perPlayer", base: 0, perPlayer: 2 } as const;
    expect(
      resolveValue(state, { kind: "product", values: [perHero, { kind: "const", value: 3 }] }, context, deps),
    ).toBe(6);
    expect(
      resolveValue(state, { kind: "product", values: [perHero, { kind: "const", value: 0 }] }, context, deps),
    ).toBe(0);
  });
});
