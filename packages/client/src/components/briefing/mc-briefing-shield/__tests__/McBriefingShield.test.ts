// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { findAll, mount, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-shield.js";

afterEach(() => document.body.replaceChildren());

const picture = { src: null, missing: "no scan" };
const shield = {
  evidence: [],
  rowsOpen: 18,
  rowsTotal: 27,
  sealedCount: 3,
  members: [{ name: "Chief Hill", open: 4 }],
  board: [],
  boardAfter: 1,
  flipNote: "A Board Member flips at 4 secrets and stays flipped.",
  numbers: [{ label: "Alert Level", value: 2, usedIn: "scenario 3" }],
  seats: [],
};

describe("mc-briefing-shield", () => {
  it("states the case file in words: the evidence heading, the open combinations, the board and the carried numbers", async () => {
    const el = await mount("mc-briefing-shield", {
      model: {
        shield,
        evidence: [{ cardId: "50001", name: "Means card", kind: "means", caption: "Means", picture }],
        board: [{ cardId: "50002", name: "Chief Medical Officer", caption: "3 secrets", picture }],
        phone: false,
      },
    });
    const words = wordsOf(el);
    expect(words).toContain("THE CASE FILE");
    expect(words).toContain("EVIDENCE · 1 GAINED");
    expect(words).toContain("18 of 27 combinations still open");
    expect(words).toContain("EXECUTIVE BOARD · AFTER SCENARIO #1");
    expect(words).toContain("A Board Member flips at 4 secrets and stays flipped.");
    expect(words).toContain("Alert Level: 2");
    expect(stopsOf(el)).toEqual(["shield-evidence-0", "shield-board-0"]);
  });

  it("with nothing held it draws no picture rows, and lists an expert seat hit points", async () => {
    const el = await mount("mc-briefing-shield", {
      model: {
        shield: { ...shield, numbers: [], seats: [{ heroName: "Colossus", status: "3 HP left", sitsOut: true }] },
        evidence: [],
        board: [],
        phone: false,
      },
    });
    expect(findAll(el, "mc-briefing-shield-pictures")).toHaveLength(0);
    expect(wordsOf(el)).toContain("Colossus: 3 HP left");
  });
});
