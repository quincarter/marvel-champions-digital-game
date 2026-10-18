/**
 * docs/phase7-wave11.md §3.3: `EffectSpec replaceLeaveDestination { to: { separateDeck, at: "bottom" } }`, proven with
 * a synthetic "Sightless" identity shaped like Daredevil: 60001a/b "Forced Interrupt: When a Sense upgrade would leave
 * play, place it on the bottom of the Sense deck instead." It also brings a Gadget deck without `fixedOrder` as the
 * control, with the same interrupt for its Gadget upgrades.
 *
 * Sources: RRG 1.8 "Leaves Play" (p. 27: discard, defeat, the victory display and removal from the game are all leaving
 * play; attachments leave with their host), "'Would'" (p. 48), "Attach To" (p. 8), "Search" (p. 39: only a search
 * shuffles); RRG 1.8 FAQ "Rocket Raccoon (#29A)" (p. 61: a cost that discards is still paid) and the ruling of August
 * 3, 2026 R1 (Acute Tactility "discards first", so its cost is paid and the card is back in the Sense deck).
 *
 * Both decks keep a discard pile of their own here (`discardPile: "own"`), so a card the replacement did not move would
 * be seen in that pile, not sent home by the no-discard-pile backstop (`noDiscardPileDeckFor`).
 */

import { flat, trait, type AnyCard, type MainSchemeCard, type CardId, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer, separateDeckOf } from "./query.js";
import { cardsInPlay } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import {
  stubEnvironment,
  stubEvent,
  stubAlly,
  stubIdentity,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";
import { encounterCardInVillainArea, minionEngagedWith, playerCardIntoPlay } from "./testing/wave3.js";

const p1 = playerId("p1");
const SENSE = "Sense";
const GADGET = "Gadget";
const self = { kind: "self" } as const;
const one = { kind: "const", value: 1 } as const;

/** "Discard this card → deal 1 damage to the villain." (shaped like Radar Sense's cost). */
const RADAR = stubAbility("radar.action", {
  trigger: { kind: "action" },
  cost: { discardSelf: true },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: one }],
});
const deckCards = (deck: string, names: readonly string[]): readonly AnyCard[] =>
  names.map((name) => ({
    ...stubUpgrade({ id: `${deck}-${name}`, cost: 1, traits: [trait(deck)], abilities: [RADAR.ref] }),
    deckLimit: 0,
    separateDeck: deck,
    attachesTo: { kind: "anyOf", hosts: [{ kind: "enemy" }, { kind: "scheme" }] },
  }));
const SENSES = deckCards(SENSE, ["a", "b", "c", "d", "e"]);
const GADGETS = deckCards(GADGET, ["w", "x", "y", "z"]);

/** "Forced Interrupt: When a <deck> upgrade would leave play, place it on the bottom of the <deck> deck instead." */
const homeward = (deck: string, to = deck) =>
  stubAbility(`sightless.${deck}-home`, {
    trigger: {
      kind: "interrupt",
      forced: true,
      would: true,
      on: { on: "cardLeavesPlay", targetIs: { categories: ["upgrade"], trait: trait(deck) } },
    },
    effects: [
      { kind: "replaceLeaveDestination", to: { separateDeck: to, at: "bottom" } },
      { kind: "then", effects: [{ kind: "addCounters", target: self, counterType: "home", amount: one }] },
    ],
  });
const SENSE_HOME = homeward(SENSE);
const GADGET_HOME = homeward(GADGET);
/** A deck the identity does not have: nothing to replace. */
const ODD_HOME = homeward("Odd", "Nowhere");
const ODD = stubUpgrade({ id: "odd", cost: 0, traits: [trait("Odd")] });

/** Sensory Overload's question: "after a card enters play". */
const WITNESS_ENTERS = stubAbility("witness.enters", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay" } },
  effects: [{ kind: "addCounters", target: self, counterType: "entered", amount: one }],
});
/**
 * "Forced Interrupt: When an upgrade leaves play, …" (no "would") and "Forced Response: After an upgrade leaves play,
 * …".
 */
const upgradeLeaves = { on: "cardLeavesPlay", targetIs: { categories: ["upgrade"] } } as const;
const WITNESS_WHEN = stubAbility("witness.when-leaves", {
  trigger: { kind: "interrupt", forced: true, on: upgradeLeaves },
  effects: [{ kind: "addCounters", target: self, counterType: "when", amount: one }],
});
const WITNESS_AFTER = stubAbility("witness.after-leaves", {
  trigger: { kind: "response", forced: true, on: upgradeLeaves },
  effects: [{ kind: "addCounters", target: self, counterType: "after", amount: one }],
});
const WITNESS = stubSupport({
  id: "witness",
  cost: 0,
  abilities: [WITNESS_ENTERS.ref, WITNESS_WHEN.ref, WITNESS_AFTER.ref],
});

const HOMES = [SENSE_HOME, GADGET_HOME, ODD_HOME];
const SIGHTLESS: HeroIdentityCard = {
  ...stubIdentity({
    id: "sightless",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: HOMES.map((a) => a.ref),
    alterEgoAbilities: HOMES.map((a) => a.ref),
  }),
  separateDecks: [
    {
      name: SENSE,
      cards: SENSES.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: true,
      discardPile: "own",
      whenEmpty: "stayEmpty",
      fixedOrder: true,
      ownerMayLookThrough: true,
    },
    {
      name: GADGET,
      cards: GADGETS.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: false,
      discardPile: "own",
      whenEmpty: "stayEmpty",
    },
  ],
};

const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 3, boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank-leave-home", boostIcons: 0 });

/** A player event that resolves `effects`. */
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
const named = (name: string) => ({ kind: "each", query: { name } }) as const;
const ZAP_THUG = event("zap-thug", [
  { kind: "dealDamage", target: named("thug"), amount: { kind: "const", value: 5 } },
]);
const FOIL_PLOT = event("foil-plot", [
  { kind: "removeThreat", target: named("plot"), amount: { kind: "const", value: 5 } },
]);
const upgrades = { kind: "ref", ref: { kind: "each", query: { categories: ["upgrade"] } } } as const;
const TO_VICTORY = event("to-victory", [{ kind: "moveCards", cards: upgrades, to: "victoryDisplay" }]);
const TO_OBLIVION = event("to-oblivion", [{ kind: "moveCards", cards: upgrades, to: "removedFromGame" }]);
const DISCARD_ALL = event("discard-all", [{ kind: "discardFromPlay", target: upgrades.ref }]);
const ADVANCE = event("advance", [{ kind: "advanceMainScheme" }]);
const FLIP_SCHEME = event("flip-scheme", [
  { kind: "flipCard", target: { kind: "each", query: { categories: ["mainScheme"], name: "flipping" } } },
]);
const REMOVE_VILLAIN = event("remove-villain", [{ kind: "removeVillain", villain: { kind: "villain" } }]);
const EVENTS = [ZAP_THUG, FOIL_PLOT, TO_VICTORY, TO_OBLIVION, DISCARD_ALL, ADVANCE, FLIP_SCHEME, REMOVE_VILLAIN];

/** A two-stage main scheme (advanced), and one whose only stage flips to an environment (`flipMainSchemeStage`). */
const stage = { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) };
const TWO_STAGES = stubMainScheme({ id: "two-stages", stages: [stage, stage] });
const SCHEME_FACE = stubEnvironment({ id: "scheme-face" });
const RAW_FLIPPING = stubMainScheme({ id: "flipping", stages: [stage] });
const FLIPPING: MainSchemeCard = {
  ...RAW_FLIPPING,
  stages: [{ ...RAW_FLIPPING.stages[0]!, otherFaceId: SCHEME_FACE.id }],
};

/**
 * The wave 9 tuck is not a replacement effect (docs/phase7-wave9.md §3.20): "When an ally leaves play, tuck it under
 * here" (Abduct Superhumans 50081) has no "would" and no "instead" (RRG 1.8 "Replacement Effect", p. 37), so the ally's
 * own "when this leaves play" interrupt (Cyclops-style) and "after … leaves play" responses still answer its leaving.
 */
const VAULT_TUCK = stubAbility("vault.tuck", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [{ kind: "replaceLeaveDestination", to: { tuckedUnder: self } }],
});
const VAULT = stubSupport({ id: "vault", cost: 0, abilities: [VAULT_TUCK.ref] });
const markWitness = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: named("witness"),
  counterType,
  amount: one,
});
const OWN_WHEN = stubAbility("leaver.when", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [markWitness("allyWhen")],
});
const OWN_AFTER = stubAbility("leaver.after", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [markWitness("allyAfter")],
});
const LEAVER = stubAlly({ id: "leaver", cost: 1, atk: 1, thw: 1, hp: 3, abilities: [OWN_WHEN.ref, OWN_AFTER.ref] });
const DISCARD_LEAVER = event("discard-leaver", [{ kind: "discardFromPlay", target: named("leaver") }]);

const OTHERS = [
  VAULT_TUCK,
  OWN_WHEN,
  OWN_AFTER,
  DISCARD_LEAVER.ability,
  RADAR,
  WITNESS_ENTERS,
  WITNESS_WHEN,
  WITNESS_AFTER,
  ...EVENTS.map((e) => e.ability),
];
const deps: EngineDeps = depsOf(...HOMES, ...OTHERS);
/** No interrupt sends anything home: the control. */
const quietDeps: EngineDeps = depsOf(...OTHERS);

function started(using: EngineDeps, mainScheme: MainSchemeCard = MAIN_SCHEME): GameState {
  const result = createGame(
    {
      seed: 53,
      cards: [
        ...DEFAULT_CARDS,
        ...(mainScheme === MAIN_SCHEME ? [] : [mainScheme]),
        FLIPPING,
        SCHEME_FACE,
        VAULT,
        LEAVER,
        DISCARD_LEAVER.card,
        SIGHTLESS,
        ...SENSES,
        ...GADGETS,
        ODD,
        WITNESS,
        THUG,
        PLOT,
        BLANK,
        ...EVENTS.map((e) => e.card),
      ],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: mainScheme.id,
      encounterDeck: [THUG.id, PLOT.id, ...Array.from({ length: 12 }, (): CardId => BLANK.id)],
      players: [
        {
          identityCardId: SIGHTLESS.id,
          deck: [
            ...DEFAULT_DECK,
            ODD.id,
            WITNESS.id,
            VAULT.id,
            LEAVER.id,
            DISCARD_LEAVER.card.id,
            ...EVENTS.map((e) => e.card.id),
          ],
        },
      ],
    },
    using,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, using).state;
}

const deckOf = (state: GameState, name: string) => separateDeckOf(state, p1, name).deck;
const discardOf = (state: GameState, name: string) => separateDeckOf(state, p1, name).discard;
const villainOf = (state: GameState) =>
  Object.values(state.instances).find((i) => i.cardId === VILLAIN.id)!.instanceId as InstanceId;

/**
 * Test surgery: a second main scheme stage in play beside the central one (`extraMainSchemes`), whose only stage flips
 * to an environment. The only main scheme in play cannot flip (`flipMainSchemeStage`).
 */
function withFlippingScheme(state: GameState) {
  const id = "flipping-1" as InstanceId;
  const central = mustInstance(state, state.mainScheme.instanceId);
  const next: GameState = {
    ...state,
    instances: { ...state.instances, [id]: { ...central, instanceId: id, cardId: FLIPPING.id, attachments: [] } },
    extraMainSchemes: [{ instanceId: id, cardId: FLIPPING.id, stageIndex: 0, completed: false, accelerationTokens: 0 }],
  };
  return { state: next, id };
}

/** Test surgery: the `index`-th card of a separate deck attached to `host`, faceup, under p1's control. */
function attachFromDeck(state: GameState, name: string, index: number, host: InstanceId) {
  const id = deckOf(state, name)[index] as InstanceId;
  const piles = separateDeckOf(state, p1, name);
  const next: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === p1
        ? {
            ...p,
            separateDecks: { ...p.separateDecks, [name]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
          }
        : p,
    ),
    instances: {
      ...state.instances,
      [id]: { ...mustInstance(state, id), attachedTo: host, faceup: true, controllerId: p1 },
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, id] },
    },
  };
  return { state: next, id };
}

/** Test surgery: a player card from p1's deck attached to `host`. */
function attachFromPlayerDeck(state: GameState, card: CardId, host: InstanceId) {
  const given = giveCard(state, p1, card);
  const seat = mustPlayer(given.state, p1);
  const next: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === p1 ? { ...p, hand: seat.hand.filter((x) => x !== given.id) } : p,
    ),
    instances: {
      ...given.state.instances,
      [given.id]: { ...mustInstance(given.state, given.id), attachedTo: host, faceup: true, controllerId: p1 },
      [host]: {
        ...mustInstance(given.state, host),
        attachments: [...mustInstance(given.state, host).attachments, given.id],
      },
    },
  };
  return { state: next, id: given.id };
}

function playEvent(start: GameState, fx: (typeof EVENTS)[number], using = deps, pick = defaultPick) {
  const given = giveCard(start, p1, fx.card.id);
  const command: Command = {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return runCommandsPicking(given.state, using, pick, command);
}

const returned = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "returnedToSeparateDeck" ? [{ id: e.instanceId, instead: e.instead, replaced: e.replaced }] : [],
  );
const discardedFromPlay = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "cardDiscardedFromPlay" ? [e.instanceId] : []));
const shuffled = (name: string) => (e: GameEvent) =>
  e.type === "deckShuffled" && e.zone.kind === "separateDeck" && e.zone.name === name;
const homeCounters = (state: GameState) => mustPlayer(state, p1).identity.instanceId;
const homes = (state: GameState) => mustInstance(state, homeCounters(state)).counters.home ?? 0;
const unresolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "preThenUnresolved" ? [e.cause] : []));
function expectReplays(session: GameSession, using = deps) {
  const replayed = replay(session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§3.20 a tuck is no replacement effect: the tucked ally's leaving keeps its interrupts and responses", () => {
  it.each([
    ["the tuck first", (ids: readonly string[]) => ids],
    ["the ally's own interrupt first", (ids: readonly string[]) => [...ids].reverse()],
  ] as const)("%s: tucked, and both the ally's interrupt and its response fire", (_which, order) => {
    const witness = playerCardIntoPlay(started(deps), WITNESS.id, p1);
    const vault = playerCardIntoPlay(witness.state, VAULT.id, p1);
    const leaver = playerCardIntoPlay(vault.state, LEAVER.id, p1);
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "orderTriggers") return order(choice.options.map((o) => o.optionId));
      return defaultPick(state);
    };
    const { state, session } = playEvent(leaver.state, DISCARD_LEAVER, deps, pick);
    expect(mustInstance(state, vault.id).tucked).toEqual([leaver.id]);
    const counters = mustInstance(state, witness.id).counters;
    expect([counters.allyWhen ?? 0, counters.allyAfter ?? 0]).toEqual([1, 1]);
    expectReplays(session);
  });
});

describe("§3.3 a leaving card goes to the bottom of its separate deck instead", () => {
  it("discarded as its own cost: the bottom of the Sense deck, facedown; the cost is paid and the damage resolves", () => {
    const start = started(deps);
    const put = attachFromDeck(start, SENSE, 0, villainOf(start));
    const rest = deckOf(put.state, SENSE);
    const command: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: put.id,
      abilityId: RADAR.ref.id,
      payment: [],
    };
    const { state, events, session } = runCommands(put.state, deps, command);
    expect(deckOf(state, SENSE)).toEqual([...rest, put.id]);
    expect(mustInstance(state, put.id)).toMatchObject({ faceup: false, attachedTo: null, damage: 0 });
    expect(discardOf(state, SENSE)).toEqual([]);
    expect(mustInstance(state, villainOf(state)).damage).toBe(1);
    // Not a discard, so nothing hears one; logged as sent home by a replacement, from where it was going.
    expect(discardedFromPlay(events)).toEqual([]);
    expect(returned(events)).toEqual([{ id: put.id, instead: "separateDiscard", replaced: true }]);
    expect(homes(state)).toBe(1);
    expectReplays(session);
  });

  it("with no interrupt (the control): the same cost puts it in the Sense deck's own discard pile", () => {
    const start = started(quietDeps);
    const put = attachFromDeck(start, SENSE, 0, villainOf(start));
    const command: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: put.id,
      abilityId: RADAR.ref.id,
      payment: [],
    };
    const { state, events } = runCommands(put.state, quietDeps, command);
    expect(discardOf(state, SENSE)).toEqual([put.id]);
    expect(deckOf(state, SENSE)).not.toContain(put.id);
    expect(returned(events)).toEqual([]);
  });

  it("the minion it is attached to is defeated: the attachment leaves with its host, to the bottom of the deck", () => {
    const minion = minionEngagedWith(started(deps), THUG.id, p1);
    const put = attachFromDeck(minion.state, SENSE, 2, minion.id);
    const rest = deckOf(put.state, SENSE);
    const { state, events, session } = playEvent(put.state, ZAP_THUG);
    expect(cardsInPlay(state)).not.toContain(minion.id);
    expect(deckOf(state, SENSE)).toEqual([...rest, put.id]);
    expect(discardOf(state, SENSE)).toEqual([]);
    expect(discardedFromPlay(events)).not.toContain(put.id);
    expect(returned(events)).toEqual([{ id: put.id, instead: "separateDiscard", replaced: true }]);
    // It left play, but its leaving was replaced: no "resolved" line and no responses (RRG 1.8 "Replacement
    // Effect", p. 37; "'Would'", p. 48); the log's
    // `returnedToSeparateDeck` says where it went.
    const left = events.flatMap((e) =>
      e.type === "triggerEvent" &&
      e.phase === "resolved" &&
      e.event.kind === "cardLeavesPlay" &&
      e.event.instanceId === put.id
        ? [e.event.to]
        : [],
    );
    expect(left).toEqual([]);
    expectReplays(session);
  });

  it.each([
    ["first", (ids: readonly string[]) => ids],
    ["last", (ids: readonly string[]) => [...ids].reverse()],
  ] as const)(
    "a side scheme with two Sense upgrades is defeated, the %s attached one resolved first: both at the bottom, in that order",
    (_which, choose) => {
      const scheme = encounterCardInVillainArea(started(deps), PLOT.id, 3);
      const a = attachFromDeck(scheme.state, SENSE, 0, scheme.id);
      const b = attachFromDeck(a.state, SENSE, 0, scheme.id);
      const rest = deckOf(b.state, SENSE);
      // The two forced interrupts are simultaneous: the first player orders them (RRG 1.8 "First Player", p. 19). The
      // identity's one ability answers both leavings, so its options are `@0` (the first attached, a) and `@1` (b).
      const order: InstanceId[] = [];
      const pick = (state: GameState): readonly string[] => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "orderTriggers" && choice.options.length === 2) {
          const picked = choose(choice.options.map((o) => o.optionId));
          order.push(...(picked[0]?.endsWith("@0") ? [a.id, b.id] : [b.id, a.id]));
          return picked;
        }
        return defaultPick(state);
      };
      const { state, events, session } = playEvent(b.state, FOIL_PLOT, deps, pick);
      expect(cardsInPlay(state)).not.toContain(scheme.id);
      const tail = deckOf(state, SENSE).slice(rest.length);
      expect(new Set(tail)).toEqual(new Set([a.id, b.id]));
      expect(deckOf(state, SENSE).slice(0, rest.length)).toEqual(rest);
      expect(order).toHaveLength(2);
      expect(tail).toEqual(order);
      expect(returned(events).map((r) => r.id)).toEqual(tail);
      expect(homes(state)).toBe(2);
      expectReplays(session);
    },
  );

  it("sent to the victory display or removed from the game: the bottom of the deck instead", () => {
    for (const fx of [TO_VICTORY, TO_OBLIVION]) {
      const start = started(deps);
      const put = attachFromDeck(start, SENSE, 1, villainOf(start));
      const rest = deckOf(put.state, SENSE);
      const { state, events, session } = playEvent(put.state, fx);
      expect(deckOf(state, SENSE)).toEqual([...rest, put.id]);
      expect(state.victoryDisplay).not.toContain(put.id);
      expect(returned(events)).toEqual([
        { id: put.id, instead: fx === TO_VICTORY ? "victoryDisplay" : "removedFromGame", replaced: true },
      ]);
      expectReplays(session);
    }
  });

  it("a deck without fixed order (the control): the bottom of that deck, and it is not shuffled", () => {
    const start = started(deps);
    const put = attachFromDeck(start, GADGET, 1, villainOf(start));
    const rest = deckOf(put.state, GADGET);
    const { state, events, session } = playEvent(put.state, DISCARD_ALL);
    expect(deckOf(state, GADGET)).toEqual([...rest, put.id]);
    expect(discardOf(state, GADGET)).toEqual([]);
    expect(events.some(shuffled(GADGET))).toBe(false);
    expectReplays(session);
  });

  it("nothing entered play: an 'after a card enters play' response does not fire", () => {
    const witness = playerCardIntoPlay(started(deps), WITNESS.id, p1);
    const put = attachFromDeck(witness.state, SENSE, 0, villainOf(witness.state));
    const { state } = playEvent(put.state, DISCARD_ALL);
    expect(deckOf(state, SENSE)).toContain(put.id);
    expect(mustInstance(state, witness.id).counters.entered ?? 0).toBe(0);
  });

  it.each([
    ["on its own", false],
    ["with its host", true],
  ] as const)(
    "replaced %s: no further interrupt and no response to that leaving (RRG 1.8 'Replacement Effect', p. 37; 'Would', p. 48)",
    (_how, withHost) => {
      const witness = playerCardIntoPlay(started(deps), WITNESS.id, p1);
      const minion = minionEngagedWith(witness.state, THUG.id, p1);
      const put = attachFromDeck(minion.state, SENSE, 0, withHost ? minion.id : villainOf(minion.state));
      const { state } = playEvent(put.state, withHost ? ZAP_THUG : DISCARD_ALL);
      expect(deckOf(state, SENSE)).toContain(put.id);
      const counters = mustInstance(state, witness.id).counters;
      expect([counters.when ?? 0, counters.after ?? 0]).toEqual([0, 0]);
      // The control: an upgrade nothing replaces still hears both.
      const odd = attachFromPlayerDeck(witness.state, ODD.id, villainOf(witness.state));
      const plain = playEvent(odd.state, DISCARD_ALL, quietDeps).state;
      const heard = mustInstance(plain, witness.id).counters;
      expect([heard.when ?? 0, heard.after ?? 0]).toEqual([1, 1]);
    },
  );

  it.each([
    ["the main scheme advances", ADVANCE, TWO_STAGES],
    ["a main scheme stage flips to an environment", FLIP_SCHEME, MAIN_SCHEME],
    ["the villain is removed from the game", REMOVE_VILLAIN, MAIN_SCHEME],
  ] as const)("its host leaves play without a defeat (%s): the bottom of the deck", (_how, fx, scheme) => {
    const flipping = fx === FLIP_SCHEME ? withFlippingScheme(started(deps)) : null;
    const start = flipping?.state ?? started(deps, scheme);
    const host = flipping?.id ?? (fx === REMOVE_VILLAIN ? villainOf(start) : start.mainScheme.instanceId);
    const put = attachFromDeck(start, SENSE, 0, host);
    const rest = deckOf(put.state, SENSE);
    const { state, events, session } = playEvent(put.state, fx);
    expect(mustInstance(state, put.id).attachedTo).toBeNull();
    expect(deckOf(state, SENSE)).toEqual([...rest, put.id]);
    expect(discardOf(state, SENSE)).toEqual([]);
    expect(discardedFromPlay(events)).not.toContain(put.id);
    expect(returned(events)).toEqual([{ id: put.id, instead: "separateDiscard", replaced: true }]);
    expect(homes(state)).toBe(1);
    // A flipped stage stays in play as its other face, with nothing attached (RRG 1.8 "Flip", p. 20).
    if (flipping) expect(mustInstance(state, flipping.id)).toMatchObject({ cardId: SCHEME_FACE.id, attachments: [] });
    expectReplays(session);
  });

  it("a deck its owner does not have: not replaced, discarded as normal, and the text after 'Then' is skipped", () => {
    const start = started(deps);
    const put = attachFromPlayerDeck(start, ODD.id, villainOf(start));
    const { state, events } = playEvent(put.state, DISCARD_ALL);
    expect(mustPlayer(state, p1).discard).toContain(put.id);
    expect(unresolved(events)).toContain("leaveNotReplaced");
    expect(homes(state)).toBe(0);
  });
});
