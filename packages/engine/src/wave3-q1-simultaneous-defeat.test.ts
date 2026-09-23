/**
 * rules-qa-engineer pin for docs/phase7-wave3.md §4 Q1 (open question, no RRG rule for it — "Winning the Game",
 * p. 48, has no rule for a simultaneous win and loss): "A deferred villain defeat and a simultaneous last
 * elimination." §3.1's own docblock claims: "When a villain's defeat goes on the stack (because an ability
 * listens to it) and the same defeat sweep eliminates the last player, the elimination happens first and the game
 * is lost."
 *
 * **Finding: that claim does not hold for the case this test builds, and the discrepancy is worth a second look
 * from `game-rules-architect`.** A single `dealDamage` effect whose target is `each` of a query matching both the
 * villain and the sole player's identity (both at lethal damage from the same effect resolution) does **not**
 * produce a "loss" — it produces a **win** (`villainDefeated`), and the identity never takes damage at all. Each
 * target of an `each` effect is applied one at a time, in whatever order `selectTargets` returns them; the first
 * target processed here is the villain, whose deferred-but-heard defeat resolves to `endGame({ result: "win" })`
 * before the loop ever reaches the identity — so "simultaneous" damage from one effect is not actually
 * simultaneous in its game-ending consequences, it is a race decided by iteration order. That is a different (and
 * arguably more surprising) reading than the sequential "elimination first" scenario §3.1's docblock describes,
 * and it was not exercised by any existing engine test before this pass (`villain-defeat.test.ts` and
 * `defeat-destination.test.ts` each test their own mechanism in isolation, never both at once against the same
 * two characters).
 *
 * This test pins **today's actual observed behavior** (a win), not the doc's claim (a loss) — re-verified directly
 * against the engine, not assumed from the docblock. RRG 1.8 has no rule for this either way; flagged here rather
 * than decided. If `game-rules-architect` changes target-iteration order, or batches an `each` effect's targets
 * through the same single-sweep `damageGroup` mechanism indirect damage already uses (`resolve/damage-group.ts`,
 * RRG 1.8 "Indirect Damage" p. 24's own "assigned and then resolved simultaneously"), this is the test that should
 * flip — and docs/phase7-wave3.md §4 Q1's own docblock should be corrected to match, either way.
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
  it("today's engine: the villain (processed first by `each`) wins the game outright — the identity is never even damaged", () => {
    const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, villain: VILLAIN });
    const identityId = mustPlayer(base, P1).identity.instanceId;
    const { state } = playFree(base, deps, NOVA_BLAST.id);
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(mustPlayer(state, P1).eliminated).toBe(false);
    // The identity was never reached: the `each` loop stopped once the villain's own defeat ended the game.
    expect(mustInstance(state, identityId).damage).toBe(0);
  });
});
