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
    // Owner decision, 2026-10-08 (row 72): a defeated hero may decline to rejoin, and the call says what that means.
    expect(setupCallCopyFor("mc45.s3.setup.heal")?.explain).toBe(
      "Expert campaign: place 3 threat on the mission to heal your hero to full hit points, or decline. A hero defeated last scenario pays it to rejoin, or sits this scenario out.",
    );
    for (const n of [1, 2, 3, 4]) {
      expect(aftermathCallCopyFor(`mc45.s${n}.victory.evacuate.defeated`)?.heading).toBe("Take an upgrade.");
      expect(aftermathCallCopyFor(`mc45.s${n}.victory.sabotage.defeated`)?.heading).toBe("Take a support.");
      expect(aftermathCallCopyFor(`mc45.s${n}.victory.find.defeated`)?.heading).toBe("Take a campaign ally.");
    }
    // Owner decisions, 2026-10-08: a reward is not one of the 40 and is one of the 50; Desperate Measures counts
    // toward neither limit. The notes say so, and nothing states the superseded rule.
    for (const id of ["evacuate", "sabotage", "find"]) {
      expect(aftermathCallCopyFor(`mc45.s1.victory.${id}.defeated`)?.note).toMatch(
        /A reward isn't one of your 40 cards, but it is one of your 50\./,
      );
    }
    expect(setupCallCopyFor("mc45.setup.carried.desperate-measures")?.explain).toBe(
      "Liberate the Seattle Core was defeated, so each hero may shuffle one Desperate Measures into their deck for this game. It doesn't count toward deck size.",
    );
    expect(JSON.stringify([story.setupCalls, story.aftermathCalls])).not.toMatch(/counts toward deck size/);
    // Owner decisions, 2026-10-08 (rows 67 and 68): the pick is mandatory, so no call words a way to decline it; the
    // card's place in the deck is the player's choice each game; a title the deck holds is offered.
    for (const copy of Object.values(story.aftermathCalls ?? {})) {
      expect(copy.declineLabel).toBeUndefined();
      expect(copy.heading).not.toMatch(/none/i);
      expect(copy.note).toMatch(/Each hero picks one\. You choose before each game whether it is in your deck\./);
    }
    expect(aftermathCallCopyFor("mc45.s1.victory.evacuate.defeated")?.note).toBe(
      "Any upgrade from any aspect, even one your deck already has. Each hero picks one. You choose before each game whether it is in your deck. A reward isn't one of your 40 cards, but it is one of your 50.",
    );
    expect(aftermathCallCopyFor("mc45.s1.victory.find.defeated")?.note).toBe(
      "One copy of each ally, so a pick is taken for the whole table. Each hero picks one. You choose before each game whether it is in your deck. A reward isn't one of your 40 cards, but it is one of your 50.",
    );
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
