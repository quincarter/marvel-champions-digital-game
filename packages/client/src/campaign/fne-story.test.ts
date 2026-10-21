import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { campaignDefinitionOf } from "@mc/cards";
import { FNE_STORY } from "./stories/fne.js";
import { SAGA_VOLUMES, setupCallCopyFor, storyFor } from "./story.js";

const nodeIds = campaignDefinitionOf("fne")!.graph.nodes.map((node) => node.id);

describe("the Fear No Evil story", () => {
  test("is on the Saga shelf and registered", () => {
    expect(SAGA_VOLUMES.find((volume) => volume.campaignId === "fne")).toMatchObject({ boxCode: "MC60", number: 10 });
    expect(storyFor("fne")).toBe(FNE_STORY);
  });

  test("has exactly one issue per node, Kingpin last", () => {
    const ids = FNE_STORY.issues.map((issue) => issue.nodeId);
    expect([...ids].sort()).toEqual([...nodeIds].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.at(-1)).toBe("kingpin");
  });

  test("every issue has a briefing line and a rewind taunt", () => {
    for (const issue of FNE_STORY.issues) {
      expect(issue.briefing.text.length, issue.nodeId).toBeGreaterThanOrEqual(25);
      expect(issue.briefing.fallback, issue.nodeId).toBeTruthy();
      expect(issue.rewindTaunt.length, issue.nodeId).toBeGreaterThan(0);
    }
  });

  const byNode = (nodeId: string) => FNE_STORY.issues.find((issue) => issue.nodeId === nodeId)!;
  const pagesOf = (beats: readonly { readonly page: string }[] | undefined) => [...new Set(beats?.map((b) => b.page))];

  test("every page fits its panels and has its picture in art/campaigns/fne/pages", () => {
    // From this file, not the working directory: CI runs the suite from the repo root.
    const dir = fileURLToPath(new URL("../../../../art/campaigns/fne/pages", import.meta.url));
    for (const page of FNE_STORY.pages ?? []) {
      expect(existsSync(join(dir, `${page.file}.jpg`)), page.file).toBe(true);
      for (const beat of page.beats) {
        expect(beat.panel.x + beat.panel.w, page.file).toBeLessThanOrEqual(page.width);
        expect(beat.panel.y + beat.panel.h, page.file).toBeLessThanOrEqual(page.height);
      }
      // The pack's text-free plates and inserts are lettered by the reader; the stories carry their own lettering.
      const plate = page.file.startsWith("env-") || page.file.startsWith("villain-");
      expect(page.lettered === true, page.file).toBe(!plate);
    }
  });

  test("each scenario's full story is canned for the villain it was told around, and for a read with no run", () => {
    const canned: Record<string, string> = {
      "art-museum-heist": "hammerhead",
      "the-getaway": "hammerhead",
      "protection-racket": "hammerhead",
      "the-raft-breakout": "electro",
      "stop-the-presses": "typhoid_mary",
    };
    for (const [nodeId, villain] of Object.entries(canned)) {
      const issue = byNode(nodeId);
      expect(issue.comicFor?.(villain), nodeId).toEqual(issue.comicBeats);
      expect(issue.comicFor?.(null), nodeId).toEqual(issue.comicBeats);
    }
    expect(pagesOf(byNode("art-museum-heist").comicBeats)).toEqual([
      "art-heist-1",
      "art-heist-2",
      "art-heist-3",
      "art-heist-4",
      "art-heist-5",
    ]);
  });

  test("another villain gets the modular read: neutral pages, that villain's reveal where the pack has one, Suit up", () => {
    // Bullseye's insert lands just before the Suit up page; Black Cat's gala cameo gives way to the museum plate.
    expect(pagesOf(byNode("art-museum-heist").comicFor?.("bullseye"))).toEqual([
      "env-art-museum",
      "art-heist-2",
      "art-heist-3",
      "art-heist-4",
      "villain-bullseye-reveal",
      "art-heist-5",
    ]);
    // The Getaway's Black Cat chase is left out entirely.
    expect(pagesOf(byNode("the-getaway").comicFor?.("purple_man"))).toEqual([
      "env-getaway",
      "villain-purple-man-reveal",
      "getaway-5",
    ]);
    // Electro is pictured only in his own Raft story; anyone else gets the corridor plate.
    expect(pagesOf(byNode("the-raft-breakout").comicFor?.("typhoid_mary"))).toEqual([
      "raft-breakout-1",
      "raft-breakout-2",
      "env-raft-breakout",
      "villain-typhoid-mary-reveal",
      "raft-breakout-5",
    ]);
    // No insert for Hammerhead or Electro yet: their modular reads have no reveal (Fisk's pages need Mary).
    expect(pagesOf(byNode("stop-the-presses").comicFor?.("hammerhead"))).toEqual([
      "env-stop-the-presses",
      "stop-the-presses-4",
      "stop-the-presses-5",
    ]);
    expect(pagesOf(byNode("protection-racket").comicFor?.("electro"))).toEqual([
      "protection-racket-1",
      "protection-racket-2",
      "protection-racket-3",
      "protection-racket-4",
      "protection-racket-5",
    ]);
  });

  test("Kingpin opens on the Final Showdown pages", () => {
    expect(pagesOf(byNode("kingpin").comicBeats)).toEqual(["finale-1", "finale-2", "finale-3", "finale-4", "finale-5"]);
    expect(byNode("kingpin").comicFor).toBeUndefined();
  });

  test("the cast is Daredevil and Echo", () => {
    expect(FNE_STORY.castIdentityIds).toEqual(["60001a", "60037a"]);
  });
});

describe("the Fear No Evil plain-words calls", () => {
  const def = campaignDefinitionOf("fne")!;
  const ids = new Set(
    [
      ...(def.graph.kind === "choice" ? def.graph.beforeChoice : []),
      ...(def.everyNodeSetup ?? []),
      ...def.graph.nodes.flatMap((node) => [...(node.composition ?? []), ...node.setup, ...node.victory]),
    ].map((instruction) => instruction.id),
  );

  test("each is keyed to an instruction the definition has, and the first-playthrough question says what each answer does", () => {
    // `campaign.nextNode` is the runner's own scenario-pick question, not one of the definition's instructions.
    for (const id of Object.keys(FNE_STORY.setupCalls ?? {}))
      expect(ids.has(id) || id === "campaign.nextNode", id).toBe(true);
    const copy = setupCallCopyFor("mc60.choice.playthrough");
    expect(copy?.explain).toMatch(/rulebook's villain order/);
    expect(copy?.explain).toMatch(/at random/);
    expect(setupCallCopyFor("mc60.art-museum-heist.compose.villain")?.explain).toMatch(/recommended list/);
    const pick = setupCallCopyFor("campaign.nextNode");
    expect(pick?.explain).toMatch(/open/);
    expect(pick?.explain).toMatch(/villain is chosen/);
    expect(pick?.explain).toMatch(/Kingpin comes only after all five/);
  });
});
