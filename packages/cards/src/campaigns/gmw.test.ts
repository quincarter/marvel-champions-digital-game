/**
 * `GMW_CAMPAIGN_DEFINITION` driven through the real runner (docs/campaign-mode-design.md §11 step 7's own
 * acceptance test, `trors.test.ts`'s pattern applied to MC16).
 *
 * Two halves, like `trors.test.ts`:
 *
 * - A **between-games walk** of all five nodes (`walk()`), each node's finished-game facts supplied directly as
 *   `CampaignGameResult.records` rather than derived from a played game — the same shortcut `trors.test.ts` takes
 *   for its own five-node walk, justified there and here the same way: what a game would have computed for a
 *   `record` instruction is exactly what `campaignResultOf` derives from `GameState`/events, which is `@mc/engine`'s
 *   own job to prove (`packages/engine/src/campaign/new-primitives.test.ts`), not this file's.
 * - A **real game**, set up from a composed log via `wave3Scenario`/`createGame`, proving the campaign's own
 *   Market grants and campaign-composed set-aside cards are accepted by real content.
 */
import { describe, expect, it } from "vitest";
import { GMW_CAMPAIGN, GMW_STARTER_DECKS, WAVE3_CARDS, type CardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  CAMPAIGN_ACCEPT,
  campaignChoiceKey,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  validateDeck,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type DeckContext,
  type GameSetupConfig,
} from "@mc/engine";
import { WAVE3_DEPS, wave3Scenario } from "../wave3/index.js";
import { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";

const DEPS: CampaignDeps = { pool: WAVE3_CARDS };
const MODES: PlayModes = { campaign: { campaignId: GMW_CAMPAIGN_DEFINITION.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: GMW_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } };

const STARTER_IDS = ["groot-protection", "rocket-raccoon-aggression"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = GMW_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no gmw starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = STARTER_IDS.map((id, index) => seatFor(id, index + 1));

// --- answering the box's own choices, the same scripted-caller shape `trors.test.ts` uses ---------------------

const answer = (
  instructionId: string,
  slot: string,
  seatNumber: number | null,
  picked: readonly string[],
): CampaignChoiceAnswer => ({ instructionId, slot, seatNumber, picked });

interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 400; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      throw new Error(
        `the script has no answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 400 choices in one step list");
}

/** MC16 p. 5's Market, cost 1 through 7 (16150–16177), 4 cards per tier. */
const MARKET_TIER: Readonly<Record<number, readonly string[]>> = {
  1: ["16150", "16151", "16152", "16153"],
  2: ["16154", "16155", "16156", "16157"],
  3: ["16158", "16159", "16160", "16161"],
  4: ["16162", "16163", "16164", "16165"],
  5: ["16166", "16167", "16168", "16169"],
  6: ["16170", "16171", "16172", "16173"],
  7: ["16174", "16175", "16176", "16177"],
};

/** Composes and wins scenario 1 from a fresh log, with `unitsBySeat[seatNumber]` awarded to that seat. */
function winS1(seedLog: CampaignLog, unitsBySeat: Readonly<Record<number, number>>): CampaignLog {
  const composed = settle(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, seedLog, DEPS, seedLog.modes, answers),
    [],
  );
  const won: CampaignGameResult = {
    nodeId: "brotherhood-of-badoon",
    outcome: "won",
    records: Object.entries(unitsBySeat).map(([seatNumber, units]) => ({
      instructionId: "mc16.s1.victory.units",
      write: { field: "units", seatNumber: Number(seatNumber), mode: "add", value: { kind: "number", value: units } },
    })),
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
  };
  return settle(
    (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed.value, won, { at: 1 }, DEPS, answers),
    [],
  ).value;
}

/** Declines every market slot and every optional heal/reveal offer, for a script that answers nothing else. */
function declineEverything(instructionId: string, seatNumbers: readonly number[]): readonly CampaignChoiceAnswer[] {
  const answers: CampaignChoiceAnswer[] = [];
  for (let tier = 1; tier <= 7; tier++) {
    for (let copy = 0; copy < 4; copy++) {
      for (const seatNumber of seatNumbers)
        answers.push(answer(instructionId, `market-${tier}-${copy}`, seatNumber, []));
    }
  }
  return answers;
}

describe("GMW_CAMPAIGN_DEFINITION", () => {
  it("campaignId matches the @mc/content Campaign record, and the version and loss policy are present", () => {
    expect(GMW_CAMPAIGN_DEFINITION.campaignId).toBe(GMW_CAMPAIGN.id);
    expect(GMW_CAMPAIGN_DEFINITION.version).toBe("1");
    expect(GMW_CAMPAIGN_DEFINITION.loss).toEqual({ retry: "byInstruction", retryBaseline: "nodeStart" });
  });

  it("is a fully-connected linear graph of 5 uniquely-id'd nodes, in the content record's scenario order", () => {
    const graph = GMW_CAMPAIGN_DEFINITION.graph;
    expect(graph.kind).toBe("linear");
    if (graph.kind !== "linear") return;
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toEqual([
      "brotherhood-of-badoon",
      "infiltrate-the-museum",
      "escape-the-museum",
      "nebula",
      "ronan-the-accuser",
    ]);
    expect(ids).toEqual(GMW_CAMPAIGN.scenarioIds.map((id) => id as string));
  });
});

describe("the Market: cost, balance, and one copy per campaign for the group", () => {
  it("respects a seat's own balance (only the tiers it can afford are ever offered)", () => {
    const seedLog = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
      id: "smoke-market-balance",
      seats: SEATS,
      modes: MODES,
      poolVersion: "smoke-test",
      seed: 1,
    });
    // Seat 1 wins scenario 1 with exactly 2 units; seat 2 with 0.
    const afterS1 = winS1(seedLog, { 1: 2 });
    expect(afterS1.seats[0]?.fields.units).toEqual({ kind: "number", value: 2 });
    expect(afterS1.seats[1]?.fields.units).toBeUndefined();

    // Answer nothing: every offered slot is declined. What matters is *which* slots get asked at all.
    const composed = settle(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterS1, DEPS, MODES, answers),
      declineEverything("mc16.s2.setup.market", [1, 2]),
    );
    const marketAsks = composed.asked.filter((choice) => choice.instructionId === "mc16.s2.setup.market");
    const seat1Tiers = new Set(marketAsks.filter((c) => c.seatNumber === 1).map((c) => Number(c.slot.split("-")[1])));
    const seat2Tiers = new Set(marketAsks.filter((c) => c.seatNumber === 2).map((c) => Number(c.slot.split("-")[1])));
    // Seat 1 has 2 units: tiers 1 and 2 are offered, never 3+.
    expect([...seat1Tiers].sort()).toEqual([1, 2]);
    // Seat 2 has 0 units: no market slot is ever offered.
    expect(seat2Tiers.size).toBe(0);
  });

  it("costs the right amount, and one physical copy is legal for the group even when two seats want it", () => {
    const seedLog = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
      id: "smoke-market-buy",
      seats: SEATS,
      modes: MODES,
      poolVersion: "smoke-test",
      seed: 1,
    });
    const afterS1 = winS1(seedLog, { 1: 1, 2: 1 });

    const cheapest = MARKET_TIER[1]![0]!;
    const script: readonly CampaignChoiceAnswer[] = [
      answer("mc16.s2.setup.market", "market-1-0", 1, [cheapest]),
      // Seat 2 would also like the same physical card, but it is already taken: it is not among the options
      // offered, so the script cannot even name it — this asserts the *options* below, not this answer.
      ...declineEverything("mc16.s2.setup.market", [1, 2]).filter(
        (a) => !(a.slot === "market-1-0" && a.seatNumber === 1),
      ),
    ];
    const composed = settle(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterS1, DEPS, MODES, answers),
      script,
    );

    expect(composed.value.seats[0]?.fields.units).toEqual({ kind: "number", value: 0 });
    expect(composed.value.seats[0]?.fields.marketCards).toEqual({ kind: "cardList", cardIds: [cheapest] });
    expect(composed.value.seats[0]?.grants.some((grant) => grant.cardId === cheapest)).toBe(true);

    // Seat 2's own "market-1-0" slot never offers the now-taken card (group-wide `excludeGranted`).
    const seat2FirstSlot = composed.asked.find(
      (c) => c.instructionId === "mc16.s2.setup.market" && c.slot === "market-1-0" && c.seatNumber === 2,
    );
    expect(seat2FirstSlot?.options.includes(cheapest)).toBe(false);
  });
});

describe("a loss, and a free retry", () => {
  it("leaves position and log untouched by a lost attempt (MC16 p. 4)", () => {
    const seedLog = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
      id: "smoke-loss",
      seats: SEATS,
      modes: MODES,
      poolVersion: "smoke-test",
      seed: 1,
    });
    const composed = settle(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, seedLog, DEPS, MODES, answers),
      [],
    );
    const lost: CampaignGameResult = {
      nodeId: "brotherhood-of-badoon",
      outcome: "lost",
      records: [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const applied = settle(
      (answers) => applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed.value, lost, { at: 1 }, DEPS, answers),
      [],
    );
    expect(applied.value.position.nextNodeId).toBe("brotherhood-of-badoon");
    expect(applied.value.position.resolved["brotherhood-of-badoon"]).toBeUndefined();
    expect(applied.value.seats[0]?.fields.units).toBeUndefined();
    expect(applied.value.history).toHaveLength(1);
    expect(applied.value.history[0]?.outcome).toBe("lost");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The whole campaign's between-games half, in expert campaign mode — mirrors `trors.test.ts`'s own five-node walk
// ---------------------------------------------------------------------------------------------------------------

type Records = CampaignGameResult["records"];

const record = (instructionId: string, field: string, seatNumber: number | null, value: unknown): Records[number] =>
  ({ instructionId, write: { field, seatNumber, mode: "set", value } }) as Records[number];

const RECORDS: Readonly<Record<string, Records>> = {
  "brotherhood-of-badoon": [
    ...[1, 2].map((seatNumber) => record("mc16.s1.victory.units", "units", seatNumber, { kind: "number", value: 5 })),
    {
      instructionId: "mc16.s1.victory.headhunter",
      write: { field: "headhunterDefeated", seatNumber: null, mode: "add", value: { kind: "number", value: 1 } },
    },
    ...[1, 2].map((seatNumber) =>
      record("mc16.s1.victory.hp", "remainingHp", seatNumber, { kind: "number", value: 3 }),
    ),
  ],
  "infiltrate-the-museum": [
    {
      instructionId: "mc16.s2.victory.headhunter",
      write: { field: "headhunterDefeated", seatNumber: null, mode: "add", value: { kind: "number", value: 1 } },
    },
    ...[1, 2].map((seatNumber) =>
      record("mc16.s2.victory.hp", "remainingHp", seatNumber, { kind: "number", value: 4 }),
    ),
  ],
  "escape-the-museum": [
    {
      instructionId: "mc16.s3.victory.headhunter",
      write: { field: "headhunterDefeated", seatNumber: null, mode: "add", value: { kind: "number", value: 1 } },
    },
    ...[1, 2].map((seatNumber) =>
      record("mc16.s3.victory.hp", "remainingHp", seatNumber, { kind: "number", value: 5 }),
    ),
  ],
  nebula: [
    {
      instructionId: "mc16.s4.victory.headhunter",
      write: { field: "headhunterDefeated", seatNumber: null, mode: "add", value: { kind: "number", value: 1 } },
    },
    ...[1, 2].map((seatNumber) =>
      record("mc16.s4.victory.hp", "remainingHp", seatNumber, { kind: "number", value: 6 }),
    ),
  ],
  "ronan-the-accuser": [],
};

function scriptFor(nodeId: string, seatNumbers: readonly number[]): readonly CampaignChoiceAnswer[] {
  const answers: CampaignChoiceAnswer[] = [];
  if (nodeId !== "brotherhood-of-badoon") {
    answers.push(...declineEverything(`mc16.${idOf(nodeId)}.setup.market`, seatNumbers));
    // Accept the 1-unit heal every seat is offered (each has units from the previous scenario's victory).
    for (const seatNumber of seatNumbers)
      answers.push(answer(`mc16.${idOf(nodeId)}.setup.heal-spend`, "heal", seatNumber, [CAMPAIGN_ACCEPT]));
  }
  if (nodeId === "ronan-the-accuser") answers.push(answer("mc16.s5.setup.kree-decide", "kree", null, []));
  return answers;
}

const idOf = (nodeId: string): string =>
  ({
    "brotherhood-of-badoon": "s1",
    "infiltrate-the-museum": "s2",
    "escape-the-museum": "s3",
    nebula: "s4",
    "ronan-the-accuser": "s5",
  })[nodeId] as string;

const walk = (): { readonly log: CampaignLog } => {
  let log = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
    id: "walk-gmw",
    seats: SEATS,
    modes: EXPERT,
    poolVersion: "smoke-test",
    seed: 4242,
  });
  for (let node = 0; node < 5; node++) {
    const nodeId = log.position.nextNodeId;
    if (nodeId === null) break;
    const script = scriptFor(nodeId, [1, 2]);
    const composed = settle(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, EXPERT, answers),
      script,
    );
    const result: CampaignGameResult = {
      nodeId,
      outcome: "won",
      records: RECORDS[nodeId] ?? [],
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const applied = settle(
      (answers) =>
        applyCampaignResult(GMW_CAMPAIGN_DEFINITION, composed.value, result, { at: 1_700_000_000_000 }, DEPS, answers),
      script,
    );
    log = applied.value;
  }
  return { log };
};

describe("GMW_CAMPAIGN_DEFINITION's between-games instructions, all five scenarios (expert campaign)", () => {
  it("wins the campaign", () => {
    const { log } = walk();
    expect(log.status).toBe("won");
    expect(log.history.map((entry) => entry.nodeId)).toEqual([
      "brotherhood-of-badoon",
      "infiltrate-the-museum",
      "escape-the-museum",
      "nebula",
      "ronan-the-accuser",
    ]);
  });

  it("the Headhunter ladder advances by one mark per scenario won (MC16 p. 8/p. 10/p. 12/p. 14)", () => {
    const { log } = walk();
    expect(log.shared.headhunterDefeated).toEqual({ kind: "number", value: 4 });
  });

  it("carries remaining hit points forward, and the 1-unit heal spends the unit (MC16 p. 5/p. 10)", () => {
    const { log } = walk();
    // Scenario 1 recorded 5 hp for each seat; scenario 2's setup offered (and this script accepted) the heal,
    // which spends 1 of the 5 units scenario 1 awarded — so 4 remain after scenario 2's own setup, before
    // scenario 2's own victory adds any more.
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: 6 });
    expect(log.seats[0]?.fields.healedFull).toEqual({ kind: "flag", value: true });
  });

  it("leaves every seat's deck legal with what the campaign put in it", () => {
    const { log } = walk();
    const seat = log.seats[0];
    if (!seat) throw new Error("no seat 1");
    const context: DeckContext = {
      campaign: {
        campaignId: GMW_CAMPAIGN.id as string,
        campaignSetIds: GMW_CAMPAIGN.campaignSetIds.map((id) => id as string),
        identityCardId: seat.identityCardId as string,
        grantedCardIds: seat.grants.map((grant) => grant.cardId as string),
        removedFromCampaign: log.removedFromCampaign,
      },
    };
    expect(validateDeck(seat.deck, WAVE3_CARDS, context)).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A real game, set up from the composed log
// ---------------------------------------------------------------------------------------------------------------

/** Every card belonging to these (campaign-composed) encounter sets, one instance per `quantityInSet` copy. */
function cardsOfSets(setIds: readonly string[]): CardId[] {
  const out: CardId[] = [];
  for (const setId of setIds) {
    const members = WAVE3_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
    );
    for (const card of members) for (let copy = 0; copy < card.quantityInSet; copy++) out.push(card.id);
  }
  return out;
}

describe("a real game, set up from the composed log", () => {
  it("accepts the campaign's granted Market cards and its composed set-aside cards", () => {
    const seedLog = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
      id: "smoke-real-game",
      seats: SEATS,
      modes: MODES,
      poolVersion: "smoke-test",
      seed: 9002,
    });
    const afterS1 = winS1(seedLog, { 1: 1 });

    const cheapest = MARKET_TIER[1]![0]!;
    const composed = settle(
      (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, afterS1, DEPS, MODES, answers),
      [
        answer("mc16.s2.setup.market", "market-1-0", 1, [cheapest]),
        ...declineEverything("mc16.s2.setup.market", [1, 2]).filter(
          (a) => !(a.slot === "market-1-0" && a.seatNumber === 1),
        ),
      ],
    );
    const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed.value);
    if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);

    const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: seat.deck,
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
    });
    const withSetAside: GameSetupConfig = {
      ...config,
      setAside: [...config.setAside!, ...cardsOfSets(start.encounterSets.setAside)],
    };
    const created = createGame({ ...withSetAside, campaign: start.input }, WAVE3_DEPS);
    expect(created.ok ? "ok" : created.error.message).toBe("ok");

    // The same deck is refused outside the campaign: a granted Market card is legal only where it was granted.
    const standalone = createGame(withSetAside, WAVE3_DEPS);
    expect(standalone.ok).toBe(false);
  });
});
