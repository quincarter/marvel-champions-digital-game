/**
 * docs/phase7-wave1.md §3.9: boost cards as events, proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Boost" (p. 11: the Boost ability resolves "when the card is turned face up … After applying a boost
 * card to an activation, discard it"), "Attack (Enemy Activation)" step 3 (p. 9), "Scheme (Enemy Activation)" step 2
 * (p. 38); FAQ "Attacrobatics (#6)" (p. 59); Green Goblin insert, "Goblin Minions Activation Timing".
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "./testing/scenario.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const theVillain = { kind: "villain" } as const;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});

const boost = (id: string, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(`${id}.boost`, { trigger: { kind: "boost" }, effects });
const BOOSTED = boost("two", [{ kind: "addCounters", target: theVillain, counterType: "boosted", amount: one }]);
const TWO = stubTreachery({ id: "two", boostIcons: 2, abilities: [BOOSTED.ref] });
const ZERO = stubTreachery({ id: "zero", boostIcons: 0 });
/** Goblin Knight: "Boost: After this activation ends, shuffle this card into the encounter deck." */
const KNIGHT_BOOST = boost("knight", [
  {
    kind: "atEndOfActivation",
    effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "encounterDeckShuffle" }],
  },
]);
const KNIGHT = stubTreachery({ id: "knight", boostIcons: 1, abilities: [KNIGHT_BOOST.ref] });
/** Goblin Thrall: "Boost: Put Goblin Thrall into play engaged with you." */
const THRALL_BOOST = boost("thrall", [{ kind: "putIntoPlay", card: self, controller: { kind: "controller" } }]);
const THRALL = stubMinion({ id: "thrall", atk: 1, sch: 1, hp: 5, boostIcons: 1, abilities: [THRALL_BOOST.ref] });
/** I've Been Waiting For This!'s shape (The Wrecking Crew): "Boost: … That villain schemes." — a whole activation inside another's boost step. */
const CHAIN_BOOST = boost("chain", [{ kind: "enemyScheme", enemies: theVillain }]);
const CHAIN = stubTreachery({ id: "chain", boostIcons: 1, abilities: [CHAIN_BOOST.ref] });
/** I See You's shape: "This card gets +1 boost icon if [the first player is in hero form]." */
const SEES_CONSTANT = stubAbility("sees.constant", {
  trigger: {
    kind: "constant",
    modifiers: [
      {
        stat: "boostIcons",
        amount: 1,
        target: { self: true },
        while: { kind: "form", player: { kind: "firstPlayer" }, form: "hero" },
      },
    ],
  },
  effects: [],
});
const SEES = stubTreachery({ id: "sees", boostIcons: 1, abilities: [SEES_CONSTANT.ref] });

/** Attacrobatics' shape: "When a boost card is turned faceup [while the villain attacks], cancel the boost icons on that card. Deal 1 damage to the villain for each boost icon canceled this way." */
const ACRO_INTERRUPT = stubAbility("acro.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "boostCardTurnedFaceup", activation: "attack", eventAtLeast: { boostIcons: 1 } },
  },
  effects: [
    { kind: "cancelBoostIcons", bind: "cancelled" },
    { kind: "dealDamage", target: theVillain, amount: { kind: "var", name: "cancelled.amount" } },
  ],
});
const ACRO = stubSupport({ id: "acro", cost: 0, abilities: [ACRO_INTERRUPT.ref] });
/** Foiled!'s shape: cancel the icons "during a scheme activation". */
const FOIL_INTERRUPT = stubAbility("foil.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "boostCardTurnedFaceup", activation: "scheme", eventAtLeast: { boostIcons: 1 } },
  },
  effects: [{ kind: "cancelBoostIcons" }],
});
const FOIL = stubSupport({ id: "foil", cost: 0, abilities: [FOIL_INTERRUPT.ref] });
/** Target Acquired's shape: "After a boost card is turned faceup, … cancel that card's boost ability." */
const TARGET_RESPONSE = stubAbility("target.response", {
  trigger: { kind: "response", forced: true, on: { on: "boostCardTurnedFaceup" } },
  effects: [{ kind: "cancelBoostAbility" }],
});
const TARGET = stubSupport({ id: "target", cost: 0, abilities: [TARGET_RESPONSE.ref] });

const deps: EngineDeps = depsOf(
  BOOSTED,
  KNIGHT_BOOST,
  THRALL_BOOST,
  CHAIN_BOOST,
  SEES_CONSTANT,
  ACRO_INTERRUPT,
  FOIL_INTERRUPT,
  TARGET_RESPONSE,
);
const SUPPORTS: readonly AnyCard[] = [ACRO, FOIL, TARGET];

/** p1's first turn; `top` is the first encounter card (the villain's first boost card), `supports` are in p1's play area. */
function game(top: AnyCard, supports: readonly AnyCard[] = []): GameState {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [TWO, ZERO, KNIGHT, THRALL, SEES, CHAIN, ...SUPPORTS],
    encounterDeck: [TWO.id, KNIGHT.id, THRALL.id, SEES.id, CHAIN.id, ...copies(ZERO.id, 12)],
    deck: [...DEFAULT_DECK, ...SUPPORTS.map((card) => card.id)],
    deps,
  });
  const deck = activeEncounterDeck(start).deck;
  const topId = deck.find((id) => start.instances[id]?.cardId === top.id);
  if (!topId) throw new Error(`no ${top.id}`);
  let state = withEncounterPiles(start, { deck: [topId, ...deck.filter((id) => id !== topId)] });
  for (const card of supports) {
    const given = giveCard(state, p1, card.id);
    state = runCommands(given.state, deps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
  }
  return state;
}

const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const villainId = (state: GameState) => activeVillain(state).instanceId;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainAttack = (events: readonly GameEvent[], villain: InstanceId) =>
  ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === villain);
const villainThreat = (events: readonly GameEvent[], villain: InstanceId) =>
  ofType(events, "threatPlaced").filter((e) => e.sourceInstanceId === villain);
const cardIdOf = (state: GameState, id: InstanceId) => state.instances[id]?.cardId;

describe("§3.9 boost cards as events", () => {
  it("'When a boost card is turned faceup': cancelling its icons counts them for the ability, and its Boost ability still resolves", () => {
    const { state, events } = runCommands(game(TWO, [ACRO]), deps, toHero, endTurn);
    const villain = villainId(state);
    expect(villainAttack(events, villain)).toEqual([
      expect.objectContaining({ baseAtk: 1, boostIcons: 0, damageDealt: 1 }),
    ]);
    expect(mustInstance(state, villain).damage).toBe(2);
    expect(mustInstance(state, villain).counters.boosted).toBe(1);
    expect(ofType(events, "boostCancelled")).toEqual([expect.objectContaining({ scope: "icons" })]);
  });

  it("a Boost that makes the same villain scheme again (I've Been Waiting For This!) nests one full activation and never re-flips the card that started it", () => {
    const { state, events } = runCommands(game(CHAIN), deps, endTurn);
    const villain = villainId(state);
    // Two flips, two cards: the chaining card for the outer scheme, one fresh boost for the nested one. Before the
    // fix the nested scheme's flip step found the outer card (still faceup in `boostCards`) first and resolved its
    // Boost again, nesting another scheme, until the command was rejected for never settling.
    const flipped = ofType(events, "boostCardFlipped").filter((e) => e.enemyInstanceId === villain);
    expect(flipped.map((e) => cardIdOf(state, e.instanceId))).toEqual([CHAIN.id, ZERO.id]);
    expect(ofType(events, "schemeResolved").filter((e) => e.enemyInstanceId === villain)).toHaveLength(2);
    // Both boost cards were discarded when their activations ended.
    expect(mustInstance(state, villain).boostCards).toEqual([]);
  });

  it("a boost card with no icons offers nothing to cancel (FAQ 'Attacrobatics (#6)', p. 59)", () => {
    const { state, events } = runCommands(game(ZERO, [ACRO]), deps, toHero, endTurn);
    expect(ofType(events, "boostCancelled")).toEqual([]);
    expect(mustInstance(state, villainId(state)).damage).toBe(0);
  });

  it("a cancel 'during a scheme activation' fires only on a scheme", () => {
    const scheming = runCommands(game(TWO, [FOIL]), deps, endTurn);
    expect(villainThreat(scheming.events, villainId(scheming.state))).toEqual([expect.objectContaining({ amount: 1 })]);
    const attacking = runCommands(game(TWO, [FOIL]), deps, toHero, endTurn);
    expect(villainAttack(attacking.events, villainId(attacking.state))).toEqual([
      expect.objectContaining({ boostIcons: 2 }),
    ]);
  });

  it("'After a boost card is turned faceup … cancel that card's boost ability': its icons still count", () => {
    const { state, events } = runCommands(game(TWO, [TARGET]), deps, toHero, endTurn);
    const villain = villainId(state);
    expect(mustInstance(state, villain).counters.boosted).toBeUndefined();
    expect(villainAttack(events, villain)).toEqual([expect.objectContaining({ boostIcons: 2, damageDealt: 3 })]);
    expect(ofType(events, "boostCancelled")).toEqual([expect.objectContaining({ scope: "ability" })]);
  });

  it("a Boost ability resolves before its card is discarded (RRG 1.8 'Boost', p. 11)", () => {
    const { state, events } = runCommands(game(TWO), deps, toHero, endTurn);
    const boostId = ofType(events, "boostCardFlipped")[0]?.instanceId as InstanceId;
    expect(cardIdOf(state, boostId)).toBe(TWO.id);
    const resolved = events.findIndex((e) => e.type === "counterAdded" && e.counterType === "boosted");
    const discarded = events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === boostId && e.to.kind === "encounterDiscard",
    );
    expect(resolved).toBeGreaterThanOrEqual(0);
    expect(resolved).toBeLessThan(discarded);
  });

  it("'After this activation ends, shuffle this card into the encounter deck' runs after the activation's responses", () => {
    const { state, events } = runCommands(game(KNIGHT), deps, toHero, endTurn);
    const villain = villainId(state);
    const knight = ofType(events, "boostCardFlipped").find((e) => cardIdOf(state, e.instanceId) === KNIGHT.id)
      ?.instanceId as InstanceId;
    const attackResolved = events.findIndex(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "resolved" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === villain,
    );
    const shuffledIn = events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === knight && e.to.kind === "encounterDeck",
    );
    expect(attackResolved).toBeGreaterThanOrEqual(0);
    expect(shuffledIn).toBeGreaterThan(attackResolved);
  });

  it("a boost that puts its own minion into play engages it, and it activates in the same step (Green Goblin insert)", () => {
    const { state, events, session } = runCommands(game(THRALL), deps, toHero, endTurn);
    const thrall = ofType(events, "boostCardFlipped").find((e) => cardIdOf(state, e.instanceId) === THRALL.id)
      ?.instanceId as InstanceId;
    expect(mustPlayer(state, p1).playArea).toContain(thrall);
    expect(ofType(events, "enemyActivated").filter((e) => e.enemyInstanceId === thrall)).toEqual([
      { type: "enemyActivated", enemyInstanceId: thrall, activation: "attack", playerId: p1 },
    ]);
    expect(
      events.some((e) => e.type === "cardMoved" && e.instanceId === thrall && e.to.kind === "encounterDiscard"),
    ).toBe(false);
    // Its icon still counted for the villain's attack.
    expect(villainAttack(events, villainId(state))).toEqual([expect.objectContaining({ boostIcons: 1 })]);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("'This card gets +1 boost icon if …' is read from the boost card itself", () => {
    const hero = runCommands(game(SEES), deps, toHero, endTurn);
    expect(villainAttack(hero.events, villainId(hero.state))).toEqual([expect.objectContaining({ boostIcons: 2 })]);
    const alterEgo = runCommands(game(SEES), deps, endTurn);
    expect(villainThreat(alterEgo.events, villainId(alterEgo.state))).toEqual([expect.objectContaining({ amount: 2 })]);
  });
});
