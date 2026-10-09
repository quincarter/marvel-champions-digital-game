/**
 * What a pending campaign choice says about itself, so a client reads it instead of guessing it from the number of
 * options (`CampaignPendingChoice.minSelections`, `maxSelections`, `perSeat`, `source`, `exclusive`). All five are
 * derived from the `choose` or `random` op and its `CampaignChoiceSource` in the campaign definition.
 *
 * The shapes are the printed ones: MC10 p. 5 ("choose one of the TECH upgrades", one printed copy for the table),
 * MC45 p. 24 ("Each player chooses an upgrade from any aspect", the seat's whole collection), MC27 p. 22 ("Deal 3 …
 * That player may choose 1"), and MC10 p. 7 ("Each player may add 1 random obligation").
 */
import { describe, expect, it } from "vitest";
import { CORE_CARDS, campaignId, cardId, encounterSetId, scenarioId, type PlayModes } from "@mc/content";
import type { CampaignChoiceSource, CampaignDefinition, CampaignOp } from "../campaign.js";
import { stubEvent } from "../testing/fixtures.js";
import {
  createCampaignLog,
  resolveBetweenGames,
  type CampaignDeps,
  type CampaignPendingChoice,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("pending-shape-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const TECH = encounterSetId("shape-tech");
const TECH_CARDS = Array.from({ length: 4 }, (_, at) => ({
  ...stubEvent({ id: `tech-${at + 1}`, cost: 0 }),
  specificTo: { kind: "campaign" as const, encounterSetId: TECH },
}));
const DEPS: CampaignDeps = { pool: TECH_CARDS };
const seat = (seatNumber: number): CampaignSeatSetup => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
});
const SEATS = [seat(1), seat(2)];
const INSTRUCTION = "only.setup.pick";

const definitionOf = (ops: readonly CampaignOp[]): CampaignDefinition => ({
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
        scenario: { kind: "fixed", scenarioId: scenarioId("pending-shape-test-scenario") },
        setup: [{ id: INSTRUCTION, text: "test", citation: "test", step: { kind: "betweenGames", ops } }],
        victory: [],
      },
    ],
  },
});
const eachSeatTakes = (from: CampaignChoiceSource, more: Partial<Extract<CampaignOp, { kind: "choose" }>> = {}) =>
  definitionOf([
    {
      kind: "forEachSeat",
      ops: [
        { kind: "choose", slot: "pick", chooser: "eachSeat", from, ...more },
        { kind: "grantCard", seat: "self", card: { kind: "choice", slot: "pick" }, permanence: "campaign" },
      ],
    },
  ]);

function pendingOf(
  definition: CampaignDefinition,
  answers: Parameters<typeof resolveBetweenGames>[4] = [],
  seats: readonly CampaignSeatSetup[] = SEATS,
  deps: CampaignDeps = DEPS,
): CampaignPendingChoice {
  const log = createCampaignLog(definition, { id: "run", seats, modes: MODES, poolVersion: "test", seed: 1 });
  const outcome = resolveBetweenGames(definition, log, deps, MODES, answers);
  if (outcome.kind !== "pending") throw new Error("expected a pending choice");
  return outcome.choice;
}
const shapeOf = ({ minSelections, maxSelections, perSeat, source, exclusive }: CampaignPendingChoice) => ({
  minSelections,
  maxSelections,
  perSeat,
  source,
  exclusive,
});

describe("CampaignPendingChoice says how many to pick, who picks and whether a pick is exclusive", () => {
  it("one printed pool for the table (campaignSet, excludeGranted): each seat picks exactly 1, exclusively", () => {
    const definition = eachSeatTakes({ kind: "campaignSet", encounterSetId: TECH, excludeGranted: true });
    const first = pendingOf(definition);
    expect(shapeOf(first)).toEqual({
      minSelections: 1,
      maxSelections: 1,
      perSeat: true,
      source: "campaignSet",
      exclusive: true,
    });
    // The flag is the definition's own rule: the next seat is not offered what the first took.
    const taken = first.options[0]!;
    const second = pendingOf(definition, [
      { instructionId: INSTRUCTION, slot: "pick", seatNumber: 1, picked: [taken] },
    ]);
    expect(second.seatNumber).toBe(2);
    expect(second.options).not.toContain(taken);
    expect(second.exclusive).toBe(true);
  });

  it("the same pool without excludeGranted is not exclusive: two seats may take the same title", () => {
    const definition = eachSeatTakes({ kind: "campaignSet", encounterSetId: TECH });
    const first = pendingOf(definition);
    expect(first.exclusive).toBe(false);
    const taken = first.options[0]!;
    const second = pendingOf(definition, [
      { instructionId: INSTRUCTION, slot: "pick", seatNumber: 1, picked: [taken] },
    ]);
    expect(second.options).toContain(taken);
  });

  it("a pick over the collection: source `collection`, never exclusive, however few cards it offers", () => {
    // Real Core data: the Justice allies Spider-Man may take, a handful of cards.
    const spiderMan = cardId("01001a");
    const seats: readonly CampaignSeatSetup[] = [
      {
        seatNumber: 1,
        identityCardId: spiderMan,
        deck: { identityCardId: spiderMan, aspects: ["justice"], cards: [] },
      },
    ];
    const from: CampaignChoiceSource = { kind: "collection", filter: { categories: ["ally"], aspects: ["justice"] } };
    const pending = pendingOf(eachSeatTakes(from), [], seats, { pool: CORE_CARDS });
    expect(shapeOf(pending)).toEqual({
      minSelections: 1,
      maxSelections: 1,
      perSeat: true,
      source: "collection",
      exclusive: false,
    });
    // Well under any count a client might have guessed a collection pick by.
    expect(pending.options.length).toBeGreaterThan(0);
    expect(pending.options.length).toBeLessThan(13);
  });

  it("an explicit list, read through an `excludingTitles` wrapper, and an optional pick of up to 2", () => {
    const list: CampaignChoiceSource = { kind: "cards", cardIds: TECH_CARDS.map((card) => card.id) };
    const wrapped: CampaignChoiceSource = {
      kind: "excludingTitles",
      from: list,
      titlesIn: { kind: "const", value: "" },
    };
    expect(shapeOf(pendingOf(eachSeatTakes(wrapped, { optional: true, count: 2 })))).toEqual({
      minSelections: 0,
      maxSelections: 2,
      perSeat: true,
      source: "cards",
      exclusive: false,
    });
  });

  it("fewer options than the count: both bounds are what can be picked, as the runner checks an answer", () => {
    const two: CampaignChoiceSource = { kind: "cards", cardIds: TECH_CARDS.slice(0, 2).map((card) => card.id) };
    const pending = pendingOf(eachSeatTakes(two, { count: 3 }));
    expect([pending.count, pending.minSelections, pending.maxSelections]).toEqual([3, 2, 2]);
  });

  it("a group choice is not per seat", () => {
    const definition = definitionOf([
      { kind: "choose", slot: "pick", chooser: "group", from: { kind: "campaignSet", encounterSetId: TECH } },
    ]);
    const pending = pendingOf(definition);
    expect(pending.seatNumber).toBeNull();
    expect(pending.perSeat).toBe(false);
  });

  it("a dealt hand (values) and the consent to a random draw", () => {
    const dealt = definitionOf([
      {
        kind: "forEachSeat",
        ops: [
          {
            kind: "random",
            slot: "dealt",
            count: 3,
            from: { kind: "campaignSet", encounterSetId: TECH, excludeGranted: true },
          },
          {
            kind: "choose",
            slot: "pick",
            chooser: "eachSeat",
            optional: true,
            from: { kind: "values", of: { kind: "choice", slot: "dealt" } },
          },
        ],
      },
    ]);
    expect(shapeOf(pendingOf(dealt))).toEqual({
      minSelections: 0,
      maxSelections: 1,
      perSeat: true,
      source: "values",
      exclusive: false,
    });
    const consent = definitionOf([
      {
        kind: "forEachSeat",
        ops: [
          {
            kind: "random",
            slot: "drawn",
            optional: true,
            from: { kind: "campaignSet", encounterSetId: TECH, excludeGranted: true },
          },
        ],
      },
    ]);
    const asked = pendingOf(consent);
    expect(asked.random).toBe(true);
    expect(shapeOf(asked)).toEqual({
      minSelections: 0,
      maxSelections: 1,
      perSeat: true,
      source: "campaignSet",
      exclusive: false,
    });
  });
});
