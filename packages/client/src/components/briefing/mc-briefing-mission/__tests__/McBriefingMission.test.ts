// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { findAll, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-mission.js";

afterEach(() => document.body.replaceChildren());

const mission = {
  attempt: 1,
  fixed: false,
  mission: { cardId: "45001", name: "Reach the Vault", setup: "Place 2 threat." },
  overseer: { cardId: "45002", name: "Overseer Kane" },
  prelateAbsent: "Prelate Ward",
  earlier: [],
  carried: [],
};

describe("mission section", () => {
  it("shows the drawn mission and the Overseer, and which Prelate is absent", async () => {
    const el = await mount("mc-briefing-mission", { mission });
    expect(findAll(el, "mc-briefing-mission-row")).toHaveLength(2);
    expect(wordsOf(el)).toContain("THIS SCENARIO");
    expect(wordsOf(el)).toContain("Absent this game: Prelate Ward.");
    expect(wordsOf(el)).not.toContain("drawn again");
  });

  it("a retry names the attempt, the earlier draws and what carries over", async () => {
    const el = await mount("mc-briefing-mission", {
      mission: {
        ...mission,
        attempt: 2,
        earlier: [{ attempt: 1, mission: "Old Mission", overseer: null }],
        carried: ["Lose 1 resource."],
      },
    });
    expect(wordsOf(el)).toContain("ATTEMPT 2 · DRAWN AGAIN");
    expect(wordsOf(el)).toContain("Attempt 1 drew Old Mission");
    expect(wordsOf(el)).toContain("CARRIED OVER");
    expect(wordsOf(el)).toContain("Lose 1 resource.");
  });
});
