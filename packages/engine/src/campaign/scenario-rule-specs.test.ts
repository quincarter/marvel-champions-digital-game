/**
 * `CampaignNode.scenarioRuleSpecs`: rules a campaign puts in force for the whole of one node's game, printed in its
 * rulebook rather than on a card. MC45 p. 5's Mission Rules card has no card record, and p. 20 prints "Professor X
 * cannot enter play during this game" as a Campaign Instruction of scenario 5 only (docs/phase7-wave8.md §3.43, §3.45).
 *
 * The field reaches a game one way, pinned here: `resolveBetweenGames` freezes it into `CampaignGameInput`, and
 * `createGame` puts it in force with the scenario's own `GameSetupConfig.scenarioRuleSpecs`, after them.
 */
import { describe, expect, it } from "vitest";
import { campaignId, cardId, scenarioId, type PlayModes } from "@mc/content";
import { DEFAULT_DEPS, type RuleSpec } from "../abilities.js";
import type { CampaignDefinition } from "../campaign.js";
import { createGame } from "../setup.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, VILLAIN, seatIdentities } from "../testing/scenario.js";
import { createCampaignLog, resolveBetweenGames, startGameFromLog, type CampaignSeatSetup } from "./runner.js";

const CAMPAIGN_ID = campaignId("scenario-rule-specs-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const SEATS: readonly CampaignSeatSetup[] = [1, 2].map((seatNumber) => ({
  seatNumber,
  identityCardId: cardId(`hero-${seatNumber}`),
  deck: { identityCardId: cardId(`hero-${seatNumber}`), aspects: [], cards: [] },
}));

const NO_NAMED_ALLY: RuleSpec = { kind: "cannotEnterPlay", cards: { categories: ["ally"], name: "A Named Ally" } };
const BLANK_ALLIES: RuleSpec = { kind: "blankTextBox", target: { categories: ["ally"] } };
const SCENARIOS_OWN: RuleSpec = { kind: "blankTextBox", target: { categories: ["minion"] } };

/** Two nodes: the first states `first`, the second states nothing. */
function definitionWith(first?: readonly RuleSpec[]): CampaignDefinition {
  const node = (id: string, rules?: readonly RuleSpec[]) => ({
    id,
    label: id,
    scenario: { kind: "fixed" as const, scenarioId: scenarioId("scenario-rule-specs-scenario") },
    ...(rules ? { scenarioRuleSpecs: rules } : {}),
    setup: [],
    victory: [],
  });
  return {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: { kind: "linear", nodes: [node("first", first), node("second")] },
  };
}

function startOf(definition: CampaignDefinition) {
  const log = createCampaignLog(definition, { id: "run", seats: SEATS, modes: MODES, poolVersion: "test", seed: 1 });
  const composed = resolveBetweenGames(definition, log, { pool: [] }, MODES);
  if (composed.kind !== "done") throw new Error("unexpected pending choice");
  return startGameFromLog(definition, composed.value);
}

function create(definition: CampaignDefinition, scenarioRuleSpecs?: readonly RuleSpec[]) {
  const identities = seatIdentities(HERO, 2);
  const created = createGame(
    {
      seed: 1,
      cards: [...DEFAULT_CARDS, ...identities],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [] })),
      ...(scenarioRuleSpecs ? { scenarioRuleSpecs } : {}),
      campaign: startOf(definition).input,
    },
    DEFAULT_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}

describe("CampaignNode.scenarioRuleSpecs (MC45 pp. 5, 20)", () => {
  it("a node with the field: the frozen game input carries the rules, in the definition's order", () => {
    const start = startOf(definitionWith([NO_NAMED_ALLY, BLANK_ALLIES]));
    expect(start.nodeId).toBe("first");
    expect(start.input.scenarioRuleSpecs).toEqual([NO_NAMED_ALLY, BLANK_ALLIES]);
    expect(start.node.scenarioRuleSpecs).toEqual([NO_NAMED_ALLY, BLANK_ALLIES]);
  });

  it("a node without it, or with an empty list: the game input has no such key", () => {
    for (const definition of [definitionWith(), definitionWith([])]) {
      expect("scenarioRuleSpecs" in startOf(definition).input).toBe(false);
    }
  });

  it("createGame puts the rules in force as the game's scenario rules", () => {
    const state = create(definitionWith([NO_NAMED_ALLY]));
    expect(state.scenarioRules.rules).toEqual([NO_NAMED_ALLY]);
  });

  it("they are added to the scenario's own rules, after them", () => {
    const state = create(definitionWith([NO_NAMED_ALLY, BLANK_ALLIES]), [SCENARIOS_OWN]);
    expect(state.scenarioRules.rules).toEqual([SCENARIOS_OWN, NO_NAMED_ALLY, BLANK_ALLIES]);
  });

  it("no campaign rule: the scenario's own rules are untouched, and a game with neither has no rules entry", () => {
    expect(create(definitionWith(), [SCENARIOS_OWN]).scenarioRules.rules).toEqual([SCENARIOS_OWN]);
    expect("rules" in create(definitionWith()).scenarioRules).toBe(false);
  });

  it("the rules are in the game's replay baseline: the state's campaign input holds them and survives JSON", () => {
    const state = create(definitionWith([NO_NAMED_ALLY]));
    expect(state.campaign?.scenarioRuleSpecs).toEqual([NO_NAMED_ALLY]);
    expect(JSON.parse(JSON.stringify(state.campaign))).toEqual(state.campaign);
  });
});
