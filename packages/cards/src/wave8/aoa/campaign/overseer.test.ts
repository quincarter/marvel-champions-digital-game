import { AOA_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { OVERSEER, OVERSEER_SKIPPED } from "./overseer.js";

const CODES = ["45179a", "45180a", "45181a", "45182a", "45183a"];
const refsOf = (codes: readonly string[]): string[] =>
  AOA_CARDS.filter((c) => codes.includes(c.id as string)).flatMap((c) => abilityRefIds(c));

describe("Overseer (45179a to 45183a): every ref waits on the mission area", () => {
  it("registers nothing: all ten refs are skipped, each with a reason naming its queue task", () => {
    expect(Object.keys(OVERSEER)).toEqual([]);
    expect(Object.keys(OVERSEER_SKIPPED).sort()).toEqual(refsOf(CODES).sort());
    expect(refsOf(CODES)).toHaveLength(10);
    for (const [id, reason] of Object.entries(OVERSEER_SKIPPED)) expect(reason, id).toMatch(/task/);
  });

  it("names the mission on every face (the printed lines the skips stand for)", () => {
    for (const code of CODES) {
      const card = AOA_CARDS.find((c) => c.id === code) as { text: { current: string } };
      expect(card.text.current, code).toContain("another minion is at the mission");
    }
  });

  it("the four Mission Responses are in the data as forced responses (the parser's reading, spec 1.25)", () => {
    const responses = refsOf(CODES).filter((id) => id.endsWith("forced-response"));
    expect(responses.sort()).toEqual([
      "45180a.the-shadow-king-forced-response",
      "45181a.abyss-forced-response",
      "45182a.sugar-man-forced-response",
      "45183a.mikhail-rasputin-forced-response",
    ]);
  });
});
