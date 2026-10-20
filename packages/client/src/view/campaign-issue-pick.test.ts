import { describe, expect, test } from "vitest";
import { campaignDefinitionOf } from "@mc/cards";
import { awaitsIssuePick, currentNodeIdOf, issueNumberOfRecord } from "./campaign-issue-pick.js";

const fne = campaignDefinitionOf("fne")!;
const trors = campaignDefinitionOf("trors")!;
const trorsIds = trors.graph.nodes.map((node) => node.id);
const run = (over: Record<string, unknown> = {}) =>
  ({
    status: "active",
    position: { nextNodeId: null, resolved: {}, progress: {} },
    ...over,
  }) as never;

describe("awaitsIssuePick", () => {
  test("an active choice-graph run with no node yet awaits the pick", () => {
    expect(awaitsIssuePick(fne, run())).toBe(true);
  });

  test("not once a node is next, or an attempt is composed", () => {
    expect(awaitsIssuePick(fne, run({ position: { nextNodeId: "kingpin", resolved: {}, progress: {} } }))).toBe(false);
    expect(awaitsIssuePick(fne, run({ attempt: { nodeId: "the-getaway" } }))).toBe(false);
  });

  test("not for a finished run, nor a linear graph", () => {
    expect(awaitsIssuePick(fne, run({ status: "won" }))).toBe(false);
    expect(awaitsIssuePick(trors, run())).toBe(false);
  });
});

describe("issueNumberOfRecord", () => {
  test("a choice graph counts the issues already settled, plus this one", () => {
    expect(issueNumberOfRecord(fne, run())).toBe(1);
    const two = {
      nextNodeId: null,
      resolved: { "the-getaway": "completed", "art-museum-heist": "failed" },
      progress: {},
    };
    expect(issueNumberOfRecord(fne, run({ position: two }))).toBe(3);
  });

  test("a linear graph numbers by its fixed order", () => {
    const next = (nextNodeId: string) => run({ position: { nextNodeId, resolved: {}, progress: {} } });
    expect(issueNumberOfRecord(trors, next(trorsIds[0]!))).toBe(1);
    expect(issueNumberOfRecord(trors, next(trorsIds[2]!))).toBe(3);
    expect(currentNodeIdOf(next(trorsIds[2]!))).toBe(trorsIds[2]);
  });
});
