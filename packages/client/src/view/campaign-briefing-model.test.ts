import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import type { CampaignAttempt, CampaignChoiceAnswer, ResolvedInstruction } from "@mc/engine";
import { createCampaignLog } from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { CAMPAIGN_STORAGE_SCHEMA, MemoryCampaignStorage } from "../engine/campaign-storage.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun } from "../campaign/dev-fixtures.js";
import { briefingViewOf, deckRowsOf, handledRowsOf } from "./campaign-briefing-model.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

describe("campaign briefing model", () => {
  test("issue #1 composed: no grants yet, decks at their built size with nothing pinned", async () => {
    const record = await seedDesignRun(service(), "issue1Composed");
    const view = briefingViewOf(record, cardName as never, 1);
    expect(view).not.toBeNull();
    expect(view!.decks.every((row) => row.pinnedCount === 0)).toBe(true);
    expect(view!.decks.map((row) => row.heroName)).toEqual(["Hawkeye", "Spider-Woman"]);
  });

  test("a record with no composed attempt has no briefing view", async () => {
    const record = await seedDesignRun(service(), "afterIssue1");
    expect(briefingViewOf(record, cardName as never, 2)).toBeNull();
  });

  test("deckRowsOf: grants pin into the deck and never count toward its size (MC10 p. 3)", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    const rows = deckRowsOf(record, cardName as never);
    // seedDesignRun's own picks: each hero took a TECH and a Basic Condition upgrade over issues #1-#2.
    expect(rows.every((row) => row.pinnedCount === 2)).toBe(true);
    expect(rows.every((row) => row.deckSize > 0)).toBe(true);
  });

  test("deckRowsOf: a single aspect reads as its full name, uppercase", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    const rows = deckRowsOf(record, cardName as never);
    for (const row of rows) expect(row.aspectLabel).toBe(row.aspectLabel.toUpperCase());
  });

  test("handledRowsOf: after issue #2's rewind, the composed issue #3 lists the design's own TECH/Basic grants", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    const composed = await service_compose(service, record);
    const rows = handledRowsOf(composed.attempt!, composed, cardName as never);
    const grantsRow = rows.find((row) => row.key === "grants");
    expect(grantsRow).toBeDefined();
    expect(grantsRow!.status).toBe("done");
    expect(grantsRow!.detail).toContain("Hawkeye");
    expect(grantsRow!.detail).toContain("Spider-Woman");
  });

  test("handledRowsOf: a field this issue's own setup reads gets a ✓ row; one only a later issue reads gets a → row", () => {
    const { attempt, record, nodeIds } = trorsFixtureWithFields();
    const rows = handledRowsOf(attempt, record, cardName as never, TRORS_CAMPAIGN_DEFINITION, nodeIds);

    // (a) issue #2's own setup shuffles "experimental" into the encounter deck — a ✓ row, titled from the real
    // log field's own printed label plus the count (2 cards), detailed with the real printed instruction sentence.
    const experimentalRow = rows.find((row) => row.key === "field:mc10.s2.setup.experimental");
    expect(experimentalRow).toEqual({
      key: "field:mc10.s2.setup.experimental",
      status: "done",
      title: "Experimental Weapons added to encounter deck: 2",
      detail: "Shuffle each EXPERIMENTAL attachment recorded in the campaign log into the encounter deck.",
    });

    // (b) "delayCounters" is meaningful (3) but issue #2's own instructions never read it — only issue #5's setup
    // does (MC10 p. 15) — so it reads as held, not done, and names the real later issue number and instruction.
    const delayRow = rows.find((row) => row.key === "field-later:delayCounters");
    expect(delayRow).toEqual({
      key: "field-later:delayCounters",
      status: "later",
      title: "Number of delay counters on main scheme — held for issue #5",
      detail:
        "Place X threat counters on the main scheme, where X is the number of delay counters recorded in the campaign log.",
    });
  });

  test("handledRowsOf: a zero/empty field gets no row at all, held or otherwise", () => {
    const { attempt, record, nodeIds } = trorsFixtureWithFields({ experimental: [], delayCounters: 0 });
    const rows = handledRowsOf(attempt, record, cardName as never, TRORS_CAMPAIGN_DEFINITION, nodeIds);
    expect(rows.some((row) => row.key.startsWith("field:"))).toBe(false);
    expect(rows.some((row) => row.key.startsWith("field-later:"))).toBe(false);
  });
});

/**
 * A hand-built record against the real `TRORS_CAMPAIGN_DEFINITION` (never a fake one — the field labels, node
 * graph and printed instruction text all have to be the real generic ones a box actually ships, or the test would
 * only prove the view model agrees with itself). Issue #2 ("absorbing-man") is composed with its real "experimental"
 * setup instruction, and the log carries both fields `seedDesignRun`'s forced wins can never produce a nonzero
 * value for (its wins are substituted before any card enters play).
 */
function trorsFixtureWithFields(
  values: { readonly experimental?: readonly string[]; readonly delayCounters?: number } = {},
): { readonly attempt: CampaignAttempt; readonly record: CampaignRecord; readonly nodeIds: readonly string[] } {
  const definition = TRORS_CAMPAIGN_DEFINITION;
  const base = createCampaignLog(definition, {
    id: "test-run",
    seats: [
      {
        seatNumber: 1,
        identityCardId: "04001a" as CardId,
        deck: { identityCardId: "04001a" as CardId, aspects: ["leadership"], cards: [] },
      },
    ],
    modes: { campaign: { campaignId: definition.campaignId } },
    poolVersion: "test",
    seed: 1,
  });
  const experimentalIds = (values.experimental ?? ["04157", "04156"]) as readonly CardId[];
  const delayCounters = values.delayCounters ?? 3;
  const shared = {
    ...base.shared,
    experimental: { kind: "cardList" as const, cardIds: experimentalIds },
    delayCounters: { kind: "number" as const, value: delayCounters },
  };

  const node2 = definition.graph.nodes.find((node) => node.id === "absorbing-man")!;
  const experimentalInstruction = node2.setup.find((instruction) => instruction.id === "mc10.s2.setup.experimental")!;
  if (experimentalInstruction.step.kind !== "inGame") throw new Error("expected an inGame instruction");
  const resolvedInstructions: ResolvedInstruction[] = [
    {
      instructionId: experimentalInstruction.id,
      text: experimentalInstruction.text,
      citation: experimentalInstruction.citation,
      window: experimentalInstruction.step.window,
      effects: experimentalInstruction.step.effects,
    },
  ];

  const record: CampaignRecord = {
    ...base,
    shared,
    recordSchema: CAMPAIGN_STORAGE_SCHEMA,
    name: TRORS_CAMPAIGN_DEFINITION.campaignId as string,
    box: "MC10",
    createdAt: 0,
    updatedAt: 0,
  };
  const attempt: CampaignAttempt = {
    nodeId: "absorbing-man",
    modes: record.modes,
    logBefore: {
      definitionVersion: record.definitionVersion,
      shared: record.shared,
      hidden: record.hidden,
      seats: record.seats,
      removedFromCampaign: record.removedFromCampaign,
      position: record.position,
      rng: record.rng,
    },
    steps: [],
    input: {
      campaignId: definition.campaignId,
      nodeId: "absorbing-man",
      definitionVersion: definition.version,
      modes: record.modes,
      log: { shared: record.shared, perSeat: [] },
      instructions: resolvedInstructions,
      removedFromCampaign: [],
      seats: [],
      seed: 1,
    },
    composedVillain: null,
    composedEncounterSetIds: [],
  };
  return {
    attempt,
    record: { ...record, attempt },
    nodeIds: definition.graph.nodes.map((node) => node.id),
  };
}

/**
 * `afterIssue2` stops before issue #3 is composed. Composes it here (declining anything optional) so
 * `handledRowsOf` has a real `CampaignAttempt` to read.
 */
async function service_compose(makeService: () => CampaignService, seed: CampaignRecord): Promise<CampaignRecord> {
  const svc = makeService();
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 32; guard++) {
    const result = await svc.compose(seed, answers);
    if (result.kind === "done") return result.record;
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: result.choice.optional ? [] : result.choice.options.slice(0, result.choice.count),
    });
  }
  throw new Error("issue #3 asked more than 32 questions composing");
}
