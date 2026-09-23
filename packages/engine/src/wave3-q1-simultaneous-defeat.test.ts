/**
 * rules-qa-engineer pin for docs/phase7-wave3.md §4 Q1: "A deferred villain defeat and a simultaneous last
 * elimination", settled by FFG rulings.
 *
 * The first version of this pin found the engine producing a **win**: a single `dealDamage` effect with an `each`
 * target applied its targets one at a time, so the villain (first in the loop, its defeat listened to) fell and ended
 * the game before the identity was ever damaged. Two rulings make that wrong:
 *
 * - Ruling, June 2, 2026 (2) answer 1 (clarifying RRG 1.8 "Damage", p. 14): damage one effect deals to several
 *   characters "is dealt simultaneously; resolve damage steps for both enemies at the same time". Every target is dealt
 *   its damage before any defeat is checked.
 * - FFG ruling, May 18, 2023 (The Kraken, "each other character takes 1 damage", defeating every character): "the
 *   players are considered to have lost the scenario ... there aren't any ties in Marvel Champions between the villain
 *   and the heroes, so if the heroes don't win, they have lost." RRG 1.8 "Winning the Game" (p. 48) and "Player
 *   Elimination" (p. 34) have no rule of their own for the tie.
 *
 * The engine now deals multi-target damage as one simultaneous group and, while an identity falls in the same defeat
 * sweep, holds the villain's defeat until the eliminations apply. This pins the corrected outcome: a **loss**. The
 * engine's own tests for both halves are in `simultaneous-damage.test.ts`.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetRef } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubVillain } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const n = (value: number) => ({ kind: "const", value }) as const;

/** "When this villain would be defeated, note it" — listens without replacing, so the defeat is deferred (heard),
 * exactly the precondition §3.1's docblock names ("because an ability listens to it"). */
const WITNESS = stubAbility("villain.witness", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: n(1) }],
});
const VILLAIN = stubVillain({
  id: "one-hp-villain",
  stages: [{ hp: flat(1), atk: 1, sch: 1, abilities: [WITNESS.ref] }],
});

/** One `dealDamage` effect, `each` of a query matching both the villain and every identity — 50 damage each, well
 * past the villain's 1 HP and the default `HERO`'s 10 HP (`testing/scenario.js`). */
const NOVA_BLAST_ACTION = stubAbility("nova-blast.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "dealDamage", target: { kind: "each", query: { categories: ["identity", "villain"] } }, amount: n(50) },
  ],
});
const NOVA_BLAST = stubEvent({ id: "nova-blast", cost: 0, abilities: [NOVA_BLAST_ACTION.ref] });

const deps: EngineDeps = depsOf(WITNESS, NOVA_BLAST_ACTION);
const CARDS = [NOVA_BLAST];
const DECK: readonly CardId[] = [NOVA_BLAST.id];

describe("§4 Q1: a deferred villain defeat and a simultaneous last-player elimination", () => {
  it("is a loss: both are dealt their damage at once, and the last elimination beats the villain's defeat", () => {
    const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, villain: VILLAIN });
    const identityId = mustPlayer(base, P1).identity.instanceId;
    const { state } = playFree(base, deps, NOVA_BLAST.id);
    expect(state.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
    expect(mustPlayer(state, P1).eliminated).toBe(true);
    // The identity was dealt its damage in the same step as the villain, not skipped by an early win.
    expect(mustInstance(state, identityId).damage).toBeGreaterThanOrEqual(10);
  });
});
