import { PLAYABLE_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";
import { FNE_ASPECT_BASIC_BASIC as REGISTRY, FNE_ASPECT_BASIC_BASIC_SKIPPED as SKIPPED } from "./basic.js";

/**
 * Wave 11 `fne/aspect-basic/basic` (docs/phase7-wave11.md §8.4). Scaffold test: the module's script is checked in
 * isolation.
 * The scripting task adds the card scenarios here and names each registered ability id in this file (the wave's
 * coverage guard fails an id no test in the pack folder names).
 */
describe("wave 11 fne/aspect-basic/basic", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("skips only refs it does not register, each with a written reason", () => {
    for (const [id, reason] of Object.entries(SKIPPED)) {
      expect(id in REGISTRY, id).toBe(false);
      expect(reason.length, id).toBeGreaterThan(20);
    }
  });

  it("aliases each reprint to its original's script, and the printed text is the original's", () => {
    const ALIASES: readonly (readonly [string, string])[] = [["60056.when-defeated", "40059.when-defeated"]];
    const text = (code: string): string => {
      const card = PLAYABLE_CARDS.find((c) => (c.id as string) === code) as unknown as { text?: { current: string } };
      return (card.text?.current ?? "").replace(/\s+/g, " ").trim();
    };
    for (const [ref, source] of ALIASES) {
      expect(REGISTRY[ref], ref).toBe(WAVE10_ABILITIES[source]);
      expect(text(ref.split(".")[0]!), ref).not.toBe("");
      expect(text(ref.split(".")[0]!), ref).toBe(text(source.split(".")[0]!));
    }
  });
});
