import { AOA_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { AOA_MISSION, AOA_MISSION_SKIPPED } from "./aoa-mission.js";

const CODES = AOA_CARDS.filter((c) => /^4516[6-9]|^45170/.test(c.id as string)).map((c) => c.id as string);
const refs = AOA_CARDS.filter((c) => CODES.includes(c.id as string)).flatMap((c) => abilityRefIds(c));

describe("Missions (45166a/b to 45170a/b)", () => {
  it("registers all fifteen refs as valid definitions, each reaching the mission area; nothing is skipped", () => {
    expect(CODES).toHaveLength(10);
    expect(Object.keys(AOA_MISSION).sort()).toEqual([...refs].sort());
    expect(refs).toHaveLength(15);
    expect(AOA_MISSION_SKIPPED).toEqual({});
    for (const [id, definition] of Object.entries(AOA_MISSION)) {
      expect(validateDefinition(definition), id).toEqual([]);
      expect(definition.reaches, id).toEqual({ scenarioPlayArea: "mission" });
    }
  });

  it("the five a faces are one script and the b faces differ only in their two bullets", () => {
    const faces = (suffix: string) => Object.entries(AOA_MISSION).filter(([id]) => id.includes(suffix));
    const [firstResponse] = faces("a.").filter(([id]) => id.endsWith("forced-response"));
    for (const [id, definition] of faces("a.").filter(([key]) => key.endsWith("forced-response")))
      expect(definition, id).toEqual(firstResponse![1]);
    const [firstDefeat] = faces("a.when-defeated");
    for (const [id, definition] of faces("a.when-defeated")) expect(definition, id).toEqual(firstDefeat![1]);
    expect(new Set(faces("b.").map(([, definition]) => JSON.stringify(definition))).size).toBe(5);
  });

  it("the five a faces print the same attempt and defeat lines, and each b face one flip response", () => {
    for (const a of ["45166a", "45167a", "45168a", "45169a", "45170a"]) {
      const card = AOA_CARDS.find((c) => c.id === a) as { text: { current: string }; startingThreat: unknown };
      expect(card.text.current, a).toContain("After you resolve a mission attempt, place 1 attempt counter here");
      expect(card.startingThreat).toEqual({ base: 0, perPlayer: 5 });
    }
    for (const b of ["45166b", "45167b", "45168b", "45169b", "45170b"]) {
      const card = AOA_CARDS.find((c) => c.id === b) as { text: { current: string } };
      expect(card.text.current, b).toContain("After you flip to this side, remove each card in the mission area");
    }
  });
});
