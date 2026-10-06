/** NeXt Evolution's (MC40) story file, checked against the campaign definition in the `CAMPAIGNS` registry. */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPAIGNS } from "@mc/cards";
import { describe, expect, test } from "vitest";
import { ART_CATALOG } from "../art/scenario-art.js";
import { CAMPAIGN_ART, campaignPageFor } from "../art/campaign-art.js";
import { scenarioIntroFor } from "./scenario-intros.js";
import { issueStoryFor, lineForRoster, storyFor } from "./story.js";

const story = storyFor("next_evol")!;
const NODE_IDS = CAMPAIGNS.next_evol!.graph.nodes.map((node) => node.id);
const NODES = NODE_IDS.map((id) => ({ id }));

describe("NeXt Evolution's story (MC40)", () => {
  test("is registered and has exactly one issue per campaign node, in node order", () => {
    expect(story).toBeDefined();
    expect(NODES).toHaveLength(5);
    expect(story.issues.map((issue) => issue.nodeId)).toEqual(NODE_IDS);
    expect(issueStoryFor("next_evol", "stryfe")?.villain).toBe("Stryfe");
  });

  test("every issue carries the whole set of copy the other boxes' issues do", () => {
    for (const issue of story.issues) {
      const where = `next_evol ${issue.nodeId}`;
      for (const field of ["title", "villain", "blurb", "recap", "teaser", "rewindTaunt"] as const) {
        expect(issue[field], `${where}.${field}`).toBeTruthy();
      }
      expect(issue.briefing.text, `${where} briefing`).toBeTruthy();
      expect(issue.aftermath?.text, `${where} aftermath`).toBeTruthy();
      expect(issue.aftermathArt, `${where} aftermathArt`).toBeDefined();
      expect(issue.briefingNotes?.length ?? 0, `${where} briefingNotes`).toBeGreaterThanOrEqual(3);
      expect(issue.briefingNotes!.some((note) => note.status === "done")).toBe(true);
      expect(issue.comicBeats?.length, `${where} comicBeats`).toBeGreaterThan(0);
    }
  });

  test("stage lines exist for exactly the stages a scenario flips through", () => {
    // The Marauders (issues 1 and 2) stay at one stage; Juggernaut, Sinister and Stryfe flip to II or III.
    expect(Object.keys(story.issues[0]!.stageLines)).toEqual([]);
    expect(Object.keys(story.issues[1]!.stageLines)).toEqual([]);
    for (const issue of story.issues.slice(2)) expect(Object.keys(issue.stageLines)).toEqual(["2", "3"]);
  });

  test("the box's own cast is Cable and Domino, and a hero line falls back to narration without them", () => {
    expect(story.castIdentityIds).toEqual(["40001a", "40037a"]);
    const line = story.issues[0]!.aftermath!;
    expect(lineForRoster(line, ["40037a"])?.speaker.kind).toBe("hero");
    expect(lineForRoster(line, ["01001a"])?.speaker.kind).toBe("narrator");
    for (const issue of story.issues) {
      expect(issue.briefing.fallback, `${issue.nodeId} briefing fallback`).toBeTruthy();
      expect(issue.aftermath!.fallback, `${issue.nodeId} aftermath fallback`).toBeTruthy();
    }
  });

  test("the plain-words copy is keyed by the instruction ids the definition prints", () => {
    const keys = [...Object.keys(story.setupCalls ?? {}), ...Object.keys(story.aftermathCalls ?? {})];
    const ids = new Set(
      CAMPAIGNS.next_evol!.graph.nodes.flatMap((node) =>
        [...(node.composition ?? []), ...node.setup, ...node.victory, ...(node.defeat ?? [])].map(
          (instruction) => instruction.id,
        ),
      ),
    );
    expect(keys.length).toBeGreaterThan(0);
    for (const id of keys) expect(ids.has(id), id).toBe(true);
  });

  test("every issue's scenario has a villain picture for the opener and the aftermath", () => {
    for (const issue of story.issues) {
      expect(ART_CATALOG.scenarios.get(issue.nodeId)?.villain.length, issue.nodeId).toBeGreaterThan(0);
    }
  });

  test("the lettered pages: every beat ref exists, rects sit inside their page, every page is used", () => {
    const pages = story.pages!;
    const used = new Set<string>();
    for (const issue of story.issues) {
      for (const ref of [...(issue.comicBeats ?? []), ...(issue.aftermathBeats ?? [])]) {
        expect(
          pages.find((p) => p.file === ref.page)?.beats[ref.beatIndex],
          `${ref.page}#${ref.beatIndex}`,
        ).toBeDefined();
        used.add(ref.page);
      }
    }
    for (const ref of story.finale.comicBeats ?? []) used.add(ref.page);
    expect(story.finale.page).toBe("08-xavier");
    for (const page of pages) {
      expect(page.lettered, page.file).toBe(true);
      expect(used.has(page.file), `next_evol page never used: ${page.file}`).toBe(true);
      for (const beat of page.beats) {
        expect(beat.lines, page.file).toEqual([]);
        const { x, y, w, h } = beat.panel;
        expect(x, page.file).toBeGreaterThanOrEqual(0);
        expect(y, page.file).toBeGreaterThanOrEqual(0);
        expect(x + w, page.file).toBeLessThanOrEqual(page.width);
        expect(y + h, page.file).toBeLessThanOrEqual(page.height);
      }
    }
  });

  test("every page file on disk matches the story's own page list, and the reader can resolve each", () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/next_evol/pages");
    const onDisk = readdirSync(dir)
      .filter((file) => !file.startsWith(".") && file !== "CREDITS.md")
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    const named = (story.pages ?? []).map((page) => page.file).sort();
    expect(onDisk).toEqual(named);
    for (const file of named) expect(campaignPageFor(CAMPAIGN_ART, "next_evol", file), file).not.toBeNull();
  });

  test("each scenario's intro is the rulebook page right before its issue's opener page", () => {
    const opener = (nodeId: string) => story.issues.find((issue) => issue.nodeId === nodeId)!.comicBeats![0]!.page;
    // Rulebook page numbers of the pages copied into `pages/`, by story file (see the story file's mapping note).
    const rulebookPage: Record<string, number> = {
      "01-graymalkin": 8,
      "02-construction": 10,
      "04-omaha": 13,
      "05-elevator": 15,
      "06-portal": 17,
    };
    for (const node of NODES) {
      const intro = scenarioIntroFor(node.id)!;
      expect(intro, node.id).not.toBeNull();
      expect(intro.art).toEqual({ kind: "rulebook", campaignId: "next_evol", page: rulebookPage[opener(node.id)] });
    }
  });
});
