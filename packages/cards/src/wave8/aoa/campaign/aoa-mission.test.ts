import { AOA_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { AOA_MISSION, AOA_MISSION_SKIPPED } from "./aoa-mission.js";

const CODES = AOA_CARDS.filter((c) => /^4516[6-9]|^45170/.test(c.id as string)).map((c) => c.id as string);
const refs = AOA_CARDS.filter((c) => CODES.includes(c.id as string)).flatMap((c) => abilityRefIds(c));

describe("Missions (45166a/b to 45170a/b): every ref waits on the mission area", () => {
  it("registers nothing: all fifteen refs are skipped, each with a reason naming its queue task", () => {
    expect(CODES).toHaveLength(10);
    expect(Object.keys(AOA_MISSION)).toEqual([]);
    expect(Object.keys(AOA_MISSION_SKIPPED).sort()).toEqual([...refs].sort());
    expect(refs).toHaveLength(15);
    for (const [id, reason] of Object.entries(AOA_MISSION_SKIPPED)) expect(reason, id).toMatch(/task/);
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
