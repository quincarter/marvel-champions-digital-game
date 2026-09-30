/**
 * docs/phase7-wave5.md §3.27: the campaign queries MC27 (Sinister Motives) needs, and a check that its reputation track
 * composes from the existing between-games ops.
 *
 * - `CampaignGameQuery` `accelerationTokensInPlay`, `defeatedIdentities` and `playersInScenario`: three of MC27 p. 22's
 *   reputation conditions ("Fewer than 1[per_hero] acceleration tokens in play", "No defeated identities").
 * - `CampaignGameQuery` `cardsInPlayerDecks`: MC27 p. 13's Waking Nightmare, "the total number of Illusion cards in all
 *   player decks".
 * - `EffectSpec` `grantAdditionalMulligans`: reputation node 5's lasting reward, "During the Resolve Mulligans step of
 *   game setup, each player may take 1 additional mulligan" (RRG 1.8 p. 67 erratum), which sets the field §3.26 built.
 * - The marking itself: a condition total (victory points clamped at zero, ruling Aug 3, 2026 (4) #2), nodes marked
 *   from the topmost unmarked one, a white box resolved at once and a pink box's Setup appended to an
 *   `instructionList` for every later scenario (MC27 p. 5).
 *
 * Standalone definitions, like `new-primitives.test.ts`, so nothing here perturbs `runner.test.ts`'s fixture.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, trait, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type {
  CampaignDefinition,
  CampaignGameQuery,
  CampaignInstruction,
  CampaignLog,
  CampaignOp,
  CampaignPredicate,
  LogValue,
} from "../campaign.js";
import type { InstanceId } from "../ids.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import type { GameState } from "../state.js";
import { stubMinion, stubSideScheme } from "../testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import { campaignResultOf } from "./result.js";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("sm-queries-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const SCENARIO = scenarioId("sm-queries-test-scenario");

const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

const ILLUSION = trait("Illusion");
/** An Illusion encounter card, as Mysterio shuffles into player decks (docs/phase7-wave5.md §3.5). */
const ILLUSION_MINION = stubMinion({ id: "illusion-minion", traits: [ILLUSION], atk: 1, sch: 1, hp: 2 });
const OTHER_MINION = stubMinion({ id: "other-minion", atk: 1, sch: 1, hp: 2 });
/** Negative victory points (docs/phase7-wave5.md §1.2). */
const MINUS_TWO = {
  ...stubSideScheme({ id: "minus-two", startingThreat: 1 }),
  keywords: [{ name: "victory" as const, value: -2 }],
};
const PLUS_ONE = {
  ...stubSideScheme({ id: "plus-one", startingThreat: 1 }),
  keywords: [{ name: "victory" as const, value: 1 }],
};
const EXTRA_CARDS = [ILLUSION_MINION, OTHER_MINION, MINUS_TWO, PLUS_ONE];
/** Set aside so each exists as an instance a test can move where it wants. */
const SET_ASIDE = [
  ILLUSION_MINION.id,
  ILLUSION_MINION.id,
  ILLUSION_MINION.id,
  OTHER_MINION.id,
  MINUS_TWO.id,
  PLUS_ONE.id,
];

const identities = seatIdentities(HERO, 2);

function gameConfig(campaign?: GameSetupConfig["campaign"]): GameSetupConfig {
  return {
    seed: 1,
    cards: [...DEFAULT_CARDS, ...identities, ...EXTRA_CARDS],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    setAside: SET_ASIDE,
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
    ...(campaign ? { campaign } : {}),
  };
}

function created(campaign?: GameSetupConfig["campaign"]) {
  const result = createGame(gameConfig(campaign), DEFAULT_DEPS);
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  return result;
}

/** The set-aside instances of `card`, in instance order. */
const instancesOf = (state: GameState, card: { readonly id: string }): InstanceId[] =>
  state.encounterSetAside.filter((id) => state.instances[id]?.cardId === card.id);

const won = (state: GameState): GameState => ({
  ...state,
  outcome: { result: "win" as const, reason: "villainDefeated" as const },
});

const withCounters = (state: GameState, id: InstanceId, over: { threat?: number; acceleration?: number }) => ({
  ...state,
  instances: {
    ...state.instances,
    [id]: {
      ...state.instances[id]!,
      ...(over.threat !== undefined ? { threat: over.threat } : {}),
      ...(over.acceleration !== undefined
        ? { counters: { ...state.instances[id]!.counters, acceleration: over.acceleration } }
        : {}),
    },
  },
});

// ---------------------------------------------------------------------------------------------------------------
// The queries, each read through a `record` instruction into a number field
// ---------------------------------------------------------------------------------------------------------------

function queryDefinition(queries: Readonly<Record<string, CampaignGameQuery>>): CampaignDefinition {
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: Object.keys(queries).map((id) => ({
      id,
      label: id,
      scope: "shared" as const,
      type: { kind: "number" as const },
      citation: "test",
    })),
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "only",
          label: "Only",
          scenario: { kind: "fixed", scenarioId: SCENARIO },
          setup: [],
          victory: [
            {
              id: "only.victory.read",
              text: "test",
              citation: "test",
              step: {
                kind: "record",
                writes: Object.entries(queries).map(([field, value]) => ({ field, mode: "set" as const, value })),
              },
            },
          ],
        },
      ],
    },
  };
}

/** What each query recorded, by field, for a finished game built from a fresh one by `finish`. */
function recorded(
  queries: Readonly<Record<string, CampaignGameQuery>>,
  finish: (state: GameState) => GameState,
): Readonly<Record<string, LogValue>> {
  const definition = queryDefinition(queries);
  const log = createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });
  const composed = resolveBetweenGames(definition, log, { pool: [] }, MODES);
  if (composed.kind !== "done") throw new Error("unexpected pending choice");
  const finished = won(finish(created(startGameFromLog(definition, composed.value).input).state));
  const result = campaignResultOf(definition, composed.value, finished, [], DEFAULT_DEPS);
  return Object.fromEntries(result.records.map((record) => [record.write.field, record.write.value]));
}

const number = (value: number): LogValue => ({ kind: "number", value });

describe("CampaignGameQuery.accelerationTokensInPlay (MC27 p. 22)", () => {
  it("counts the main scheme's tokens and the acceleration counters on any other card in play", () => {
    const values = recorded({ tokens: { kind: "accelerationTokensInPlay" } }, (state) => {
      const identity = state.players[0]!.identity.instanceId;
      const onScheme = { ...state, mainScheme: { ...state.mainScheme, accelerationTokens: 2 } };
      return withCounters(onScheme, identity, { acceleration: 1 });
    });
    expect(values.tokens).toEqual(number(3));
  });

  it("is 0 with none anywhere, and ignores a card out of play that carries the counter", () => {
    const values = recorded({ tokens: { kind: "accelerationTokensInPlay" } }, (state) =>
      withCounters(state, instancesOf(state, OTHER_MINION)[0]!, { acceleration: 4 }),
    );
    expect(values.tokens).toEqual(number(0));
  });
});

describe("CampaignGameQuery.defeatedIdentities and playersInScenario (MC27 p. 22; RRG 1.8 pp. 32, 34)", () => {
  it("an eliminated player is a defeated identity, and still counts toward the per player value", () => {
    const queries = {
      defeated: { kind: "defeatedIdentities" },
      players: { kind: "playersInScenario" },
    } as const;
    const none = recorded(queries, (state) => state);
    expect(none).toEqual({ defeated: number(0), players: number(2) });
    const one = recorded(queries, (state) => ({
      ...state,
      players: state.players.map((player, index) => (index === 1 ? { ...player, eliminated: true } : player)),
    }));
    expect(one).toEqual({ defeated: number(1), players: number(2) });
  });
});

describe("CampaignGameQuery.cardsInPlayerDecks (MC27 p. 13, Waking Nightmare)", () => {
  it("counts matching cards in each living player's deck only: not a hand, discard pile or eliminated deck", () => {
    const values = recorded(
      { nightmare: { kind: "count", of: { kind: "cardsInPlayerDecks", query: { trait: ILLUSION } } } },
      (state) => {
        const [inDeck, inDiscard, inDeadDeck] = instancesOf(state, ILLUSION_MINION);
        const [plain] = instancesOf(state, OTHER_MINION);
        const moved = [inDeck!, inDiscard!, inDeadDeck!, plain!];
        return {
          ...state,
          encounterSetAside: state.encounterSetAside.filter((id) => !moved.includes(id)),
          players: state.players.map((player, index) =>
            index === 0
              ? { ...player, deck: [inDeck!, plain!, ...player.deck], discard: [inDiscard!, ...player.discard] }
              : { ...player, deck: [inDeadDeck!, ...player.deck], eliminated: true },
          ),
        };
      },
    );
    expect(values.nightmare).toEqual(number(1));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// §3.27's "verify": MC27's reputation track composed from existing ops, nodes 1 and 5 standing in for all seven
// ---------------------------------------------------------------------------------------------------------------

const field = (id: string) => ({ kind: "field", field: id }) as const;
const constant = (value: number) => ({ kind: "const", value }) as const;
const atMostZero = (of: CampaignGameQuery): CampaignGameQuery => ({ kind: "atMost", of, amount: 0 });

/** "Whenever a node … is marked" (MC27 p. 5): this marking reached node `n` and the last one had not. */
const crossed = (n: number): CampaignPredicate => ({
  kind: "and",
  of: [
    { kind: "valueAtLeast", value: field("reputation"), amount: constant(n) },
    { kind: "not", of: { kind: "valueAtLeast", value: field("reputationBefore"), amount: constant(n) } },
  ],
});

/** MC27 p. 22's "Conditions", then the marking, as a box definition would write them for every scenario's Victory. */
const REPUTATION_VICTORY: readonly CampaignInstruction[] = [
  {
    id: "rep.conditions",
    text: "Using the “Conditions” section, calculate your group’s total reputation value …",
    citation: "MC27 p. 22",
    step: {
      kind: "record",
      writes: [
        {
          field: "repVictoryPoints",
          mode: "set",
          value: { kind: "keywordValueSum", query: {}, keyword: "victory" },
        },
        {
          field: "repConditions",
          mode: "set",
          value: atMostZero({ kind: "cardsInPlay", query: { categories: ["sideScheme"] } }),
        },
        {
          field: "repConditions",
          mode: "add",
          value: atMostZero({ kind: "cardsInPlay", query: { categories: ["minion"] } }),
        },
        {
          field: "repConditions",
          mode: "add",
          value: atMostZero({ kind: "threatOn", query: { categories: ["mainScheme"] } }),
        },
        { field: "repConditions", mode: "add", value: atMostZero({ kind: "defeatedIdentities" }) },
        { field: "repTokens", mode: "set", value: { kind: "accelerationTokensInPlay" } },
        { field: "repPlayers", mode: "set", value: { kind: "playersInScenario" } },
      ],
    },
  },
  {
    id: "rep.mark",
    text: "… then mark that number of nodes (starting at the topmost unmarked node …).",
    citation: "MC27 p. 22",
    step: {
      kind: "betweenGames",
      ops: [
        { kind: "setField", field: "reputationBefore", value: field("reputation") },
        // "(+1) Fewer than 1[per_hero] acceleration tokens in play": tokens < players who started the scenario.
        {
          kind: "if",
          when: { kind: "not", of: { kind: "valueAtLeast", value: field("repTokens"), amount: field("repPlayers") } },
          then: [{ kind: "addToField", field: "repConditions", value: constant(1) }],
        },
        // Ruling Aug 3, 2026 (4) #2: negative victory points mark no nodes.
        {
          kind: "addToField",
          field: "reputation",
          value: { kind: "sum", of: [{ kind: "clampAtZero", of: field("repVictoryPoints") }, field("repConditions")] },
        },
        // Node 1: a white box resolves at once; its pink box's Setup joins every later scenario.
        {
          kind: "if",
          when: crossed(1),
          then: [
            { kind: "setField", field: "nodeOneReward", value: { kind: "const", value: true } },
            { kind: "appendToList", field: "reputationSetups", value: { kind: "const", value: "rep.node1.penalty" } },
          ],
        },
        // Node 5's left box is a lasting rule for each later setup, so it rides the same instruction list.
        {
          kind: "if",
          when: crossed(5),
          then: [
            { kind: "appendToList", field: "reputationSetups", value: { kind: "const", value: "rep.node5.reward" } },
          ],
        },
      ] satisfies readonly CampaignOp[],
    },
  },
];

const hiddenNumber = (id: string) =>
  ({ id, label: id, scope: "shared", type: { kind: "number" }, hidden: true, citation: "test" }) as const;

const REPUTATION_CAMPAIGN: CampaignDefinition = {
  campaignId: CAMPAIGN_ID,
  version: "1",
  logFields: [
    {
      id: "reputation",
      label: "Reputation",
      scope: "shared",
      type: { kind: "number", clampAtZero: true },
      citation: "test",
    },
    {
      id: "reputationSetups",
      label: "Reputation Setup",
      scope: "shared",
      type: { kind: "instructionList" },
      citation: "test",
    },
    { id: "nodeOneReward", label: "Node 1 reward", scope: "shared", type: { kind: "flag" }, citation: "test" },
    hiddenNumber("reputationBefore"),
    hiddenNumber("repVictoryPoints"),
    hiddenNumber("repConditions"),
    hiddenNumber("repTokens"),
    hiddenNumber("repPlayers"),
  ],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  everyNodeVictory: REPUTATION_VICTORY,
  conditionalInstructions: {
    "rep.node1.penalty": {
      id: "rep.node1.penalty",
      text: "Setup: (a penalty that places an acceleration token, standing in for node 1's)",
      citation: "test",
      step: { kind: "inGame", window: "afterScenarioSetup", effects: [{ kind: "addAccelerationToken" }] },
    },
    "rep.node5.reward": {
      id: "rep.node5.reward",
      text: "During the Resolve Mulligans step of game setup, each player may take 1 additional mulligan.",
      citation: "MC27 p. 22 (RRG 1.8 p. 67 erratum)",
      step: {
        kind: "inGame",
        window: "beforeStartingHands",
        effects: [{ kind: "grantAdditionalMulligans", amount: 1 }],
      },
    },
  },
  graph: {
    kind: "linear",
    nodes: ["one", "two", "three"].map((id) => ({
      id,
      label: id,
      scenario: { kind: "fixed" as const, scenarioId: SCENARIO },
      setup: [],
      victory: [],
    })),
  },
};

/** Composes the next scenario, plays it to a win finished by `finish`, and folds the result into the log. */
function playAndWin(log: CampaignLog, finish: (state: GameState) => GameState) {
  const composed = resolveBetweenGames(REPUTATION_CAMPAIGN, log, { pool: [] }, MODES);
  if (composed.kind !== "done") throw new Error("unexpected pending choice");
  const game = created(startGameFromLog(REPUTATION_CAMPAIGN, composed.value).input);
  const result = campaignResultOf(REPUTATION_CAMPAIGN, composed.value, won(finish(game.state)), [], DEFAULT_DEPS);
  const applied = applyCampaignResult(REPUTATION_CAMPAIGN, composed.value, result, { at: 1 }, { pool: [] });
  if (applied.kind !== "done") throw new Error("unexpected pending choice");
  return { game, log: applied.value };
}

/** Every condition met (one token with two players is fewer than 1[per_hero]); -2 victory points count as 0. */
const perfectWin = (state: GameState): GameState => {
  const [minusTwo] = instancesOf(state, MINUS_TWO);
  const clean = withCounters(state, state.mainScheme.instanceId, { threat: 0 });
  return {
    ...clean,
    mainScheme: { ...clean.mainScheme, accelerationTokens: 1 },
    encounterSetAside: clean.encounterSetAside.filter((id) => id !== minusTwo),
    victoryDisplay: [minusTwo!],
  };
};

/** No condition met: a side scheme and a minion in play, threat on the main scheme, a defeated identity, 2 tokens. */
const dismalWin = (state: GameState): GameState => {
  const [plusOne] = instancesOf(state, PLUS_ONE);
  const [minusTwo] = instancesOf(state, MINUS_TWO);
  const [minion] = instancesOf(state, OTHER_MINION);
  const threatened = withCounters(state, state.mainScheme.instanceId, { threat: 3 });
  return {
    ...threatened,
    mainScheme: { ...threatened.mainScheme, accelerationTokens: 2 },
    encounterSetAside: threatened.encounterSetAside.filter((id) => id !== plusOne && id !== minion && id !== minusTwo),
    villainArea: [...threatened.villainArea, plusOne!, minion!],
    victoryDisplay: [minusTwo!],
    players: threatened.players.map((player, index) => (index === 1 ? { ...player, eliminated: true } : player)),
  };
};

describe("MC27's reputation track composes from existing ops (§3.27 verify)", () => {
  const start = createCampaignLog(REPUTATION_CAMPAIGN, {
    id: "run",
    seats: SEATS,
    modes: MODES,
    poolVersion: "test",
    seed: 1,
  });

  it("a win meeting every condition marks five nodes: node 1's white box resolves, both Setup ids are appended", () => {
    const { log } = playAndWin(start, perfectWin);
    expect(log.shared.reputation).toEqual(number(5));
    expect(log.hidden.repVictoryPoints).toEqual(number(-2));
    expect(log.hidden.repConditions).toEqual(number(5));
    expect(log.shared.nodeOneReward).toEqual({ kind: "flag", value: true });
    expect(log.shared.reputationSetups).toEqual({
      kind: "instructionList",
      ids: ["rep.node1.penalty", "rep.node5.reward"],
    });
  });

  it("the next scenario resolves the appended Setups: node 5 gives each player an additional mulligan", () => {
    const { log } = playAndWin(start, perfectWin);
    const composed = resolveBetweenGames(REPUTATION_CAMPAIGN, log, { pool: [] }, MODES);
    if (composed.kind !== "done") throw new Error("unexpected pending choice");
    const input = startGameFromLog(REPUTATION_CAMPAIGN, composed.value).input;
    expect(input.instructions.map((instruction) => instruction.instructionId)).toEqual([
      "rep.node1.penalty",
      "rep.node5.reward",
    ]);
    const game = created(input);
    expect(game.state.players.map((player) => player.extraMulligans)).toEqual([1, 1]);
    expect(game.state.mainScheme.accelerationTokens).toBe(1);
    expect(game.events.filter((event) => event.type === "additionalMulligansGranted")).toEqual(
      game.state.players.map((player) => ({
        type: "additionalMulligansGranted",
        playerId: player.playerId,
        extraMulligans: 1,
      })),
    );
    // The first mulligan is the ordinary one; the second is offered as `additional` (§3.26).
    expect(game.state.pendingChoice?.prompt).toEqual({ kind: "mulligan", handSize: 6 });
  });

  it("a win meeting no condition, with negative victory points, marks nothing and re-crosses no node", () => {
    const first = playAndWin(start, perfectWin).log;
    const { log } = playAndWin(first, dismalWin);
    expect(log.hidden.repConditions).toEqual(number(0));
    expect(log.shared.reputation).toEqual(number(5));
    expect(log.shared.reputationSetups).toEqual({
      kind: "instructionList",
      ids: ["rep.node1.penalty", "rep.node5.reward"],
    });
  });

  it("victory points add their total when positive; a marking that stops short of node 5 appends only node 1", () => {
    // One victory point, plus "no side schemes", "no defeated identities" and the token condition (a minion is still in
    // play, and threat on the main scheme): 1 + 3 = 4 nodes.
    const { log } = playAndWin(start, (state) => {
      const partial = dismalWin(state);
      const [plusOne] = instancesOf(state, PLUS_ONE);
      return {
        ...partial,
        mainScheme: { ...partial.mainScheme, accelerationTokens: 0 },
        villainArea: partial.villainArea.filter((id) => id !== plusOne),
        victoryDisplay: [plusOne!],
        players: state.players,
      };
    });
    expect(log.hidden.repConditions).toEqual(number(3));
    expect(log.shared.reputation).toEqual(number(4));
    expect(log.shared.reputationSetups).toEqual({ kind: "instructionList", ids: ["rep.node1.penalty"] });
  });
});
