/**
 * An ally's consequential damage after an attack that defeated its target reads the target as it was when the attack
 * was made (`EffectContext.lastKnown`, recorded by the attack's frame as `targetAttachments` / `targetStatus.*`).
 * Synthetic allies shaped like "takes 1 less consequential damage after attacking a confused enemy" and "… an enemy
 * with a Tag attached".
 *
 * Sources: RRG 1.8 "Consequential Damage" (p. 13): the ally takes it after the attack resolves, by which time a defeated
 * enemy has left play with its status cards and attachments; FFG ruling February 8, 2026 (1): the designer intent is
 * that such a reduction still applies; owner ruling Q38 = A (docs/phase7-wave8.md §4.1): build the intent, the enemy
 * read as it was when the attack was made.
 */
import { describe, expect, it } from "vitest";
import type { RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { Predicate, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const afterAttacking = (query: TargetQuery): RuleSpec => ({
  kind: "reduceDamageTaken",
  target: { self: true },
  amount: 1,
  consequential: {
    from: "attack",
    if: { kind: "refMatches", ref: { kind: "slot", slot: "attack.target" }, query, anywhere: true } as Predicate,
  },
});
const rule = (id: string, spec: RuleSpec) =>
  stubAbility(id, { trigger: { kind: "constant", rules: [spec] }, effects: [] });

/** "Takes 1 less consequential damage after attacking a confused enemy." */
const HAZE_RULE = rule("haze.constant", afterAttacking({ categories: ["enemy"], hasStatus: "confused" }));
const HAZE = stubAlly({ id: "haze", cost: 0, atk: 2, thw: 1, hp: 5, abilities: [HAZE_RULE.ref] });
/** "Takes 1 less consequential damage after attacking an enemy with a Tag attached." */
const SLEET_RULE = rule("sleet.constant", afterAttacking({ categories: ["enemy"], hasAttachment: { name: "tag" } }));
const SLEET = stubAlly({ id: "sleet", cost: 0, atk: 2, thw: 1, hp: 5, abilities: [SLEET_RULE.ref] });
const TAG = stubUpgrade({ id: "tag", cost: 0 });
const STURDY = stubMinion({ id: "sturdy", atk: 0, sch: 0, hp: 9 });
const FRAIL = stubMinion({ id: "frail", atk: 0, sch: 0, hp: 2 });

const deps = depsOf(HAZE_RULE, SLEET_RULE);
const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][InstanceId]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
/** A Tag attached to `host` (surgery). */
function tagged(state: GameState, host: InstanceId): GameState {
  const placed = playerCardIntoPlay(state, TAG.id);
  const off = {
    ...placed.state,
    players: placed.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== placed.id) })),
  };
  return patch(patch(off, placed.id, { attachedTo: host }), host, {
    attachments: [...mustInstance(off, host).attachments, placed.id],
  });
}
function table(ally: typeof HAZE, minion: typeof STURDY, how: "confused" | "tagged" | "bare") {
  const base = gameAtFirstTurn({
    cards: [HAZE, SLEET, TAG, STURDY, FRAIL],
    deps,
    deck: [HAZE.id, SLEET.id, TAG.id],
    encounter: [STURDY.id, FRAIL.id],
  });
  const attacker = playerCardIntoPlay(base, ally.id);
  const enemy = minionEngagedWith(attacker.state, minion.id);
  let state = enemy.state;
  if (how === "confused") {
    state = patch(state, enemy.id, { statuses: { ...mustInstance(state, enemy.id).statuses, confused: 1 } });
  }
  if (how === "tagged") state = tagged(state, enemy.id);
  return { state, ally: attacker.id, enemy: enemy.id };
}
function attack(t: ReturnType<typeof table>) {
  const run = runCommands(t.state, deps, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: t.ally,
    targetInstanceId: t.enemy,
  });
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return {
    consequential: mustInstance(run.state, t.ally).damage,
    defeated: !cardsInPlay(run.state).includes(t.enemy),
  };
}

describe("consequential damage reads the attacked enemy as it was when the attack was made", () => {
  it("a confused enemy that survives: 1 less (read live, as before)", () => {
    expect(attack(table(HAZE, STURDY, "confused"))).toEqual({ consequential: 0, defeated: false });
  });
  it("a confused enemy the attack defeats: still 1 less, though its confused card left play with it", () => {
    expect(attack(table(HAZE, FRAIL, "confused"))).toEqual({ consequential: 0, defeated: true });
  });
  it("an enemy that was not confused: the full consequential damage, defeated or not", () => {
    expect(attack(table(HAZE, STURDY, "bare"))).toEqual({ consequential: 1, defeated: false });
    expect(attack(table(HAZE, FRAIL, "bare"))).toEqual({ consequential: 1, defeated: true });
  });
  it("an enemy with the upgrade attached that survives: 1 less", () => {
    expect(attack(table(SLEET, STURDY, "tagged"))).toEqual({ consequential: 0, defeated: false });
  });
  it("an enemy with the upgrade attached that the attack defeats: still 1 less, though the upgrade is no longer attached", () => {
    expect(attack(table(SLEET, FRAIL, "tagged"))).toEqual({ consequential: 0, defeated: true });
  });
  it("another kind of last known state is not confused with it: a tagged enemy is not a confused one", () => {
    expect(attack(table(HAZE, FRAIL, "tagged"))).toEqual({ consequential: 1, defeated: true });
    expect(attack(table(SLEET, FRAIL, "confused"))).toEqual({ consequential: 1, defeated: true });
  });
});
