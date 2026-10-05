/**
 * docs/phase7-wave7.md §3.41: `CampaignGameQuery` `damageOn`.
 *
 * MC40 pp. 14, 16, Victory: "Record the amount of damage on Hope Summers in the campaign log." The next scenario's
 * setup then places that much damage on her (pp. 16, 18), which is the existing `placeDamage` effect reading the log
 * through the existing `campaignLog` value, in an `inGame` instruction.
 *
 * A standalone definition, like `sm-queries.test.ts`, so nothing here perturbs `runner.test.ts`'s fixture.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS } from "../abilities.js";
import type { CampaignDefinition, CampaignGameQuery, CampaignLog, CampaignNode, LogValue } from "../campaign.js";
import type { InstanceId } from "../ids.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import type { GameState } from "../state.js";
import { runCommands } from "../testing/drive.js";
import { stubMinion } from "../testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import { campaignResultOf } from "./result.js";
import {
  applyCampaignResult,
  createCampaignLog,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignSeatSetup,
} from "./runner.js";

const CAMPAIGN_ID = campaignId("damage-on-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const SCENARIO = scenarioId("damage-on-test-scenario");

const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

/** Set aside, so it exists as an instance that is not in play. */
const BYSTANDER = stubMinion({ id: "bystander", atk: 1, sch: 1, hp: 9 });

const identities = seatIdentities(HERO, 2);

function playGame(campaign: GameSetupConfig["campaign"]) {
  const config: GameSetupConfig = {
    seed: 1,
    cards: [...DEFAULT_CARDS, ...identities, BYSTANDER],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    setAside: [BYSTANDER.id],
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
    ...(campaign ? { campaign } : {}),
  };
  const created = createGame(config, DEFAULT_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const driven = runCommands(created.state, DEFAULT_DEPS);
  return { state: driven.state, events: [...created.events, ...driven.events] };
}

const instanceOf = (state: GameState, card: { readonly id: string }): InstanceId => {
  const found = Object.values(state.instances).find((instance) => instance.cardId === card.id);
  if (!found) throw new Error(`no instance of ${card.id}`);
  return found.instanceId;
};

const withDamage = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, damage } },
});

const won = (state: GameState): GameState => ({
  ...state,
  outcome: { result: "win" as const, reason: "villainDefeated" as const },
});

const node = (id: string, over: Partial<CampaignNode> = {}): CampaignNode => ({
  id,
  label: id,
  scenario: { kind: "fixed", scenarioId: SCENARIO },
  setup: [],
  victory: [],
  ...over,
});

const recordStep = (id: string, queries: Readonly<Record<string, CampaignGameQuery>>) => ({
  id,
  text: "test",
  citation: "test",
  step: {
    kind: "record" as const,
    writes: Object.entries(queries).map(([field, value]) => ({ field, mode: "set" as const, value })),
  },
});

function definitionOf(fields: readonly string[], nodes: readonly CampaignNode[]): CampaignDefinition {
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: fields.map((id) => ({
      id,
      label: id,
      scope: "shared" as const,
      type: { kind: "number" as const },
      citation: "test",
    })),
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: { kind: "linear", nodes },
  };
}

const newLog = (definition: CampaignDefinition): CampaignLog =>
  createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });

function composed(definition: CampaignDefinition, log: CampaignLog): CampaignLog {
  const result = resolveBetweenGames(definition, log, { pool: [] }, MODES);
  if (result.kind !== "done") throw new Error("unexpected pending choice");
  return result.value;
}

/** What each query recorded at Victory, by field, for a game changed by `finish` just before it was won. */
function recorded(
  queries: Readonly<Record<string, CampaignGameQuery>>,
  finish: (state: GameState) => GameState,
): Readonly<Record<string, LogValue>> {
  const definition = definitionOf(Object.keys(queries), [
    node("only", { victory: [recordStep("only.read", queries)] }),
  ]);
  const log = composed(definition, newLog(definition));
  const finished = won(finish(playGame(startGameFromLog(definition, log).input).state));
  const result = campaignResultOf(definition, log, finished, [], DEFAULT_DEPS);
  return Object.fromEntries(result.records.map((record) => [record.write.field, record.write.value]));
}

const number = (value: number): LogValue => ({ kind: "number", value });

describe("CampaignGameQuery.damageOn (MC40 pp. 14, 16)", () => {
  it("reads the damage on the matching card at Victory", () => {
    const values = recorded({ damage: { kind: "damageOn", query: { categories: ["villain"] } } }, (state) =>
      withDamage(state, instanceOf(state, VILLAIN), 2),
    );
    expect(values.damage).toEqual(number(2));
  });

  it("reads damage tokens, not hit points remaining", () => {
    const values = recorded(
      { damage: { kind: "damageOn", query: { categories: ["mainScheme", "villain"] } } },
      (state) => withDamage(state, instanceOf(state, VILLAIN), 3),
    );
    // The villain has 20 hit points: 17 remain, and 3 is what is recorded.
    expect(values.damage).toEqual(number(3));
  });

  it("sums the damage over several matching cards", () => {
    const values = recorded({ damage: { kind: "damageOn", query: { categories: ["identity"] } } }, (state) => {
      const [first, second] = state.players.map((player) => player.identity.instanceId);
      return withDamage(withDamage(state, first!, 2), second!, 3);
    });
    expect(values.damage).toEqual(number(5));
  });

  it("reads 0 when nothing in play matches, as threatOn and countersOn do, even for a damaged card out of play", () => {
    const queries = {
      absent: { kind: "damageOn", query: { categories: ["ally"] } },
      outOfPlay: { kind: "damageOn", query: { name: BYSTANDER.name } },
      undamaged: { kind: "damageOn", query: { categories: ["villain"] } },
    } as const;
    const values = recorded(queries, (state) => withDamage(state, instanceOf(state, BYSTANDER), 4));
    expect(values).toEqual({ absent: number(0), outOfPlay: number(0), undamaged: number(0) });
  });
});

describe("carrying recorded damage into the next node (MC40 pp. 16, 18)", () => {
  /** "Place damage on [the card] equal to the damage recorded for [it] from the previous scenario." */
  const definition = definitionOf(
    ["carried"],
    [
      node("first", {
        victory: [recordStep("first.record", { carried: { kind: "damageOn", query: { categories: ["villain"] } } })],
      }),
      node("second", {
        setup: [
          {
            id: "second.setup.place",
            text: "test",
            citation: "test",
            step: {
              kind: "inGame",
              window: "afterScenarioSetup",
              effects: [
                {
                  kind: "placeDamage",
                  target: { kind: "each", query: { categories: ["villain"] } },
                  amount: { kind: "campaignLog", field: "carried" },
                },
              ],
            },
          },
        ],
      }),
    ],
  );

  function secondGameAfter(damage: number) {
    const first = composed(definition, newLog(definition));
    const game = playGame(startGameFromLog(definition, first).input);
    const finished = won(withDamage(game.state, instanceOf(game.state, VILLAIN), damage));
    const result = campaignResultOf(definition, first, finished, game.events, DEFAULT_DEPS);
    const applied = applyCampaignResult(definition, first, result, { at: 1 }, { pool: [] });
    if (applied.kind !== "done") throw new Error("unexpected pending choice");
    expect(applied.value.shared.carried).toEqual(number(damage));
    const second = composed(definition, applied.value);
    return playGame(startGameFromLog(definition, second).input);
  }

  it("starts the card with the recorded damage, placed rather than dealt", () => {
    const { state, events } = secondGameAfter(2);
    const villain = instanceOf(state, VILLAIN);
    expect(state.instances[villain]?.damage).toBe(2);
    expect(events.filter((event) => event.type === "damagePlaced")).toMatchObject([
      { targetInstanceId: villain, amount: 2 },
    ]);
  });

  it("places nothing when 0 was recorded", () => {
    const { state, events } = secondGameAfter(0);
    expect(state.instances[instanceOf(state, VILLAIN)]?.damage).toBe(0);
    expect(events.filter((event) => event.type === "damagePlaced")).toEqual([]);
  });
});
