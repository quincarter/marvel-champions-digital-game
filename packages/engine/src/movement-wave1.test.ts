/**
 * docs/phase7-wave1.md §3.13: card movement and placement — returning a played event to hand, moving a card as it is
 * defeated, setting a hit point dial, threat on a non-scheme card, engaging an enemy, reordering the top of the
 * encounter deck, facedown attachments, damage that ignores tough, per-instance event modifiers, an ally's power
 * added to a basic power, and a consequential damage modifier. Proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Engage" (p. 18), "Event" (p. 19), "Hit Points" (p. 22), "Deck" (p. 15), "Tough" (p. 44),
 * "Thwart" (p. 44); errata "Lightning Strike (#6)" (p. 65); FAQ "Embiggen (#10)" / "Shrink (#11)" (p. 59).
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, characterProfile, mustInstance, mustPlayer, currentName } from "./query.js";
import { activeAbilityRefs, selectTargets } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubEvent, stubIdentity, stubMainScheme, stubMinion, stubSupport, stubTreachery, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO, seatIdentities, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const villainRef: TargetRef = { kind: "villain" };
const eventTarget: TargetRef = { kind: "eventTarget" };
const num = (value: number): ValueSpec => ({ kind: "const", value });
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const AERIAL = trait("Aerial");

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(50), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({ id: "long", stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }] });
const TOUGH_MINION = stubMinion({ id: "tough-minion", atk: 0, sch: 0, hp: 9, boostIcons: 0, keywords: [{ name: "toughness" }] });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 9, boostIcons: 0 });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

// --- the cards under test ---------------------------------------------------------------------------------------

/** Morphogenetics: "After you play an [Attack] event, … return that event to your hand." */
const RETURN_EVENT = stubAbility("morphogenetics.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardPlayed", playerIs: "controller" } },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: eventTarget, filter: { categories: ["event"] } }, to: "hand" }],
});
const MORPHO = stubSupport({ id: "morpho", cost: 0, abilities: [RETURN_EVENT.ref] });
const PLAIN_EVENT = action("plain-event", [{ kind: "addCounters", target: yourIdentity, counterType: "played", amount: num(1) }]);
/** Damage dealt through a real effect, so the defeat sweep runs (a hand-edited damage total never triggers one). */
const ZAP_ALLY = action("zap-ally", [{ kind: "dealDamage", target: { kind: "each", query: { categories: ["ally"] } }, amount: num(2) }]);
const SELF_HARM = action("self-harm", [{ kind: "dealDamage", target: yourIdentity, amount: num(10) }]);

/** Clea: "When Clea is defeated, shuffle her into her owner's deck." */
const CLEA_INTERRUPT = stubAbility("clea.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: "deckShuffle" }] }],
});
const CLEA = stubAlly({ id: "clea", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [CLEA_INTERRUPT.ref] });

/** Captain America's Helmet: "When Captain America would be defeated, set his hit point dial to 1 instead. Then, discard this card." */
const HELMET_INTERRUPT = stubAbility("helmet.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["identity"], controller: "you" } } },
  effects: [
    { kind: "replaceTriggeringEvent", with: [{ kind: "setRemainingHitPoints", target: eventTarget, amount: num(1) }] },
    { kind: "discardFromPlay", target: self },
  ],
});
const HELMET = stubUpgrade({ id: "helmet", cost: 0, abilities: [HELMET_INTERRUPT.ref] });

/** Beat Cop: "move 1 threat from a scheme to here", then "deal 1 damage to a minion for each threat here". */
const BEAT_COP_MOVE = stubAbility("beat-cop.move", {
  trigger: { kind: "action" },
  effects: [{ kind: "moveThreat", from: { kind: "mainScheme" }, to: self, amount: num(1) }],
});
const BEAT_COP_SPEND = stubAbility("beat-cop.spend", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: { kind: "threat", of: self } }],
});
const BEAT_COP = stubSupport({ id: "beat-cop", cost: 0, abilities: [BEAT_COP_MOVE.ref, BEAT_COP_SPEND.ref] });

/** Get Over Here!: "engage that enemy". */
const ENGAGED_COUNTER = stubAbility("watcher.engaged", {
  trigger: { kind: "response", forced: true, on: { on: "minionEngaged" } },
  effects: [{ kind: "addCounters", target: { kind: "each", query: { categories: ["mainScheme"] } }, counterType: "engaged", amount: num(1) }],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [ENGAGED_COUNTER.ref] });
const GET_OVER_HERE = action("get-over-here", [
  { kind: "chooseTarget", slot: "minion", query: { categories: ["minion"] }, chooser: you },
  { kind: "engage", minion: { kind: "slot", slot: "minion" }, player: you },
]);

/** Heimdall: "look at the top 3 cards of the encounter deck. Discard 1 of them and put the others back in any order." */
const HEIMDALL = action("heimdall", [
  { kind: "selectCards", slot: "looked", cards: { kind: "encounter", zones: ["deck"], top: num(3) } },
  { kind: "chooseCards", slot: "tossed", from: { kind: "ref", ref: { kind: "slot", slot: "looked" } }, chooser: you, min: 1, max: 1 },
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "tossed" } }, to: "discard" },
  {
    kind: "reorderCards",
    cards: { kind: "ref", ref: { kind: "slot", slot: "looked" }, filter: { excludeSlots: ["tossed"] } },
    chooser: you,
    to: "encounterDeckTop",
  },
]);

/** Bruno Carrelli: "attach 1 card from your hand facedown here" / "add up to 3 cards attached here to your hand". */
const BRUNO_ATTACH = stubAbility("bruno.attach", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseCards", slot: "card", from: { kind: "zone", zone: "hand", player: you }, chooser: you, min: 1, max: 1 },
    { kind: "attach", card: { kind: "slot", slot: "card" }, to: self, facedown: true },
  ],
});
const BRUNO_RETURN = stubAbility("bruno.return", {
  trigger: { kind: "action" },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "attachmentsOf", of: self } }, to: "hand" }],
});
const BRUNO = stubSupport({ id: "bruno", cost: 0, abilities: [BRUNO_ATTACH.ref, BRUNO_RETURN.ref] });
/** The card Bruno hides: its own ability would place a counter if it were live. */
const NOISY = stubAbility("noisy.response", {
  trigger: { kind: "response", forced: true, on: { on: "turnStarted" } },
  effects: [{ kind: "addCounters", target: { kind: "each", query: { categories: ["mainScheme"] } }, counterType: "noisy", amount: num(1) }],
});
const NOISY_CARD = stubUpgrade({ id: "noisy", cost: 0, abilities: [NOISY.ref] });

/** Lightning Strike: "This damage ignores tough status cards if you have the Aerial trait." */
const STRIKE = action("strike", [{ kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: num(3), ignoreTough: true }]);
const PLAIN_STRIKE = action("plain-strike", [{ kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: num(3) }]);

/** Embiggen!: "When you play an [Attack] event, … increase the amount of damage that event deals by 2." */
const EMBIGGEN = stubAbility("embiggen.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } } },
  effects: [{ kind: "modifyCardEffect", card: eventTarget, damage: num(2) }],
});
const EMBIGGEN_CARD = stubUpgrade({ id: "embiggen", cost: 0, abilities: [EMBIGGEN.ref] });
/** An event that deals damage twice: each instance is modified (FAQ "Embiggen (#10)"). */
const TWICE = action("twice", [
  { kind: "dealDamage", target: villainRef, amount: num(3) },
  { kind: "dealDamage", target: villainRef, amount: num(3) },
]);

/** Shrink: "increase the amount of threat that event removes by 2". */
const SHRINK = stubAbility("shrink.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } } },
  effects: [{ kind: "modifyCardEffect", card: eventTarget, threatRemoved: num(2) }],
});
const SHRINK_CARD = stubUpgrade({ id: "shrink", cost: 0, abilities: [SHRINK.ref] });
const CLEAR_THREAT = action("clear-threat", [{ kind: "removeThreat", target: { kind: "mainScheme" }, amount: num(1) }]);

/** Enraged: "Attached ally … takes +1 consequential damage after it attacks." */
const ENRAGED = stubAbility("enraged.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "consequentialAttack", amount: 1, target: { self: true } }] },
  effects: [],
});
const ENRAGED_ALLY = stubAlly({ id: "enraged-ally", cost: 0, atk: 2, thw: 1, hp: 9, consequentialAttack: 1, abilities: [ENRAGED.ref] });
const CALM_ALLY = stubAlly({ id: "calm-ally", cost: 0, atk: 2, thw: 1, hp: 9, consequentialAttack: 1 });

/** Teamwork: "When you use your basic attack power (ATK), exhaust an ally you control → add that ally's matching power." */
const TEAMWORK = stubAbility("teamwork.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller", attackKind: "basic" } },
  effects: [
    {
      kind: "modifyStatUntil",
      stat: "atk",
      amount: { kind: "stat", of: { kind: "each", query: { categories: ["ally"], controller: "you" } }, stat: "atk" },
      target: yourIdentity,
      until: "endOfAttack",
    },
  ],
});
const TEAM_HERO = stubIdentity({
  id: "team-hero",
  hp: 12,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroTraits: [AERIAL],
  heroAbilities: [TEAMWORK.ref],
});

const EVENTS = [PLAIN_EVENT, ZAP_ALLY, SELF_HARM, GET_OVER_HERE, HEIMDALL, STRIKE, PLAIN_STRIKE, TWICE, CLEAR_THREAT];
const ABILITIES: readonly StubAbility[] = [
  RETURN_EVENT,
  CLEA_INTERRUPT,
  HELMET_INTERRUPT,
  BEAT_COP_MOVE,
  BEAT_COP_SPEND,
  ENGAGED_COUNTER,
  BRUNO_ATTACH,
  BRUNO_RETURN,
  NOISY,
  EMBIGGEN,
  SHRINK,
  ENRAGED,
  TEAMWORK,
  ...EVENTS.map((e) => e.ability),
];
const deps: EngineDeps = depsOf(...ABILITIES);

const PLAYER_CARDS = [MORPHO, CLEA, HELMET, BEAT_COP, WATCHER, BRUNO, NOISY_CARD, EMBIGGEN_CARD, SHRINK_CARD, ENRAGED_ALLY, CALM_ALLY, ...EVENTS.map((e) => e.card)];
const CARDS = [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, TOUGH_MINION, THUG, ...PLAYER_CARDS];

function game(options: { readonly players?: number; readonly identity?: typeof HERO; readonly encounter?: readonly CardId[] } = {}): GameState {
  const identities = seatIdentities(options.identity ?? HERO, options.players ?? 1);
  const result = createGame(
    {
      seed: 4,
      cards: [...CARDS, TEAM_HERO, ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LONG_SCHEME.id,
      encounterDeck: options.encounter ?? copies(BLANK.id, 16),
      includeIdentitySets: false,
      players: identities.map((identity) => ({ identityCardId: identity.id, deck: [...DEFAULT_DECK, ...PLAYER_CARDS.map((c) => c.id)] })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const ok = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
};

const playCard = (player: playerIdType, id: InstanceId): Command => ({ type: "playCard", playerId: player, cardInstanceId: id, payment: [], attachToInstanceId: null });
type playerIdType = typeof p1;

function play(state: GameState, cardId: CardId, player = p1) {
  const given = giveCard(state, player, cardId);
  return { ...runCommands(given.state, deps, playCard(player, given.id)), id: given.id };
}

const useAbility = (player: playerIdType, id: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: id,
  abilityId: abilityId as never,
  payment: [],
});

const toHero = (state: GameState, player = p1): GameState => ok(state, { type: "changeForm", playerId: player });
const withThreat =(state: GameState, id: InstanceId, threat: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } },
});

/** Test surgery: the first copy of `card` in the encounter deck enters play engaged with `player`. */
function engageMinion(state: GameState, cardId: CardId, player = p1): { readonly state: GameState; readonly id: InstanceId } {
  const deck = activeEncounterDeck(state).deck;
  const id = deck.find((candidate) => state.instances[candidate]?.cardId === cardId);
  if (!id) throw new Error(`no ${cardId} in the encounter deck`);
  return {
    id,
    state: {
      ...withEncounterPiles(state, { deck: deck.filter((x) => x !== id) }),
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: true, engagedWith: player, controllerId: null } },
    },
  };
}

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) => events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("§3.13 moving a card as it is played or defeated", () => {
  it("a response to playing an event returns it to hand instead of leaving it in the discard pile", () => {
    const start = play(game(), MORPHO.id).state;
    const { state, id } = play(start, PLAIN_EVENT.card.id);
    expect(mustPlayer(state, p1).hand).toContain(id);
    expect(mustPlayer(state, p1).discard).not.toContain(id);
    // The event still resolved.
    expect(mustInstance(state, mustPlayer(state, p1).identity.instanceId).counters.played).toBe(1);
  });

  it("'when this ally is defeated, shuffle her into her owner's deck' replaces the defeat", () => {
    const start = play(game(), CLEA.id);
    const clea = start.id;
    const { state, events } = play(start.state, ZAP_ALLY.card.id);
    expect(mustPlayer(state, p1).deck).toContain(clea);
    expect(mustPlayer(state, p1).discard).not.toContain(clea);
    expect(ofType(events, "characterDefeated").map((e) => e.instanceId)).not.toContain(clea);
  });

  it("'set his hit point dial to 1 instead' replaces an identity's defeat; without it the player is eliminated", () => {
    const start = play(game(), HELMET.id);
    const identity = mustPlayer(start.state, p1).identity.instanceId;
    const maxHp = characterProfile(start.state, identity, deps)?.maxHp ?? 0;
    const { state, events } = play(start.state, SELF_HARM.card.id);
    expect(mustPlayer(state, p1).eliminated).toBe(false);
    expect(mustInstance(state, identity).damage).toBe(maxHp - 1);
    expect(ofType(events, "hitPointsSet")).toEqual([{ type: "hitPointsSet", instanceId: identity, remaining: 1, damage: maxHp - 1 }]);
    expect(mustPlayer(state, p1).discard).toContain(start.id);

    // The Core path is unchanged: with nothing listening, the identity's defeat eliminates the player outright.
    const eliminated = play(game(), SELF_HARM.card.id).state;
    expect(eliminated.outcome).toEqual({ result: "loss", reason: "allPlayersDefeated" });
  });
});

describe("§3.13 placement: threat, engagement and deck order", () => {
  it("threat moves from a scheme onto a support, and an ability reads it there", () => {
    const start = play(game({ encounter: [THUG.id, ...copies(BLANK.id, 15)] }), BEAT_COP.id);
    const cop = start.id;
    const scheme = start.state.mainScheme.instanceId;
    const withSome = withThreat(start.state, scheme, 3);
    const moved = runCommands(withSome, deps, useAbility(p1, cop, "beat-cop.move")).state;
    expect(mustInstance(moved, cop).threat).toBe(1);
    expect(mustInstance(moved, scheme).threat).toBe(2);

    const thug = engageMinion(moved, THUG.id);
    const spent = runCommands(thug.state, deps, useAbility(p1, cop, "beat-cop.spend")).state;
    expect(mustInstance(spent, thug.id).damage).toBe(1);
  });

  it("'engage that enemy' moves the minion and announces the engagement; a minion already engaged with you does not re-engage", () => {
    const start = play(game({ players: 2, encounter: [THUG.id, ...copies(BLANK.id, 15)] }), WATCHER.id).state;
    const thug = engageMinion(start, THUG.id, p2);
    const scheme = start.mainScheme.instanceId;
    const before = mustInstance(thug.state, scheme).counters.engaged ?? 0;

    const pulled = play(thug.state, GET_OVER_HERE.card.id);
    expect(mustPlayer(pulled.state, p1).playArea).toContain(thug.id);
    expect(mustInstance(pulled.state, thug.id).engagedWith).toBe(p1);
    expect(mustInstance(pulled.state, scheme).counters.engaged).toBe(before + 1);

    // RRG 1.8 "Engage" (p. 18): it is already engaged with p1, so nothing happens and nothing is announced.
    const again = play(pulled.state, GET_OVER_HERE.card.id);
    expect(mustInstance(again.state, scheme).counters.engaged).toBe(before + 1);
  });

  it("'discard 1 of them and put the others back in any order' sets the top of the encounter deck", () => {
    const start = game();
    const [a, b, c, d] = activeEncounterDeck(start).deck as [InstanceId, InstanceId, InstanceId, InstanceId];
    const given = giveCard(start, p1, HEIMDALL.card.id);
    const atToss = ok(given.state, playCard(p1, given.id));
    // First choice: which of the top 3 to discard.
    expect(atToss.pendingChoice?.prompt).toEqual({ kind: "chooseCards", slot: "tossed" });
    const atOrder = ok(atToss, { type: "resolveChoice", playerId: p1, choiceId: atToss.pendingChoice!.choiceId, selectedOptionIds: [a] });

    const order = atOrder.pendingChoice;
    expect(order?.prompt).toEqual({ kind: "orderCards", to: "encounterDeckTop" });
    expect(order?.ordered).toBe(true);
    expect(order?.options.map((option) => option.optionId)).toEqual([b, c]);

    const done = ok(atOrder, { type: "resolveChoice", playerId: p1, choiceId: order!.choiceId, selectedOptionIds: [c, b] });
    expect(activeEncounterDeck(done).deck.slice(0, 3)).toEqual([c, b, d]);
    expect(activeEncounterDeck(done).discard).toContain(a);
  });
});

describe("§3.13 facedown attachments", () => {
  it("a card attached facedown has no title, traits, keywords or abilities, and comes back to hand", () => {
    const start = play(game(), BRUNO.id);
    const bruno = start.id;
    const handed = giveCard(start.state, p1, NOISY_CARD.id);
    // Pick the card to hide rather than letting the harness take the first card in hand.
    const atChoice = ok(handed.state, useAbility(p1, bruno, "bruno.attach"));
    expect(atChoice.pendingChoice?.prompt).toEqual({ kind: "chooseCards", slot: "card" });
    const hidden = ok(atChoice, { type: "resolveChoice", playerId: p1, choiceId: atChoice.pendingChoice!.choiceId, selectedOptionIds: [handed.id] });

    const attached = mustInstance(hidden, bruno).attachments;
    expect(attached).toContain(handed.id);
    expect(mustInstance(hidden, handed.id).faceup).toBe(false);
    // Blank while facedown: no title for a `named` target, and no live abilities.
    expect(currentName(hidden, handed.id)).toBeUndefined();
    expect(activeAbilityRefs(hidden, handed.id)).toEqual([]);
    expect(selectTargets(hidden, { name: NOISY_CARD.name }, { selfInstanceId: null, controllerId: p1, event: null, bindings: {}, deps })).toEqual([]);

    const returned = runCommands(hidden, deps, useAbility(p1, bruno, "bruno.return")).state;
    expect(mustPlayer(returned, p1).hand).toContain(handed.id);
    expect(mustInstance(returned, bruno).attachments).toEqual([]);
  });
});

describe("§3.13 damage and threat amounts", () => {
  it("damage that ignores tough is taken and leaves the status card in place; ordinary damage is prevented by it", () => {
    const start = game({ encounter: [TOUGH_MINION.id, ...copies(BLANK.id, 15)] });
    const minion = engageMinion(start, TOUGH_MINION.id);
    const tough = { ...minion.state, instances: { ...minion.state.instances, [minion.id]: { ...mustInstance(minion.state, minion.id), statuses: { stunned: 0, confused: 0, tough: 1 } } } };

    const ignored = play(tough, STRIKE.card.id).state;
    expect(mustInstance(ignored, minion.id).damage).toBe(3);
    expect(mustInstance(ignored, minion.id).statuses.tough).toBe(1);

    const prevented = play(tough, PLAIN_STRIKE.card.id).state;
    expect(mustInstance(prevented, minion.id).damage).toBe(0);
    expect(mustInstance(prevented, minion.id).statuses.tough).toBe(0);
  });

  it("'increase the damage that event deals by 2' modifies every instance, and ends with that card's play", () => {
    const start = play(game(), EMBIGGEN_CARD.id).state;
    const villain = start.villains[0]?.instanceId as InstanceId;
    const boosted = play(start, TWICE.card.id);
    // Two instances of 3, each increased by 2 (FAQ "Embiggen (#10)", p. 59).
    expect(mustInstance(boosted.state, villain).damage).toBe(10);
    expect(boosted.state.lastingEffects.filter((effect) => effect.kind === "cardEffectBonus")).toEqual([]);
  });

  it("'increase the threat that event removes by 2' applies to a removal, once per instance", () => {
    const start = play(game(), SHRINK_CARD.id).state;
    const scheme = start.mainScheme.instanceId;
    const withThreatOnIt = withThreat(start, scheme, 9);
    const removed = play(withThreatOnIt, CLEAR_THREAT.card.id).state;
    expect(mustInstance(removed, scheme).threat).toBe(6);
  });

  it("an ally takes its modified consequential damage after it attacks", () => {
    const start = game();
    const hero = toHero(start);
    const enraged = play(hero, ENRAGED_ALLY.id);
    const calm = play(enraged.state, CALM_ALLY.id);
    const villain = calm.state.villains[0]?.instanceId as InstanceId;
    const attacked = runCommands(calm.state, deps, { type: "basicAttack", playerId: p1, attackerInstanceId: enraged.id, targetInstanceId: villain }).state;
    // Printed 1 consequential damage, +1 from its own modifier.
    expect(mustInstance(attacked, enraged.id).damage).toBe(2);

    const other = runCommands(calm.state, deps, { type: "basicAttack", playerId: p1, attackerInstanceId: calm.id, targetInstanceId: villain }).state;
    expect(mustInstance(other, calm.id).damage).toBe(1);
  });

  it("an ally's power can be added to a hero's basic attack for that use", () => {
    const start = game({ identity: TEAM_HERO });
    const hero = toHero(start);
    const ally = play(hero, CALM_ALLY.id);
    const identity = mustPlayer(ally.state, p1).identity.instanceId;
    const villain = ally.state.villains[0]?.instanceId as InstanceId;
    const attacked = runCommands(ally.state, deps, { type: "basicAttack", playerId: p1, attackerInstanceId: identity, targetInstanceId: villain }).state;
    // Hero ATK 2 plus the ally's ATK 2, for this attack only.
    expect(mustInstance(attacked, villain).damage).toBe(4);
    expect(characterProfile(attacked, identity, deps)?.atk).toBe(2);
  });
});
