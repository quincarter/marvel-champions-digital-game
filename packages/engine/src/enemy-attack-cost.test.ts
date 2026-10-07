/**
 * docs/phase7-wave7.md §3.19 (b): an enemy's attack as the cost of a player's ability (`AbilityCost.enemyAttack`,
 * `enemy-attack-cost.ts`). Synthetic cards shaped like "Hero Action: Attached villain attacks you → discard this
 * card", an encounter attachment on the villain (or on a minion).
 *
 * - The attack is paid in full before the effect (RRG 1.8 "Cost Arrow Icon", p. 14): boost card, defender, the boost
 *   card's Boost ability, damage and the "after [enemy] attacks" abilities (RRG 1.8 "Attack (Enemy Activation)",
 *   pp. 8–9), and only then is the card discarded.
 * - Owner decision §4.1 Q13 = B: while the enemy could not attack (stunned, RRG 1.8 "Stun, Stunned", p. 41; "cannot
 *   activate"; a dashed ATK) the ability is not offered and a command to use it is rejected, the stun not spent.
 * - Alter-ego form: an ability can make an enemy attack an alter-ego (RRG 1.8 "Attack (Enemy Activation)", p. 8), so
 *   it is the "Hero Action" label that keeps the ability from an alter-ego, not the cost.
 * - An attack an interrupt cancels was not made (RRG 1.8 "Cancel", p. 11), so the cost is not paid and the effect does
 *   not resolve (engine reading of "paid and/or resolved in full", p. 14); one another player defends was made.
 * - The paying player defeated by the attack: the cost is paid, and the effect still resolves (the card, on the
 *   villain, is not in the eliminated player's play area; RRG 1.8 "Player Elimination", p. 34).
 *
 * No FFG ruling on this cost in the post-RRG 1.7 rulings transcript.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeck, activeVillain, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubAttachment,
  stubEnvironment,
  stubMinion,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, fromHand, giveCard, RESOURCE, withEncounterPiles } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const count = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "self" },
  counterType,
  amount: one,
});
const attackCost: AbilityCost = { enemyAttack: { enemy: { kind: "host" }, against: "you" } };
const discardThis: EffectSpec = { kind: "discardFromPlay", target: { kind: "self" } };

/** "Hero Action: Attached villain attacks you → discard this card." */
const LIMIT_ACTION = stubAbility("limit.action", {
  trigger: { kind: "action", form: "hero" },
  cost: attackCost,
  effects: [discardThis],
});
/** The same with a resource to spend as well: "Hero Action: Spend 1 resource and attached villain attacks you → …". */
const PRICED_ACTION = stubAbility("priced.action", {
  trigger: { kind: "action", form: "hero" },
  cost: { ...attackCost, resources: 1 },
  effects: [discardThis],
});
const LIMIT = stubAttachment({ id: "limit", abilities: [LIMIT_ACTION.ref] });
const PRICED = stubAttachment({ id: "priced", abilities: [PRICED_ACTION.ref] });

/** The boost card: 2 boost icons and "Boost: place 1 'boosted' counter here" (so its Boost ability is seen to resolve). */
const TWO_BOOST = stubAbility("two.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "addCounters", target: { kind: "villain" }, counterType: "boosted", amount: one }],
});
const TWO = stubTreachery({ id: "two", boostIcons: 2, abilities: [TWO_BOOST.ref] });
/** A player card: "Forced Response: After an enemy attacks you, place 1 counter here." */
const WATCH_RESPONSE = stubAbility("watch.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [count("attacked")],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_RESPONSE.ref] });
/** An encounter card: "Forced Response: After an enemy attacks, place 1 counter here." */
const OMEN_RESPONSE = stubAbility("omen.response", {
  trigger: { kind: "response", forced: true, on: { on: "enemyAttack" } },
  effects: [count("attacks")],
});
const OMEN = stubEnvironment({ id: "omen", abilities: [OMEN_RESPONSE.ref] });
/** A player card: "Forced Interrupt: When an enemy attacks you, cancel that attack." */
const NOPE_INTERRUPT = stubAbility("nope.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [{ kind: "cancelTriggeringEvent" }],
});
const NOPE = stubSupport({ id: "nope", cost: 0, abilities: [NOPE_INTERRUPT.ref] });
/** An encounter card: "Enemies cannot activate." */
const SNARE_RULE = stubAbility("snare.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotActivate", target: { categories: ["enemy"] } }] },
  effects: [],
});
const SNARE = stubEnvironment({ id: "snare", abilities: [SNARE_RULE.ref] });
const THUG = stubMinion({ id: "thug", atk: 3, sch: 1, hp: 5 });
/** A minion with a dashed ATK, which never attacks. */
const SCHEMER = stubMinion({ id: "schemer", atk: null, sch: 1, hp: 5 });
const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 2, sch: 1 }] });

const ABILITIES: readonly StubAbility[] = [
  LIMIT_ACTION,
  PRICED_ACTION,
  TWO_BOOST,
  WATCH_RESPONSE,
  OMEN_RESPONSE,
  NOPE_INTERRUPT,
  SNARE_RULE,
];
const deps: EngineDeps = depsOf(...ABILITIES);

const heroOf = (state: GameState, player: PlayerId = P1): InstanceId => mustPlayer(state, player).identity.instanceId;
const villainId = (state: GameState): InstanceId => activeVillain(state).instanceId;

/** Surgery: an encounter attachment on `host` (no reveal). */
function attach(state: GameState, card: typeof LIMIT, host: InstanceId): { state: GameState; id: InstanceId } {
  const taken = encounterCardInVillainArea(state, card.id);
  return {
    id: taken.id,
    state: {
      ...taken.state,
      villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
      instances: {
        ...taken.state.instances,
        [taken.id]: { ...mustInstance(taken.state, taken.id), attachedTo: host },
        [host]: {
          ...mustInstance(taken.state, host),
          attachments: [...mustInstance(taken.state, host).attachments, taken.id],
        },
      },
    },
  };
}

/** Surgery: `amount` of a status, or of damage, on a card. */
const withInstance = (state: GameState, id: InstanceId, patch: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...patch } },
});

/**
 * P1 (hero: 10 hit points, DEF 2) at their first turn against a villain with ATK 2 and the attachment on it; the
 * encounter deck is nothing but the 2-icon boost card, so the villain's attack is for 4.
 */
function table(players: 1 | 2 = 1, card: typeof LIMIT = LIMIT) {
  const started = gameAtFirstTurn({
    players,
    villain: BOSS,
    cards: [LIMIT, PRICED, TWO, WATCH, OMEN, NOPE, SNARE, THUG, SCHEMER],
    deps,
    encounter: [LIMIT.id, PRICED.id, OMEN.id, SNARE.id, THUG.id, SCHEMER.id, ...copiesOf(TWO.id, 20)],
    deck: [WATCH.id, NOPE.id],
  });
  const attached = attach(started, card, villainId(started));
  return { state: attached.state, limit: attached.id };
}

/** The encounter deck cut down to its boost cards, whatever the setup shuffle did (done as each test starts playing). */
const boostDeck = (state: GameState): GameState =>
  withEncounterPiles(state, {
    deck: activeEncounterDeck(state).deck.filter((id) => state.instances[id]?.cardId === TWO.id),
  });

const toHero = (player: PlayerId = P1): Command => ({ type: "changeForm", playerId: player });
const use = (source: InstanceId, ability: StubAbility = LIMIT_ACTION, payment: readonly Payment[] = []): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: source,
  abilityId: ability.ref.id,
  payment,
});

/** Declares `defender` for every attack (else no defense), answering everything else by default. */
const defendingWith =
  (defender: InstanceId | null) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender" && defender ? [defender] : defaultPick(state);

const play = (state: GameState, commands: readonly Command[], defender: InstanceId | null = null) =>
  runCommandsPicking(boostDeck(state), deps, defendingWith(defender), ...commands);

const offered = (state: GameState, source: InstanceId): boolean => {
  const legal = legalActions(state, P1, deps);
  return (
    legal.kind === "turn" &&
    legal.legal.some(({ action }) => action.kind === "useAbility" && action.instanceId === source)
  );
};
const at = (events: readonly GameEvent[], match: (event: GameEvent) => boolean): number => events.findIndex(match);
const inEncounterDiscard = (state: GameState, id: InstanceId): boolean =>
  activeEncounterDeck(state).discard.includes(id);
const settled = (events: readonly GameEvent[]) => events.filter((event) => event.type === "enemyAttackCostSettled");

describe("§3.19 (b) an enemy's attack as a cost", () => {
  it("is offered to a hero while the attached villain can attack", () => {
    const { state, limit } = table();
    const hero = play(state, [toHero()]).state;
    expect(offered(hero, limit)).toBe(true);
  });

  it("the villain attacks the player with a boost card, undefended, and then the card is discarded", () => {
    const { state, limit } = table();
    const { state: after, events, session } = play(state, [toHero(), use(limit)]);
    // ATK 2 + 2 boost icons, undefended.
    expect(mustInstance(after, heroOf(after)).damage).toBe(4);
    expect(mustInstance(after, villainId(after)).counters.boosted).toBe(1);
    expect(mustInstance(after, villainId(after)).boostCards).toEqual([]);
    expect(mustInstance(after, villainId(after)).attachments).toEqual([]);
    expect(inEncounterDiscard(after, limit)).toBe(true);
    expect(settled(events)).toEqual([
      {
        type: "enemyAttackCostSettled",
        instanceId: limit,
        playerId: P1,
        enemyInstanceId: villainId(after),
        paid: true,
      },
    ]);
    // Boost card, damage, the cost settled, then the effect.
    const order = [
      at(events, (e) => e.type === "boostCardDealt"),
      at(events, (e) => e.type === "boostCardFlipped"),
      at(events, (e) => e.type === "damageDealt"),
      at(events, (e) => e.type === "enemyAttackCostSettled"),
      at(events, (e) => e.type === "cardDiscardedFromPlay" && e.instanceId === limit),
    ];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after);
  });

  it("the player may defend: the hero exhausts and its DEF reduces the damage", () => {
    const { state, limit } = table();
    const hero = heroOf(state);
    const { state: after } = play(state, [toHero(), use(limit)], hero);
    expect(mustInstance(after, hero).damage).toBe(2);
    expect(mustInstance(after, hero).exhausted).toBe(true);
    expect(inEncounterDiscard(after, limit)).toBe(true);
  });

  it('"after an enemy attacks you" and "after an enemy attacks" responses resolve before the effect', () => {
    const { state, limit } = table();
    const watch = playerCardIntoPlay(state, WATCH.id);
    const omen = encounterCardInVillainArea(watch.state, OMEN.id);
    const { state: after, events } = play(omen.state, [toHero(), use(limit)]);
    expect(mustInstance(after, watch.id).counters.attacked).toBe(1);
    expect(mustInstance(after, omen.id).counters.attacks).toBe(1);
    const discarded = at(events, (e) => e.type === "cardDiscardedFromPlay" && e.instanceId === limit);
    const responses = events
      .map((event, index) => (event.type === "counterAdded" ? index : -1))
      .filter((index) => index >= 0);
    expect(responses.length).toBeGreaterThanOrEqual(2);
    expect(discarded).toBeGreaterThan(Math.max(...responses));
  });

  it("is not offered, and is rejected, while the villain is stunned; the stun is not spent", () => {
    const { state, limit } = table();
    const stunned = withInstance(state, villainId(state), {
      statuses: { ...mustInstance(state, villainId(state)).statuses, stunned: 1 },
    });
    const hero = play(stunned, [toHero()]).state;
    expect(offered(hero, limit)).toBe(false);
    const result = applyCommand(hero, use(limit), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    expect(mustInstance(hero, villainId(hero)).statuses.stunned).toBe(1);
    expect(mustInstance(hero, limit).attachedTo).toBe(villainId(hero));
    expect(mustInstance(hero, heroOf(hero)).damage).toBe(0);
  });

  it('is not offered, and is rejected, while the villain "cannot activate"', () => {
    const { state, limit } = table();
    const snared = encounterCardInVillainArea(state, SNARE.id).state;
    const hero = play(snared, [toHero()]).state;
    expect(offered(hero, limit)).toBe(false);
    const result = applyCommand(hero, use(limit), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    expect(mustInstance(hero, limit).attachedTo).toBe(villainId(hero));
  });

  it('in alter-ego form the "Hero Action" is not offered and is rejected for the form, not the cost', () => {
    const { state, limit } = table();
    expect(mustPlayer(state, P1).identity.form).toBe("alterEgo");
    expect(offered(state, limit)).toBe(false);
    const result = applyCommand(state, use(limit), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("wrong_form");
  });

  it("an attack an interrupt cancels does not pay the cost: no damage, and the card stays", () => {
    const { state, limit } = table();
    const nope = playerCardIntoPlay(state, NOPE.id);
    const { state: after, events } = play(nope.state, [toHero(), use(limit)]);
    expect(mustInstance(after, heroOf(after)).damage).toBe(0);
    expect(mustInstance(after, limit).attachedTo).toBe(villainId(after));
    expect(settled(events)).toEqual([
      {
        type: "enemyAttackCostSettled",
        instanceId: limit,
        playerId: P1,
        enemyInstanceId: villainId(after),
        paid: false,
      },
    ]);
    expect(events.some((e) => e.type === "cardDiscardedFromPlay" && e.instanceId === limit)).toBe(false);
  });

  it("another player may defend: they take the damage, and the cost is still paid", () => {
    const { state, limit } = table(2);
    const ally = heroOf(state, P2);
    // P2 is in hero form too, so their hero can defend.
    const ready = withIdentityForm(state, P2);
    const { state: after } = play(ready, [toHero(), use(limit)], ally);
    expect(mustInstance(after, heroOf(after)).damage).toBe(0);
    expect(mustInstance(after, ally).damage).toBe(2);
    expect(mustInstance(after, ally).exhausted).toBe(true);
    expect(inEncounterDiscard(after, limit)).toBe(true);
  });

  it("the player defeated by the attack has paid the cost, and the card is still discarded", () => {
    const { state, limit } = table(2);
    const wounded = withInstance(state, heroOf(state), { damage: 9 });
    const { state: after, events } = play(wounded, [toHero(), use(limit)]);
    expect(mustPlayer(after, P1).eliminated).toBe(true);
    expect(after.outcome).toBeNull();
    expect(settled(events).map((event) => event.type === "enemyAttackCostSettled" && event.paid)).toEqual([true]);
    expect(mustInstance(after, villainId(after)).attachments).toEqual([]);
    expect(inEncounterDiscard(after, limit)).toBe(true);
  });

  it("a minion as the attached enemy attacks the same way, with no boost card", () => {
    const { state } = table();
    const thug = minionEngagedWith(state, THUG.id);
    // A second copy of the attachment's shape, on the minion.
    const onMinion = attach(thug.state, PRICED, thug.id);
    const hand = giveCard(onMinion.state, P1, RESOURCE.id);
    const { state: after, events } = play(hand.state, [toHero(), use(onMinion.id, PRICED_ACTION, fromHand(hand.id))]);
    expect(mustInstance(after, heroOf(after)).damage).toBe(3);
    expect(events.some((e) => e.type === "boostCardDealt")).toBe(false);
    expect(mustInstance(after, thug.id).attachments).toEqual([]);
    expect(inEncounterDiscard(after, onMinion.id)).toBe(true);
  });

  it("is not offered while the attached enemy has a dashed ATK", () => {
    const { state } = table();
    const schemer = minionEngagedWith(state, SCHEMER.id);
    const onMinion = attach(schemer.state, PRICED, schemer.id);
    const hand = giveCard(onMinion.state, P1, RESOURCE.id);
    const hero = play(hand.state, [toHero()]).state;
    expect(offered(hero, onMinion.id)).toBe(false);
    const result = applyCommand(hero, use(onMinion.id, PRICED_ACTION, fromHand(hand.id)), deps);
    expect(result.ok).toBe(false);
    expect(mustPlayer(hero, P1).hand).toContain(hand.id);
  });

  it("with a resource cost as well, the resource is spent first, then the attack, then the effect", () => {
    const { state, limit } = table(1, PRICED);
    const hand = giveCard(state, P1, RESOURCE.id);
    const hero = play(hand.state, [toHero()]).state;
    expect(offered(hero, limit)).toBe(true);
    // Unpaid, nothing happens: no attack.
    const unpaid = applyCommand(hero, use(limit, PRICED_ACTION), deps);
    expect(unpaid.ok).toBe(false);
    if (!unpaid.ok) expect(unpaid.error.code).toBe("insufficient_resources");

    const { state: after, events } = play(hero, [use(limit, PRICED_ACTION, fromHand(hand.id))]);
    expect(locateCard(after, hand.id)).toEqual({ kind: "discard", playerId: P1 });
    expect(mustInstance(after, heroOf(after)).damage).toBe(4);
    expect(inEncounterDiscard(after, limit)).toBe(true);
    const order = [
      at(events, (e) => e.type === "cardDiscardedFromHand" && e.instanceId === hand.id),
      at(events, (e) => e.type === "boostCardDealt"),
      at(events, (e) => e.type === "enemyAttackCostSettled"),
      at(events, (e) => e.type === "cardDiscardedFromPlay" && e.instanceId === limit),
    ];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("a stunned villain keeps a resource cost unspent too: the whole cost is refused", () => {
    const { state, limit } = table(1, PRICED);
    const hand = giveCard(state, P1, RESOURCE.id);
    const stunned = withInstance(hand.state, villainId(state), {
      statuses: { ...mustInstance(state, villainId(state)).statuses, stunned: 1 },
    });
    const hero = play(stunned, [toHero()]).state;
    expect(offered(hero, limit)).toBe(false);
    expect(applyCommand(hero, use(limit, PRICED_ACTION, fromHand(hand.id)), deps).ok).toBe(false);
    expect(mustPlayer(hero, P1).hand).toContain(hand.id);
    expect(mustInstance(hero, villainId(hero)).statuses.stunned).toBe(1);
  });
});

/** Surgery: `player`'s identity in hero form (off their turn, where no command flips it). */
function withIdentityForm(state: GameState, player: PlayerId): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, identity: { ...p.identity, form: "hero" as const } } : p,
    ),
  };
}
