import { describe, expect, test } from "vitest";
import { CAMPAIGN_ART, campaignRulebookPageFor } from "../art/campaign-art.js";
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

describe("box scenarios reuse the rulebook's own reveal page", () => {
  // docs/phase7-wave5-handoff.md "Scenario intros from the rulebook art": each entry is the page right before that
  // scenario's own Setup instructions in the box's rulebook (mc*_rules*.pdf, transcribed in
  // docs/campaign-modes/markdown/), i.e. the page right before the scenario's own header page.
  const EXPECTED: ReadonlyArray<readonly [scenarioId: string, campaignId: string, page: number]> = [
    ["sandman", "sm", 8],
    ["venom", "sm", 10],
    ["mysterio", "sm", 12],
    ["sinister-six", "sm", 14],
    ["venom-goblin", "sm", 16],
    ["brotherhood-of-badoon", "gmw", 7],
    ["infiltrate-the-museum", "gmw", 9],
    ["escape-the-museum", "gmw", 11],
    ["nebula", "gmw", 13],
    ["ebony-maw", "mts", 5],
    ["tower-defense", "mts", 9],
    ["thanos", "mts", 15],
    ["hela", "mts", 19],
    ["loki", "mts", 23],
    ["crossbones", "trors", 4],
    ["absorbing-man", "trors", 6],
    ["taskmaster", "trors", 9],
    ["zola", "trors", 11],
    ["red-skull", "trors", 14],
  ];

  test.each(EXPECTED)(
    "%s opens on %s's rulebook page %i, already lettered, with no lines of its own",
    (scenarioId, campaignId, page) => {
      const intro = scenarioIntroFor(scenarioId)!;
      expect(intro).not.toBeNull();
      expect(intro.art).toEqual({ kind: "rulebook", campaignId, page });
      expect(intro.page.lettered).toBe(true);
      expect(intro.page.beats.length).toBeGreaterThan(0);
      for (const beat of intro.page.beats) expect(beat.lines).toEqual([]);
      // The page this points at is actually captured on disk (`art/campaigns/<box>/rulebook/`), not a dangling ref.
      expect(campaignRulebookPageFor(CAMPAIGN_ART, campaignId, page)).not.toBeNull();
    },
  );

  test("Ronan the Accuser's own rulebook page wasn't captured, so it falls back to no intro", () => {
    expect(scenarioIntroFor("ronan-the-accuser")).toBeNull();
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
