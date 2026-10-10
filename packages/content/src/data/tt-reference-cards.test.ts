import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateScenario } from "../schema/index.js";
import type { Scenario } from "../schema/index.js";
import { TT_SCENARIOS } from "./tt/scenarios.js";

const godOfLies = TT_SCENARIOS.find((s) => s.id === "god-of-lies") as Scenario;

describe("tt Scenario.referenceCards (docs/phase7-wave9.md section 1.15 item 9)", () => {
  it("God of Lies carries the Shatter the Illusion and Epic Multiplayer Reminder cards; Enchantress carries none", () => {
    expect(godOfLies.referenceCards?.map((r) => r.id)).toEqual(["shatter-the-illusion", "epic-multiplayer-reminder"]);
    expect(TT_SCENARIOS.find((s) => s.id === "enchantress")?.referenceCards).toBeUndefined();
  });

  it("transcribes the printed text and points each image at a tracked scan", () => {
    const [shatter, epic] = godOfLies.referenceCards ?? [];
    expect(shatter?.text).toContain("3. Deal each player 1 facedown encounter card.");
    expect(epic?.text).toContain("Cross-group communication is allowed and highly encouraged!");
    for (const r of godOfLies.referenceCards ?? [])
      expect(existsSync(new URL(`../../../../${r.image}`, import.meta.url)), r.image).toBe(true);
  });

  it("validates, and the validator rejects a duplicate id or an empty field", () => {
    expect(validateScenario(godOfLies).errors).toEqual([]);
    const [a] = godOfLies.referenceCards ?? [];
    if (!a) throw new Error("no reference card");
    expect(validateScenario({ ...godOfLies, referenceCards: [a, a] }).errors.join()).toContain("repeats id");
    expect(validateScenario({ ...godOfLies, referenceCards: [{ ...a, text: "" }] }).errors.join()).toContain("text");
    expect(validateScenario({ ...godOfLies, referenceCards: [] }).errors.join()).toContain("non-empty");
  });
});
