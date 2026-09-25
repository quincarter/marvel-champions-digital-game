import { describe, expect, test } from "vitest";
import { GMW_CAMPAIGN_DEFINITION, MTS_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { SAGA_VOLUMES, issueStoryFor, lineForRoster, storyFor } from "./story.js";

describe("campaign story", () => {
  test("MC10's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("trors");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      TRORS_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
  });

  test("MC16's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("gmw");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      GMW_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
  });

  test("MC21's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("mts");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      MTS_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
  });

  test("every mts comicBeats ref points at a page and beat that exist, and every page file is used by some issue or the finale", () => {
    const story = storyFor("mts")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      for (const ref of issue.comicBeats ?? []) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `mts comicBeats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `mts comicBeats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
      }
    }
    if (story.finale.page) usedFiles.add(story.finale.page);
    for (const page of pages) {
      expect(usedFiles.has(page.file), `mts page never used: ${page.file}`).toBe(true);
    }
  });

  test("every comicBeats ref points at a page and beat that exist, and every page file is used by some issue or is the box's known unwired aftermath/finale page", () => {
    const story = storyFor("gmw")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      for (const ref of issue.comicBeats ?? []) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `gmw comicBeats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `gmw comicBeats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
      }
    }
    // 04-knowhere (scenario 4 aftermath) and 06-finale (the finale spread) are recorded but not wired to an
    // issue opener yet — those screens land in a later pass (see the story file's own header note).
    const unwired = new Set(["04-knowhere", "06-finale"]);
    for (const page of pages) {
      if (!usedFiles.has(page.file)) expect(unwired.has(page.file), `gmw page never used: ${page.file}`).toBe(true);
    }
  });

  test("MC10's comicBeats ref points at a page and beat that exist, every page file is used or is the unwired epilogue, and every issue's own beats climb in reading order", () => {
    const story = storyFor("trors")!;
    const pages = story.pages!;
    const usedFiles = new Set<string>();
    for (const issue of story.issues) {
      const refs = issue.comicBeats ?? [];
      let lastPage: string | null = null;
      let lastBeatIndex = -1;
      for (const ref of refs) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `trors comicBeats: unknown page "${ref.page}"`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `trors comicBeats: ${ref.page}#${ref.beatIndex}`).toBeDefined();
        usedFiles.add(ref.page);
        // Reading order within one page climbs (a page shared across two issues, like GMW's museum split, can
        // pick up mid-page rather than always starting at beat 0 — the prior issue already claimed the earlier
        // beats), but this issue's own refs never repeat or reverse a beat on the same page.
        if (ref.page === lastPage) {
          expect(ref.beatIndex, `${issue.nodeId}: ${ref.page} beats out of reading order`).toBeGreaterThan(
            lastBeatIndex,
          );
        }
        lastPage = ref.page;
        lastBeatIndex = ref.beatIndex;
      }
    }
    // 08-epilogue is the finale's own page — recorded for a later comic pass over the Finale screen, not wired
    // to any issue yet (see the story file's own header note).
    const unwired = new Set(["08-epilogue"]);
    for (const page of pages) {
      if (!usedFiles.has(page.file)) expect(unwired.has(page.file), `trors page never used: ${page.file}`).toBe(true);
    }
  });

  test("every MC10 page is marked lettered — the reader draws none of its own captions/bubbles over the box's official art", () => {
    for (const page of storyFor("trors")!.pages ?? []) expect(page.lettered, page.file).toBe(true);
  });

  test("every trors page file on disk exists in art/campaigns/trors/pages, matching the story's own page list", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/trors/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith("."))
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    const named = (storyFor("trors")!.pages ?? []).map((page) => page.file).sort();
    expect(onDisk).toEqual(named);
  });

  test("every gmw stagePanels ref points at a page and beat that exist", () => {
    const story = storyFor("gmw")!;
    const pages = story.pages!;
    for (const issue of story.issues) {
      for (const [stage, ref] of Object.entries(issue.stagePanels ?? {})) {
        const page = pages.find((p) => p.file === ref.page);
        expect(page, `gmw stagePanels: ${issue.nodeId} stage ${stage}: unknown page "${ref.page}"`).toBeDefined();
        expect(
          page!.beats[ref.beatIndex],
          `gmw stagePanels: ${issue.nodeId} stage ${stage}: ${ref.page}#${ref.beatIndex}`,
        ).toBeDefined();
        // A `stagePanels` entry with no matching `stageLines` entry would draw a panel with an empty speech
        // bubble — the beat never opens for a stage the story has nothing to say about (`campaign-beat-model.ts`),
        // so a `stagePanels` entry with no line is dead data.
        expect(
          issue.stageLines[Number(stage)],
          `gmw stagePanels: ${issue.nodeId} stage ${stage} has no matching stageLines entry`,
        ).toBeDefined();
      }
    }
  });

  test("every mts page file on disk exists in art/campaigns/mts/pages, matching the story's own page list", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/mts/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith(".") && file !== "CREDITS.md")
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    const named = (storyFor("mts")!.pages ?? []).map((page) => page.file).sort();
    expect(onDisk).toEqual(named);
  });

  test("every gmw, trors and mts panel rect sits inside its page's own bounds", () => {
    for (const campaignId of ["gmw", "trors", "mts"]) {
      const story = storyFor(campaignId)!;
      for (const page of story.pages ?? []) {
        for (const beat of page.beats) {
          const { x, y, w, h } = beat.panel;
          expect(x, `${campaignId}/${page.file}`).toBeGreaterThanOrEqual(0);
          expect(y, `${campaignId}/${page.file}`).toBeGreaterThanOrEqual(0);
          expect(x + w, `${campaignId}/${page.file}`).toBeLessThanOrEqual(page.width);
          expect(y + h, `${campaignId}/${page.file}`).toBeLessThanOrEqual(page.height);
        }
      }
    }
  });

  test("a hero line falls back to narration when that hero did not sign the roster", () => {
    const line = issueStoryFor("trors", "crossbones")!.opener[2]!.lines[0]!;
    expect(lineForRoster(line, ["04001a"])?.speaker.kind).toBe("hero");
    expect(lineForRoster(line, ["01001a"])).toEqual({ speaker: { kind: "narrator" }, text: line.fallback });
    const noFallback = issueStoryFor("trors", "crossbones")!.opener[2]!.lines[1]!;
    expect(lineForRoster(noFallback, ["01001a"])).toBeNull();
  });

  test("the saga lists nine campaign boxes and no Civil War", () => {
    expect(SAGA_VOLUMES.map((volume) => volume.boxCode)).not.toContain("MC56");
    expect(SAGA_VOLUMES).toHaveLength(9);
  });
});
