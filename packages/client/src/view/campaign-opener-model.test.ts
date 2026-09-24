import { describe, expect, test } from "vitest";
import { TRORS_STORY } from "../campaign/stories/trors.js";
import { openerViewOf } from "./campaign-opener-model.js";

const CROSSBONES = TRORS_STORY.issues[0]!;
const HAWKEYE_ID = "04001a";
const SPIDER_WOMAN_ID = "04031a";

describe("openerViewOf", () => {
  test("reveals only the first panel to start, with the second as the next hint", () => {
    const view = openerViewOf(CROSSBONES, 1, 5, [HAWKEYE_ID, SPIDER_WOMAN_ID], 1);
    expect(view.issueLabel).toBe("ISSUE #1 OF 5");
    expect(view.title).toBe("Blitz on the Mountain");
    expect(view.panels[0]!.revealed).toBe(true);
    expect(view.panels[0]!.caption).toContain("The Adirondacks");
    expect(view.panels[1]!.revealed).toBe(false);
    expect(view.panels[1]!.isNext).toBe(true);
    expect(view.panels[2]!.revealed).toBe(false);
    expect(view.panels[2]!.isNext).toBe(false);
    expect(view.ctaLabel).toBe("TAP TO CONTINUE 1/3");
    expect(view.allRevealed).toBe(false);
  });

  test("the villain panel keeps its sfx and villain art", () => {
    const view = openerViewOf(CROSSBONES, 1, 5, [HAWKEYE_ID, SPIDER_WOMAN_ID], 2);
    const villainPanel = view.panels[1]!;
    expect(villainPanel.revealed).toBe(true);
    expect(villainPanel.art).toEqual({ kind: "villain" });
    expect(villainPanel.sfx).toBe("KRA-KOOM!");
    expect(villainPanel.lines[0]!.text).toContain("Knock knock");
  });

  test("every panel revealed reads SUIT UP and drops the next hint", () => {
    const view = openerViewOf(CROSSBONES, 1, 5, [HAWKEYE_ID, SPIDER_WOMAN_ID], 3);
    expect(view.allRevealed).toBe(true);
    expect(view.ctaLabel).toBe("SUIT UP ▸");
    expect(view.panels.every((panel) => !panel.isNext)).toBe(true);
  });

  test("a hero not on the roster falls back to the narrator caption line, and a fallback-less line drops", () => {
    const view = openerViewOf(CROSSBONES, 1, 5, [], 3);
    const heroPanel = view.panels[2]!;
    // Hawkeye's line has a `fallback`; Spider-Woman's reply in the same panel doesn't, so an empty roster keeps
    // only the narrated line — never Spider-Woman's own text attributed to nobody.
    expect(heroPanel.lines).toHaveLength(1);
    expect(heroPanel.lines[0]!.speaker).toEqual({ kind: "narrator" });
    expect(heroPanel.lines[0]!.text).toContain("Somebody likes those odds");
  });

  test("clamps a revealed count outside the panel range", () => {
    expect(openerViewOf(CROSSBONES, 1, 5, [], 0).panels[0]!.revealed).toBe(true);
    expect(openerViewOf(CROSSBONES, 1, 5, [], 99).allRevealed).toBe(true);
  });
});
