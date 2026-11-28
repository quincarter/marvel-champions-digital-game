// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { campaignCardsById } from "../../../../../content/campaign-pool.js";
import type { ShieldBriefing } from "../../../../../view/campaign-shield-model.js";
import { bangersMock, recorder, sectionHarness, textsOf } from "../sections.test-support.js";
import { drawShield } from "./shield.js";
import { boardCaptionIn, evidenceKindIn, membersLineIn } from "./shield-text.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("../../../../../ui/campaign-chrome.js", () => bangersMock);
vi.mock("../../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

const [a, b] = [...campaignCardsById().values()];
const brief = (over: Partial<ShieldBriefing> = {}): ShieldBriefing => ({
  evidence: [{ cardId: a!.id, name: "Wire", kind: "means" }],
  sealedCount: 3,
  rowsOpen: 12,
  rowsTotal: 27,
  members: [{ name: "Chief Hill", open: 4 }],
  boardAfter: 2,
  board: [{ cardId: b!.id, name: "Fury", attachment: true, secrets: 1 }],
  numbers: [{ key: "n", label: "Secrets", value: "3", usedIn: "Scenario #3 Setup", usedInIssue: 3 }],
  seats: [{ seatNumber: 1, heroName: "Hawkeye", status: "7 hit points", sitsOut: false }],
  flipNote: "Flips at 5.",
  ...over,
});

describe("the case file", () => {
  it("draws the evidence and the board as pictures, each a stop that opens the card", () => {
    const h = sectionHarness();
    const seen = recorder();
    h.run((base) => drawShield({ ...base, shield: brief() }, seen));
    expect(h.stopKeys()).toEqual(["shield-evidence-0", "shield-board-0"]);
    h.press("shield-board-0");
    expect(seen.cards).toEqual([{ cardId: b!.id, name: "Fury" }]);
  });

  it("says what is open, what is carried and in an expert game each seat's hit points", () => {
    const h = sectionHarness();
    const { b: out } = h.run((base) => drawShield({ ...base, shield: brief() }, recorder()));
    expect(textsOf(out)).toEqual(
      expect.arrayContaining([
        "THE CASE FILE",
        "EVIDENCE · 1 GAINED",
        "12 of 27 combinations still open. The A.I.M. envelope holds 3 sealed cards, one of each kind.",
        "Hill: 4 open",
        "EXECUTIVE BOARD · AFTER SCENARIO #2",
        "CARRIED OVER",
        "Secrets: 3  (Scenario #3 Setup)",
        "EXPERT · HIT POINTS",
        "Hawkeye: 7 hit points",
      ]),
    );
  });

  it("leaves out the empty parts", () => {
    const h = sectionHarness();
    const { b: out } = h.run((base) =>
      drawShield(
        { ...base, shield: brief({ evidence: [], board: [], numbers: [], seats: [], boardAfter: null }) },
        recorder(),
      ),
    );
    expect(h.stopKeys()).toEqual([]);
    expect(textsOf(out)).toContain("EXECUTIVE BOARD · NOT YET RECORDED");
    expect(textsOf(out)).not.toContain("EXPERT · HIT POINTS");
  });

  it("words the captions without colour alone", () => {
    expect(evidenceKindIn("motive")).toBe("Motive");
    expect(boardCaptionIn({ cardId: a!.id, name: "x", attachment: true, secrets: 2 })).toBe("Attachment · 2 secrets");
    expect(boardCaptionIn({ cardId: a!.id, name: "x", attachment: false, secrets: 1 })).toBe("1 secret");
    expect(
      membersLineIn([
        { name: "Chief Hill", open: 1 },
        { name: "Fury", open: 2 },
      ]),
    ).toBe("Hill: 1 open · Fury: 2 open");
  });
});
