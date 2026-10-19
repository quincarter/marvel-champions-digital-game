/**
 * `RuleSpec playCostModifier`, lasting through `applyRuleUntil`: "Until the end of the phase, reduce the cost to play
 * each Team-Up card by 1" (Defend Our City 61029). Synthetic cards: an Action that creates the rule, a Team-Up event
 * costing 2, a Team-Up event costing 1, and a control event without the keyword. Two players.
 *
 * Sources: RRG 1.8 "Lasting Effects" (p. 26: it keeps working after its card has left play, for its duration), "Cost"
 * (p. 13), "Modifiers" (p. 29: a value below zero is treated as zero), "Team-Up" (p. 43).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { playCostContributions, playCostOf } from "./actions.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const TEAM_UP_RULE: RuleSpec = {
  kind: "playCostModifier",
  player: { kind: "each" },
  appliesTo: { withKeyword: "teamUp" },
  delta: -1,
};
/** "Action: Until the end of the phase, reduce the cost to play each Team-Up card by 1." */
const RALLY_ACTION = stubAbility("rally.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "applyRuleUntil", rule: TEAM_UP_RULE, until: "endOfPhase" }],
});
const RALLY = stubSupport({ id: "rally", cost: 0, abilities: [RALLY_ACTION.ref] });
const RALLY_TOO = stubSupport({ id: "rally-too", cost: 0, abilities: [RALLY_ACTION.ref] });
const TEAM_UP = [{ name: "teamUp", names: ["Iron Fist", "Luke Cage"] }] as const;
const DUO = stubEvent({ id: "duo", cost: 2, keywords: TEAM_UP as never });
const CHEAP_DUO = stubEvent({ id: "cheap-duo", cost: 1, keywords: TEAM_UP as never });
const SOLO = stubEvent({ id: "solo", cost: 2 });

const deps: EngineDeps = depsOf(RALLY_ACTION);

function start() {
  let state = gameAtFirstTurn({
    cards: [RALLY, RALLY_TOO, DUO, CHEAP_DUO, SOLO],
    deps,
    players: 2,
    deck: [RALLY.id, RALLY_TOO.id, DUO.id, DUO.id, SOLO.id, CHEAP_DUO.id],
  });
  const rally = playerCardIntoPlay(state, RALLY.id);
  const rallyToo = playerCardIntoPlay(rally.state, RALLY_TOO.id);
  state = rallyToo.state;
  const mine = giveCards(state, P1, DUO.id, SOLO.id, CHEAP_DUO.id);
  const theirs = giveCards(mine.state, P2, DUO.id);
  const [duo, solo, cheap] = mine.ids as [InstanceId, InstanceId, InstanceId];
  return { state: theirs.state, rally: rally.id, rallyToo: rallyToo.id, duo, solo, cheap, p2Duo: theirs.ids[0]! };
}

const use = (instanceId: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: instanceId,
  abilityId: RALLY_ACTION.ref.id,
  payment: [],
});
function drive(state: GameState, ...commands: readonly Command[]): GameState {
  const { session } = driveSession(startSession(state), deps, commands, defaultPick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return session.state;
}
const cost = (state: GameState, id: InstanceId, player: PlayerId = P1) => playCostOf(state, player, id, deps)?.current;
const lasting = (state: GameState) => state.lastingEffects.filter((effect) => effect.kind === "ruleGrant");

describe("`RuleSpec playCostModifier` until the end of the phase (Defend Our City 61029)", () => {
  it("reduces each Team-Up card by 1 for every player, and names its card; a card without the keyword is unchanged", () => {
    const { state, rally, duo, solo, p2Duo } = start();
    expect([cost(state, duo), cost(state, p2Duo, P2), cost(state, solo)]).toEqual([2, 2, 2]);
    const after = drive(state, use(rally));
    // One lasting effect per player the rule names, each frozen to that player (`applyRuleUntil`, wave 2 §22).
    expect(lasting(after).map((effect) => (effect.rule as { player: unknown }).player)).toEqual([
      { kind: "id", playerId: P1 },
      { kind: "id", playerId: P2 },
    ]);
    expect([cost(after, duo), cost(after, p2Duo, P2), cost(after, solo)]).toEqual([1, 1, 2]);
    expect(playCostContributions(after, deps, P1, duo, null)).toEqual([{ sourceInstanceId: rally, delta: -1 }]);
  });

  it("a Team-Up card drawn after the rule was created is reduced too", () => {
    const { state, rally } = start();
    const after = drive(state, use(rally));
    const drawn = giveCards(after, P1, DUO.id);
    expect(cost(drawn.state, drawn.ids[0]!)).toBe(1);
  });

  it("stacks with a second one, and is floored at 0", () => {
    const { state, rally, rallyToo, duo, cheap } = start();
    const twice = drive(state, use(rally), use(rallyToo));
    expect(lasting(twice)).toHaveLength(4);
    expect(cost(twice, duo)).toBe(0);
    expect(cost(twice, cheap)).toBe(0);
  });

  it("ends with the phase: after the player phase the Team-Up card costs 2 again", () => {
    const { state, rally, duo } = start();
    const reduced = drive(state, use(rally));
    const ended = drive(reduced, { type: "endTurn", playerId: P1 }, { type: "endTurn", playerId: P2 });
    expect(ended.step.phase).toBe("player");
    expect(ended.round).toBeGreaterThan(state.round);
    expect(lasting(ended)).toHaveLength(0);
    expect(cost(ended, duo)).toBe(2);
  });

  it("control: scoped to one player, only that player's plays are reduced", () => {
    const { state, duo, p2Duo } = start();
    const mine: RuleSpec = { ...TEAM_UP_RULE, player: { kind: "controller" } };
    const onlyMine = {
      ...state,
      lastingEffects: [
        ...state.lastingEffects,
        {
          kind: "ruleGrant",
          rule: mine,
          duration: "endOfPhase",
          scope: { selfInstanceId: null, controllerId: P1 },
        } as never,
      ],
    };
    expect([cost(onlyMine, duo), cost(onlyMine, p2Duo, P2)]).toEqual([1, 2]);
  });
});
