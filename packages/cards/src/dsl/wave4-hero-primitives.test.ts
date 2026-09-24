/**
 * docs/phase7-wave4.md §3.17–§3.22: the DSL builders for the hero-pack and The Hood primitives of cycle 3. Each
 * composition is the one the spec gives the scripter for a printed card; this file proves each validates and emits the
 * plain data the per-primitive engine test drives.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { exhaustEachCost, heroAction, heroInterrupt, on } from "./abilities.js";
import { damageAnEnemy, dealDamage, draw, preventDamage, ready } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventSource, query, statOf, sum } from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);
const AVENGER = trait("AVENGER");
const GUARDIAN = trait("GUARDIAN");
const avengerAndGuardian = exhaustEachCost({
  avenger: query(["identity", "ally"], { trait: AVENGER }),
  guardian: query(["identity", "ally"], { trait: GUARDIAN }),
});
const combined = (stat: "atk" | "thw") => sum(statOf(chosen("avenger"), stat), statOf(chosen("guardian"), stat));

describe("§3.17 Alliance: 'Exhaust an [Avenger] character and a [Guardian] character →' (exhaustEachCost)", () => {
  it("emits one pick per slot, each of exactly one card", () => {
    expect(avengerAndGuardian).toEqual({
      exhaustCards: [
        { slot: "avenger", query: { categories: ["identity", "ally"], trait: AVENGER }, min: 1, max: 1 },
        { slot: "guardian", query: { categories: ["identity", "ally"], trait: GUARDIAN }, min: 1, max: 1 },
      ],
    });
  });

  it("As One! (23032): the combined ATK of those characters reads both slots", () => {
    valid(heroAction({ label: "attack", cost: avengerAndGuardian }, damageAnEnemy(combined("atk"))));
  });

  it("Stand Together (23034): a hero interrupt with the two-slot cost validates", () => {
    valid(
      heroInterrupt(
        on.damage(query(["identity", "ally"]), { fromAttack: true }),
        { cost: avengerAndGuardian },
        preventDamage(),
        dealDamage(1, eventSource),
      ),
    );
  });

  it("refuses a single slot: that is exhaustCardsCost", () => {
    expect(() => exhaustEachCost({ avenger: query("ally") })).toThrow(/two slots/);
  });

  it("the validator knows both slots: reading an unbound slot is an error, reading a bound one is not", () => {
    valid(heroAction({ cost: avengerAndGuardian }, ready(chosen("guardian")), draw(1)));
    expect(validateDefinition(heroAction({ cost: avengerAndGuardian }, ready(chosen("other"))))).not.toEqual([]);
  });
});
