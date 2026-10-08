/**
 * Age of Apocalypse's story file (`stories/aoa.ts`) against its definition and its art: one issue per node, every beat
 * reference real, every page on disk named and used, every panel inside its page, and every plain-words call keyed to
 * an instruction the definition really has.
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AOA_CAMPAIGN_DEFINITION as DEF } from "@mc/cards";
import type { CampaignInstruction } from "@mc/engine";
import { SAGA_VOLUMES, aftermathCallCopyFor, setupCallCopyFor, storyFor } from "./story.js";

const story = storyFor("aoa")!;
const instructions = (): readonly CampaignInstruction[] => [
  ...(DEF.everyNodeSetup ?? []),
  ...DEF.graph.nodes.flatMap((node) => [...node.setup, ...node.victory, ...(node.defeat ?? [])]),
];
const art = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/aoa");

describe("the Age of Apocalypse story", () => {
  test("is on the Saga shelf's volume and has exactly one issue per node, in node order", () => {
    expect(SAGA_VOLUMES.find((volume) => volume.campaignId === "aoa")).toMatchObject({ boxCode: "MC45", number: 8 });
    expect(story.issues.map((issue) => issue.nodeId)).toEqual(DEF.graph.nodes.map((node) => node.id));
  });

  test("every issue has beats, every beat ref exists and every page is used", () => {
    const pages = story.pages!;
    const used = new Set<string>();
    for (const issue of story.issues) {
      expect(issue.comicBeats?.length, `${issue.nodeId} has no comicBeats`).toBeGreaterThan(0);
      for (const ref of [...(issue.comicBeats ?? []), ...(issue.aftermathBeats ?? [])]) {
        const page = pages.find((candidate) => candidate.file === ref.page);
        expect(page, `unknown page ${ref.page}`).toBeDefined();
        expect(page!.beats[ref.beatIndex], `${ref.page}#${ref.beatIndex}`).toBeDefined();
        used.add(ref.page);
      }
    }
    for (const ref of story.finale.comicBeats ?? []) used.add(ref.page);
    if (story.finale.page) used.add(story.finale.page);
    for (const page of pages) {
      expect(page.lettered).toBe(true);
      expect(used.has(page.file), `page never used: ${page.file}`).toBe(true);
    }
  });

  test("the pages on disk are exactly the pages the story names, copied from the rulebook's own", () => {
    const onDisk = readdirSync(join(art, "pages"))
      .filter((file) => !file.startsWith("."))
      .map((file) => file.slice(0, file.lastIndexOf(".")))
      .sort();
    expect(onDisk).toEqual(story.pages!.map((page) => page.file).sort());
    expect(readdirSync(join(art, "rulebook")).filter((file) => file.endsWith(".jpg"))).toHaveLength(8);
  });

  test("every panel rectangle sits inside its page", () => {
    for (const page of story.pages!)
      for (const beat of page.beats) {
        const { x, y, w, h } = beat.panel;
        expect(x, page.file).toBeGreaterThanOrEqual(0);
        expect(y, page.file).toBeGreaterThanOrEqual(0);
        expect(x + w, page.file).toBeLessThanOrEqual(page.width);
        expect(y + h, page.file).toBeLessThanOrEqual(page.height);
      }
  });

  test("every plain-words call is keyed to an instruction the definition has, and the rewards have all three kinds", () => {
    const ids = new Set(instructions().map((instruction) => instruction.id));
    for (const id of [...Object.keys(story.setupCalls ?? {}), ...Object.keys(story.aftermathCalls ?? {})])
      expect(ids.has(id), id).toBe(true);
    // The prompts the box raises: Desperate Measures between games, the ally search and heal in the game, and the
    // three reward cells of every scenario that has them.
    expect(setupCallCopyFor("mc45.setup.carried.desperate-measures")?.name).toBe("Desperate Measures");
    expect(setupCallCopyFor("mc45.setup.ally-search")?.name).toBe("Ally search");
    expect(setupCallCopyFor("mc45.s3.setup.heal")?.explain).toMatch(/3 threat/);
    for (const n of [1, 2, 3, 4]) {
      expect(aftermathCallCopyFor(`mc45.s${n}.victory.evacuate.defeated`)?.heading).toBe("Take an upgrade, or none.");
      expect(aftermathCallCopyFor(`mc45.s${n}.victory.sabotage.defeated`)?.heading).toBe("Take a support, or none.");
      expect(aftermathCallCopyFor(`mc45.s${n}.victory.find.defeated`)?.heading).toBe("Take a campaign ally, or none.");
    }
    // Owner Q25: a reward counts toward deck size, and the note says so.
    expect(aftermathCallCopyFor("mc45.s1.victory.evacuate.defeated")?.note).toMatch(/counts toward deck size/);
  });

  test("the instruction every call names carries a choice (a pick or an optional offer), not a record", () => {
    const byId = new Map(instructions().map((instruction) => [instruction.id, instruction]));
    for (const id of Object.keys(story.aftermathCalls ?? {})) expect(byId.get(id)?.step.kind).toBe("betweenGames");
    for (const id of Object.keys(story.setupCalls ?? {})) {
      const kind = byId.get(id)?.step.kind;
      expect(kind === "inGame" || kind === "betweenGames", id).toBe(true);
    }
  });
});
