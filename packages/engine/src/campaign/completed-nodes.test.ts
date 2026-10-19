/**
 * docs/phase7-wave11-scenarios.md §S3.13: `CampaignChoiceSource` `nodes { filter: "completed" }`.
 *
 * MC60 p. 23, the Kingpin scenario's DEFEAT, "Expert Campaign Only: If there is at least one environment on its
 * Completed side, choose and flip one to its Failed side and replay the scenario. Otherwise, the players lose the
 * campaign." The environment matches a scenario, so the choice is over the Completed nodes and the flip is
 * `markNode as: "failed"`.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import type {
  CampaignDefinition,
  CampaignGameResult,
  CampaignLog,
  CampaignNode,
  CampaignPredicate,
} from "../campaign.js";
import {
  applyCampaignResult,
  CAMPAIGN_NEXT_NODE_INSTRUCTION,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignDeps,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("completed-nodes-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID, expertCampaign: true } };
const DEPS: CampaignDeps = { pool: [] };

const node = (id: string, over: Partial<CampaignNode> = {}): CampaignNode => ({
  id,
  label: id,
  scenario: { kind: "fixed", scenarioId: scenarioId(`${id}-scenario`) },
  setup: [],
  victory: [],
  ...over,
});

const anyCompleted: CampaignPredicate = {
  kind: "or",
  of: ["first", "second", "third"].map((nodeId) => ({ kind: "nodeResolved", nodeId, as: "completed" as const })),
};

const FLIP = "t.finale.defeat.flip";

const definition: CampaignDefinition = {
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [],
  loss: { retry: "byInstruction", retryBaseline: "nodeStart" },
  graph: {
    kind: "choice",
    available: { kind: "and", of: [] },
    beforeChoice: [],
    progressToFail: 3,
    nodes: [
      node("first"),
      node("second"),
      // Never played: `toFinale` marks it Failed, as three progression marks would.
      node("third"),
      node("finale", {
        defeat: [
          {
            id: FLIP,
            text: "If there is at least one environment on its Completed side, choose and flip one to its Failed side and replay the scenario. Otherwise, the players lose the campaign.",
            citation: "t",
            whenModes: { expertCampaign: true },
            step: {
              kind: "betweenGames",
              ops: [
                {
                  kind: "if",
                  when: anyCompleted,
                  then: [
                    { kind: "choose", slot: "flip", chooser: "group", from: { kind: "nodes", filter: "completed" } },
                    { kind: "markNode", node: { kind: "choice", slot: "flip" }, as: "failed" },
                  ],
                  else: [{ kind: "endCampaign", result: "lost" }],
                },
              ],
            },
          },
        ],
      }),
    ],
    finale: {
      nodeId: "finale",
      when: { kind: "and", of: ["first", "second", "third"].map((nodeId) => ({ kind: "nodeResolved", nodeId })) },
    },
  },
};

const result = (log: CampaignLog, outcome: "won" | "lost"): CampaignGameResult => ({
  nodeId: log.attempt?.nodeId ?? "",
  outcome,
  records: [],
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
});

const play = (log: CampaignLog, nodeId: string): CampaignLog => {
  const outcome = resolveBetweenGames(definition, log, DEPS, MODES, [
    { instructionId: CAMPAIGN_NEXT_NODE_INSTRUCTION, slot: "node", seatNumber: null, picked: [nodeId] },
  ]);
  if (outcome.kind !== "done") throw new Error(`${nodeId} did not compose`);
  expect(outcome.value.attempt?.nodeId).toBe(nodeId);
  return outcome.value;
};

const end = (log: CampaignLog, outcome: "won" | "lost", answers: readonly CampaignChoiceAnswer[] = []) =>
  applyCampaignResult(definition, log, result(log, outcome), { at: 1 }, DEPS, answers);

const done = (outcome: ReturnType<typeof end>): CampaignLog => {
  if (outcome.kind !== "done") throw new Error("unexpected pending choice");
  return outcome.value;
};

const flip = (nodeId: string): CampaignChoiceAnswer[] => [
  { instructionId: FLIP, slot: "flip", seatNumber: null, picked: [nodeId] },
];

/** First and second won, third Failed: the finale is next. */
function toFinale(): CampaignLog {
  let log = createCampaignLog(definition, {
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
    seed: 11,
  });
  log = done(end(play(log, "first"), "won"));
  log = done(end(play(log, "second"), "won"));
  log = { ...log, position: { ...log.position, resolved: { ...log.position.resolved, third: "failed" } } };
  return log;
}

describe("nodes { filter: completed } (§S3.13; MC60 p. 23 expert DEFEAT)", () => {
  it("offers the Completed nodes in graph order, never a Failed or unresolved one", () => {
    const lost = end(play(toFinale(), "finale"), "lost");
    expect(lost.kind === "pending" && lost.choice.instructionId).toBe(FLIP);
    expect(lost.kind === "pending" && lost.choice.options).toEqual(["first", "second"]);
  });

  it("flips the chosen node to Failed and replays the finale; with none left the campaign is lost", () => {
    const afterFirstLoss = done(end(play(toFinale(), "finale"), "lost", flip("second")));
    expect(afterFirstLoss.position.resolved).toEqual({ first: "completed", second: "failed", third: "failed" });
    expect(afterFirstLoss.status).toBe("active");
    expect(afterFirstLoss.position.nextNodeId).toBe("finale");

    const second = end(play(afterFirstLoss, "finale"), "lost");
    expect(second.kind === "pending" && second.choice.options).toEqual(["first"]);
    const afterSecondLoss = done(end(play(afterFirstLoss, "finale"), "lost", flip("first")));
    expect(afterSecondLoss.position.resolved).toEqual({ first: "failed", second: "failed", third: "failed" });

    const afterThirdLoss = done(end(play(afterSecondLoss, "finale"), "lost"));
    expect(afterThirdLoss.status).toBe("lost");
  });

  it("refuses an answer that is not a Completed node", () => {
    expect(() => end(play(toFinale(), "finale"), "lost", flip("third"))).toThrow(/not one of its options/);
  });
});
