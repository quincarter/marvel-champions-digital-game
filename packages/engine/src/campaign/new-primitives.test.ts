/**
 * The between-games/record primitives closed while writing MC16's `CampaignDefinition` (`@mc/cards`
 * `src/campaigns/gmw.ts`), each cited to the printed sentence that forced it. Deliberately isolated from
 * `testing/campaign.ts`'s shared synthetic fixture: a small standalone definition per group of primitives, so a
 * mistake here cannot perturb `runner.test.ts`'s own coverage.
 *
 * - `CampaignValue` `seatCount` / `divide`, and `CampaignPredicate` `valueAtLeast`: a threshold or a unit price
 *   that is itself computed (a per-player count, a quotient) rather than a literal `CampaignOp` can write in.
 * - `CollectionFilter.unitCostExactly`: a `campaignSet` choice narrowed by a card's Market price, not its printed
 *   play cost (`maxPrintedCost` reads a different field).
 * - `CampaignOp` `composeEncounterSets`' `into`: a gathered set can land in the composed game's encounter deck (the
 *   default) or its set-aside pool, for a set only some of whose cards should enter this game's deck.
 * - `CampaignGameQuery` `cardsInScenarioArea`: the `record`-side mirror of the in-game `CardSelector`
 *   `scenarioArea`, over the same `GameState.scenarioAreas`.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, encounterSetId, flat, scenarioId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type { CampaignDefinition, CampaignGameResult, LogWrite } from "../campaign.js";
import type { GameEvent } from "../events.js";
import type { InstanceId } from "../ids.js";
import { stubEvent, stubMainScheme, stubSideScheme } from "../testing/fixtures.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import { campaignResultOf } from "./result.js";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignDeps,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("primitives-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };

const SEATS: readonly CampaignSeatSetup[] = [
  {
    seatNumber: 1,
    identityCardId: cardId("hero-one"),
    deck: { identityCardId: cardId("hero-one"), aspects: [], cards: [] },
  },
  {
    seatNumber: 2,
    identityCardId: cardId("hero-two"),
    deck: { identityCardId: cardId("hero-two"), aspects: [], cards: [] },
  },
];

function definitionWith(
  setup: CampaignDefinition["graph"]["nodes"][number]["setup"],
  victory: CampaignDefinition["graph"]["nodes"][number]["victory"] = [],
): CampaignDefinition {
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [
      { id: "pool", label: "Pool", scope: "shared", type: { kind: "number" }, citation: "test" },
      { id: "result", label: "Result", scope: "shared", type: { kind: "number" }, citation: "test" },
      { id: "flag", label: "Flag", scope: "shared", type: { kind: "flag" }, citation: "test" },
      { id: "collected", label: "Collected", scope: "shared", type: { kind: "cardList" }, citation: "test" },
    ],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "only",
          label: "Only",
          scenario: { kind: "fixed", scenarioId: scenarioId("primitives-test-scenario") },
          setup,
          victory,
        },
      ],
    },
  };
}

const newLog = (definition: CampaignDefinition) =>
  createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });

describe("CampaignValue seatCount and divide, and CampaignPredicate valueAtLeast", () => {
  it("MC16 p. 12's floor(count / 2), and MC16 p. 10's per-hero threshold over 2 seats", () => {
    const definition = definitionWith([
      {
        id: "only.setup.compute",
        text: "test",
        citation: "test",
        step: {
          kind: "betweenGames",
          ops: [
            { kind: "setField", field: "pool", value: { kind: "const", value: 5 } },
            {
              kind: "setField",
              field: "result",
              value: { kind: "divide", of: { kind: "field", field: "pool" }, by: 2, round: "down" },
            },
            // "1[per_hero] or fewer": pool (5) is not <= seatCount (2), so the flag stays unset.
            {
              kind: "if",
              when: {
                kind: "not",
                of: { kind: "valueAtLeast", value: { kind: "field", field: "pool" }, amount: { kind: "seatCount" } },
              },
              then: [{ kind: "setField", field: "flag", value: { kind: "const", value: true } }],
            },
          ],
        },
      },
    ]);
    const settled = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (settled.kind !== "done") throw new Error("unexpected pending choice");
    expect(settled.value.shared.result).toEqual({ kind: "number", value: 2 });
    expect(settled.value.shared.flag).toBeUndefined();
  });

  it("a pool exactly at the seat count sets the flag ('N or fewer' includes the boundary)", () => {
    // "1[per_hero] or fewer" is `pool <= seatCount`, i.e. `NOT(pool >= seatCount + 1)` — the `+ 1` matters at the
    // boundary (pool == seatCount), which is why the amount is `sum([seatCount, 1])` and not `seatCount` alone.
    const definition = definitionWith([
      {
        id: "only.setup.compute",
        text: "test",
        citation: "test",
        step: {
          kind: "betweenGames",
          ops: [
            { kind: "setField", field: "pool", value: { kind: "const", value: 2 } },
            {
              kind: "if",
              when: {
                kind: "not",
                of: {
                  kind: "valueAtLeast",
                  value: { kind: "field", field: "pool" },
                  amount: { kind: "sum", of: [{ kind: "seatCount" }, { kind: "const", value: 1 }] },
                },
              },
              then: [{ kind: "setField", field: "flag", value: { kind: "const", value: true } }],
            },
          ],
        },
      },
    ]);
    const settled = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (settled.kind !== "done") throw new Error("unexpected pending choice");
    expect(settled.value.shared.flag).toEqual({ kind: "flag", value: true });
  });
});

describe("CollectionFilter.unitCostExactly", () => {
  it("narrows a campaignSet choice to one Market price tier, not by printed play cost", () => {
    const MARKET = encounterSetId("mini-market");
    const cheap = {
      ...stubEvent({ id: "cheap", cost: 5 }), // a high printed play cost, to prove the filter reads `unitCost`
      unitCost: 1,
      specificTo: { kind: "campaign" as const, encounterSetId: MARKET },
    };
    const pricey = {
      ...stubEvent({ id: "pricey", cost: 0 }),
      unitCost: 2,
      specificTo: { kind: "campaign" as const, encounterSetId: MARKET },
    };
    const definition = definitionWith([
      {
        id: "only.setup.choose",
        text: "test",
        citation: "test",
        step: {
          kind: "betweenGames",
          ops: [
            {
              kind: "choose",
              slot: "buy",
              chooser: "eachSeat",
              from: { kind: "campaignSet", encounterSetId: MARKET, filter: { unitCostExactly: 1 } },
            },
          ],
        },
      },
    ]);
    const deps: CampaignDeps = { pool: [cheap, pricey] };
    const settled = resolveBetweenGames(definition, newLog(definition), deps, MODES);
    if (settled.kind !== "pending") throw new Error("expected a pending choice");
    expect(settled.choice.options).toEqual([cheap.id]);
  });
});

describe("CampaignOp composeEncounterSets' into", () => {
  it("splits gathered sets into the composed game's deck and set-aside pools", () => {
    const definition = definitionWith([
      {
        id: "only.setup.compose",
        text: "test",
        citation: "test",
        step: {
          kind: "betweenGames",
          ops: [
            { kind: "composeEncounterSets", sets: [{ kind: "const", value: "deck-set" }] },
            { kind: "composeEncounterSets", sets: [{ kind: "const", value: "aside-set" }], into: "setAside" },
          ],
        },
      },
    ]);
    const settled = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (settled.kind !== "done") throw new Error("unexpected pending choice");
    const start = startGameFromLog(definition, settled.value);
    expect(start.encounterSets).toEqual({ deck: ["deck-set"], setAside: ["aside-set"] });
  });
});

describe("CampaignGameQuery.cardsInScenarioArea", () => {
  it("mirrors cardsInVictoryDisplay over GameState.scenarioAreas", () => {
    const definition = definitionWith(
      [],
      [
        {
          id: "only.victory.collect",
          text: "test",
          citation: "test",
          step: {
            kind: "record",
            writes: [
              {
                field: "collected",
                mode: "append",
                value: { kind: "cardsInScenarioArea", name: "collection", query: { categories: ["identity"] } },
              },
            ],
          },
        },
      ],
    );
    const identities = seatIdentities(HERO, 2);
    const config: GameSetupConfig = {
      seed: 1,
      cards: [...DEFAULT_CARDS, ...identities],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
    };
    const created = createGame(config, DEFAULT_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const [firstPlayer] = created.state.players;
    if (!firstPlayer) throw new Error("no player seated");
    const finished = {
      ...created.state,
      scenarioAreas: { collection: [firstPlayer.identity.instanceId] },
      outcome: { result: "win" as const, reason: "villainDefeated" as const },
    };

    const composed = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    const result = campaignResultOf(definition, composed.value, finished, [], DEFAULT_DEPS);
    const write = result.records.find((record) => record.instructionId === "only.victory.collect")?.write;
    expect(write?.value).toEqual({ kind: "cardList", cardIds: [HERO.id] });

    // And through the runner end to end, folded into the log.
    const gameResult: CampaignGameResult = {
      nodeId: "only",
      outcome: "won",
      records: result.records,
      removedFromCampaign: [],
      logWrites: [],
      expiringGrants: [],
    };
    const applied = applyCampaignResult(definition, composed.value, gameResult, { at: 1 }, { pool: [] });
    if (applied.kind !== "done") throw new Error("unexpected pending choice");
    expect(applied.value.shared.collected).toEqual({ kind: "cardList", cardIds: [HERO.id] });
  });
});

describe("CampaignGameQuery.keywordValueSum, capAt and atMost", () => {
  it("MC16 p. 8: sums printed Victory X values in the victory display, capped at 3", () => {
    const definition = definitionWith(
      [],
      [
        {
          id: "only.victory.units",
          text: "test",
          citation: "test",
          step: {
            kind: "record",
            writes: [
              {
                field: "result",
                mode: "set",
                value: {
                  kind: "capAt",
                  of: { kind: "keywordValueSum", query: { categories: ["sideScheme"] }, keyword: "victory" },
                  amount: 3,
                },
              },
            ],
          },
        },
      ],
    );
    const identities = seatIdentities(HERO, 1);
    const twoPointScheme = {
      ...stubSideScheme({ id: "two-point", startingThreat: 1 }),
      keywords: [{ name: "victory" as const, value: 2 }],
    };
    const config: GameSetupConfig = {
      seed: 1,
      cards: [...DEFAULT_CARDS, ...identities, twoPointScheme],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      setAside: [twoPointScheme.id],
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
    };
    const created = createGame(config, DEFAULT_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const twoPointInstance = Object.entries(created.state.instances).find(
      ([, instance]) => instance.cardId === twoPointScheme.id,
    )?.[0] as InstanceId | undefined;
    if (!twoPointInstance) throw new Error("stub side scheme never instantiated");
    // Two copies in the victory display: 2 + 2 = 4, capped at 3 (not the card count, 2).
    const finished = {
      ...created.state,
      victoryDisplay: [twoPointInstance, twoPointInstance],
      outcome: { result: "win" as const, reason: "villainDefeated" as const },
    };

    const composed = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    const result = campaignResultOf(definition, composed.value, finished, [], DEFAULT_DEPS);
    const write = result.records.find((record) => record.instructionId === "only.victory.units")?.write;
    expect(write?.value).toEqual({ kind: "number", value: 3 });
  });

  it("atMost is atLeast's complement, for MC16 p. 8's 'if there are no minions in play'", () => {
    const definition = definitionWith(
      [],
      [
        {
          id: "only.victory.noMinions",
          text: "test",
          citation: "test",
          step: {
            kind: "record",
            writes: [
              {
                field: "flag",
                mode: "set",
                value: { kind: "atMost", of: { kind: "cardsInPlay", query: { categories: ["minion"] } }, amount: 0 },
              },
            ],
          },
        },
      ],
    );
    const identities = seatIdentities(HERO, 1);
    const config: GameSetupConfig = {
      seed: 1,
      cards: [...DEFAULT_CARDS, ...identities],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
    };
    const created = createGame(config, DEFAULT_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const finished = { ...created.state, outcome: { result: "win" as const, reason: "villainDefeated" as const } };

    const composed = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    const result = campaignResultOf(definition, composed.value, finished, [], DEFAULT_DEPS);
    const write = result.records.find((record) => record.instructionId === "only.victory.noMinions")?.write;
    // No minions were ever instantiated for this game, so `atMost(…, 0)` is true.
    expect(write?.value).toEqual({ kind: "flag", value: true });
  });
});

describe("CampaignGameQuery.mainSchemeStageNumber and equals", () => {
  // MC16 p. 8 / p. 14: "Record 1 unit for each player if the main scheme is on stage 1B". A main scheme is one card
  // record with a `stages` array; the stage in play is `GameState.mainScheme.stageIndex`, always on its B side
  // (RRG 1.8 "Main Scheme", p. 27), so the sentence is `equals(mainSchemeStageNumber, 1)`.
  const twoStageScheme = stubMainScheme({
    id: "two-stage-scheme",
    stages: [
      { startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(1) },
      { startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(1) },
    ],
  });
  const definition = definitionWith(
    [],
    [
      {
        id: "only.victory.stage",
        text: "test",
        citation: "test",
        step: {
          kind: "record",
          writes: [
            { field: "result", mode: "set", value: { kind: "mainSchemeStageNumber" } },
            { field: "flag", mode: "set", value: { kind: "equals", of: { kind: "mainSchemeStageNumber" }, amount: 1 } },
          ],
        },
      },
    ],
  );

  function recordedAt(stageIndex: number): readonly LogWrite[] {
    const identities = seatIdentities(HERO, 1);
    const created = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS, ...identities, twoStageScheme],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: twoStageScheme.id,
        encounterDeck: [],
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
      },
      DEFAULT_DEPS,
    );
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const finished = {
      ...created.state,
      mainScheme: { ...created.state.mainScheme, stageIndex },
      outcome: { result: "win" as const, reason: "villainDefeated" as const },
    };
    const composed = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    return campaignResultOf(definition, composed.value, finished, [], DEFAULT_DEPS).records.map((r) => r.write);
  }

  it("reads the printed stage number of the stage in play; equals is true only on that exact value", () => {
    expect(recordedAt(0).map((write) => write.value)).toEqual([
      { kind: "number", value: 1 },
      { kind: "flag", value: true },
    ]);
    expect(recordedAt(1).map((write) => write.value)).toEqual([
      { kind: "number", value: 2 },
      { kind: "flag", value: false },
    ]);
  });
});

describe("CampaignDefinition.elimination (design §4.6b; MC16 p. 5 'Elimination and Victory')", () => {
  const EXPERT_MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID, expertCampaign: true } };
  const identities = seatIdentities(HERO, 2);
  const printedHp = identities[1]!.hp;

  const base = definitionWith(
    [],
    [
      {
        id: "only.victory.record",
        text: "Record each identity's remaining hit points; 1 unit for each player; the team's shared result.",
        citation: "test",
        step: {
          kind: "record",
          writes: [
            { field: "hp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } },
            { field: "units", seat: "each", mode: "add", value: { kind: "const", value: 1 } },
            { field: "result", mode: "set", value: { kind: "const", value: 7 } },
          ],
        },
      },
      {
        id: "only.victory.between",
        text: "Each player adds 1 unit (a between-games Victory op).",
        citation: "test",
        step: {
          kind: "betweenGames",
          ops: [
            {
              kind: "forEachSeat",
              ops: [{ kind: "addToField", field: "units", seat: "self", value: { kind: "const", value: 1 } }],
            },
          ],
        },
      },
    ],
  );
  const withFields: CampaignDefinition = {
    ...base,
    logFields: [
      ...base.logFields,
      { id: "hp", label: "HP", scope: "perSeat", type: { kind: "number", min: 0 }, citation: "test" },
      { id: "units", label: "Units", scope: "perSeat", type: { kind: "number", min: 0 }, citation: "test" },
    ],
  };
  const withPolicy: CampaignDefinition = {
    ...withFields,
    elimination: {
      id: "only.elimination.rejoin",
      text: "test",
      citation: "MC16 p. 5",
      whenModes: { expertCampaign: true },
      rejoinAtPrintedHitPoints: { field: "hp" },
    },
  };

  function play(definition: CampaignDefinition, modes: PlayModes) {
    const log = createCampaignLog(definition, { id: "run", seats: SEATS, modes, poolVersion: "test", seed: 1 });
    const composed = resolveBetweenGames(definition, log, { pool: [] }, modes);
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    const created = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS, ...identities],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: [],
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
        campaign: startGameFromLog(definition, composed.value).input,
      },
      DEFAULT_DEPS,
    );
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const seat2Identity = created.state.players[1]!.identity.instanceId;
    // Seat 2 was defeated (its identity at 0 hit points) in a game seat 1 went on to win.
    const finished = {
      ...created.state,
      instances: {
        ...created.state.instances,
        [seat2Identity]: { ...created.state.instances[seat2Identity]!, damage: printedHp },
      },
      players: created.state.players.map((player, index) => (index === 1 ? { ...player, eliminated: true } : player)),
      outcome: { result: "win" as const, reason: "villainDefeated" as const },
    };
    const result = campaignResultOf(definition, composed.value, finished, [], DEFAULT_DEPS);
    const applied = applyCampaignResult(definition, composed.value, result, { at: 1 }, { pool: [] });
    if (applied.kind !== "done") throw new Error("unexpected pending choice");
    const field = (seatNumber: number, id: string) =>
      applied.value.seats.find((seat) => seat.seatNumber === seatNumber)?.fields[id];
    return { result, log: applied.value, field };
  }

  it("the eliminated seat gets no per-seat record or between-games Victory op; shared writes still happen", () => {
    const { result, log, field } = play(withPolicy, EXPERT_MODES);
    expect(result.sittingOut).toEqual([2]);
    const recorded = result.records.filter((r) => r.instructionId === "only.victory.record");
    expect(recorded.map((r) => r.write.seatNumber)).toEqual([1, 1, null]);
    expect(field(1, "units")).toEqual({ kind: "number", value: 2 });
    expect(field(2, "units")).toBeUndefined();
    expect(log.shared.result).toEqual({ kind: "number", value: 7 });
  });

  it("rejoinAtPrintedHitPoints writes the seat's printed hit points in place of the record it did not make", () => {
    const { log, field } = play(withPolicy, EXPERT_MODES);
    expect(field(2, "hp")).toEqual({ kind: "number", value: printedHp });
    expect(field(1, "hp")).toEqual({ kind: "number", value: identities[0]!.hp });
    // Traced as its own step, after the node's own Victory instructions.
    const last = log.history.at(-1)!.steps.at(-1);
    expect(last?.instructionId).toBe("only.elimination.rejoin");
    expect(last?.writes).toEqual([
      { field: "hp", seatNumber: 2, mode: "set", value: { kind: "number", value: printedHp } },
    ]);
  });

  it("outside the policy's modes, and with no policy at all, the eliminated seat participates (the default)", () => {
    for (const { result, field } of [play(withPolicy, MODES), play(withFields, EXPERT_MODES)]) {
      expect(result.sittingOut).toBeUndefined();
      expect(field(2, "units")).toEqual({ kind: "number", value: 2 });
      expect(field(2, "hp")).toEqual({ kind: "number", value: 0 });
    }
  });
});

describe("CampaignGameQuery.cardsDefeated", () => {
  // MC21 p. 7/13/21: "If Secure the Landing Pad was defeated, add Cosmo to the campaign pool." Read off the defeat
  // events, by the name the card had when it was defeated: a card never in play was not defeated, and a side scheme
  // that flipped on defeat (Find the Norn Stones → Retrieve Odin's Armor) was, though no card of that name remains.
  const definition = definitionWith(
    [],
    [
      {
        id: "only.victory.defeated",
        text: "test",
        citation: "test",
        step: {
          kind: "record",
          writes: [
            {
              field: "flag",
              mode: "set",
              value: { kind: "atLeast", of: { kind: "cardsDefeated", name: "Front Scheme" }, amount: 1 },
            },
          ],
        },
      },
    ],
  );
  const front = { ...stubSideScheme({ id: "front-scheme", startingThreat: 1 }), name: "Front Scheme" };
  const back = { ...stubSideScheme({ id: "back-scheme", startingThreat: 1 }), name: "Back Scheme" };

  function recordedWith(events: readonly GameEvent[]): LogWrite | undefined {
    const identities = seatIdentities(HERO, 1);
    const created = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS, ...identities, front, back],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: [],
        setAside: [front.id],
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
      },
      DEFAULT_DEPS,
    );
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const finished = { ...created.state, outcome: { result: "win" as const, reason: "villainDefeated" as const } };
    const composed = resolveBetweenGames(definition, newLog(definition), { pool: [] }, MODES);
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    const result = campaignResultOf(definition, composed.value, finished, events, DEFAULT_DEPS);
    return result.records.find((record) => record.instructionId === "only.victory.defeated")?.write;
  }

  it("a card that never entered play was not defeated", () => {
    expect(recordedWith([])?.value).toEqual({ kind: "flag", value: false });
  });

  it("a defeat reads by the face defeated, whatever face the instance ends on", () => {
    const defeat: GameEvent = { type: "schemeDefeated", instanceId: "i-front" as InstanceId, cardId: front.id };
    expect(recordedWith([defeat])?.value).toEqual({ kind: "flag", value: true });
    const otherDefeat: GameEvent = { type: "schemeDefeated", instanceId: "i-back" as InstanceId, cardId: back.id };
    expect(recordedWith([otherDefeat])?.value).toEqual({ kind: "flag", value: false });
  });
});
