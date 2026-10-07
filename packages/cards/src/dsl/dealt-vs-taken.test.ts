/**
 * `on.damage`'s two response readings (owner ruling 2026-10-07, docs/phase7-wave7.md §4.1; RRG 1.8 "Prevent", p. 35):
 * `dealt` for "after X deals / is dealt damage", `taken` for "after X takes damage". The engine's
 * `dealt-vs-taken.test.ts` drives them; docs/dealt-vs-taken-audit.md lists every script's reading.
 */
import type { EventPattern } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_ABILITIES } from "../playable/index.js";
import { forcedInterrupt, forcedResponse, on } from "./abilities.js";
import { draw, preventDamage } from "./effects.js";
import { validateDefinition } from "./validate.js";

const READING =
  'a response to damage says whether it reads damage dealt or damage taken (on.damage\'s "dealt" or "taken")';

describe("on.damage: damage dealt or damage taken", () => {
  it("`dealt` reads the event's dealt amount, `taken` its amount result", () => {
    expect(on.damage("host", { fromAttack: true, dealt: 3 })).toEqual({
      on: "dealDamage",
      targetIs: { hostOfSelf: true },
      fromAttack: true,
      eventAtLeast: { dealt: 3 },
    });
    expect(on.damage("self", { dealt: true })).toEqual({
      on: "dealDamage",
      selfIs: "target",
      eventAtLeast: { dealt: 1 },
    });
    expect(on.damage("self", { taken: true })).toEqual({
      on: "dealDamage",
      selfIs: "target",
      requireResults: { amount: 1 },
    });
    expect(on.youDealDamage({ categories: ["enemy"] })).toMatchObject({ eventAtLeast: { dealt: 1 } });
    expect(on.consequentialDamage("self", { from: "attack" })).toMatchObject({ requireResults: { amount: 1 } });
  });

  it("a response to damage that names neither reading is refused; an interrupt needs none", () => {
    expect(validateDefinition(forcedResponse(on.damage("self"), draw(1)))).toContain(READING);
    expect(validateDefinition(forcedResponse(on.damage("self", { dealt: true }), draw(1)))).toEqual([]);
    expect(validateDefinition(forcedResponse(on.damage("self", { taken: true }), draw(1)))).toEqual([]);
    expect(validateDefinition(forcedInterrupt(on.damage("self"), preventDamage(1)))).toEqual([]);
  });

  it("every scripted response to damage reads one of the two, and the three 'deals' cards read dealt", () => {
    const reading = (pattern: EventPattern): "dealt" | "taken" | "none" =>
      pattern.eventAtLeast?.dealt !== undefined
        ? "dealt"
        : pattern.requireResults?.amount !== undefined || pattern.eventAtLeast?.taken !== undefined
          ? "taken"
          : "none";
    const hears = (pattern: EventPattern) =>
      (typeof pattern.on === "string" ? [pattern.on] : pattern.on).includes("dealDamage");
    const byReading: Record<string, string[]> = { dealt: [], taken: [], none: [] };
    for (const [id, ability] of Object.entries(PLAYABLE_ABILITIES)) {
      const trigger = ability.trigger;
      if (trigger.kind !== "response" || !hears(trigger.on)) continue;
      byReading[reading(trigger.on)]!.push(id);
    }
    expect(byReading.none).toEqual([]);
    expect(byReading.dealt!.sort()).toEqual([
      "16149.power-stone-forced-response",
      "19028.challenge-accepted-forced-response",
    ]);
    expect(byReading.taken).toHaveLength(19);
    // Schadenfreude's lasting "each time you deal any amount of damage" is the third dealt reader.
    expect(JSON.stringify(PLAYABLE_ABILITIES["16032.schadenfreude-action"]?.effects)).toContain(
      '"eventAtLeast":{"dealt":1}',
    );
  });
});
