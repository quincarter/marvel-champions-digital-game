/**
 * `RuleSpec mainSchemeValue`: a scenario or campaign rule that changes a threat value of a named main scheme stage,
 * with no card to carry a constant. Each rule here comes in through a campaign node, as a script writes it, and is
 * gated on a seeded `hidden` log field (`CampaignLogSetup.hiddenFields`).
 */
import { campaignId, cardId, flat, perPlayerOnly, scenarioId, type MainSchemeCard, type PlayModes } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { CampaignDefinition, LogValue } from "./campaign.js";
import { createCampaignLog, resolveBetweenGames, startGameFromLog } from "./campaign/runner.js";
import { playerId } from "./ids.js";
import { modifiersFor } from "./modifiers.js";
import { mainSchemeStage, mainSchemeValue, mustInstance, startingThreatOf } from "./query.js";
import type { Predicate, ValueSpec } from "./spec.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, HERO, seatIdentities } from "./testing/scenario.js";

const p1 = playerId("p1");
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const SCHEME = stubMainScheme({
  id: "two-stages",
  stages: [
    { startingThreat: perPlayerOnly(2), targetThreat: perPlayerOnly(6), acceleration: perPlayerOnly(2) },
    { startingThreat: perPlayerOnly(3), targetThreat: perPlayerOnly(9), acceleration: perPlayerOnly(2) },
  ],
});
const STAGE_1 = { cardId: SCHEME.id, stageNumber: 1 };
const STAGE_2 = { cardId: SCHEME.id, stageNumber: 2 };

/** The same scheme with its target threat printed as a dash on the first stage. */
const DASHED: MainSchemeCard = (() => {
  const [first, second] = SCHEME.stages;
  if (!first || !second) throw new Error("no stages");
  return { ...SCHEME, stages: [{ ...first, dashedValues: ["targetThreat"] }, second] };
})();

const ADVANCE = stubAbility("advance.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "advanceMainScheme" }],
});
const ADVANCE_CARD = stubEvent({ id: "advance-card", cost: 0, abilities: [ADVANCE.ref] });
const deps: EngineDeps = depsOf(ADVANCE);

const HOUSE_RULE: Predicate = { kind: "campaignLog", field: "house", isSet: true };
const ONE_HERO: Predicate = {
  kind: "compare",
  left: { kind: "perPlayer", base: 0, perPlayer: 1 },
  op: "equalTo",
  right: { kind: "const", value: 1 },
};
const MINUS_ONE_PER_PLAYER: ValueSpec = { kind: "perPlayer", base: 0, perPlayer: -1 };

const SLOWER: RuleSpec = {
  kind: "mainSchemeValue",
  field: "acceleration",
  stage: STAGE_1,
  amount: MINUS_ONE_PER_PLAYER,
  while: HOUSE_RULE,
};
/** Every stage of the card: no `stageNumber`. */
const NO_STARTING_THREAT: RuleSpec = {
  kind: "mainSchemeValue",
  field: "startingThreat",
  stage: { cardId: SCHEME.id },
  amount: 0,
  setBase: true,
  while: HOUSE_RULE,
};
const HIGHER_TARGET_SOLO: RuleSpec = {
  kind: "mainSchemeValue",
  field: "targetThreat",
  stage: STAGE_1,
  amount: 6,
  while: { kind: "and", of: [HOUSE_RULE, ONE_HERO] },
};

const CAMPAIGN_ID = campaignId("main-scheme-value-rule-test");
const MODES: PlayModes = { campaign: { campaignId: CAMPAIGN_ID } };
const ON: Readonly<Record<string, LogValue>> = { house: { kind: "flag", value: true } };

function campaignInput(players: number, rules: readonly RuleSpec[], hiddenFields?: Readonly<Record<string, LogValue>>) {
  const definition: CampaignDefinition = {
    campaignId: CAMPAIGN_ID,
    version: "1",
    logFields: [
      { id: "house", label: "House rule", scope: "shared", type: { kind: "flag" }, hidden: true, citation: "test" },
    ],
    loss: { retry: "free", retryBaseline: "nodeStart" },
    graph: {
      kind: "linear",
      nodes: [
        {
          id: "only",
          label: "only",
          scenario: { kind: "fixed", scenarioId: scenarioId("main-scheme-value-rule-scenario") },
          scenarioRuleSpecs: rules,
          setup: [],
          victory: [],
        },
      ],
    },
  };
  const log = createCampaignLog(definition, {
    id: "run",
    seats: Array.from({ length: players }, (_, seat) => ({
      seatNumber: seat + 1,
      identityCardId: cardId("seat"),
      deck: { identityCardId: cardId("seat"), aspects: [], cards: [] },
    })),
    modes: MODES,
    poolVersion: "test",
    seed: 1,
    ...(hiddenFields ? { hiddenFields } : {}),
  });
  const composed = resolveBetweenGames(definition, log, { pool: [] }, MODES);
  if (composed.kind !== "done") throw new Error("unexpected pending choice");
  return startGameFromLog(definition, composed.value).input;
}

function config(players: number, extra: Partial<GameSetupConfig>, scheme: MainSchemeCard = SCHEME): GameSetupConfig {
  const identities = seatIdentities(HERO, players);
  return {
    seed: 7,
    cards: [QUIET_VILLAIN, scheme, BLANK, ADVANCE_CARD, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: scheme.id,
    encounterDeck: Array.from({ length: 24 }, () => BLANK.id),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: Array.from({ length: 12 }, () => ADVANCE_CARD.id),
    })),
    ...extra,
  };
}

function start(gameConfig: GameSetupConfig): GameState {
  const created = createGame(gameConfig, deps);
  if (!created.ok) throw new Error(created.error.message);
  return runCommands(created.state, deps).state;
}

/** A game of a campaign node holding `rules`, with the house rule's log field on or left unset. */
const campaignGame = (players: number, rules: readonly RuleSpec[], on: boolean) =>
  start(config(players, { campaign: campaignInput(players, rules, on ? ON : undefined) }));

const scenarioGame = (players: number, rules: readonly RuleSpec[], scheme: MainSchemeCard = SCHEME) =>
  start(config(players, { scenarioRuleSpecs: rules }, scheme));

function advance(state: GameState): GameState {
  const given = giveCard(state, p1, ADVANCE_CARD.id);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
}

const threatOn = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;

describe("RuleSpec mainSchemeValue", () => {
  it("acceleration lowered by 1 per player on a named stage", () => {
    expect(mainSchemeValue(campaignGame(2, [SLOWER], true), "acceleration", deps)).toBe(2);
    expect(mainSchemeValue(campaignGame(3, [SLOWER], true), "acceleration", deps)).toBe(3);
  });

  it("starting threat set to 0: placed nothing on the first stage at setup, and nothing on a later stage on flip", () => {
    const state = campaignGame(2, [NO_STARTING_THREAT], true);
    expect(threatOn(state)).toBe(0);
    expect(startingThreatOf(state, state.mainScheme.instanceId, deps)).toBe(0);
    const flipped = advance(state);
    expect(mainSchemeStage(flipped).stageNumber).toBe(2);
    expect(threatOn(flipped)).toBe(0);
    expect(mainSchemeValue(flipped, "startingThreat", deps)).toBe(0);
  });

  it("target threat raised on a named stage while one hero is in the game", () => {
    expect(mainSchemeValue(campaignGame(1, [HIGHER_TARGET_SOLO], true), "targetThreat", deps)).toBe(12);
    expect(mainSchemeValue(campaignGame(2, [HIGHER_TARGET_SOLO], true), "targetThreat", deps)).toBe(12);
    expect(mainSchemeValue(campaignGame(3, [HIGHER_TARGET_SOLO], true), "targetThreat", deps)).toBe(18);
  });

  it("a false `while` changes nothing: the game reads as if the rule were not there", () => {
    const rules = [SLOWER, NO_STARTING_THREAT, HIGHER_TARGET_SOLO];
    const off = campaignGame(1, rules, false);
    expect(threatOn(off)).toBe(2);
    expect(mainSchemeValue(off, "acceleration", deps)).toBe(2);
    expect(mainSchemeValue(off, "startingThreat", deps)).toBe(2);
    expect(mainSchemeValue(off, "targetThreat", deps)).toBe(6);
    expect(modifiersFor(off, deps, off.mainScheme.instanceId)).toEqual([]);
    const flipped = advance(off);
    expect(threatOn(flipped)).toBe(3);
  });

  it("a stage's rule holds only while that stage is showing, either way across a flip", () => {
    const later: RuleSpec = { ...SLOWER, stage: STAGE_2 };
    const onFirst = campaignGame(2, [SLOWER], true);
    expect(mainSchemeValue(advance(onFirst), "acceleration", deps)).toBe(4);
    const onSecond = campaignGame(2, [later], true);
    expect(mainSchemeValue(onSecond, "acceleration", deps)).toBe(4);
    expect(mainSchemeValue(advance(onSecond), "acceleration", deps)).toBe(2);
  });

  it("a rule on another card's stage changes nothing, and `name` narrows by the stage's title", () => {
    const other: RuleSpec = {
      ...SLOWER,
      stage: { cardId: cardId("another-scheme") },
      while: { kind: "not", of: ONE_HERO },
    };
    expect(mainSchemeValue(scenarioGame(2, [other]), "acceleration", deps)).toBe(4);
    const named: RuleSpec = {
      ...SLOWER,
      stage: { ...STAGE_1, name: "Not This Title" },
      while: { kind: "not", of: ONE_HERO },
    };
    expect(mainSchemeValue(scenarioGame(2, [named]), "acceleration", deps)).toBe(4);
  });

  it("no card is self: a plain scenario rule outside any campaign reads, and its modifier names no source", () => {
    const rule: RuleSpec = {
      kind: "mainSchemeValue",
      field: "targetThreat",
      stage: STAGE_1,
      amount: MINUS_ONE_PER_PLAYER,
    };
    const state = scenarioGame(2, [rule]);
    expect(mainSchemeValue(state, "targetThreat", deps)).toBe(10);
    expect(modifiersFor(state, deps, state.mainScheme.instanceId, "targetThreat")).toEqual([
      { sourceInstanceId: null, stat: "targetThreat", amount: -2, origin: "rule" },
    ]);
  });

  it("floors at 0 once, after every modifier (RRG 1.8 'Modifiers', p. 29), not rule by rule", () => {
    const by = (amount: number): RuleSpec => ({
      kind: "mainSchemeValue",
      field: "acceleration",
      stage: STAGE_1,
      amount,
    });
    expect(mainSchemeValue(scenarioGame(1, [by(-5)]), "acceleration", deps)).toBe(0);
    expect(mainSchemeValue(scenarioGame(1, [by(-5), by(5)]), "acceleration", deps)).toBe(2);
    expect(mainSchemeValue(scenarioGame(1, [by(5), by(-5)]), "acceleration", deps)).toBe(2);
  });

  it("`setBase` replaces the printed value, and an additive modifier still adds to it", () => {
    const base: RuleSpec = {
      kind: "mainSchemeValue",
      field: "startingThreat",
      stage: STAGE_1,
      amount: 0,
      setBase: true,
    };
    const plus: RuleSpec = { kind: "mainSchemeValue", field: "startingThreat", stage: STAGE_1, amount: 3 };
    const minus: RuleSpec = { ...plus, amount: -3 };
    expect(mainSchemeValue(scenarioGame(2, [base, plus]), "startingThreat", deps)).toBe(3);
    expect(threatOn(scenarioGame(2, [plus, base]))).toBe(3);
    expect(mainSchemeValue(scenarioGame(2, [base, minus]), "startingThreat", deps)).toBe(0);
  });

  it("beside a card's constant: an additive one adds to the rule's base, and a card's `setBase` holds over it", () => {
    const base: RuleSpec = {
      kind: "mainSchemeValue",
      field: "targetThreat",
      stage: STAGE_1,
      amount: 1,
      setBase: true,
    };
    const withConstant = (modifier: { readonly amount: number; readonly setBase?: true }) => {
      const constant = stubAbility("scheme.constant", {
        trigger: { kind: "constant", modifiers: [{ stat: "targetThreat", target: { self: true }, ...modifier }] },
        effects: [],
      });
      const [first, second] = SCHEME.stages;
      if (!first || !second) throw new Error("no stages");
      const scheme: MainSchemeCard = { ...SCHEME, stages: [{ ...first, abilities: [constant.ref] }, second] };
      const withDeps = depsOf(ADVANCE, constant);
      const created = createGame(config(2, { scenarioRuleSpecs: [base] }, scheme), withDeps);
      if (!created.ok) throw new Error(created.error.message);
      return mainSchemeValue(runCommands(created.state, withDeps).state, "targetThreat", withDeps);
    };
    expect(withConstant({ amount: 3 })).toBe(4);
    expect(withConstant({ amount: 5, setBase: true })).toBe(5);
  });

  it("a dashed value is an unmodifiable 0 (RRG 1.8 'Dash (Value)', p. 15)", () => {
    const rule: RuleSpec = { kind: "mainSchemeValue", field: "targetThreat", stage: STAGE_1, amount: 6 };
    expect(mainSchemeValue(scenarioGame(1, [rule], DASHED), "targetThreat", deps)).toBe(0);
  });
});
