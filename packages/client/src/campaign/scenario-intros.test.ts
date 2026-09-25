import { describe, expect, test } from "vitest";
import { ART_CATALOG, introArtFor } from "../art/scenario-art.js";
import { POOL_SCENARIOS } from "../content/pool.js";
import { scenarioIntroFor } from "./scenario-intros.js";

describe("scenario intros", () => {
  test("Rhino opens on its artboard: Spider-Man, then Rhino, then the whole picture", () => {
    const intro = scenarioIntroFor("rhino")!;
    expect(intro).not.toBeNull();
    expect(introArtFor(ART_CATALOG, "rhino")?.key).toBe("scene-art:scenarios/rhino/intro.jpg");
    const { beats, width, height } = intro.page;
    expect(beats).toHaveLength(3);
    expect(beats[2]!.panel).toEqual({ x: 0, y: 0, w: width, h: height });
  });

  test("every beat's crop lies inside its artboard, for a real pool scenario", () => {
    for (const scenario of POOL_SCENARIOS) {
      const intro = scenarioIntroFor(scenario.id as string);
      if (!intro) continue;
      const { width, height, beats } = intro.page;
      for (const { panel } of beats) {
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.y).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.w).toBeLessThanOrEqual(width);
        expect(panel.y + panel.h).toBeLessThanOrEqual(height);
      }
    }
  });

  test("a hero's quip degrades to narration when that hero isn't at the table", () => {
    const intro = scenarioIntroFor("rhino")!;
    const heroLines = intro.page.beats.flatMap((beat) => beat.lines).filter((line) => line.speaker.kind === "hero");
    expect(heroLines.length).toBeGreaterThan(0);
    for (const line of heroLines) expect(line.fallback).toBeTruthy();
  });

  test("a scenario without an intro has none", () => {
    expect(scenarioIntroFor("klaw")).toBeNull();
  });
});
