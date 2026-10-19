/**
 * docs/phase7-wave11-scenarios.md §S3.11: a `choice` graph's finale is never one of its `available` nodes.
 *
 * MC60 p. 9 step 4: "The players as a group choose any scenario to play that has not been Completed or Failed. If
 * each scenario is either Completed or Failed, the players must choose the Kingpin scenario". The `available` gate is
 * always true in MC60 (`{ kind: "and", of: [] }`), so before this the finale was offered from the very first choice.
 */
import { describe, expect, it } from "vitest";
import { campaignId, scenarioId, cardId, type PlayModes } from "@mc/content";
import type { CampaignDefinition, CampaignGameResult, CampaignLog, CampaignNode } from "../campaign.js";
import {
  applyCampaignResult,
  CAMPAIGN_NEXT_NODE_INSTRUCTION,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignDeps,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("finale-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const DEPS: CampaignDeps = { pool: [] };

const node = (id: string): CampaignNode => ({
  id,
  label: id,
  scenario: { kind: "fixed", scenarioId: scenarioId(`${id}-scenario`) },
  setup: [],
  victory: [],
});

const definition: CampaignDefinition = {
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: {
    kind: "choice",
    nodes: [node("first"), node("second"), node("finale")],
    // Always true, as MC60 prints it: every unresolved node may be chosen.
    available: { kind: "and", of: [] },
    finale: {
      nodeId: "finale",
      when: {
        kind: "and",
        of: [
          { kind: "nodeResolved", nodeId: "first" },
          { kind: "nodeResolved", nodeId: "second" },
        ],
      },
    },
    beforeChoice: [
      {
        id: "t.peek",
        text: "Choose one of the scenarios you may play, and one still unresolved.",
        citation: "t",
        step: {
          kind: "betweenGames",
          ops: [
            { kind: "choose", slot: "available", chooser: "group", from: { kind: "nodes", filter: "available" } },
            { kind: "choose", slot: "unresolved", chooser: "group", from: { kind: "nodes", filter: "unresolved" } },
          ],
        },
      },
    ],
  },
};

const newLog = (): CampaignLog =>
  createCampaignLog(definition, {
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
    seed: 7,
  });

const peekAnswers = (available: string, unresolved: string): CampaignChoiceAnswer[] => [
  { instructionId: "t.peek", slot: "available", seatNumber: null, picked: [available] },
  { instructionId: "t.peek", slot: "unresolved", seatNumber: null, picked: [unresolved] },
];

const win = (log: CampaignLog): CampaignLog => {
  const result: CampaignGameResult = {
    nodeId: log.attempt?.nodeId ?? "",
    outcome: "won",
    records: [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  const applied = applyCampaignResult(definition, log, result, { at: 1 }, DEPS);
  if (applied.kind !== "done") throw new Error("unexpected choice after the game");
  return applied.value;
};

describe("a choice graph's finale is not available (§S3.11; MC60 p. 9 step 4)", () => {
  it("is offered neither by `nodes available` nor by the next-node choice, and is still unresolved", () => {
    const log = newLog();
    const first = resolveBetweenGames(definition, log, DEPS, MODES, []);
    expect(first.kind === "pending" && first.choice.options).toEqual(["first", "second"]);

    const second = resolveBetweenGames(definition, log, DEPS, MODES, [
      { instructionId: "t.peek", slot: "available", seatNumber: null, picked: ["first"] },
    ]);
    expect(second.kind === "pending" && second.choice.options).toEqual(["first", "second", "finale"]);

    const next = resolveBetweenGames(definition, log, DEPS, MODES, peekAnswers("first", "first"));
    expect(next.kind === "pending" && next.choice.instructionId).toBe(CAMPAIGN_NEXT_NODE_INSTRUCTION);
    expect(next.kind === "pending" && next.choice.options).toEqual(["first", "second"]);
  });

  it("refuses the finale as an answer to the next-node choice while another node is available", () => {
    const log = newLog();
    const answered = resolveBetweenGames(definition, log, DEPS, MODES, [
      ...peekAnswers("first", "finale"),
      { instructionId: CAMPAIGN_NEXT_NODE_INSTRUCTION, slot: "node", seatNumber: null, picked: ["finale"] },
    ]);
    // Not taken: the choice is asked again, over the two scenarios only.
    expect(answered.kind === "pending" && answered.choice.options).toEqual(["first", "second"]);
  });

  it("plays the one node left without asking, then falls to the finale once its condition holds", () => {
    const start = resolveBetweenGames(definition, newLog(), DEPS, MODES, [
      ...peekAnswers("first", "first"),
      { instructionId: CAMPAIGN_NEXT_NODE_INSTRUCTION, slot: "node", seatNumber: null, picked: ["first"] },
    ]);
    if (start.kind !== "done") throw new Error("the first node did not compose");
    const afterFirst = win(start.value);

    // Only "second" is available: it is composed with no next-node choice (the finale is not a second option).
    const second = resolveBetweenGames(definition, afterFirst, DEPS, MODES, peekAnswers("second", "second"));
    if (second.kind !== "done") throw new Error("the second node asked a question");
    expect(second.value.attempt?.nodeId).toBe("second");
    const afterSecond = win(second.value);

    // Nothing is available now; the finale is played because its `when` holds. The peek's `available` choice has no
    // options left, so it asks for nothing.
    const finale = resolveBetweenGames(definition, afterSecond, DEPS, MODES, [
      { instructionId: "t.peek", slot: "available", seatNumber: null, picked: [] },
      { instructionId: "t.peek", slot: "unresolved", seatNumber: null, picked: ["finale"] },
    ]);
    if (finale.kind !== "done") throw new Error("the finale asked a question");
    expect(finale.value.attempt?.nodeId).toBe("finale");
  });
});
