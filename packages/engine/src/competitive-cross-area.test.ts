/**
 * Cross-area effects of a game with two teams (docs/competitive-mode-plan.md §1.5, milestone M3).
 *
 * Sources: MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4). A leader attacking a leader:
 * "The attacking leader is given a facedown boost card from its encounter deck. The first player on the defending
 * leader's team turns it faceup and resolves it … deals damage equal to its total ATK" (p. 16; Q5, Q6 settled by the
 * rules expert 2026-11-20: the deck of the area the attacker is in, turned by the first player of the team there).
 * "Card abilities completely ignore cards on the other side of the table unless they specifically refer to them".
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, sharedMainSchemes } from "./query.js";
import { matchesQuery, resolvePlayers, resolveRef, type EffectContext } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, settle } from "./testing/scenario.js";
import { competitiveGame } from "./testing/team.js";
import { stepOneThreats } from "./villain/step-one-threat.js";

const P1 = playerId("p1");
const P2 = playerId("p2");

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Your leader attacks the enemy leader." (the leader player cards' attack events) */
const LEADER_ATTACK = actionEvent("leader-attack", [
  {
    kind: "enemyAttacksEnemy",
    attacker: { kind: "leader", of: "yours" },
    target: { kind: "leader", of: "enemy" },
    boost: true,
  },
]);
/** "Place 2 threat on your leader's main scheme." (Double Agent) */
const DOUBLE_AGENT = actionEvent("double-agent", [
  { kind: "placeThreat", target: { kind: "mainScheme", of: "yourLeader" }, amount: { kind: "const", value: 2 } },
]);
const EVENTS = [LEADER_ATTACK, DOUBLE_AGENT];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const game = (): GameState =>
  competitiveGame({
    deps,
    extraCards: EVENTS.map((e) => e.card),
    deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => [e.card.id, e.card.id])],
  });

function play(state: GameState, card: string) {
  const given = giveCard(state, P1, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

const context = (controller: typeof P1): EffectContext => ({
  selfInstanceId: null,
  controllerId: controller,
  event: null,
  bindings: {},
  deps,
});

describe("a leader attacks a leader (MC56 p. 16)", () => {
  const start = game();
  const [leaderOne, leaderTwo] = start.villains;
  const asked = play(start, LEADER_ATTACK.card.id);

  it("gives your leader a boost card from the deck of the area it sits in, turned by that team's first player", () => {
    const dealt = asked.events.find((event) => event.type === "boostCardDealt");
    expect(dealt).toMatchObject({ enemyInstanceId: leaderTwo!.instanceId });
    const moved = asked.events.find(
      (event) => event.type === "cardMoved" && event.to.kind === "boost" && event.from.kind === "encounterDeck",
    );
    expect(moved && moved.type === "cardMoved" && moved.from).toEqual({
      kind: "encounterDeck",
      deckId: leaderTwo!.encounterDeckId,
    });
    // Q5: "you" of that boost card is the first player of the team in the attacker's area (team two's, p2).
    expect(JSON.stringify(asked.events)).toContain(`"boostPlayerId":"${P2}"`);
    expect(JSON.stringify(asked.events)).not.toContain(`"boostPlayerId":"${P1}"`);
  });

  it("deals the attacker's total ATK to the enemy leader in the other area, with no defender", () => {
    const done = settle(asked.state, undefined, deps);
    const attacked = [...asked.events].reverse().find((event) => event.type === "enemyAttackedEnemy");
    const damage = mustInstance(done, leaderOne!.instanceId).damage;
    expect(damage).toBeGreaterThanOrEqual(2);
    expect(attacked).toMatchObject({
      targetInstanceId: leaderOne!.instanceId,
      attackerInstanceId: leaderTwo!.instanceId,
    });
    expect(attacked.targetInstanceId).toBe(leaderOne!.instanceId);
  });
});

describe("the words that reach the other side of the table", () => {
  const state = game();
  const [schemeOne, schemeTwo] = sharedMainSchemes(state);

  it("'your leader's main scheme' is the scheme of the area your leader is in", () => {
    const after = play(state, DOUBLE_AGENT.card.id).state;
    expect(mustInstance(after, schemeTwo!.instanceId).threat - mustInstance(state, schemeTwo!.instanceId).threat).toBe(
      2,
    );
    expect(mustInstance(after, schemeOne!.instanceId).threat).toBe(mustInstance(state, schemeOne!.instanceId).threat);
    expect(resolveRef(state, { kind: "mainScheme", of: "yourLeader" }, context(P2))).toEqual([schemeOne!.instanceId]);
  });

  it("'the first player' of an effect read for a team is that team's token holder", () => {
    expect(resolvePlayers(state, { kind: "firstPlayer" }, context(P1))).toEqual([P1]);
    expect(resolvePlayers(state, { kind: "firstPlayer" }, context(P2))).toEqual([P2]);
  });

  it("a query matches the other area's cards only when it says so (anyGameArea)", () => {
    const [, leaderTwo] = state.villains;
    const leader = leaderTwo!.instanceId as InstanceId;
    expect(matchesQuery(state, leader, { categories: ["villain"] }, context(P1))).toBe(false);
    expect(matchesQuery(state, leader, { categories: ["villain"], anyGameArea: true }, context(P1))).toBe(true);
  });

  it("step one counts acceleration tokens off a scheme on the active team's side only", () => {
    const [, leaderTwo] = state.villains;
    const tokened: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [leaderTwo!.instanceId]: {
          ...mustInstance(state, leaderTwo!.instanceId),
          counters: { acceleration: 3 },
        },
      },
    };
    expect(stepOneThreats(tokened, deps).map((threat) => threat.otherTokens)).toEqual([0]);
    const teamTwo: GameState = { ...tokened, activeTeamId: tokened.teams![1]!.teamId };
    expect(stepOneThreats(teamTwo, deps).map((threat) => threat.otherTokens)).toEqual([3]);
  });
});
