/**
 * Agents of S.H.I.E.L.D.'s story file (`stories/aos.ts`) against its definition and its art: one issue per node, every
 * beat reference real, every page on disk named and used, every panel inside its page, and every plain-words call keyed
 * to an instruction the definition really has.
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AOS_CAMPAIGN_DEFINITION as DEF } from "@mc/cards";
import type { CampaignInstruction } from "@mc/engine";
import { SAGA_VOLUMES, setupCallCopyFor, storyFor } from "./story.js";

const story = storyFor("aos")!;
const instructions = (): readonly CampaignInstruction[] => [
  ...(DEF.everyNodeSetup ?? []),
  ...DEF.graph.nodes.flatMap((node) => [...node.setup, ...node.victory, ...(node.defeat ?? [])]),
];
const art = join(dirname(fileURLToPath(import.meta.url)), "../../../../art/campaigns/aos");

describe("the Agents of S.H.I.E.L.D. story", () => {
  test("is on the Saga shelf's volume and has exactly one issue per node, in node order", () => {
    expect(SAGA_VOLUMES.find((volume) => volume.campaignId === "aos")).toMatchObject({ boxCode: "MC50", number: 9 });
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
    // The comic's eight pages, besides the cover (page_001) the Extras rulebook reader shows.
    const comic = readdirSync(join(art, "rulebook")).filter((file) => file.endsWith(".jpg") && file !== "page_001.jpg");
    expect(comic).toHaveLength(8);
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

  test("every plain-words call is keyed to an in-game or between-games instruction the definition has", () => {
    const byId = new Map(instructions().map((instruction) => [instruction.id, instruction]));
    for (const id of Object.keys(story.setupCalls ?? {})) {
      const kind = byId.get(id)?.step.kind;
      expect(kind === "inGame" || kind === "betweenGames", id).toBe(true);
    }
    // The expert heal of scenarios 2 to 5 and every evidence card's Setup in them have words.
    for (const n of [2, 3, 4, 5]) {
      expect(setupCallCopyFor(`mc50.s${n}.setup.heal`)?.name).toBe("Expert heal");
      expect(setupCallCopyFor(`mc50.s${n}.setup.evidence.50185`)?.name).toBe("Evidence setup");
      // Owner decision 66B: rejoin or sit out is decided before setup, a hero who sits out is not counted, and the
      // heal's words no longer claim the choice comes there.
      const rejoin = setupCallCopyFor(`mc50.s${n}.setup.rejoin`);
      expect(rejoin?.name).toBe("Rejoin or sit out");
      expect(rejoin?.explain).toMatch(/before the scenario is set up/);
      expect(rejoin?.explain).toMatch(/1 secret counter on a Board Member/);
      expect(rejoin?.explain).toMatch(/not counted/);
      expect(setupCallCopyFor(`mc50.s${n}.setup.heal`)?.explain).not.toMatch(/sits this scenario out/);
    }
    expect(Object.keys(story.setupCalls ?? {})).toHaveLength(4 + 4 + 4 * 9);
  });
});
