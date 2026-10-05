import { describe, expect, test } from "vitest";
import type { CardId } from "@mc/content";
import type { CampaignAttempt, CampaignChoiceAnswer, ResolvedInstruction } from "@mc/engine";
import { createCampaignLog } from "@mc/engine";
import { campaignDefinitionOf, SM_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { CAMPAIGN_STORAGE_SCHEMA, MemoryCampaignStorage } from "../engine/campaign-storage.js";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedDesignRun, seedSmComposed } from "../campaign/dev-fixtures.js";
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
      title: "Number of delay counters on main scheme: 3 — held for issue #5",
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

  /**
   * MC27 p. 9's Community Service pick (`sm.ts`'s `communityServicePick`): a `random` op into a scratch slot, then
   * a `setField` recording that same choice onto `communityServiceDealt` — two engine-trace facts for the one
   * printed sentence. The row must read as a single human sentence, never the raw `set field = value` / `chose …
   * for "slot"` trace `effectsOf` used to print verbatim.
   */
  test("handledRowsOf: Community Service's random pick reads as one sentence, not a raw write+choice trace", async () => {
    const record = await seedSmComposed(
      new CampaignService({
        storage: new MemoryCampaignStorage(),
        campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
        engineDeps: POOL_DEPS,
      }),
      "afterIssue1",
    );
    if (!record.attempt) throw new Error("expected issue #2 to be composed");
    const nodeIds = SM_CAMPAIGN_DEFINITION.graph.nodes.map((node) => node.id);
    const rows = handledRowsOf(record.attempt, record, cardName as never, SM_CAMPAIGN_DEFINITION, nodeIds);
    const pickRow = rows.find((row) => row.key.includes("community-service-pick"));
    expect(pickRow).toBeDefined();
    expect(pickRow!.detail).toMatch(/^The group chose .+ at random for Community Service\.$/);
    expect(pickRow!.detail).not.toContain("set ");
    expect(pickRow!.detail).not.toContain('"communityService"');
  }, 30_000);
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
    composedEncounterSets: { deck: [], setAside: [] },
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

describe("campaign briefing model, role-building rows", () => {
  test("handledRowsOf: role-building reads as one sentence per seat, with the hero, the role and the cards", () => {
    const trace = (instructionId: string, over: Record<string, unknown>) => ({
      instructionId,
      text: "Each player may role-build to modify their deck (see page 5).",
      citation: "MC32 p. 7",
      kind: "betweenGames",
      writes: [],
      choices: [],
      removedFromCampaign: [],
      grants: [],
      ...over,
    });
    const attempt = {
      steps: [
        trace("role", {
          text: "Each player chooses one of the campaign roles.",
          choices: [
            { slot: "role", seatNumber: 1, picked: ["brawler"] },
            { slot: "role", seatNumber: 2, picked: ["commander"] },
          ],
        }),
        trace("build", {
          choices: [
            { slot: "roleEvent", seatNumber: 1, picked: ["01100"] },
            { slot: "roleUpgradeCard", seatNumber: 1, picked: ["01101"] },
            { slot: "roleEvent", seatNumber: 2, picked: [] },
          ],
          grants: [
            { cardId: "01100", permanence: "thisGame", grantedAtNodeId: "n" },
            { cardId: "01101", permanence: "thisGame", grantedAtNodeId: "n" },
          ],
        }),
      ],
    } as unknown as CampaignAttempt;
    const record = {
      seats: [
        { seatNumber: 1, identityCardId: "01010", grants: [], fields: {} },
        { seatNumber: 2, identityCardId: "01001", grants: [], fields: {} },
      ],
    } as unknown as CampaignRecord;
    const names: Record<string, string> = {
      "01100": "Get Over Here!",
      "01101": "Marked",
      "01010": "Colossus",
      "01001": "Shadowcat",
    };
    const rows = handledRowsOf(attempt, record, ((id: string) => names[id] ?? id) as never);
    const titles = rows.map((row) => row.title);
    expect(titles).toContain("Colossus (Brawler) added Get Over Here! and Marked to the deck for this game.");
    expect(titles).toContain("Shadowcat (Commander) added nothing to the deck this game.");
    expect(rows.filter((row) => row.key.startsWith("build"))).toHaveLength(2);
  });

  test("a role-building pick that every seat declined reads as nothing added, not as a log line", () => {
    const attempt = {
      steps: [
        {
          instructionId: "build",
          skipped: false,
          citation: "MC32 p. 3",
          writes: [],
          grants: [],
          removedFromCampaign: [],
          choices: [{ slot: "roleEvent", seatNumber: 1, picked: [] }],
        },
      ],
    } as unknown as CampaignAttempt;
    const record = {
      seats: [{ seatNumber: 1, identityCardId: "01010", grants: [], fields: {} }],
    } as unknown as CampaignRecord;
    const rows = handledRowsOf(attempt, record, ((id: string) => (id === "01010" ? "Colossus" : id)) as never);
    const titles = rows.map((row) => row.title);
    expect(titles).toContain("Colossus added nothing to the deck this game.");
    expect(JSON.stringify(rows)).not.toMatch(/declined for/i);
  });

  test("handledRowsOf: taking a role and drawing a role upgrade read as sentences, not as log lines", () => {
    const trace = (instructionId: string, text: string, choices: unknown[]) => ({
      instructionId,
      text,
      citation: "MC32 p. 7",
      kind: "betweenGames",
      writes: [],
      choices,
      removedFromCampaign: [],
      grants: [],
    });
    const attempt = {
      steps: [
        trace("role", "Each player chooses one of the campaign roles.", [
          { slot: "role", seatNumber: 1, picked: ["brawler"] },
        ]),
        trace("draw", "Each player draws a random role upgrade.", [
          { slot: "roleUpgrade", seatNumber: 1, picked: ["01102"], random: true },
        ]),
      ],
    } as unknown as CampaignAttempt;
    const record = {
      seats: [{ seatNumber: 1, identityCardId: "01010", grants: [], fields: {} }],
    } as unknown as CampaignRecord;
    const names: Record<string, string> = { "01102": "Brazen Defense", "01010": "Colossus" };
    const rows = handledRowsOf(attempt, record, ((id: string) => names[id] ?? id) as never);
    const titles = rows.map((row) => row.title);
    expect(titles).toContain("Colossus took the Brawler role.");
    expect(titles).toContain("Colossus (Brawler) drew Brazen Defense as a role upgrade.");
    expect(titles.some((title) => /^Seat \d+ chose/.test(title))).toBe(false);
    expect(rows.find((row) => row.title.startsWith("Colossus took"))!.detail, "one sentence, no second line").toBe("");
  });
});

describe("campaign briefing model, Mutant Genesis wording", () => {
  const names: Record<string, string> = {
    c1: "Get Over Here!",
    c2: "Marked",
    "01010": "Colossus",
    r1: "Rictor",
    r2: "Boom Boom",
  };
  const nameOf = ((id: string) => names[id] ?? id) as never;

  test("a card added to the deck for one game is not a 'start in play' row (MC32 p. 5); a campaign grant still is (MC10 p. 3)", () => {
    const seat = (permanence: "thisGame" | "campaign") => ({
      seatNumber: 1,
      identityCardId: "01010",
      fields: {},
      grants: [{ cardId: "c1", permanence, grantedAtNodeId: "n" }],
    });
    const attempt = { steps: [] } as unknown as CampaignAttempt;
    const roleBuilt = { seats: [seat("thisGame")] } as unknown as CampaignRecord;
    expect(handledRowsOf(attempt, roleBuilt, nameOf).some((row) => row.key === "grants")).toBe(false);
    const kept = { seats: [seat("campaign")] } as unknown as CampaignRecord;
    const row = handledRowsOf(attempt, kept, nameOf).find((candidate) => candidate.key === "grants");
    expect(row?.title).toBe("Setup cards start in play");
    expect(row?.detail).toContain("Get Over Here!");
  });

  test("the captive-shuffle step labels recorded captives and struck allies apart, each with its own count", () => {
    const definition = campaignDefinitionOf("mut_gen")!;
    const nodeIds = definition.graph.nodes.map((node) => node.id);
    const instruction = {
      instructionId: "mc32.s4.setup.captives",
      text: "Each CAPTIVE ally recorded in the campaign log may be shuffled into any player's deck.",
      citation: "MC32 p. 16",
      window: "setup",
      effects: [
        { kind: "campaignLog", field: "captives" },
        { kind: "campaignLog", field: "heldAllies" },
      ],
    };
    const attempt = {
      nodeId: nodeIds[3],
      steps: [],
      input: { instructions: [instruction] },
    } as unknown as CampaignAttempt;
    const record = (shared: Record<string, unknown>) => ({ seats: [], shared }) as unknown as CampaignRecord;
    const rowsOf = (shared: Record<string, unknown>) =>
      handledRowsOf(attempt, record(shared), nameOf, definition, nodeIds).filter((row) => row.key.startsWith("field:"));

    // 0 captives recorded, 2 struck: only the struck row shows, with its own words (the QA case).
    const onlyStruck = rowsOf({ heldAllies: { kind: "cardList", cardIds: ["r1", "r2"] } });
    expect(onlyStruck.map((row) => row.title)).toEqual(["Allies struck: 2"]);
    expect(onlyStruck[0]!.detail).toMatch(/out of the campaign/i);

    const both = rowsOf({
      captives: { kind: "cardList", cardIds: ["r1", "r2", "c1"] },
      heldAllies: { kind: "cardList", cardIds: ["r2"] },
    });
    expect(both.map((row) => row.title)).toEqual(["Captives recorded: 3", "Allies struck: 1"]);
    expect(both[0]!.detail).toMatch(/shuffled into any player's deck/);
    expect(both.some((row) => row.title.includes("Rescue Captives"))).toBe(false);
  });
});
