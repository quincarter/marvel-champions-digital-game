/**
 * Boost cards a friendly character holds for its basic powers (`EffectSpec giveBoostCard.forBasicPower`,
 * `CardInstance.heldForBasicPowers`, `resolve/villainous.ts`): "Give Elektra 1 facedown boost card" (Acrobatic Prowess
 * 63006), "give this card to Elektra as a facedown boost card" (the Ninja cards 63002–63004).
 *
 * Sources: ruling September 10, 2026 - Ruling 3: (A) "if Elektra has a boost card while in Alter-Ego form and makes a
 * basic recovery, she resolves that boost card for that activation"; (B) defending, she turns her cards faceup "during
 * the same step that the villain's boost cards are turned faceup"; (C) "Elektra cannot use boost cards placed on her by
 * Venom". Ruling October 12, 2026 - Ruling 1: "you can choose to resolve either character's boost cards first, and
 * when you do, resolve all of their boost cards in the order those cards were dealt". RRG 1.8 "Villainous" (p. 47) for
 * how a card resolves; MC60 p. 4's Amplify text (owner, 2026-11-14). Synthetic cards; the test hero has ATK 2, THW 2,
 * DEF 2, REC 3 and the villain ATK 2.
 */

import type { CardId, SideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import type { LastingEffect } from "./lasting.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { heldBoostCardsOf } from "./resolve/villainous.js";
import { evaluate } from "./select.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const YOUR_IDENTITY: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const EACH_ALLY: TargetRef = { kind: "each", query: { categories: ["ally"] } };

const action = (id: string, effects: AbilityDefinition["effects"]) =>
  stubAbility(id, { trigger: { kind: "action" }, effects });
/** "Give your hero 1 facedown boost card" for its basic powers (Acrobatic Prowess's shape). */
const GIVE_HELD = action("give-held.action", [{ kind: "giveBoostCard", enemy: YOUR_IDENTITY, forBasicPower: true }]);
/** "Give each ally 1 facedown boost card" for its basic powers. */
const GIVE_ALLY = action("give-ally.action", [{ kind: "giveBoostCard", enemy: EACH_ALLY, forBasicPower: true }]);
/** "Place 1 facedown boost card on your identity" (Venom's shape): not for her basic powers. */
const PLACE = action("place.action", [{ kind: "giveBoostCard", enemy: YOUR_IDENTITY }]);
/** "Deal 5 damage to each ally." */
const SLAY = action("slay.action", [{ kind: "dealDamage", target: EACH_ALLY, amount: { kind: "const", value: 5 } }]);
/** "Give the villain 1 facedown boost card" (Hired Gun's shape): a second card for its next activation. */
const GIVE_VILLAIN = action("give-villain.action", [{ kind: "giveBoostCard", enemy: { kind: "villain" } }]);
/** "Move each facedown boost card from your identity to the villain" (Venom's main scheme 1B shape, `sm` 27071b). */
const TO_VILLAIN = action("to-villain.action", [
  { kind: "moveBoostCards", from: YOUR_IDENTITY, to: { kind: "villain" } },
]);
const ACTIONS = [GIVE_HELD, GIVE_ALLY, PLACE, SLAY, GIVE_VILLAIN, TO_VILLAIN];
const DESK = stubSupport({ id: "desk", cost: 0, abilities: ACTIONS.map((a) => a.ref) });
/** An optional interrupt to every boost card turned faceup that does nothing to it: a window to look at the state. */
const PEEK = stubAbility("peek.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "boostCardTurnedFaceup" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["mainScheme"] } },
      counterType: "peek",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const PEEKER = stubSupport({ id: "peeker", cost: 0, abilities: [PEEK.ref] });
/** "When a character attacks, cancel that attack" (forced). */
const STOP = stubAbility("stop.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
});
const STOPPER = stubSupport({ id: "stopper", cost: 0, abilities: [STOP.ref] });
/** "Forced Interrupt: When a character would attack, cancel that attack": the "would" tier of the attack's window. */
const WOULD_STOP = stubAbility("would-stop.interrupt", {
  trigger: { kind: "interrupt", forced: true, would: true, on: { on: "attack" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
});
const WOULD_STOPPER = stubSupport({ id: "would-stopper", cost: 0, abilities: [WOULD_STOP.ref] });
/** "Forced Interrupt: When a character would attack, place 1 'would' counter on the main scheme." */
const WOULD_MARK = stubAbility("would-mark.interrupt", {
  trigger: { kind: "interrupt", forced: true, would: true, on: { on: "attack" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["mainScheme"] } },
      counterType: "would",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const WOULD_MARKER = stubSupport({ id: "would-marker", cost: 0, abilities: [WOULD_MARK.ref] });
/** "When a character attacks, place 1 'mark' counter on the main scheme" (forced): an interrupt to her attack itself. */
const MARK = stubAbility("mark.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["mainScheme"] } },
      counterType: "mark",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const MARKER = stubSupport({ id: "marker", cost: 0, abilities: [MARK.ref] });
const onFlip = { on: "boostCardTurnedFaceup" } as const;
/** Wraith's shape (22012): "When a boost card is turned faceup, … cancel that card's 'Boost' effect." */
const WRAITH_CANCEL = stubAbility("wraith-shape.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onFlip },
  effects: [{ kind: "cancelBoostAbility" }],
});
/** Killer Instinct's shape (63001a): "… cancel its 'Boost' ability. Then, that card gains [boost]." */
const INSTINCT = stubAbility("instinct-shape.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: onFlip },
  effects: [
    { kind: "cancelBoostAbility" },
    { kind: "then", effects: [{ kind: "adjustBoostCount", delta: { kind: "const", value: 1 } }] },
  ],
});
const CANCELLERS = stubSupport({ id: "cancellers", cost: 0, abilities: [WRAITH_CANCEL.ref, INSTINCT.ref] });
/**
 * "Forced Response: After you attack, place 1 facedown boost card on your identity" (Vengeance's shape on Venom, `sm`
 * 27073): an enemy's text placing a card while her attack, and so her use, is still on the stack.
 */
const AVENGE = stubAbility("avenge.response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [{ kind: "giveBoostCard", enemy: YOUR_IDENTITY }],
});
const AVENGER = stubSupport({ id: "avenger", cost: 0, abilities: [AVENGE.ref] });
/** "[star] Boost: Cancel this activation" (a community card's shape, `cancelBoostedActivation`). No icons. */
const QUIT = stubAbility("quit.boost", { trigger: { kind: "boost" }, effects: [{ kind: "cancelBoostedActivation" }] });
const QUITTER = stubTreachery({ id: "quitter", boostIcons: 0, starIcon: true, abilities: [QUIT.ref] });

/** "[star] Boost: Deal 1 damage to you." Two boost icons. */
const HURT_YOU = stubAbility("hurt.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "dealDamage", target: YOUR_IDENTITY, amount: { kind: "const", value: 1 } }],
});
const HURTER = stubTreachery({ id: "hurter", boostIcons: 2, starIcon: true, abilities: [HURT_YOU.ref] });
/** Two boost icons, no Boost ability. */
const PLAIN = stubTreachery({ id: "plain", boostIcons: 2 });
/** "[star] Boost: Give this card to your hero as a facedown boost card" (a Ninja card's "otherwise"). Two icons. */
const REGIVE = stubAbility("regive.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "giveBoostCard", enemy: YOUR_IDENTITY, card: { kind: "self" }, forBasicPower: true }],
});
const BOOMERANG = stubTreachery({ id: "boomerang", boostIcons: 2, starIcon: true, abilities: [REGIVE.ref] });
/** One amplify icon (Vendetta's shape). */
const VENDETTA: SideSchemeCard = { ...stubSideScheme({ id: "vendetta", startingThreat: 2 }), amplifyIcons: 1 };
const ALLY = stubAlly({ id: "plain-ally", cost: 0, atk: 1, thw: 1, hp: 5 });

const deps = depsOf(
  ...ACTIONS,
  HURT_YOU,
  REGIVE,
  PEEK,
  STOP,
  WOULD_STOP,
  WOULD_MARK,
  QUIT,
  AVENGE,
  MARK,
  WRAITH_CANCEL,
  INSTINCT,
);

/** P1's first turn in hero form, 9 threat on the main scheme, the desk in play; the encounter deck is `deck`. */
function start(deck: readonly CardId[] = copiesOf(PLAIN.id, 20)) {
  const base = gameAtFirstTurn({
    cards: [
      DESK,
      HURTER,
      PLAIN,
      BOOMERANG,
      VENDETTA,
      ALLY,
      PEEKER,
      STOPPER,
      WOULD_STOPPER,
      WOULD_MARKER,
      QUITTER,
      AVENGER,
      MARKER,
      CANCELLERS,
    ],
    deps,
    encounter: [VENDETTA.id, ...deck],
    deck: [
      DESK.id,
      ALLY.id,
      PEEKER.id,
      STOPPER.id,
      WOULD_STOPPER.id,
      WOULD_MARKER.id,
      AVENGER.id,
      MARKER.id,
      CANCELLERS.id,
    ],
  });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const scheme = hero.mainScheme!.instanceId;
  const desk = playerCardIntoPlay(hero, DESK.id, P1);
  const state = desk.state;
  return {
    state: { ...state, instances: { ...state.instances, [scheme]: { ...mustInstance(state, scheme), threat: 9 } } },
    scheme,
    desk: desk.id,
  };
}

const run = (state: GameState, commands: readonly Command[], pick = defaultPick) => {
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  return { session, state: session.state, events };
};
const use = (desk: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: desk,
  abilityId: ability.ref.id,
  payment: [],
});

const activeDeck = (state: GameState) => state.encounterDecks[state.encounterDeckOrder[0]!]!.deck;
const identity = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const villain = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const thwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const characterFlips = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "characterBoostCardFlipped" }> => e.type === "characterBoostCardFlipped",
  );
const grantVillainous = (target: InstanceId): LastingEffect => ({
  id: "test.grant",
  kind: "keywordGrant",
  keyword: { name: "villainous" },
  targets: [target],
  affects: null,
  scope: { selfInstanceId: null, controllerId: null, vars: {}, bindings: {} },
  duration: { kind: "endOfRound" },
});

/** `start()` after the desk gave the hero `count` held boost cards. */
function holding(count = 1, deck?: readonly CardId[]) {
  const s = start(deck);
  const given = run(
    s.state,
    Array.from({ length: count }, () => use(s.desk, GIVE_HELD)),
  );
  return { ...s, state: given.state, events: given.events };
}

describe("giving a held boost card (EffectSpec giveBoostCard.forBasicPower)", () => {
  it("puts the encounter deck's top card facedown on the hero, marked, and logs it", () => {
    const { state, events } = holding();
    const hero = identity(state);
    const held = heldBoostCardsOf(state, hero);
    expect(held).toHaveLength(1);
    expect(mustInstance(state, held[0]!)).toMatchObject({ faceup: false, heldForBasicPowers: true });
    expect(locateCard(state, held[0]!)).toEqual({ kind: "boost", hostInstanceId: hero });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "boostCardDealt", enemyInstanceId: hero, forBasicPower: true }),
    );
  });

  it("a card placed without it (Venom's) is not held, and her basic power leaves it facedown (R3 (C))", () => {
    const s = start();
    const placed = run(s.state, [use(s.desk, PLACE)]);
    const hero = identity(placed.state);
    const [card] = mustInstance(placed.state, hero).boostCards;
    expect(heldBoostCardsOf(placed.state, hero)).toEqual([]);
    const after = run(placed.state, [thwart(hero, s.scheme)]);
    expect(characterFlips(after.events)).toHaveLength(0);
    expect(mustInstance(after.state, card!).faceup).toBe(false);
    expect(mustInstance(after.state, s.scheme).threat).toBe(7);
  });
});

describe("a card an enemy's text places during her own use is not hers (ruling Sep 10, 2026 R3 (C))", () => {
  it("placed by a forced response to her villainous attack: left facedown, not held, not discarded", () => {
    const s = start();
    const placing = playerCardIntoPlay(s.state, AVENGER.id, P1).state;
    const hero = identity(placing);
    const granted = { ...placing, lastingEffects: [...placing.lastingEffects, grantVillainous(hero)] };
    const before = mustInstance(granted, villain(granted)).damage;
    const after = run(granted, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain(granted) },
    ]);
    // Her villainous card resolved (ATK 2 + 2) and was discarded; the placed card is the only one left on her.
    expect(characterFlips(after.events)).toHaveLength(1);
    expect(mustInstance(after.state, villain(after.state)).damage).toBe(before + 4);
    const [placed] = mustInstance(after.state, hero).boostCards;
    expect(mustInstance(after.state, hero).boostCards).toHaveLength(1);
    expect(mustInstance(after.state, placed!).faceup).toBe(false);
    expect(mustInstance(after.state, placed!).heldForBasicPowers).toBeUndefined();
    expect(heldBoostCardsOf(after.state, hero)).toEqual([]);

    // Her next basic power leaves it there.
    const readied = {
      ...after.state,
      instances: { ...after.state.instances, [hero]: { ...mustInstance(after.state, hero), exhausted: false } },
    };
    const next = run(readied, [thwart(hero, s.scheme)]);
    expect(characterFlips(next.events).map((e) => e.instanceId)).not.toContain(placed);
    expect(locateCard(next.state, placed!)).toEqual({ kind: "boost", hostInstanceId: hero });
  });
});

describe("'Move each facedown boost card from your identity to Venom' (owner decision 6, provisional)", () => {
  it("her held card moves too, loses its held mark, and resolves as the villain's boost card when it attacks", () => {
    const s = holding(1, copiesOf(HURTER.id, 20));
    const hero = identity(s.state);
    const [held] = heldBoostCardsOf(s.state, hero);
    const moved = run(s.state, [use(s.desk, TO_VILLAIN)]);
    const boss = villain(moved.state);
    expect(mustInstance(moved.state, hero).boostCards).toEqual([]);
    expect(locateCard(moved.state, held!)).toEqual({ kind: "boost", hostInstanceId: boss });
    expect(mustInstance(moved.state, held!).heldForBasicPowers).toBeUndefined();
    expect(moved.events).toContainEqual(
      expect.objectContaining({ type: "boostCardMoved", instanceId: held, fromInstanceId: hero, toInstanceId: boss }),
    );

    // The villain attacks: the moved card is flipped as its own (with the card its activation draws), not as hers.
    const after = run(moved.state, [{ type: "endTurn", playerId: P1 }]);
    const enemyFlips = after.events.filter((e) => e.type === "boostCardFlipped");
    expect(enemyFlips.map((e) => (e.type === "boostCardFlipped" ? e.instanceId : null))).toContain(held);
    expect(characterFlips(after.events)).toHaveLength(0);
    expect(locateCard(after.state, held!)?.kind).toBe("encounterDiscard");
  });
});

describe("a held card resolves on the holder's next basic power (ruling Sep 10, 2026 R3 (A))", () => {
  it("a hero without villainous: her thwart turns it up, resolves its Boost for 'you', adds its icons, discards it", () => {
    const { state, scheme } = holding(1, copiesOf(HURTER.id, 20));
    const hero = identity(state);
    const [card] = heldBoostCardsOf(state, hero);
    const before = mustInstance(state, hero).damage;
    const after = run(state, [thwart(hero, scheme)]);
    expect(characterFlips(after.events)).toEqual([
      expect.objectContaining({ instanceId: card, power: "thwart", stat: "thw", boostIcons: 2 }),
    ]);
    // THW 2 + 2.
    expect(mustInstance(after.state, scheme).threat).toBe(5);
    expect(mustInstance(after.state, hero).damage).toBe(before + 1);
    expect(locateCard(after.state, card!)?.kind).toBe("encounterDiscard");
    expect(mustInstance(after.state, card!).heldForBasicPowers).toBeUndefined();
    expect(heldBoostCardsOf(after.state, hero)).toEqual([]);
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });

  it("two held cards both resolve, in the order given", () => {
    const { state, scheme } = holding(2);
    const hero = identity(state);
    const held = heldBoostCardsOf(state, hero);
    const after = run(state, [thwart(hero, scheme)]);
    expect(characterFlips(after.events).map((e) => e.instanceId)).toEqual(held);
    // THW 2 + 2 + 2.
    expect(mustInstance(after.state, scheme).threat).toBe(3);
  });

  it("a basic attack adds them to ATK", () => {
    const { state } = holding();
    const hero = identity(state);
    const before = mustInstance(state, villain(state)).damage;
    const after = run(state, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain(state) },
    ]);
    expect(mustInstance(after.state, villain(after.state)).damage).toBe(before + 4);
  });

  it("they belong to the identity: kept through a change to alter-ego, then resolved on a basic recovery", () => {
    const { state } = holding();
    const hero = identity(state);
    const [card] = heldBoostCardsOf(state, hero);
    const hurt = { ...state, instances: { ...state.instances, [hero]: { ...mustInstance(state, hero), damage: 7 } } };
    const flipped = run(hurt, [{ type: "changeForm", playerId: P1 }]);
    expect(mustPlayer(flipped.state, P1).identity.form).toBe("alterEgo");
    expect(heldBoostCardsOf(flipped.state, hero)).toEqual([card]);
    const after = run(flipped.state, [{ type: "basicRecover", playerId: P1 }]);
    expect(characterFlips(after.events)).toEqual([
      expect.objectContaining({ instanceId: card, power: "recover", stat: "rec", boostIcons: 2 }),
    ]);
    // REC 3 + 2 heals 5 of 7.
    expect(mustInstance(after.state, hero).damage).toBe(2);
    expect(locateCard(after.state, card!)?.kind).toBe("encounterDiscard");
  });

  it("a villainous hero resolves the held card, then the card that use gives (both)", () => {
    const { state, scheme } = holding();
    const hero = identity(state);
    const [card] = heldBoostCardsOf(state, hero);
    const granted = { ...state, lastingEffects: [...state.lastingEffects, grantVillainous(hero)] };
    const after = run(granted, [thwart(hero, scheme)]);
    const flips = characterFlips(after.events);
    expect(flips).toHaveLength(2);
    expect(flips[0]?.instanceId).toBe(card);
    // THW 2 + 2 + 2.
    expect(mustInstance(after.state, scheme).threat).toBe(3);
    expect(mustInstance(after.state, hero).boostCards).toEqual([]);
  });

  it("amplify adds to a held card (MC60 p. 4, owner 2026-11-14)", () => {
    const { state, scheme } = holding();
    const hero = identity(state);
    const amplified = encounterCardInVillainArea(state, VENDETTA.id, 2).state;
    const after = run(amplified, [thwart(hero, scheme)]);
    expect(characterFlips(after.events)[0]?.boostIcons).toBe(3);
    // THW 2 + 2 + 1.
    expect(mustInstance(after.state, scheme).threat).toBe(4);
  });

  it("an ally holding one resolves it on its thwart; leaving play takes it to the encounter discard pile", () => {
    const s = start();
    const ally = playerCardIntoPlay(s.state, ALLY.id, P1);
    const given = run(ally.state, [use(s.desk, GIVE_ALLY)]);
    const [card] = heldBoostCardsOf(given.state, ally.id);
    expect(card).toBeDefined();
    const thwarted = run(given.state, [thwart(ally.id, s.scheme)]);
    // THW 1 + 2.
    expect(mustInstance(thwarted.state, s.scheme).threat).toBe(6);

    const again = run(given.state, [use(s.desk, SLAY)]);
    expect(locateCard(again.state, ally.id)?.kind).toBe("discard");
    expect(locateCard(again.state, card!)?.kind).toBe("encounterDiscard");
  });
});

describe("a Boost ability that sends its own card elsewhere (the Ninja cards' 'Otherwise, give this card to Elektra')", () => {
  it("the card goes back facedown and held and is not discarded; its icons still count for this use", () => {
    // Ruling January 11, 2024 #134 (a boost card moved by its own Boost still counts); the given-back case is owner
    // decision 4 (docs/phase7-elektra-iron-fist.md §5).
    const { state, scheme } = holding(1, copiesOf(BOOMERANG.id, 20));
    const hero = identity(state);
    const [card] = heldBoostCardsOf(state, hero);
    const after = run(state, [thwart(hero, scheme)]);
    expect(characterFlips(after.events).map((e) => e.instanceId)).toEqual([card]);
    // THW 2 + 2.
    expect(mustInstance(after.state, scheme).threat).toBe(5);
    expect(heldBoostCardsOf(after.state, hero)).toEqual([card]);
    expect(mustInstance(after.state, card!)).toMatchObject({ faceup: false, heldForBasicPowers: true });
  });
});

describe("a card the use never reached stays held (owner decision 5, docs/phase7-elektra-iron-fist.md §5)", () => {
  it("a basic defense whose attack the villain's own boost card cancels first: her cards stay, facedown and held", () => {
    const s = holding(1, [QUITTER.id, ...copiesOf(PLAIN.id, 20)]);
    const hero = identity(s.state);
    const [held] = heldBoostCardsOf(s.state, hero);
    const granted = { ...s.state, lastingEffects: [...s.state.lastingEffects, grantVillainous(hero)] };
    const staged = onTopOfEncounterDeck(granted, QUITTER.id);
    const after = run(staged, [{ type: "endTurn", playerId: P1 }], (st) => {
      const choice = st.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") return [hero];
      if (choice?.prompt.kind === "chooseOption" && choice.options.some((o) => o.optionId === "defender"))
        return ["enemy"];
      return defaultPick(st);
    });
    expect(characterFlips(after.events)).toHaveLength(0);
    const kept = heldBoostCardsOf(after.state, hero);
    // The held card, and the card her villainous defense was given.
    expect(kept).toContain(held);
    expect(kept).toHaveLength(2);
    for (const id of kept)
      expect(mustInstance(after.state, id)).toMatchObject({ faceup: false, heldForBasicPowers: true });
  });

  it("a 'would attack' cancel: Villainous gives no card, and her held card is never turned up", () => {
    // RRG 1.8 "'Would'" (p. 48): the "would" interrupts to her attack resolve first, and once one cancels it no further
    // interrupt to it resolves, so the Villainous forced interrupt ("Villainous" p. 47, "Forced" p. 20) gives nothing.
    const s = holding();
    const hero = identity(s.state);
    const [held] = heldBoostCardsOf(s.state, hero);
    const stopped = playerCardIntoPlay(s.state, WOULD_STOPPER.id, P1).state;
    const granted = { ...stopped, lastingEffects: [...stopped.lastingEffects, grantVillainous(hero)] };
    const before = mustInstance(granted, villain(granted)).damage;
    const deck = activeDeck(granted);
    const after = run(granted, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain(granted) },
    ]);
    expect(characterFlips(after.events)).toHaveLength(0);
    expect(after.events.some((e) => e.type === "boostCardDealt")).toBe(false);
    expect(activeDeck(after.state)).toEqual(deck);
    expect(mustInstance(after.state, villain(after.state)).damage).toBe(before);
    expect(heldBoostCardsOf(after.state, hero)).toEqual([held]);
    expect(mustInstance(after.state, held!)).toMatchObject({ faceup: false, heldForBasicPowers: true });
  });

  it("a cancel that is no 'would' interrupt comes after the give: the card is given, and both her cards stay held", () => {
    // Villainous answers "uses a basic power", announced once the attack's "would" tier is over and before the attack's
    // other interrupts (`usingAfterWould`): STOP ("when a character attacks", forced, no "would") resolves after it.
    const s = holding();
    const hero = identity(s.state);
    const [held] = heldBoostCardsOf(s.state, hero);
    const stopped = playerCardIntoPlay(s.state, STOPPER.id, P1).state;
    const granted = { ...stopped, lastingEffects: [...stopped.lastingEffects, grantVillainous(hero)] };
    const after = run(granted, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain(granted) },
    ]);
    expect(characterFlips(after.events)).toHaveLength(0);
    const kept = heldBoostCardsOf(after.state, hero);
    expect(kept).toHaveLength(2);
    expect(kept[0]).toBe(held);
    for (const id of kept)
      expect(mustInstance(after.state, id)).toMatchObject({ faceup: false, heldForBasicPowers: true });
  });

  it("a 'would attack' interrupt that does not cancel resolves first, then the give, then the attack's other interrupts", () => {
    const s = holding();
    const hero = identity(s.state);
    const both = playerCardIntoPlay(playerCardIntoPlay(s.state, WOULD_MARKER.id, P1).state, MARKER.id, P1).state;
    const granted = { ...both, lastingEffects: [...both.lastingEffects, grantVillainous(hero)] };
    const after = run(granted, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain(granted) },
    ]);
    const resolvedAt = (id: string) =>
      after.events.findIndex((e) => e.type === "abilityResolved" && (e.abilityId as string) === id);
    const would = resolvedAt(WOULD_MARK.ref.id as string);
    const dealt = after.events.findIndex((e) => e.type === "boostCardDealt");
    const mark = resolvedAt(MARK.ref.id as string);
    expect(would).toBeGreaterThanOrEqual(0);
    expect(dealt).toBeGreaterThan(would);
    expect(mark).toBeGreaterThan(dealt);
    expect(characterFlips(after.events)).toHaveLength(2);
  });

  it("with another interrupt to the attack: the card is given in that window, and turned up with the held one", () => {
    const s = holding();
    const hero = identity(s.state);
    const marked = playerCardIntoPlay(s.state, MARKER.id, P1).state;
    const granted = { ...marked, lastingEffects: [...marked.lastingEffects, grantVillainous(hero)] };
    const after = run(granted, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain(granted) },
    ]);
    const dealt = after.events.findIndex((e) => e.type === "boostCardDealt");
    const flipped = after.events.findIndex((e) => e.type === "characterBoostCardFlipped");
    expect(dealt).toBeGreaterThanOrEqual(0);
    expect(flipped).toBeGreaterThan(dealt);
    // The held card and the card given for this attack, both turned up.
    expect(characterFlips(after.events)).toHaveLength(2);
  });

  it("her cards turn up after the attack's own interrupts have resolved, then add to ATK", () => {
    const s = holding();
    const hero = identity(s.state);
    const [held] = heldBoostCardsOf(s.state, hero);
    const marked = playerCardIntoPlay(s.state, MARKER.id, P1).state;
    const before = mustInstance(marked, villain(marked)).damage;
    const after = run(marked, [
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: villain(marked) },
    ]);
    const resolved = after.events.findIndex(
      (e) => e.type === "abilityResolved" && (e.abilityId as string) === MARK.ref.id,
    );
    const flipped = after.events.findIndex((e) => e.type === "characterBoostCardFlipped");
    expect(resolved).toBeGreaterThanOrEqual(0);
    expect(flipped).toBeGreaterThan(resolved);
    // ATK 2 + 2.
    expect(mustInstance(after.state, villain(after.state)).damage).toBe(before + 4);
    expect(locateCard(after.state, held!)?.kind).toBe("encounterDiscard");
  });
});

describe("a 'cancel, then gains [boost]' after another cancel already took the Boost (RRG 1.8 \"'Then'\", p. 44)", () => {
  const option = (st: GameState, id: string) =>
    st.pendingChoice?.prompt.kind === "chooseTriggers"
      ? st.pendingChoice.options.find((o) => o.ref.kind === "ability" && (o.ref.abilityId as string) === id)
      : undefined;

  it("Wraith's cancel first: Killer Instinct's shape is no longer offered, and the card gains no icon", () => {
    const s = holding(1, copiesOf(HURTER.id, 20));
    const hero = identity(s.state);
    const withCancellers = playerCardIntoPlay(s.state, CANCELLERS.id, P1).state;
    let wraithTaken = false;
    let instinctAfter = 0;
    const before = mustInstance(withCancellers, hero).damage;
    const after = run(withCancellers, [thwart(hero, s.scheme)], (st) => {
      const wraith = option(st, WRAITH_CANCEL.ref.id);
      const instinct = option(st, INSTINCT.ref.id);
      if (wraithTaken && instinct) instinctAfter++;
      if (wraith && !wraithTaken) {
        wraithTaken = true;
        return [wraith.optionId];
      }
      if (instinct) return [instinct.optionId];
      return defaultPick(st);
    });
    expect(wraithTaken).toBe(true);
    expect(instinctAfter).toBe(0);
    expect(after.events.filter((e) => e.type === "boostCancelled")).toHaveLength(1);
    // Its Boost (1 damage to her) was cancelled; THW 2 + its 2 icons, no gained icon.
    expect(mustInstance(after.state, hero).damage).toBe(before);
    expect(mustInstance(after.state, s.scheme).threat).toBe(5);
  });

  it("taken alone, it cancels and the card gains the icon", () => {
    const s = holding(1, copiesOf(HURTER.id, 20));
    const hero = identity(s.state);
    const withCancellers = playerCardIntoPlay(s.state, CANCELLERS.id, P1).state;
    const after = run(withCancellers, [thwart(hero, s.scheme)], (st) => {
      const instinct = option(st, INSTINCT.ref.id);
      return instinct ? [instinct.optionId] : defaultPick(st);
    });
    // THW 2 + 2 icons + 1 gained.
    expect(mustInstance(after.state, s.scheme).threat).toBe(4);
  });
});

describe('the usingBasicPower predicate in a real use ("If Elektra is using a basic power")', () => {
  const usingNow = (st: GameState): boolean =>
    evaluate(st, { kind: "usingBasicPower" }, { selfInstanceId: null, controllerId: P1, event: null, bindings: {} });

  it("true while her held card resolves for her thwart; false before and after", () => {
    const s = holding();
    const hero = identity(s.state);
    const peeking = playerCardIntoPlay(s.state, PEEKER.id, P1).state;
    expect(usingNow(peeking)).toBe(false);
    const seen: boolean[] = [];
    const after = run(peeking, [thwart(hero, s.scheme)], (st) => {
      if (st.pendingChoice?.prompt.kind === "chooseTriggers") seen.push(usingNow(st));
      return defaultPick(st);
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
    expect(usingNow(after.state)).toBe(false);
  });

  it("false while the villain's card turns up in an attack she does not defend; true when she defends", () => {
    const s = start();
    const peeking = playerCardIntoPlay(s.state, PEEKER.id, P1).state;
    const watch = (defend: boolean) => {
      const seen: boolean[] = [];
      run(peeking, [{ type: "endTurn", playerId: P1 }], (st) => {
        const choice = st.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") return defend ? [identity(st)] : ["decline"];
        if (choice?.prompt.kind === "chooseTriggers" && st.stack.some((f) => f.kind === "enemyAttack"))
          seen.push(usingNow(st));
        return defaultPick(st);
      });
      return seen;
    };
    const undefended = watch(false);
    expect(undefended.length).toBeGreaterThan(0);
    expect(undefended.some(Boolean)).toBe(false);
    const defended = watch(true);
    expect(defended.length).toBeGreaterThan(0);
    expect(defended.every(Boolean)).toBe(true);
  });
});

describe("a villain's own boost card whose Boost gives it to a hero (`resolvingBoostCard`, its enemy branch)", () => {
  it("it leaves the villain for the hero, facedown and held, and its icons still count for the villain's attack", () => {
    // "[star] Boost: Give this card to your hero as a facedown boost card" as Rhino-shaped ATK 2's boost card; she
    // does not defend. Ruling January 11, 2024 #134: a boost card moved by its own Boost still counts.
    const s = start(copiesOf(BOOMERANG.id, 20));
    const hero = identity(s.state);
    const before = mustInstance(s.state, hero).damage;
    const after = run(s.state, [{ type: "endTurn", playerId: P1 }]);
    const flipped = after.events.find((e) => e.type === "boostCardFlipped");
    const card = flipped?.type === "boostCardFlipped" ? flipped.instanceId : undefined;
    expect(card).toBeDefined();
    expect(locateCard(after.state, card!)).toEqual({ kind: "boost", hostInstanceId: hero });
    expect(mustInstance(after.state, card!)).toMatchObject({ faceup: false, heldForBasicPowers: true });
    // ATK 2 + its 2 icons, undefended.
    expect(mustInstance(after.state, hero).damage).toBe(before + 4);
  });
});

describe("defending: both characters' cards in step 3, whose first chosen (R3 (B); Oct 12, 2026 R1)", () => {
  const defend = (state: GameState, first: "enemy" | "defender") => {
    const hero = identity(state);
    let asked = 0;
    const after = run(state, [{ type: "endTurn", playerId: P1 }], (s) => {
      const prompt = s.pendingChoice?.prompt.kind;
      if (prompt === "declareDefender") return [hero];
      if (prompt === "chooseOption" && s.pendingChoice?.options.some((o) => o.optionId === "defender")) {
        asked++;
        return [first];
      }
      return defaultPick(s);
    });
    return { ...after, asked };
  };
  const order = (events: readonly GameEvent[]) =>
    events.flatMap((e) =>
      e.type === "boostCardFlipped" ? ["enemy"] : e.type === "characterBoostCardFlipped" ? ["defender"] : [],
    );

  it("a hero without villainous holding a card: asked once; the defender's first", () => {
    const { state } = holding();
    const hero = identity(state);
    const before = mustInstance(state, hero).damage;
    const after = defend(state, "defender");
    expect(after.asked).toBe(1);
    expect(order(after.events)).toEqual(["defender", "enemy"]);
    // ATK 2 + 2 against DEF 2 + 2.
    expect(mustInstance(after.state, hero).damage).toBe(before);
  });

  it("the enemy's first", () => {
    const { state } = holding();
    const after = defend(state, "enemy");
    expect(after.asked).toBe(1);
    expect(order(after.events)).toEqual(["enemy", "defender"]);
  });

  it("a villainous hero holding one: all of hers (held, then the new one) together, before the villain's", () => {
    const { state } = holding();
    const hero = identity(state);
    const granted = { ...state, lastingEffects: [...state.lastingEffects, grantVillainous(hero)] };
    const before = mustInstance(state, hero).damage;
    const after = defend(granted, "defender");
    expect(order(after.events)).toEqual(["defender", "defender", "enemy"]);
    // ATK 2 + 2 against DEF 2 + 4: no damage.
    expect(mustInstance(after.state, hero).damage).toBe(before);
  });

  it("the enemy's first with two enemy cards: the order is recorded and the answer cleared before the second", () => {
    const s = holding();
    const withPeek = playerCardIntoPlay(s.state, PEEKER.id, P1).state;
    const two = run(withPeek, [use(s.desk, GIVE_VILLAIN)]).state;
    const hero = identity(two);
    const seen: { boostOrder?: string | undefined; answer: readonly string[] | null }[] = [];
    run(two, [{ type: "endTurn", playerId: P1 }], (st) => {
      const choice = st.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") return [hero];
      if (choice?.prompt.kind === "chooseOption" && choice.options.some((o) => o.optionId === "defender"))
        return ["enemy"];
      if (choice?.prompt.kind === "chooseTriggers") {
        const attack = st.stack.find((f) => f.kind === "enemyAttack");
        if (attack?.kind === "enemyAttack") seen.push({ boostOrder: attack.boostOrder, answer: attack.answer });
      }
      return defaultPick(st);
    });
    // The windows of the villain's two cards (the hero's own come after them).
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[1]).toEqual({ boostOrder: "enemy", answer: null });
  });

  it("nothing is asked when the hero has no card of its own", () => {
    const { state } = start();
    const after = defend(state, "defender");
    expect(after.asked).toBe(0);
  });
});
