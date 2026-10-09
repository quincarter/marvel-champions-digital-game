/**
 * Owner ruling of 2026-10-09 on Toe to Toe (10015 / 32046: "Choose an enemy. That enemy attacks you. Deal 5 damage to
 * that enemy.", a Hero Action (attack)), docs/phase7-wave8.md §4.1 rows 73 and 88. The card's hero attack begins when
 * the ability begins resolving (RRG 1.8 "Labeled Ability", p. 26), so:
 *
 * (a) an enemy stunned when its attack would initiate has that attack canceled by the stun (RRG 1.8 "Stun, Stunned",
 *     p. 41) and the 5 damage still lands: it does not depend on the enemy's attack succeeding;
 * (b) a stun the hero receives after the hero's attack began (here from a real boost card during the enemy's attack)
 *     does not cancel the hero's attack and stays on the hero. OWNER DECISION, row 88: "A, medium confidence, not
 *     PDF-verified by the owner", not a confirmed ruling;
 * (c) control: a hero already stunned when playing it has the whole ability canceled except costs (pp. 26, 41);
 * (d) an enemy stunned after its attack initiated is not retroactively canceled. NOT TESTED: no shipped card stuns
 *     the attacking enemy mid-attack for the Spider-Man (Justice) hero used here (Psylocke's defense stun is a hero
 *     kit not in this game), and staging it would assert the surgery rather than a card.
 *
 * (b) uses Ancient Warrior's boost (11030, "[star] Boost: You are stunned."), staged as the top encounter card, which
 * the villain's attack draws as its boost card. Real Core Spider-Man hand in a real Rhino game (`testing/qa-bench.ts`).
 */
import { cardId } from "@mc/content";
import { activeEncounterDeck, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { identityOf, inst, patchInstance } from "./testing/harness.js";
import { conjure, playOut, rhino } from "./testing/qa-bench.js";

const toeToToe = "10015";
const costOf = (state: GameState): number => {
  const card = state.cardPool[cardId(toeToToe)]!;
  return "cost" in card && typeof card.cost === "number" ? card.cost : 0;
};
const index = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);
const damageTo =
  (id: InstanceId) =>
  (e: GameEvent): boolean =>
    e.type === "damageDealt" && e.targetInstanceId === id;
const takenBy = (events: readonly GameEvent[], id: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));
const statusGiven =
  (id: InstanceId) =>
  (e: GameEvent): boolean =>
    e.type === "statusGiven" && e.instanceId === id && e.status === "stunned";
const statusRemoved = (id: InstanceId) => (e: GameEvent) =>
  e.type === "statusRemoved" && e.instanceId === id && e.status === "stunned";
const stun = (state: GameState, id: InstanceId): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, stunned: 1 } });
const enemyAttackBegan = (e: GameEvent): boolean =>
  e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttack";

describe("Toe to Toe (10015) and stun timing (docs/phase7-wave8.md §4.1 rows 73, 88)", () => {
  it("(a) stunned enemy: its attack is canceled by the stun (RRG p. 41) and Toe to Toe still deals 5", () => {
    const start = rhino();
    const villain = start.activeVillainId!;
    const given = conjure(stun(start, villain), toeToToe);
    const hero = identityOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state), { target: villain });
    expect(done.accepted).toBe(true);
    expect(index(done.events, statusRemoved(villain))).toBeGreaterThanOrEqual(0);
    expect(inst(done.state, villain).statuses.stunned).toBe(0);
    expect(takenBy(done.events, hero)).toEqual([]);
    expect(takenBy(done.events, villain)).toEqual([5]);
    expect(index(done.events, statusRemoved(villain))).toBeLessThan(index(done.events, damageTo(villain)));
    expect(done.state.stack).toEqual([]);
  });

  it("(b) owner decision, row 88: hero stunned by the enemy's boost mid-card; the 5 damage lands and the stun stays", () => {
    const start = rhino();
    const villain = start.activeVillainId!;
    const top = activeEncounterDeck(start).deck[0]!;
    const staged = patchInstance(start, top, { cardId: cardId("11030") });
    const given = conjure(staged, toeToToe);
    const hero = identityOf(given.state);
    expect(inst(given.state, hero).statuses.stunned).toBe(0);
    const done = playOut(given.state, given.id, costOf(given.state), { target: villain });
    expect(done.accepted).toBe(true);
    const stunned = index(done.events, statusGiven(hero));
    expect(stunned).toBeGreaterThanOrEqual(0);
    expect(index(done.events, enemyAttackBegan)).toBeLessThan(stunned);
    expect(stunned).toBeLessThan(index(done.events, damageTo(villain)));
    expect(takenBy(done.events, villain)).toEqual([5]);
    expect(index(done.events, statusRemoved(hero))).toBe(-1);
    expect(inst(done.state, hero).statuses.stunned).toBe(1);
    expect(done.state.stack).toEqual([]);
  });

  it("(c) control: hero already stunned: stun discarded, no enemy attack, no damage (RRG pp. 26, 41)", () => {
    const start = rhino();
    const villain = start.activeVillainId!;
    const given = conjure(stun(start, identityOf(start)), toeToToe);
    const hero = identityOf(given.state);
    const done = playOut(given.state, given.id, costOf(given.state), { target: villain });
    expect(done.accepted).toBe(true);
    expect(inst(done.state, hero).statuses.stunned).toBe(0);
    expect(index(done.events, enemyAttackBegan)).toBe(-1);
    expect(takenBy(done.events, villain)).toEqual([]);
    expect(takenBy(done.events, hero)).toEqual([]);
  });
});
