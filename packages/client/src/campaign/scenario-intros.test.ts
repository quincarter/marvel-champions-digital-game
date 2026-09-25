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

describe("scenario intro bubble placement", () => {
  test("every quip's tail lands inside its beat's crop, and the reader view carries the pin", async () => {
    const { comicReaderViewOf, resolveComicBeats } = await import("../view/comic-reader-model.js");
    const { page } = scenarioIntroFor("rhino")!;
    const steps = resolveComicBeats(
      [page],
      page.beats.map((_, beatIndex) => ({ page: page.file, beatIndex })),
    );
    page.beats.forEach(({ panel, lines }, index) => {
      for (const line of lines) {
        const placement = line.placement!;
        expect(placement).toBeDefined();
        // The bubble may sit past the panel's edge (into the gutter); the speaker it points at must be in the shot.
        const { speaker } = placement;
        expect(speaker.x).toBeGreaterThanOrEqual(panel.x);
        expect(speaker.x).toBeLessThanOrEqual(panel.x + panel.w);
        expect(speaker.y).toBeGreaterThanOrEqual(panel.y);
        expect(speaker.y).toBeLessThanOrEqual(panel.y + panel.h);
      }
      // With Spider-Man at the table and without him (his lines become narration), the pin comes along.
      for (const roster of [["01001a"], []]) {
        const view = comicReaderViewOf(steps, index, roster);
        expect(view.step.lines.every((line) => line.placement !== undefined)).toBe(true);
      }
    });
  });
});
