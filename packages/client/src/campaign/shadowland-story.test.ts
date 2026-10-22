import { describe, expect, test } from "vitest";
import { campaignDefinitionOf } from "@mc/cards";
import { SHADOWLAND_STORY } from "./stories/shadowland.js";
import { SAGA_VOLUMES, storyFor } from "./story.js";

describe("the Shadowland story", () => {
  test("is on the Saga shelf after Fear No Evil and registered", () => {
    expect(SAGA_VOLUMES.find((volume) => volume.campaignId === "shadowland")).toMatchObject({
      boxCode: "MC65",
      number: 11,
      name: "Shadowland",
    });
    expect(storyFor("shadowland")).toBe(SHADOWLAND_STORY);
  });

  test("has exactly one issue per campaign node, in node order, each with an opener and a briefing", () => {
    const nodeIds = campaignDefinitionOf("shadowland")!.graph.nodes.map((node) => node.id);
    expect(SHADOWLAND_STORY.issues.map((issue) => issue.nodeId)).toEqual(nodeIds);
    for (const issue of SHADOWLAND_STORY.issues) {
      expect(issue.opener.length, issue.nodeId).toBeGreaterThan(0);
      expect(issue.briefing.text.length, issue.nodeId).toBeGreaterThanOrEqual(25);
      expect(issue.rewindTaunt.length, issue.nodeId).toBeGreaterThan(0);
    }
  });
});
