/**
 * Three small primitives the Synthezoid Smackdown leader cards need (docs/competitive-card-audit.md, issue #883), each
 * general and each a plain-data field:
 *
 * - `PlayerRef firstPlayer.of: "enemy"`: "the first player on the enemy team", the other team's token holder (MC56
 *   p. 16: each team has its own first player token), which is not `enemyTeamDecider` (who answers the enemy team's
 *   choices). Cooperatively the enemy team is the players (MC56 p. 6), so it is the first player.
 * - `EffectSpec shuffleEncounterDeck.deckOf`: "your leader's encounter deck" is shuffled after it is searched (RRG 1.8
 *   "Search", p. 39), and "your leader" sits in the other team's area (MC56 p. 16).
 * - `EffectSpec enemyAttacksEnemy.atkBonus` / `.keywords`: "+1 ATK for this attack and this attack gains piercing" on a
 *   leader-versus-leader attack, scoped to that one attack as `enemyAttack.atkBonus` / `.keywords` are.
 *
 * Each is checked in a two-team game and, where it can be read there, unchanged in a cooperative one. Also: an outer
 * query's `anyGameArea` carries into its `anyOf` alternatives and its `not` (docs/competitive-card-audit.md section 4).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { matchesQuery, resolvePlayers, type EffectContext } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, settle } from "./testing/scenario.js";
import { competitiveGame } from "./testing/team.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const P1 = playerId("p1");
const P2 = playerId("p2");
const P3 = playerId("p3");
const P4 = playerId("p4");

const YOUR_LEADER = { kind: "leader", of: "yours" } as const;
const ENEMY_LEADER = { kind: "leader", of: "enemy" } as const;

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attack = (extra: Partial<Extract<EffectSpec, { kind: "enemyAttacksEnemy" }>> = {}): EffectSpec => ({
  kind: "enemyAttacksEnemy",
  attacker: YOUR_LEADER,
  target: ENEMY_LEADER,
  ...extra,
});
const PLAIN = actionEvent("plain-strike", [attack()]);
const STRONG = actionEvent("strong-strike", [
  attack({ atkBonus: { kind: "const", value: 1 }, keywords: ["piercing"] }),
]);
const BOOSTED = actionEvent("boosted-strike", [attack({ boost: true })]);
const BOOSTED_STRONG = actionEvent("boosted-strong-strike", [
  attack({ boost: true, atkBonus: { kind: "const", value: 1 } }),
]);
const SHUFFLE_YOURS = actionEvent("shuffle-yours", [{ kind: "shuffleEncounterDeck", deckOf: YOUR_LEADER }]);
const SHUFFLE_PLAIN = actionEvent("shuffle-plain", [{ kind: "shuffleEncounterDeck" }]);
const EVENTS = [PLAIN, STRONG, BOOSTED, BOOSTED_STRONG, SHUFFLE_YOURS, SHUFFLE_PLAIN];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

const twoTeams = (sizes?: readonly [number, number]): GameState =>
  competitiveGame({
    ...(sizes ? { sizes } : {}),
    deps,
    extraCards: EVENTS.map((e) => e.card),
    deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => [e.card.id, e.card.id])],
  });

function play(state: GameState, card: string): { state: GameState; events: readonly GameEvent[] } {
  const given = giveCard(state, P1, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { state: settle(result.state, undefined, deps), events: result.events };
}

const context = (controller: typeof P1): EffectContext => ({
  selfInstanceId: null,
  controllerId: controller,
  event: null,
  bindings: {},
  deps,
});
const ENEMY_FIRST: { kind: "firstPlayer"; of: "enemy" } = { kind: "firstPlayer", of: "enemy" };

describe("'the first player on the enemy team' (firstPlayer of: enemy)", () => {
  it("1v1: each team's enemy first player is the other seat", () => {
    const state = twoTeams();
    expect(resolvePlayers(state, ENEMY_FIRST, context(P1))).toEqual([P2]);
    expect(resolvePlayers(state, ENEMY_FIRST, context(P2))).toEqual([P1]);
    expect(resolvePlayers(state, { kind: "firstPlayer", of: "yours" }, context(P1))).toEqual([P1]);
  });

  it("2v2: the other team's token holder, which need not be the player who answers its choices", () => {
    const start = twoTeams([2, 2]);
    // Team two (p3, p4) passed its token to p4; the enemy team's decider stays the first of them in player order.
    const state: GameState = {
      ...start,
      teams: start.teams!.map((team, index) => (index === 1 ? { ...team, firstPlayerId: P4 } : team)),
    };
    expect(resolvePlayers(state, ENEMY_FIRST, context(P1))).toEqual([P4]);
    expect(resolvePlayers(state, { kind: "enemyTeamDecider" }, context(P1))).toEqual([P3]);
    // Team one is active, so its token is the game's own first player.
    expect(resolvePlayers(state, ENEMY_FIRST, context(P4))).toEqual([state.firstPlayerId]);
  });

  it("with two teams and no team to read for, it names nobody", () => {
    expect(resolvePlayers(twoTeams(), ENEMY_FIRST, { ...context(P1), controllerId: null })).toEqual([]);
  });

  it("cooperative: the enemy team is the players (MC56 p. 6), so it is the first player, as plain firstPlayer", () => {
    const base = gameAtFirstTurn({ cards: [], deps, players: 2 });
    const state: GameState = { ...base, firstPlayerId: P2 };
    expect(resolvePlayers(state, ENEMY_FIRST, context(P1))).toEqual([P2]);
    expect(resolvePlayers(state, { kind: "firstPlayer" }, context(P1))).toEqual([P2]);
  });
});

const shuffled = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "deckShuffled" && e.zone.kind === "encounterDeck" ? [e.zone.deckId] : []));

describe("shuffleEncounterDeck deckOf: another villain's encounter deck", () => {
  const state = twoTeams();
  const [leaderOne, leaderTwo] = state.villains;

  it("p1's 'your leader's encounter deck' is leader two's, in the other team's area; only it is shuffled", () => {
    expect(shuffled(play(state, SHUFFLE_YOURS.card.id).events)).toEqual([leaderTwo!.encounterDeckId]);
  });

  it("without deckOf it is still the deck of the effect's own area (leader one's for p1)", () => {
    expect(shuffled(play(state, SHUFFLE_PLAIN.card.id).events)).toEqual([leaderOne!.encounterDeckId]);
  });

  it("cooperative: a deckOf that names no villain ('your leader') shuffles nothing; without it, the active deck", () => {
    const coop = gameAtFirstTurn({
      cards: EVENTS.map((e) => e.card),
      deps,
      deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 1)),
    });
    expect(shuffled(playFree(coop, deps, SHUFFLE_YOURS.card.id).events)).toEqual([]);
    expect(shuffled(playFree(coop, deps, SHUFFLE_PLAIN.card.id).events)).toEqual([coop.villains[0]!.encounterDeckId]);
  });
});

describe("enemyAttacksEnemy atkBonus and keywords: this attack only", () => {
  const start = twoTeams();
  const [leaderOne] = start.villains;
  const target = leaderOne!.instanceId as InstanceId;
  const tough = (state: GameState): GameState => ({
    ...state,
    instances: {
      ...state.instances,
      [target]: { ...mustInstance(state, target), statuses: { ...mustInstance(state, target).statuses, tough: 1 } },
    },
  });

  it("deals the attacker's ATK plus the bonus (2 + 1)", () => {
    expect(mustInstance(play(start, PLAIN.card.id).state, target).damage).toBe(2);
    expect(mustInstance(play(start, STRONG.card.id).state, target).damage).toBe(3);
  });

  it("piercing discards the target's tough status card and the damage lands; without it tough absorbs the attack", () => {
    const pierced = play(tough(start), STRONG.card.id).state;
    expect(mustInstance(pierced, target).statuses.tough).toBe(0);
    expect(mustInstance(pierced, target).damage).toBe(3);
    const absorbed = play(tough(start), PLAIN.card.id).state;
    expect(mustInstance(absorbed, target).statuses.tough).toBe(0);
    expect(mustInstance(absorbed, target).damage).toBe(0);
  });

  it("does not reach the next attack: a plain attack after it deals the plain ATK, and tough absorbs it", () => {
    const first = play(start, STRONG.card.id).state;
    const second = play(tough(first), PLAIN.card.id).state;
    expect(mustInstance(second, target).damage).toBe(3);
    expect(mustInstance(second, target).statuses.tough).toBe(0);
  });

  it("with a boost card the bonus is added to ATK and boost icons alike (one more than the same boosted attack)", () => {
    const boosted = mustInstance(play(start, BOOSTED.card.id).state, target).damage;
    expect(mustInstance(play(start, BOOSTED_STRONG.card.id).state, target).damage).toBe(boosted + 1);
  });
});

describe("an outer anyGameArea carries into anyOf alternatives and not", () => {
  const state = twoTeams();
  const leaderTwo = state.villains[1]!.instanceId as InstanceId;
  const villain = { categories: ["villain" as const] };

  it("anyOf: p1 matches leader two (the other area) through an alternative that does not repeat anyGameArea", () => {
    expect(matchesQuery(state, leaderTwo, { anyOf: [villain], anyGameArea: true }, context(P1))).toBe(true);
    expect(
      matchesQuery(state, leaderTwo, { anyOf: [{ categories: ["minion"] }], anyGameArea: true }, context(P1)),
    ).toBe(false);
  });

  it("not: the inner query is read in the outer's reach, so a villain of the other area fails 'not a villain'", () => {
    expect(matchesQuery(state, leaderTwo, { not: villain, anyGameArea: true }, context(P1))).toBe(false);
    expect(matchesQuery(state, leaderTwo, { not: { categories: ["minion"] }, anyGameArea: true }, context(P1))).toBe(
      true,
    );
  });

  it("without it on the outer query the other area's cards still match nothing, alternatives or not", () => {
    expect(matchesQuery(state, leaderTwo, { anyOf: [{ ...villain, anyGameArea: true }] }, context(P1))).toBe(false);
    expect(matchesQuery(state, leaderTwo, { anyOf: [villain] }, context(P2))).toBe(true);
  });
});
