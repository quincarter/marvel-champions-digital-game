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

  test("Art Museum Heist opens on its five lettered pages, every panel in order; the other issues have none yet", () => {
    const heist = FNE_STORY.issues.find((issue) => issue.nodeId === "art-museum-heist")!;
    expect(heist.comicBeats?.map((beat) => beat.page)).toEqual([
      "art-heist-1",
      "art-heist-1",
      "art-heist-2",
      "art-heist-2",
      "art-heist-3",
      "art-heist-3",
      "art-heist-4",
      "art-heist-4",
      "art-heist-4",
      "art-heist-5",
    ]);
    for (const page of FNE_STORY.pages ?? []) {
      expect(page.lettered, page.file).toBe(true);
      for (const beat of page.beats) {
        expect(beat.panel.x + beat.panel.w, page.file).toBeLessThanOrEqual(page.width);
        expect(beat.panel.y + beat.panel.h, page.file).toBeLessThanOrEqual(page.height);
      }
    }
    for (const issue of FNE_STORY.issues.filter((i) => i.nodeId !== "art-museum-heist")) {
      expect(issue.comicBeats, issue.nodeId).toBeUndefined();
    }
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
