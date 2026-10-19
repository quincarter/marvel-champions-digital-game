/**
 * docs/phase7-wave11-scenarios.md §S3.12: `CampaignValue` `nodeProgress`, a node's progression marks as a value.
 *
 * MC60 p. 9 step 3 marks boxes beside a scenario (`CampaignPosition.progress`); p. 13's campaign SETUP then reads them:
 * "Place 1 threat (2 threat in expert mode) on each main scheme for each check mark in the campaign log beside
 * 'Protection Racket.'" A game never sees the position, so the node's composition copies the count into a working
 * number field, which the game reads like any other field and the trace records like any other write.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import { EngineInvariantError } from "../errors.js";
import type { CampaignDefinition, CampaignInstruction, CampaignLog, CampaignNode, CampaignOp } from "../campaign.js";
import { createCampaignLog, resolveBetweenGames, type CampaignDeps } from "./runner.js";

const CAMPAIGN_ID = campaignId("node-progress-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const DEPS: CampaignDeps = { pool: [] };

const between = (id: string, ops: readonly CampaignOp[]): CampaignInstruction => ({
  id,
  text: "test",
  citation: "test",
  step: { kind: "betweenGames", ops },
});

const progress = (nodeId: string): CampaignOp => ({ kind: "progressNode", node: { kind: "const", value: nodeId } });

const node = (id: string, composition: readonly CampaignInstruction[] = []): CampaignNode => ({
  id,
  label: id,
  scenario: { kind: "fixed", scenarioId: scenarioId(`${id}-scenario`) },
  composition,
  setup: [],
  victory: [],
});

const definitionWith = (
  beforeChoice: readonly CampaignOp[],
  composition: readonly CampaignInstruction[],
): CampaignDefinition => ({
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [
    { id: "checks", label: "(working)", scope: "shared", type: { kind: "number" }, working: true, citation: "t" },
  ],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "choice",
    // Only "racket" is ever available, so it is played without a next-node choice.
    available: { kind: "and", of: [] },
    nodes: [node("racket", composition), node("finale")],
    finale: { nodeId: "finale", when: { kind: "nodeResolved", nodeId: "racket" } },
    progressToFail: 3,
    beforeChoice: [between("t.progress", beforeChoice)],
  },
});

const copyChecks = (nodeId: string): CampaignInstruction =>
  between("t.checks", [{ kind: "setField", field: "checks", value: { kind: "nodeProgress", node: nodeId } }]);

const compose = (definition: CampaignDefinition): CampaignLog => {
  const log = createCampaignLog(definition, {
    id: "run",
    seats: [
      {
        seatNumber: 1,
        identityCardId: cardId("hero"),
        deck: { identityCardId: cardId("hero"), aspects: [], cards: [] },
      },
    ],
    modes: MODES,
    poolVersion: "t",
    seed: 3,
  });
  const outcome = resolveBetweenGames(definition, log, DEPS, MODES, []);
  if (outcome.kind !== "done") throw new Error("the composition asked a question");
  return outcome.value;
};

describe("nodeProgress (§S3.12; MC60 p. 9 step 3, p. 13)", () => {
  it("reads the node's marks into a field the game is handed, and traces the copy", () => {
    const log = compose(definitionWith([progress("racket"), progress("racket")], [copyChecks("racket")]));

    expect(log.position.progress).toEqual({ racket: 2 });
    expect(log.attempt?.input.log.shared.checks).toEqual({ kind: "number", value: 2 });
    const step = log.attempt?.steps.find((entry) => entry.instructionId === "t.checks");
    expect(step?.writes).toEqual([
      { field: "checks", seatNumber: null, mode: "set", value: { kind: "number", value: 2 } },
    ]);
  });

  it("reads 0 for a node never progressed, and counts only the node it names", () => {
    const log = compose(definitionWith([progress("finale")], [copyChecks("racket")]));
    expect(log.attempt?.input.log.shared.checks).toEqual({ kind: "number", value: 0 });
  });

  it("refuses a node the graph does not hold", () => {
    expect(() => compose(definitionWith([], [copyChecks("nowhere")]))).toThrow(EngineInvariantError);
  });
});

// docs/phase7-wave11-scenarios.md C1a: the sheet has `progressToFail` boxes, so the count never passes it.
describe("progressNode caps a node's marks at progressToFail (C1a)", () => {
  it("stores 3, not 4, for a node at 2 marks drawn twice more, and fails it", () => {
    const log = compose(
      definitionWith([progress("racket"), progress("racket"), progress("racket"), progress("racket")], []),
    );
    expect(log.position.progress).toEqual({ racket: 3 });
    expect(log.position.resolved.racket).toBe("failed");
  });

  it("counts below the cap as before", () => {
    const log = compose(definitionWith([progress("racket")], []));
    expect(log.position.progress).toEqual({ racket: 1 });
  });
});
