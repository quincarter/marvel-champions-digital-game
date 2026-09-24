import { describe, expect, test } from "vitest";
import { GMW_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
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

  test("every gmw panel rect sits inside its page's own bounds", () => {
    const story = storyFor("gmw")!;
    for (const page of story.pages ?? []) {
      for (const beat of page.beats) {
        const { x, y, w, h } = beat.panel;
        expect(x, page.file).toBeGreaterThanOrEqual(0);
        expect(y, page.file).toBeGreaterThanOrEqual(0);
        expect(x + w, page.file).toBeLessThanOrEqual(page.width);
        expect(y + h, page.file).toBeLessThanOrEqual(page.height);
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
