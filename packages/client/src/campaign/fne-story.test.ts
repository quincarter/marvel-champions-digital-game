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

  test("every issue has a briefing line and a rewind taunt, and no panel art to wait on", () => {
    for (const issue of FNE_STORY.issues) {
      expect(issue.briefing.text.length, issue.nodeId).toBeGreaterThanOrEqual(25);
      expect(issue.briefing.fallback, issue.nodeId).toBeTruthy();
      expect(issue.rewindTaunt.length, issue.nodeId).toBeGreaterThan(0);
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
    for (const id of Object.keys(FNE_STORY.setupCalls ?? {})) expect(ids.has(id), id).toBe(true);
    const copy = setupCallCopyFor("mc60.choice.playthrough");
    expect(copy?.explain).toMatch(/rulebook's villain order/);
    expect(copy?.explain).toMatch(/at random/);
    expect(setupCallCopyFor("mc60.art-museum-heist.compose.villain")?.explain).toMatch(/recommended list/);
  });
});
