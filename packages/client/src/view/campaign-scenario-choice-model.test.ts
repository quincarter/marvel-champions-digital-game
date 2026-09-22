/**
 * `campaign-scenario-choice-model.ts` against a synthetic `kind: "choice"` fixture — no shipped box has this
 * graph shape yet (MC60 only; see the module's own header). The fixture's `available` predicate is a vacuous
 * "always true" (`not fieldIsSet "__never__"`) since `CampaignGraph.available` is evaluated once, not per node
 * (`ops.ts`'s `availableNodeIds`): this file exists to prove the *rendering*, not to re-derive MC60's own gate.
 */
import { describe, expect, it } from "vitest";
import { cardId, campaignId, scenarioId } from "@mc/content";
import {
  createCampaignLog,
  resolveBetweenGames,
  type CampaignDefinition,
  type CampaignDeps,
  type CampaignPendingChoice,
  type CampaignSeatSetup,
} from "@mc/engine";
import { campaignChoiceBoard, availableNodeIdsOf } from "./campaign-scenario-choice-model.js";

const CHOICE_DEFINITION: CampaignDefinition = {
  campaignId: campaignId("syn-choice"),
  version: "1",
  // Declared only so the vacuous "always available" predicate below (`not fieldIsSet "__never__"`) names a real
  // field — `CampaignGraph.available` is checked against `logFields` the same as any other instruction.
  logFields: [{ id: "__never__", label: "never set", scope: "shared", type: { kind: "flag" }, citation: "n/a" }],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "choice",
    beforeChoice: [],
    available: { kind: "not", of: { kind: "fieldIsSet", field: "__never__" } },
    progressToFail: 3,
    nodes: [
      {
        id: "node-a",
        label: "Node A",
        scenario: { kind: "fixed", scenarioId: scenarioId("rhino") },
        setup: [],
        victory: [],
      },
      {
        id: "node-b",
        label: "Node B",
        scenario: { kind: "fixed", scenarioId: scenarioId("rhino") },
        setup: [],
        victory: [],
      },
    ],
  },
};

const SEATS: readonly CampaignSeatSetup[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("hero"),
    deck: { identityCardId: cardId("hero"), aspects: ["justice"], cards: [] },
  },
];

const DEPS: CampaignDeps = { pool: [] };

const freshLog = () =>
  createCampaignLog(CHOICE_DEFINITION, {
    id: "choice-model-test",
    seats: SEATS,
    modes: {},
    poolVersion: "choice-model-test",
    seed: 1,
  });

describe("availableNodeIdsOf", () => {
  it("reads the runner's own next-node prompt, and nothing else", () => {
    const composed = resolveBetweenGames(CHOICE_DEFINITION, freshLog(), DEPS);
    if (composed.kind !== "pending") throw new Error("expected two open nodes to force a choice");
    expect([...availableNodeIdsOf(composed.choice)].sort()).toEqual(["node-a", "node-b"]);
  });

  it("reads as empty for an unrelated pending choice, and for null", () => {
    const other: CampaignPendingChoice = {
      instructionId: "some.other.choice",
      slot: "x",
      seatNumber: null,
      text: "",
      citation: "",
      chooser: "group",
      options: ["node-a"],
      count: 1,
      optional: false,
    };
    expect(availableNodeIdsOf(other)).toEqual([]);
    expect(availableNodeIdsOf(null)).toEqual([]);
  });
});

describe("campaignChoiceBoard", () => {
  it("renders the available nodes with their label and progress, given the engine's own available-node list", () => {
    const board = campaignChoiceBoard(
      CHOICE_DEFINITION,
      { nextNodeId: null, resolved: {}, progress: { "node-a": 1, "node-b": 0 } },
      ["node-a", "node-b"],
    );
    expect(board.available).toEqual([
      { nodeId: "node-a", label: "Node A", progress: 1, progressToFail: 3 },
      { nodeId: "node-b", label: "Node B", progress: 0, progressToFail: 3 },
    ]);
    expect(board.completed).toEqual([]);
    expect(board.failed).toEqual([]);
  });

  it("splits resolved nodes into completed and failed", () => {
    const board = campaignChoiceBoard(
      CHOICE_DEFINITION,
      { nextNodeId: null, resolved: { "node-a": "completed", "node-b": "failed" }, progress: { "node-b": 3 } },
      [],
    );
    expect(board.available).toEqual([]);
    expect(board.completed).toEqual([{ nodeId: "node-a", label: "Node A", progress: 0, progressToFail: 3 }]);
    expect(board.failed).toEqual([{ nodeId: "node-b", label: "Node B", progress: 3, progressToFail: 3 }]);
  });

  it("refuses a linear graph rather than silently rendering an empty board", () => {
    const linear: CampaignDefinition = {
      ...CHOICE_DEFINITION,
      graph: { kind: "linear", nodes: CHOICE_DEFINITION.graph.nodes },
    };
    expect(() => campaignChoiceBoard(linear, { nextNodeId: "node-a", resolved: {}, progress: {} }, [])).toThrow(
      /not "choice"/,
    );
  });
});
