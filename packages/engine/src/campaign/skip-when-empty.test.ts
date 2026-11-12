/**
 * `choose.skipWhenEmpty` (#679): an optional pick whose source has nothing left is passed, with the empty pick a
 * decline records, instead of asking the players a question with no options. MC16 p. 5's Market is the shape: one
 * printed copy of each card for the table, so once the cards are taken the slots after them have nothing to sell.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, encounterSetId, scenarioId, type PlayModes } from "@mc/content";
import type { CampaignDefinition, CampaignOp } from "../campaign.js";
import { stubEvent } from "../testing/fixtures.js";
import {
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("skip-when-empty-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const STALL = encounterSetId("skip-stall");
const STALL_CARD = {
  ...stubEvent({ id: "stall-1", cost: 0 }),
  specificTo: { kind: "campaign" as const, encounterSetId: STALL },
};
const DEPS: CampaignDeps = { pool: [STALL_CARD] };
const seat = (seatNumber: number): CampaignSeatSetup => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
});
const SEATS = [seat(1), seat(2)];
const INSTRUCTION = "only.setup.stall";

/** Each seat may take the stall's one card, then the slot after it ("after") asks again from what is left. */
const definitionOf = (more: Partial<Extract<CampaignOp, { kind: "choose" }>>): CampaignDefinition => {
  const slot = (name: string): CampaignOp[] => [
    {
      kind: "choose",
      slot: name,
      chooser: "eachSeat",
      from: { kind: "campaignSet", encounterSetId: STALL, excludeGranted: true },
      ...more,
    },
    {
      kind: "if",
      when: { kind: "choiceMade", slot: name },
      then: [{ kind: "grantCard", seat: "self", card: { kind: "choice", slot: name }, permanence: "campaign" }],
    },
  ];
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "only",
          label: "Only",
          scenario: { kind: "fixed", scenarioId: scenarioId("skip-when-empty-scenario") },
          setup: [
            {
              id: INSTRUCTION,
              text: "test",
              citation: "test",
              step: { kind: "betweenGames", ops: [{ kind: "forEachSeat", ops: [...slot("first"), ...slot("after")] }] },
            },
          ],
          victory: [],
        },
      ],
    },
  };
};

const take = (slot: string, seatNumber: number, picked: readonly string[]): CampaignChoiceAnswer => ({
  instructionId: INSTRUCTION,
  slot,
  seatNumber,
  picked,
});

const stepOf = (definition: CampaignDefinition, answers: readonly CampaignChoiceAnswer[]) => {
  const log = createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });
  return resolveBetweenGames(definition, log, DEPS, MODES, answers);
};

describe("choose.skipWhenEmpty", () => {
  it("passes an optional pick with nothing left, recording the empty pick a decline would", () => {
    const definition = definitionOf({ optional: true, skipWhenEmpty: true });
    // Seat 1 takes the only card: its own next slot and both of seat 2's have nothing to offer, so nothing is asked.
    const outcome = stepOf(definition, [take("first", 1, ["stall-1"])]);
    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") return;
    expect(outcome.value.seats[0]?.grants.map((grant) => grant.cardId)).toEqual(["stall-1"]);
    expect(outcome.value.seats[1]?.grants).toEqual([]);
    // The trace holds the same records an explicit decline of each empty slot would have.
    const declined = stepOf(definitionOf({ optional: true }), [
      take("first", 1, ["stall-1"]),
      take("after", 1, []),
      take("first", 2, []),
      take("after", 2, []),
    ]);
    if (declined.kind !== "done") throw new Error("expected the declined run to finish");
    const choicesOf = (log: typeof outcome.value) =>
      log.attempt?.steps.flatMap((step) =>
        step.choices.map(({ slot, seatNumber, picked }) => ({ slot, seatNumber, picked })),
      );
    expect(choicesOf(outcome.value)).toEqual([
      { slot: "first", seatNumber: 1, picked: ["stall-1"] },
      { slot: "after", seatNumber: 1, picked: [] },
      { slot: "first", seatNumber: 2, picked: [] },
      { slot: "after", seatNumber: 2, picked: [] },
    ]);
    expect(choicesOf(outcome.value)).toEqual(choicesOf(declined.value));
  });

  it("still asks while the source has an option", () => {
    const outcome = stepOf(definitionOf({ optional: true, skipWhenEmpty: true }), []);
    expect(outcome.kind === "pending" && outcome.choice.options).toEqual(["stall-1"]);
  });

  it("without the flag the empty pick is still asked, as some boxes show an empty offer on purpose", () => {
    const outcome = stepOf(definitionOf({ optional: true }), [take("first", 1, ["stall-1"])]);
    expect(outcome.kind).toBe("pending");
    if (outcome.kind !== "pending") return;
    expect([outcome.choice.slot, outcome.choice.seatNumber, outcome.choice.options]).toEqual(["after", 1, []]);
  });

  it("a required pick with nothing to pick is still asked, even with the flag", () => {
    const outcome = stepOf(definitionOf({ skipWhenEmpty: true }), [take("first", 1, ["stall-1"])]);
    expect(outcome.kind).toBe("pending");
    if (outcome.kind !== "pending") return;
    expect([outcome.choice.slot, outcome.choice.options]).toEqual(["after", []]);
  });
});
