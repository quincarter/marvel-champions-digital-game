import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POINTS, UNLOCK_HEROES, UNLOCK_WAVES } from "../progression/unlocks.js";
import { progressionGuideOf, waveGuideLines } from "./progression-guide.js";

const guideText = progressionGuideOf()
  .flatMap((s) => [s.heading, ...s.paragraphs, ...s.bullets])
  .join("\n");
const doc = readFileSync(new URL("../../../../docs/progression.md", import.meta.url), "utf8");

describe("progressionGuideOf", () => {
  it("opens by saying this is the app's feature, not the card game's rules", () => {
    const first = progressionGuideOf()[0]!;
    expect(first.heading).toBe("Part of this app, not the card game");
    expect(first.paragraphs.join(" ")).toContain("aren't in Marvel Champions' rules");
  });

  it("states every point value the progression runs on", () => {
    for (const value of Object.values(POINTS)) expect(guideText).toContain(String(value));
  });

  it("names every wave and every hero outside the Core Set", () => {
    expect(waveGuideLines()).toHaveLength(UNLOCK_WAVES.length);
    for (const hero of UNLOCK_HEROES.filter((h) => h.cycleId !== "core")) expect(guideText).toContain(hero.name);
    expect(waveGuideLines()[1]).toBe(
      "Wave 1: beat Rhino. Then, a villain each: Captain America for Rhino; Ms. Marvel for Klaw; Thor for Ultron; " +
        "Black Widow for Norman Osborn (Risky Business); Doctor Strange for Green Goblin (Mutagen Formula); " +
        "Hulk for Wrecker (Breakout).",
    );
  });
});

describe("docs/progression.md", () => {
  it("says it is a client feature, not a game rule", () => {
    expect(doc).toContain("This is a feature of this client, not of Marvel Champions.");
  });

  it("keeps the same numbers as the code", () => {
    const rows: [string, number][] = [
      ["First win against a scenario", POINTS.firstWin],
      ["First Expert (or Extreme) win", POINTS.firstExpertWin],
      ["Completing a campaign ", POINTS.campaign],
      ["Completing it as an Expert Campaign", POINTS.expertCampaign],
      ["One hero's precon", POINTS.unlockHero],
      ["One campaign", POINTS.unlockCampaign],
    ];
    for (const [label, value] of rows) {
      const line = doc.split("\n").find((l) => l.includes(label));
      expect(line, label).toBeDefined();
      expect(line!.replace(/\s+/g, " "), label).toMatch(new RegExp(`\\| \\+?${value}\\b`));
    }
  });

  it("names every hero on the unlock path", () => {
    for (const hero of UNLOCK_HEROES.filter((h) => h.cycleId !== "core")) expect(doc).toContain(hero.name);
  });
});
