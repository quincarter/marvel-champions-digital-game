/**
 * rules-qa-engineer pin for docs/phase7-wave3.md §4 Q4 (open question): "A defeated minion leaves play before its
 * When Defeated resolves." The ruling of Jan 11, 2026 (1) ("Fearless Determination & When Defeated Timing") keeps
 * a defeated *side scheme* in play until its own When Defeated ability resolves. `resolve/defeat.ts`'s
 * `applyDefeat` moves a defeated *minion* (or ally) to its discard pile first (`defeatFromPlay`), and only then
 * pushes its own When Defeated frames — the opposite order from the side scheme path (`victory-keyword.test.ts`'s
 * own "a defeated side scheme with it goes there after its When Defeated resolves" pins that half already; this
 * file pins the minion half, which nothing did before this pass).
 *
 * No cycle 2 card reads the difference (docs/phase7-wave3.md §3.4's own text), so this is not tied to a wrong game
 * result today — it is a pin against a future card that cares (e.g. a minion's own "When Defeated: return this
 * card to play" or a constant that reads "while in play"), and against the ruling being read to cover minions too
 * in a later FAQ update.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playFree } from "./testing/wave3.js";
import type { EffectSpec, TargetRef } from "./spec.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const each = (categories: readonly "minion"[]): TargetRef => ({ kind: "each", query: { categories } });

/** "When Defeated: nothing printed happens, but the ability itself must resolve to prove the ordering." */
const GRUNT_DEFEATED = stubAbility("grunt.when-defeated", { trigger: { kind: "whenDefeated" }, effects: [] });
const GRUNT = stubMinion({ id: "q4-grunt", atk: 1, sch: 1, hp: 7, abilities: [GRUNT_DEFEATED.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const SMASH = actionEvent("q4-smash", [{ kind: "dealDamage", target: each(["minion"]), amount: n(10) }]);

const deps: EngineDeps = depsOf(GRUNT_DEFEATED, SMASH.ability);
const CARDS = [GRUNT, SMASH.card];
const ENCOUNTER: readonly CardId[] = [GRUNT.id, ...copiesOf(GRUNT.id, 5)];

describe("§4 Q4: a defeated minion leaves play before its own When Defeated resolves", () => {
  it("today's engine: 'cardMoved' (to the encounter discard pile) fires before 'abilityResolved' (the minion's own When Defeated) — the opposite order from a defeated side scheme (victory-keyword.test.ts)", () => {
    const base = gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, deck: copiesOf(SMASH.card.id, 2) });
    const grunt = minionEngagedWith(base, GRUNT.id);
    const { events } = playFree(grunt.state, deps, SMASH.card.id);
    const order = events.flatMap((event) =>
      event.type === "cardMoved" && event.instanceId === grunt.id
        ? ["cardMoved"]
        : event.type === "abilityResolved" && event.abilityId === GRUNT_DEFEATED.ref.id
          ? ["whenDefeated"]
          : [],
    );
    expect(order).toEqual(["cardMoved", "whenDefeated"]);
  });
});
