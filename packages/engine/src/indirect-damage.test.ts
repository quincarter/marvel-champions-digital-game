/**
 * docs/phase7-wave1.md §3.7: indirect damage, proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Indirect Damage" (p. 24, quoted on `EffectSpec dealIndirectDamage`); ruling Aug 3, 2026 (2) answer 1
 * (a reduction applies to indirect damage assigned to that character); user decision 2026-09-13 (§4.7: each player
 * assigns their own, `authority: "player"`).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { ALLY, DEFAULT_DECK, expectOk, giveCard, newGame, resolvePending, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const you = { kind: "controller" } as const;

const indirect = (id: string, amount: number, to: "you" | "each") => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "dealIndirectDamage", to: to === "you" ? you : { kind: "each" }, amount: { kind: "const", value: amount }, bind: "hit" }],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TWO = indirect("indirect-2", 2, "you");
const FOUR = indirect("indirect-4", 4, "you");
const EACH_TWO = indirect("indirect-each-2", 2, "each");

/** "Allies cannot take damage." */
const WARD_ABILITY: StubAbility = stubAbility("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotTakeDamage", target: { categories: ["ally"] } }] },
  effects: [],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARD_ABILITY.ref] });
/** "Characters cannot take damage." */
const FORTRESS_ABILITY = stubAbility("fortress.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotTakeDamage", target: { categories: ["character"] } }] },
  effects: [],
});
const FORTRESS = stubSupport({ id: "fortress", cost: 0, abilities: [FORTRESS_ABILITY.ref] });
/** "Forced Response: after a character takes damage, place a counter here for each damaged character." */
const WATCH_RESPONSE = stubAbility("watch.response", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs: { categories: ["character"] } } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "damagedSeen", amount: { kind: "count", query: { categories: ["character"], damaged: true } } }],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_RESPONSE.ref] });
/** "Interrupt: when an ally would take damage, prevent 1 of it" (Echo's shape). */
const SHIELD_INTERRUPT = stubAbility("shield.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["ally"] } } },
  effects: [{ kind: "preventDamage", amount: { kind: "const", value: 1 } }],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(TWO.ability, FOUR.ability, EACH_TWO.ability, WARD_ABILITY, FORTRESS_ABILITY, WATCH_RESPONSE, SHIELD_INTERRUPT);
const EXTRA = [TWO.card, FOUR.card, EACH_TWO.card, WARD, FORTRESS, WATCH, SHIELD];
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

function game(players = 1): GameState {
  return newGame({ players, deps, extraCards: EXTRA, deck: [...DEFAULT_DECK, ...EXTRA.flatMap((card) => copies(card.id, 2))] });
}

/** Test surgery: a card from `player`'s deck put straight into play under their control. */
function inPlay(state: GameState, player: PlayerId, card: CardId): { readonly state: GameState; readonly id: InstanceId } {
  const given = giveCard(state, player, card);
  const s = given.state;
  return {
    id: given.id,
    state: {
      ...s,
      players: s.players.map((p) => (p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== given.id), playArea: [...p.playArea, given.id] } : p)),
      instances: { ...s.instances, [given.id]: { ...mustInstance(s, given.id), faceup: true, controllerId: player } },
    },
  };
}

const withDamage = (state: GameState, id: InstanceId, damage: number, tough = false): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage, statuses: { stunned: 0, confused: 0, tough: tough ? 1 : 0 } } },
});

/** p1 plays `card` for 0; stops at the first choice (if any). */
function play(state: GameState, card: CardId) {
  const given = giveCard(state, p1, card);
  const result = applyCommand(given.state, { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }, deps);
  if (!result.ok) throw new Error(result.error.message);
  return { state: result.state, events: result.events };
}

const identityOf = (state: GameState, player: PlayerId = p1) => mustPlayer(state, player).identity.instanceId;
const damageEvents = (events: readonly GameEvent[]) => events.filter((e) => e.type === "damageDealt");

describe("§3.7 indirect damage", () => {
  it("the player divides it, each character capped at its remaining hit points", () => {
    const start = game();
    const ally = inPlay(start, p1, ALLY.id);
    const hero = identityOf(ally.state);
    const primed = withDamage(withDamage(ally.state, hero, 7), ally.id, 1);

    const { state } = play(primed, FOUR.card.id);
    const choice = state.pendingChoice;
    expect(choice).toMatchObject({
      playerId: p1,
      authority: "player",
      prompt: { kind: "assignIndirectDamage", amount: 4, caps: { [hero]: 3, [ally.id]: 2 } },
      minSelections: 4,
      maxSelections: 4,
    });
    expect(choice?.options.map((o) => o.optionId)).toEqual([`${hero}#1`, `${hero}#2`, `${hero}#3`, `${ally.id}#1`, `${ally.id}#2`]);

    const after = settle(resolvePending(state, [`${hero}#1`, `${hero}#2`, `${ally.id}#1`, `${ally.id}#2`], deps), undefined, deps);
    expect(mustInstance(after, hero).damage).toBe(9);
    // Assigned exactly its remaining hit points: defeated.
    expect(mustPlayer(after, p1).discard).toContain(ally.id);
  });

  it("a split with one eligible character is made without asking", () => {
    const { state, events } = play(game(), TWO.card.id);
    expect(state.pendingChoice).toBeNull();
    expect(mustInstance(state, identityOf(state)).damage).toBe(2);
    expect(damageEvents(events)).toHaveLength(1);
  });

  it("a tough character can be assigned up to its remaining hit points, and all of it is prevented", () => {
    const start = game();
    const ally = inPlay(start, p1, ALLY.id);
    const primed = withDamage(ally.state, ally.id, 0, true);
    const { state } = play(primed, FOUR.card.id);
    expect(state.pendingChoice?.prompt).toMatchObject({ caps: { [ally.id]: 3 } });
    const hero = identityOf(state);
    const after = settle(resolvePending(state, [`${ally.id}#1`, `${ally.id}#2`, `${ally.id}#3`, `${hero}#1`], deps), undefined, deps);
    expect(mustInstance(after, ally.id)).toMatchObject({ damage: 0, statuses: { tough: 0 } });
    expect(mustInstance(after, hero).damage).toBe(1);
  });

  it("characters that cannot take damage are not offered, and damage nobody can take is ignored", () => {
    const withAlly = inPlay(game(), p1, ALLY.id);
    const warded = inPlay(withAlly.state, p1, WARD.id).state;
    const { state } = play(warded, TWO.card.id);
    expect(state.pendingChoice).toBeNull();
    expect(mustInstance(state, withAlly.id).damage).toBe(0);
    expect(mustInstance(state, identityOf(state)).damage).toBe(2);

    // "If indirect damage dealt to a player cannot be assigned to any character that player controls, that damage is
    // ignored": no choice, no damage, no damage group.
    const fortified = inPlay(withAlly.state, p1, FORTRESS.id).state;
    const { state: ignored, events } = play(fortified, FOUR.card.id);
    expect(ignored.pendingChoice).toBeNull();
    expect(damageEvents(events)).toEqual([]);
    expect(events.some((e) => e.type === "framePushed" && e.frame === "damageGroup")).toBe(false);
    expect(mustInstance(ignored, identityOf(ignored)).damage).toBe(0);
  });

  it("the damage resolves simultaneously: every response sees every character already damaged", () => {
    const withAlly = inPlay(game(), p1, ALLY.id);
    const watching = inPlay(withAlly.state, p1, WATCH.id);
    const { state } = play(watching.state, TWO.card.id);
    const hero = identityOf(state);
    const after = settle(resolvePending(state, [`${hero}#1`, `${withAlly.id}#1`], deps), undefined, deps);
    expect(mustInstance(after, hero).damage).toBe(1);
    expect(mustInstance(after, withAlly.id).damage).toBe(1);
    // Two responses, each counting both damaged characters (one at a time would count 1 then 2).
    expect(mustInstance(after, watching.id).counters.damagedSeen).toBe(4);
  });

  it("a reduction applies to the indirect damage assigned to that character (ruling, Aug 3, 2026 (2))", () => {
    const withAlly = inPlay(game(), p1, ALLY.id);
    const shielded = inPlay(withAlly.state, p1, SHIELD.id).state;
    const { state } = play(shielded, TWO.card.id);
    const after = settle(resolvePending(state, [`${withAlly.id}#1`, `${withAlly.id}#2`], deps), undefined, deps);
    expect(mustInstance(after, withAlly.id).damage).toBe(1);
  });

  it("'each player' asks each player for their own division, addressed to that player", () => {
    const start = game(2);
    const p2Ally = inPlay(start, p2, ALLY.id);
    const { state } = play(p2Ally.state, EACH_TWO.card.id);
    // p1 has only their identity: no question. p2 has an ally: p2 decides.
    expect(state.pendingChoice).toMatchObject({ playerId: p2, authority: "player", prompt: { kind: "assignIndirectDamage", amount: 2 } });
    const after = expectOk(
      applyCommand(state, { type: "resolveChoice", playerId: p2, choiceId: state.pendingChoice?.choiceId as never, selectedOptionIds: [`${p2Ally.id}#1`, `${p2Ally.id}#2`] }, deps),
    );
    expect(mustInstance(after, identityOf(after, p1)).damage).toBe(2);
    expect(mustInstance(after, identityOf(after, p2)).damage).toBe(0);
    expect(mustInstance(after, p2Ally.id).damage).toBe(2);
  });
});
