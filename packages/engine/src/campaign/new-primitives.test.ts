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
import { campaignId, cardId, encounterSetId, scenarioId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type { CampaignDefinition, CampaignGameResult } from "../campaign.js";
import type { InstanceId } from "../ids.js";
import { stubEvent, stubSideScheme } from "../testing/fixtures.js";
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
