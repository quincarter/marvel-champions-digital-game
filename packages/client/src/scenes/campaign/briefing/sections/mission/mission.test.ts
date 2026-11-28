// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { campaignCardsById } from "../../../../../content/campaign-pool.js";
import type { MissionBriefing } from "../../../../../view/campaign-mission-model.js";
import { bangersMock, recorder, sectionHarness, textsOf } from "../sections.test-support.js";
import { drawMission, missionRowsOf } from "./mission.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("../../../../../ui/campaign-chrome.js", () => bangersMock);
vi.mock("../../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

const [a, b] = [...campaignCardsById().values()];
const brief = (over: Partial<MissionBriefing> = {}): MissionBriefing => ({
  nodeId: "n",
  attempt: 1,
  mission: { name: "Dark Beast", cardId: a!.id as string, setup: "Put it into play." },
  overseer: { name: "Sugar Man", cardId: b!.id as string },
  prelateAbsent: null,
  earlier: [],
  carried: [],
  fixed: false,
  ...over,
});

describe("the mission section", () => {
  it("says a drawn mission and a fixed one differently, and where the Overseer is", () => {
    expect(missionRowsOf({ mission: brief() }).map((row) => row.kind)).toEqual(["Mission drawn", "Overseer drawn"]);
    expect(missionRowsOf({ mission: brief({ fixed: true }) })[0]!.kind).toBe("Mission");
    expect(missionRowsOf({ mission: brief() })[1]!.detail).toBe("In the mission area.");
    expect(missionRowsOf({ mission: brief({ prelateAbsent: "Sinister" }) })[1]!.detail).toBe(
      "Absent this game: Sinister.",
    );
  });

  it("gives each card its own Inspect chip, which opens the card and answers nothing", () => {
    const h = sectionHarness();
    const seen = recorder();
    h.run((base) => drawMission({ ...base, mission: brief() }, seen));
    expect(h.stopKeys()).toEqual(["mission-mission", "mission-overseer"]);
    h.press("mission-overseer");
    expect(seen.cards).toEqual([{ cardId: b!.id, name: "Sugar Man" }]);
    expect(h.answers).toEqual([]);
  });

  it("notes a retry, its earlier draws and what is carried over", () => {
    const h = sectionHarness();
    const { b: out } = h.run((base) =>
      drawMission(
        {
          ...base,
          mission: brief({
            attempt: 2,
            earlier: [{ attempt: 1, mission: "Fallen", overseer: null }],
            carried: ["Shuffled into every deck."],
          }),
        },
        recorder(),
      ),
    );
    expect(textsOf(out)).toEqual(
      expect.arrayContaining([
        "THIS SCENARIO",
        "ATTEMPT 2 · DRAWN AGAIN",
        "Attempt 1 drew Fallen",
        "CARRIED OVER",
        "Shuffled into every deck.",
      ]),
    );
  });
});
