/**
 * `CampaignLogSetup.hiddenFields`: a campaign log that starts with values in `hidden` fields, for a choice made as the
 * run is created. A hidden field holding an ordinary value is scratch "traced and handed to a game like any other
 * field" (`LogFieldDef.hidden`), so a seed is pinned here against every reader: an instruction's `when`, the frozen
 * `CampaignGameInput`, and the in-game `Predicate campaignLog`.
 */
import { describe, expect, it } from "vitest";
import { campaignId, scenarioId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS, type RuleSpec } from "../abilities.js";
import type { CampaignDefinition, CampaignInstruction, LogValue } from "../campaign.js";
import { evaluate } from "../select.js";
import { createGame } from "../setup.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import { createCampaignLog, resolveBetweenGames, startGameFromLog, type CampaignSeatSetup } from "./runner.js";

const CAMPAIGN_ID = campaignId("hidden-field-seeds-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const SEATS: readonly CampaignSeatSetup[] = [
  { seatNumber: 1, identityCardId: HERO.id, deck: { identityCardId: HERO.id, aspects: [], cards: [] } },
];
const ON: LogValue = { kind: "flag", value: true };
const OFF: LogValue = { kind: "flag", value: false };

const IS_SET = { kind: "campaignLog", field: "house", isSet: true } as const;
const READING_RULE: RuleSpec = {
  kind: "mainSchemeValue",
  field: "acceleration",
  stage: { cardId: MAIN_SCHEME.id },
  amount: 1,
  while: IS_SET,
};

const countOnlyIfHouse: CampaignInstruction = {
  id: "only-if-house",
  text: "If the house rule is on, record 1.",
  citation: "test",
  when: { kind: "fieldIsSet", field: "house" },
  step: { kind: "betweenGames", ops: [{ kind: "setField", field: "ran", value: { kind: "const", value: 1 } }] },
};

function definitionWith(
  node: { readonly setup?: readonly CampaignInstruction[]; readonly rules?: readonly RuleSpec[] } = {},
): CampaignDefinition {
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [
      { id: "house", label: "House rule", scope: "shared", type: { kind: "flag" }, hidden: true, citation: "test" },
      { id: "unread", label: "Unread", scope: "shared", type: { kind: "flag" }, hidden: true, citation: "test" },
      { id: "printed", label: "Printed", scope: "shared", type: { kind: "flag" }, citation: "test" },
      { id: "ran", label: "Ran", scope: "shared", type: { kind: "number" }, citation: "test" },
    ],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "only",
          label: "only",
          scenario: { kind: "fixed", scenarioId: scenarioId("hidden-field-seeds-scenario") },
          ...(node.rules ? { scenarioRuleSpecs: node.rules } : {}),
          setup: node.setup ?? [],
          victory: [],
        },
      ],
    },
  };
}

const logFor = (definition: CampaignDefinition, hiddenFields?: Readonly<Record<string, LogValue>>) =>
  createCampaignLog(definition, {
    id: "run",
    seats: SEATS,
    modes: MODES,
    poolVersion: "test",
    seed: 1,
    ...(hiddenFields ? { hiddenFields } : {}),
  });

function composed(definition: CampaignDefinition, hiddenFields?: Readonly<Record<string, LogValue>>) {
  const result = resolveBetweenGames(definition, logFor(definition, hiddenFields), { pool: [] }, MODES);
  if (result.kind !== "done") throw new Error("unexpected pending choice");
  return result.value;
}

function gameOf(definition: CampaignDefinition, hiddenFields?: Readonly<Record<string, LogValue>>) {
  const created = createGame(
    {
      seed: 1,
      cards: [...DEFAULT_CARDS, ...seatIdentities(HERO, 1)],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: [{ identityCardId: HERO.id, deck: [] }],
      campaign: startGameFromLog(definition, composed(definition, hiddenFields)).input,
    },
    DEFAULT_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}

const readsInGame = (definition: CampaignDefinition, hiddenFields?: Readonly<Record<string, LogValue>>) =>
  evaluate(gameOf(definition, hiddenFields), IS_SET, {
    selfInstanceId: null,
    controllerId: null,
    event: null,
    bindings: {},
    deps: DEFAULT_DEPS,
  });

describe("CampaignLogSetup.hiddenFields", () => {
  it("omitted: the log starts with no hidden value, byte for byte the log an empty seed list makes", () => {
    const definition = definitionWith();
    const log = logFor(definition);
    expect(log.hidden).toEqual({});
    expect(JSON.stringify(log)).toBe(JSON.stringify(logFor(definition, {})));
    expect(JSON.stringify(log)).toContain('"shared":{},"hidden":{},"removedFromCampaign"');
  });

  it("seeded: the value is in the log, and in the snapshot a retry restores", () => {
    const definition = definitionWith();
    expect(logFor(definition, { house: ON }).hidden).toEqual({ house: ON });
    expect(composed(definition, { house: ON }).attempt?.logBefore.hidden).toEqual({ house: ON });
  });

  it("an instruction's `when` reads a seeded value, and an unset or false one as not set", () => {
    const definition = definitionWith({ setup: [countOnlyIfHouse] });
    expect(composed(definition, { house: ON }).shared.ran).toEqual({ kind: "number", value: 1 });
    expect(composed(definition, { house: OFF }).shared.ran).toBeUndefined();
    expect(composed(definition).shared.ran).toBeUndefined();
  });

  it("an in-game instruction's read hands the field to the game, and the in-game predicate sees it", () => {
    const definition = definitionWith({
      setup: [
        {
          id: "reads",
          text: "If the house rule is on, do nothing.",
          citation: "test",
          step: {
            kind: "inGame",
            window: "afterScenarioSetup",
            effects: [{ kind: "if", condition: IS_SET, then: [] }],
          },
        },
      ],
    });
    expect(startGameFromLog(definition, composed(definition, { house: ON })).input.log.shared).toEqual({ house: ON });
    expect(readsInGame(definition, { house: ON })).toBe(true);
    expect(readsInGame(definition)).toBe(false);
  });

  it("a rule the node puts in force hands the field to the game too, with no instruction reading it", () => {
    const definition = definitionWith({ rules: [READING_RULE] });
    expect(startGameFromLog(definition, composed(definition, { house: ON })).input.log.shared).toEqual({ house: ON });
    expect(readsInGame(definition, { house: ON })).toBe(true);
  });

  it("a hidden field nothing in this game reads stays out of the game", () => {
    const definition = definitionWith({ rules: [READING_RULE] });
    const input = startGameFromLog(definition, composed(definition, { house: ON, unread: ON })).input;
    expect(input.log.shared).toEqual({ house: ON });
  });

  it("refuses a seed that is not an ordinary value of a declared hidden field", () => {
    const definition = definitionWith();
    expect(() => logFor(definition, { nowhere: ON })).toThrow(/nowhere/);
    expect(() => logFor(definition, { printed: ON })).toThrow(/not a hidden field/);
    expect(() => logFor(definition, { house: { kind: "number", value: 1 } })).toThrow(/seeded with a number/);
    expect(() => logFor(definition, { house: { ...ON, sealed: true } })).toThrow(/sealed/);
  });
});
