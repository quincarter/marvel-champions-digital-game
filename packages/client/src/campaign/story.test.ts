import { describe, expect, test } from "vitest";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { SAGA_VOLUMES, issueStoryFor, lineForRoster, storyFor } from "./story.js";

describe("campaign story", () => {
  test("MC10's story has exactly one issue per campaign node, in node order", () => {
    const story = storyFor("trors");
    expect(story?.issues.map((issue) => issue.nodeId)).toEqual(
      TRORS_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id),
    );
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
