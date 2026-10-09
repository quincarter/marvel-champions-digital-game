/**
 * docs/phase7-wave8.md §3.48: "Play with the top card of your deck faceup." (`RuleSpec topOfDeckFaceup`), the third
 * exception to a deck being closed, and `Predicate topOfDeckFaceup`, the one predicate that reads a deck's top card.
 * Proven with synthetic cards shaped like Magik's kit (`aoa` 45030a and 45033 to 45040), each test driving real commands.
 *
 * Sources: RRG 1.8 FAQ "Magik (#30A)" (p. 64), first entry: when the top card leaves, "she turns the new top card of
 * her deck faceup" at once; "Player Deck" (p. 33): the deck's order does not change; "Look, Looked-At" (p. 27): a card
 * kept faceup is not looked at, so nothing triggers; "'Swap'" (p. 42): a swapped card takes the other's place; "Text
 * Box" (p. 44): a blank text box has no constant. Owner decision §4.1 Q26 = B: a facedown top card satisfies no
 * condition, because the game does not read a hidden card to answer a question about it.
 *
 * The test numbers in the titles are §3.48's; §3.50's tests 1 and 7 are the two that need only the engine.
 */

import type { AnyCard, CardId, HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, deckTopFaceupPlayers, evaluate, shownDeckTop } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubResource, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, RESOURCE, TREACHERY, VILLAIN } from "./testing/scenario.js";
import { copiesOf, P1, P2 } from "./testing/wave3.js";
import { faceVisible, zoneHidden } from "./visibility.js";

const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const n = (value: number): ValueSpec => ({ kind: "const", value });
const SELF = { categories: ["identity"], controller: "you" } as const;
const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): StubAbility => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub;
};
/** A 0-cost event with one action. */
const event = (id: string, effects: readonly EffectSpec[], icons: Parameters<typeof stubEvent>[0]["resourceIcons"]) =>
  stubEvent({
    id,
    cost: 0,
    abilities: [ability(`${id}.action`, { trigger: { kind: "action" }, effects }).ref],
    ...(icons ? { resourceIcons: icons } : {}),
  });

// --- The cards the top of the deck is read for: their printed icons are what matters. ---------------------------------
const CLOBBER = stubResource({ id: "clobber", icons: 0, produces: { physical: 1 } });
const CROWN = stubResource({ id: "crown", icons: 0, produces: { mental: 1 } });
const ARMOR = stubResource({ id: "armor", icons: 0, produces: { energy: 1 } });
const BLOODGEM = stubResource({ id: "bloodgem", icons: 1 });
const GENIUS = stubResource({ id: "genius", icons: 0, produces: { mental: 2 } });

/** "If the top card of your deck has a [physical] or [wild] resource icon" (§3.50's helper, as plain data). */
const TOP_HAS_PHYSICAL: Predicate = {
  kind: "topOfDeckFaceup",
  player: you,
  matches: { anyPrintedResource: ["physical", "wild"] },
};
const TOP_IS_FACEUP: Predicate = { kind: "topOfDeckFaceup", player: you };

// --- The hero: "Play with the top card of your deck faceup." on the hero face. ---------------------------------------
const FACEUP = ability("magik.constant", {
  trigger: { kind: "constant", rules: [{ kind: "topOfDeckFaceup", player: you }] },
  effects: [],
});
const identity = (id: string, heroAbilities: readonly StubAbility[]): HeroIdentityCard =>
  stubIdentity({
    id,
    hp: 10,
    atk: 2,
    thw: 1,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    heroAbilities: heroAbilities.map((a) => a.ref),
  });
const MAGIK = identity("magik", [FACEUP]);
/** The same line with a `while`: "…while there is no veil counter on your identity". */
const VEILED_RULE = ability("veiled.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "topOfDeckFaceup",
        player: you,
        while: { kind: "not", of: { kind: "counterAtLeast", of: yourIdentity, counterType: "veil", amount: 1 } },
      },
    ],
  },
  effects: [],
});
const VEILED = identity("veiled", [VEILED_RULE]);

// --- What moves cards. ----------------------------------------------------------------------------------------------
/** Spiritual Meditation: "Draw 2 cards. Choose and discard 1 card from your hand." */
const MEDITATION = event(
  "meditation",
  [
    { kind: "draw", player: you, amount: n(2) },
    { kind: "discardFromHand", player: you, amount: n(1) },
  ],
  undefined,
);
/** A mission attempt's discards: "Discard the top 2 cards of your deck." */
const MILL_TWO = event(
  "mill-two",
  [{ kind: "moveCards", cards: { kind: "zone", zone: "deck", player: you, top: n(2) }, to: "discard" }],
  undefined,
);
const SHUFFLE = event("shuffle", [{ kind: "shuffleDeck", player: you }], undefined);
/** "Search your deck for Mystical Armor and add it to your hand." (a find: the deck is shuffled afterwards). */
const SEARCH = event("search", [{ kind: "findCard", query: { name: ARMOR.name }, owner: you, to: "hand" }], undefined);
/** "Put Magik's Crown from your hand on top of your deck." */
const PUT_ON_TOP = event(
  "put-on-top",
  [
    {
      kind: "moveCards",
      cards: { kind: "zone", zone: "hand", player: you, filter: { name: CROWN.name } },
      to: "deckTop",
    },
  ],
  undefined,
);
/** Soul Strike, as a card to hold: its [physical] icon, and a tally that is its "stun that enemy" sentence. */
const SOUL_STRIKE = event(
  "soul-strike",
  [
    { kind: "addCounters", target: yourIdentity, counterType: "played", amount: n(1) },
    {
      kind: "if",
      condition: TOP_HAS_PHYSICAL,
      then: [{ kind: "addCounters", target: yourIdentity, counterType: "stunned", amount: n(1) }],
    },
  ],
  { physical: 1 },
);
/** Limbo: "Swap a card in your hand with the top card of your deck." */
const LIMBO = event(
  "limbo",
  [
    {
      kind: "chooseCards",
      slot: "held",
      from: { kind: "zone", zone: "hand", player: you, filter: { name: SOUL_STRIKE.name } },
      chooser: you,
      min: 1,
      max: 1,
    },
    {
      kind: "chooseCards",
      slot: "top",
      from: { kind: "zone", zone: "deck", player: you, top: n(1) },
      chooser: you,
      min: 1,
      max: 1,
    },
    { kind: "swapCards", a: { kind: "slot", slot: "held" }, b: { kind: "slot", slot: "top" } },
  ],
  undefined,
);
/** "Change form." as an effect, which is not the one voluntary change a round. */
const FLIP = event("flip", [{ kind: "changeForm", player: you }], undefined);
const VEIL = event(
  "veil",
  [{ kind: "addCounters", target: yourIdentity, counterType: "veil", amount: n(1) }],
  undefined,
);
const UNVEIL = event("unveil", [{ kind: "removeCounters", target: yourIdentity, counterType: "veil" }], undefined);

/** Pestilence's blank as a card in play: "Treat your identity's printed text box as if it were blank." */
const BLANK_RULE = ability("blank.constant", {
  trigger: { kind: "constant", rules: [{ kind: "blankTextBox", target: SELF }] },
  effects: [],
});
const BLANK = { ...stubUpgrade({ id: "blank", cost: 0, abilities: [BLANK_RULE.ref] }) };
const UNBLANK = event(
  "unblank",
  [{ kind: "discardFromPlay", target: { kind: "each", query: { name: BLANK.name } } }],
  undefined,
);
/** Soulsword: "Magik gets +1 ATK while the top card of your deck has a [physical] or [wild] resource icon." */
const SOULSWORD_RULE = ability("soulsword.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 1, target: SELF, while: TOP_HAS_PHYSICAL }] },
  effects: [],
});
const SOULSWORD = stubUpgrade({ id: "soulsword", cost: 0, abilities: [SOULSWORD_RULE.ref] });
/** A card that stays in play and draws: "Action: Draw 1 card." */
const WELL_DRAW = ability("well.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "draw", player: you, amount: n(1) }],
});
const WELL = stubUpgrade({ id: "well", cost: 0, abilities: [WELL_DRAW.ref] });

const KIT: readonly AnyCard[] = [
  CLOBBER,
  CROWN,
  ARMOR,
  BLOODGEM,
  GENIUS,
  MEDITATION,
  MILL_TWO,
  SHUFFLE,
  SEARCH,
  PUT_ON_TOP,
  SOUL_STRIKE,
  LIMBO,
  FLIP,
  VEIL,
  UNVEIL,
  BLANK,
  UNBLANK,
  SOULSWORD,
  WELL,
];
const deps: EngineDeps = depsOf(...abilities);

/** Two seats at the first turn: P1 plays `hero`, P2 the plain stub hero, both with two copies of every kit card. */
function table(hero: HeroIdentityCard = MAGIK): GameState {
  const result = createGame(
    {
      seed: 48,
      cards: [...DEFAULT_CARDS, hero, ...KIT],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copiesOf(TREACHERY.id, 30),
      players: [hero, HERO].map((card) => ({
        identityCardId: card.id,
        deck: [...copiesOf(RESOURCE.id, 8), ...KIT.flatMap((kit) => [kit.id, kit.id])],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

/**
 * Test surgery, before a session starts (so its log replays): P1's hand, deck (top first) and discard pile hold exactly
 * the named cards, and every other card P1 owns out of play is out of the game.
 */
function arrange(
  state: GameState,
  zones: {
    readonly hand?: readonly AnyCard[];
    readonly deck: readonly AnyCard[];
    readonly discard?: readonly AnyCard[];
  },
  player: PlayerId = P1,
): GameState {
  const seat = mustPlayer(state, player);
  const pool = [...seat.hand, ...seat.deck, ...seat.discard];
  const take = (cards: readonly AnyCard[]): InstanceId[] =>
    cards.map((card) => {
      const at = pool.findIndex((id) => state.instances[id]!.cardId === card.id);
      if (at < 0) throw new Error(`${player} has no spare ${card.id}`);
      return pool.splice(at, 1)[0]!;
    });
  const hand = take(zones.hand ?? []);
  const deck = take(zones.deck);
  const discard = take(zones.discard ?? []);
  return {
    ...state,
    removedFromGame: [...state.removedFromGame, ...pool],
    players: state.players.map((p) => (p.playerId === player ? { ...p, hand, deck, discard } : p)),
  };
}

const inHand = (state: GameState, card: AnyCard, player: PlayerId = P1): InstanceId => {
  const id = mustPlayer(state, player).hand.find((x) => state.instances[x]!.cardId === card.id);
  if (!id) throw new Error(`${player} holds no ${card.id}`);
  return id;
};
const inPlay = (state: GameState, card: AnyCard): InstanceId => {
  const id = cardsInPlay(state).find((x) => state.instances[x]!.cardId === card.id);
  if (!id) throw new Error(`no ${card.id} in play`);
  return id;
};
const play = (state: GameState, card: AnyCard, player: PlayerId = P1): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: inHand(state, card, player),
  payment: [],
  attachToInstanceId: null,
});
const toHero = (player: PlayerId = P1): Command => ({ type: "changeForm", playerId: player });

interface Run {
  readonly session: GameSession;
  readonly state: GameState;
  /** The events of the last step only. */
  readonly events: readonly GameEvent[];
}
const begin = (state: GameState): Run => ({ session: startSession(state), state, events: [] });
/** One command (built from the state it is applied to), choices answered with the default pick. */
function step(run: Run, command: Command | ((state: GameState) => Command)): Run {
  const next = typeof command === "function" ? command(run.state) : command;
  const { session, events } = driveSession(run.session, deps, [next]);
  return { session, state: session.state, events };
}
function expectReplays(run: Run): void {
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.state);
}

const deckOf = (state: GameState, player: PlayerId = P1) => mustPlayer(state, player).deck;
const cardAt = (state: GameState, id: InstanceId | undefined): CardId | undefined =>
  id === undefined ? undefined : mustInstance(state, id).cardId;
const SEATS = [P1, P2] as const;
/** Whether every seat, and the table with no seat named, reads the card's face. */
const everySeatSees = (state: GameState, id: InstanceId): boolean[] => [
  ...SEATS.map((viewer) => faceVisible(state, id, { viewer, deps })),
  faceVisible(state, id, { deps }),
];
const shown = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "deckTopShown" ? [{ playerId: e.playerId, instanceId: e.instanceId }] : []));
const hidden = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "deckTopHidden" ? [e.playerId] : []));
const holds = (state: GameState, predicate: Predicate, player: PlayerId = P1): boolean =>
  evaluate(state, predicate, { selfInstanceId: null, controllerId: player, event: null, bindings: {}, deps });
const atk = (state: GameState): number | undefined =>
  characterProfile(state, mustPlayer(state, P1).identity.instanceId, deps)?.atk;
const counter = (state: GameState, name: string): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters[name] ?? 0;

/** Magik in hero form with `deck` (top first) and `hand`. */
function inHeroForm(zones: Parameters<typeof arrange>[1], hero: HeroIdentityCard = MAGIK): Run {
  return step(begin(arrange(table(hero), zones)), toHero());
}

describe("§3.48 the top card of a player's deck kept faceup", () => {
  it("1. hero form, Clobber on top: every seat sees Clobber on her deck, and nobody the card under it", () => {
    const before = arrange(table(), { deck: [CLOBBER, GENIUS, CROWN] });
    // Alter-ego form: the line is on the hero face, so nothing is showing and nothing has been logged.
    expect(everySeatSees(before, deckOf(before)[0]!)).toEqual([false, false, false]);
    expect(before.deckTopsAnnounced).toBeUndefined();

    const run = step(begin(before), toHero());
    const [top, second] = deckOf(run.state);
    expect(cardAt(run.state, top)).toBe(CLOBBER.id);
    expect(everySeatSees(run.state, top!)).toEqual([true, true, true]);
    expect(everySeatSees(run.state, second!)).toEqual([false, false, false]);
    expect(shownDeckTop(run.state, deps, P1)).toBe(top);
    expect(deckTopFaceupPlayers(run.state, deps)).toEqual([P1]);
    // The preview's truncation rule reads the same answer: the top card is open, the one under it closed.
    expect(zoneHidden(run.state, top!, { deps })).toBe(false);
    expect(zoneHidden(run.state, second!, { deps })).toBe(true);
    // Derived, never stored on the card: its flag is untouched, the deck's order too, and it is still in the deck.
    expect(mustInstance(run.state, top!).faceup).toBe(false);
    expect(deckOf(run.state)).toEqual(deckOf(before));
    // With no rules to read (no deps) the answer is the zone's: closed.
    expect(faceVisible(run.state, top!)).toBe(false);
    // One log line for the card turned faceup, and the log's memory of it.
    expect(shown(run.events)).toEqual([{ playerId: P1, instanceId: top }]);
    expect(hidden(run.events)).toEqual([]);
    expect(run.state.deckTopsAnnounced).toEqual({ [P1]: top });
    // The second player's deck is as closed as ever.
    expect(everySeatSees(run.state, deckOf(run.state, P2)[0]!)).toEqual([false, false, false]);
    expect(shownDeckTop(run.state, deps, P2)).toBeNull();
    expectReplays(run);
  });

  it("2. Spiritual Meditation draws 2: two deckTopShown, the second card then the third, each before the next draw", () => {
    const start = inHeroForm({ hand: [MEDITATION, RESOURCE], deck: [CLOBBER, GENIUS, CROWN, ARMOR] });
    const [first, second, third] = deckOf(start.state);
    const run = step(start, (state) => play(state, MEDITATION));

    expect(shown(run.events)).toEqual([
      { playerId: P1, instanceId: second },
      { playerId: P1, instanceId: third },
    ]);
    // One card at a time: the second card shows after the first draw and before it is drawn itself.
    const trace = run.events.flatMap((e) =>
      e.type === "cardDrawn" ? [`drawn:${e.instanceId}`] : e.type === "deckTopShown" ? [`shown:${e.instanceId}`] : [],
    );
    expect(trace).toEqual([`drawn:${first}`, `shown:${second}`, `drawn:${second}`, `shown:${third}`]);
    expect(cardAt(run.state, deckOf(run.state)[0])).toBe(CROWN.id);
    expect(everySeatSees(run.state, third!)).toEqual([true, true, true]);
    expect(deckOf(run.state)).toHaveLength(2);
    // Drawn 2, discarded 1 of the 3 then in hand; the discard from hand changes nothing on the deck.
    expect(mustPlayer(run.state, P1).hand).toHaveLength(2);
    expect(run.state.deckTopsAnnounced).toEqual({ [P1]: third });
    expectReplays(run);
  });

  it("3. alter-ego form hides it (deckTopHidden); back to hero form with nothing moved, the same card shows", () => {
    const start = inHeroForm({ hand: [FLIP, FLIP], deck: [CLOBBER, GENIUS] });
    const top = deckOf(start.state)[0]!;

    const alterEgo = step(start, (state) => play(state, FLIP));
    expect(mustPlayer(alterEgo.state, P1).identity.form).toBe("alterEgo");
    expect(hidden(alterEgo.events)).toEqual([P1]);
    expect(shown(alterEgo.events)).toEqual([]);
    expect(everySeatSees(alterEgo.state, top)).toEqual([false, false, false]);
    expect(alterEgo.state.deckTopsAnnounced).toBeUndefined();
    expect(holds(alterEgo.state, TOP_IS_FACEUP)).toBe(false);

    const hero = step(alterEgo, (state) => play(state, FLIP));
    expect(deckOf(hero.state)).toEqual(deckOf(start.state));
    expect(shown(hero.events)).toEqual([{ playerId: P1, instanceId: top }]);
    expect(hidden(hero.events)).toEqual([]);
    expect(everySeatSees(hero.state, top)).toEqual([true, true, true]);
    expectReplays(hero);
  });

  it("4. Limbo swaps Soul Strike in hand with Clobber on top: Soul Strike shows, Clobber is in hand", () => {
    const start = inHeroForm({ hand: [LIMBO, SOUL_STRIKE], deck: [CLOBBER, GENIUS, CROWN] });
    const [clobber, under] = deckOf(start.state);
    const strike = inHand(start.state, SOUL_STRIKE);
    const run = step(start, (state) => play(state, LIMBO));

    expect(deckOf(run.state)[0]).toBe(strike);
    expect(mustPlayer(run.state, P1).hand).toEqual([clobber]);
    // One line, for the card that took the top: the card under Clobber was never the top card.
    expect(shown(run.events)).toEqual([{ playerId: P1, instanceId: strike }]);
    expect(everySeatSees(run.state, strike)).toEqual([true, true, true]);
    expect(everySeatSees(run.state, under!)).toEqual([false, false, false]);
    expect(deckOf(run.state)).toHaveLength(3);
    expectReplays(run);
  });

  it("5. a deck of 2 and 6 in the discard pile, Spiritual Meditation: the new deck's top card shows, then the deal", () => {
    const pile = [RESOURCE, RESOURCE, RESOURCE, CROWN, ARMOR, BLOODGEM];
    const start = inHeroForm({ hand: [MEDITATION, RESOURCE], deck: [CLOBBER, GENIUS], discard: pile });
    const [first, second] = deckOf(start.state);
    const meditation = inHand(start.state, MEDITATION);
    const run = step(start, (state) => play(state, MEDITATION));

    const seat = mustPlayer(run.state, P1);
    // Both drawn; the 6 cards are the new deck, Spiritual Meditation not among them (ruling April 30, 2026, 3 (7)).
    expect(seat.deck).toHaveLength(6);
    expect(seat.deck).not.toContain(meditation);
    expect(seat.hand).toHaveLength(2);
    expect(seat.discard).toHaveLength(2);
    expect(seat.discard).toContain(meditation);
    expect(seat.dealtEncounter).toHaveLength(1);
    // The second card showed after the first draw; the emptied deck showed nothing; the new top card shows.
    expect(shown(run.events)).toEqual([
      { playerId: P1, instanceId: second },
      { playerId: P1, instanceId: seat.deck[0] },
    ]);
    expect(hidden(run.events)).toEqual([]);
    expect(everySeatSees(run.state, seat.deck[0]!)).toEqual([true, true, true]);
    // In order: the reset, its top card shown, the facedown encounter card dealt, the discard from hand.
    const order = run.events.flatMap((e) => {
      if (e.type === "playerDeckReset") return ["reset"];
      if (e.type === "deckTopShown" && e.instanceId === seat.deck[0]) return ["shown"];
      if (e.type === "cardMoved" && e.to.kind === "dealtEncounter") return ["dealt"];
      if (e.type === "cardMoved" && e.from.kind === "hand" && e.to.kind === "discard") return ["discarded"];
      return [];
    });
    expect(order).toEqual(["reset", "shown", "dealt", "discarded"]);
    expect([first, second].every((id) => !seat.deck.includes(id!))).toBe(true);
    expectReplays(run);
  });

  it("6. a blank text box hides it and no 'top card has' condition is met; unblanked, the same card shows (Q26 = B)", () => {
    const start = inHeroForm({
      hand: [SOULSWORD, BLANK, SOUL_STRIKE, UNBLANK, SOUL_STRIKE],
      deck: [CLOBBER, GENIUS],
    });
    const top = deckOf(start.state)[0]!;
    const armed = step(start, (state) => play(state, SOULSWORD));
    // §3.50 test 7: Soulsword in play and Clobber ([physical]) on top, ATK 3.
    expect(atk(armed.state)).toBe(3);
    expect(holds(armed.state, TOP_HAS_PHYSICAL)).toBe(true);

    const blanked = step(armed, (state) => play(state, BLANK));
    expect(hidden(blanked.events)).toEqual([P1]);
    expect(everySeatSees(blanked.state, top)).toEqual([false, false, false]);
    expect(shownDeckTop(blanked.state, deps, P1)).toBeNull();
    expect(blanked.state.deckTopsAnnounced).toBeUndefined();
    // Clobber is still the top card, facedown: the game does not read it, so the condition is false and ATK is 2.
    expect(deckOf(blanked.state)[0]).toBe(top);
    expect(holds(blanked.state, TOP_IS_FACEUP)).toBe(false);
    expect(holds(blanked.state, TOP_HAS_PHYSICAL)).toBe(false);
    expect(atk(blanked.state)).toBe(2);
    // Soul Strike can still be played: its first sentence resolves, its second does not.
    const struck = step(blanked, (state) => play(state, SOUL_STRIKE));
    expect(counter(struck.state, "played")).toBe(1);
    expect(counter(struck.state, "stunned")).toBe(0);
    expect(shown(struck.events)).toEqual([]);
    expect(hidden(struck.events)).toEqual([]);

    const restored = step(struck, (state) => play(state, UNBLANK));
    expect(deckOf(restored.state)).toEqual(deckOf(start.state));
    expect(shown(restored.events)).toEqual([{ playerId: P1, instanceId: top }]);
    expect(everySeatSees(restored.state, top)).toEqual([true, true, true]);
    expect(holds(restored.state, TOP_HAS_PHYSICAL)).toBe(true);
    expect(atk(restored.state)).toBe(3);
    const again = step(restored, (state) => play(state, SOUL_STRIKE));
    expect(counter(again.state, "played")).toBe(2);
    expect(counter(again.state, "stunned")).toBe(1);
    expectReplays(again);
  });

  it("6b. a false `while` turns the rule off the same way, and on again", () => {
    const start = inHeroForm({ hand: [VEIL, UNVEIL], deck: [CLOBBER, GENIUS] }, VEILED);
    const top = deckOf(start.state)[0]!;
    expect(shown(start.events)).toEqual([{ playerId: P1, instanceId: top }]);
    expect(holds(start.state, TOP_HAS_PHYSICAL)).toBe(true);

    const veiled = step(start, (state) => play(state, VEIL));
    expect(hidden(veiled.events)).toEqual([P1]);
    expect(everySeatSees(veiled.state, top)).toEqual([false, false, false]);
    expect(holds(veiled.state, TOP_IS_FACEUP)).toBe(false);
    expect(holds(veiled.state, TOP_HAS_PHYSICAL)).toBe(false);

    const unveiled = step(veiled, (state) => play(state, UNVEIL));
    expect(shown(unveiled.events)).toEqual([{ playerId: P1, instanceId: top }]);
    expect(everySeatSees(unveiled.state, top)).toEqual([true, true, true]);
    expect(holds(unveiled.state, TOP_HAS_PHYSICAL)).toBe(true);
    expectReplays(unveiled);
  });

  it("7. a mission attempt's 2 discards with Magik's Crown on top: both are discarded and the third card shows", () => {
    const start = inHeroForm({ hand: [MILL_TWO], deck: [CROWN, GENIUS, CLOBBER, ARMOR] });
    const [crown, under, third] = deckOf(start.state);
    const run = step(start, (state) => play(state, MILL_TWO));

    expect(mustPlayer(run.state, P1).discard).toEqual(expect.arrayContaining([crown, under]));
    expect(deckOf(run.state)[0]).toBe(third);
    expect(deckOf(run.state)).toHaveLength(2);
    // One card at a time, as at the table: the card under the Crown shows before it is discarded, then the third.
    expect(shown(run.events)).toEqual([
      { playerId: P1, instanceId: under },
      { playerId: P1, instanceId: third },
    ]);
    expect(everySeatSees(run.state, third!)).toEqual([true, true, true]);
    expect(holds(run.state, TOP_HAS_PHYSICAL)).toBe(true);
    expectReplays(run);
  });
});

describe("§3.48 the log after each kind of card move", () => {
  it("a shuffle shows the new top card, once", () => {
    const start = inHeroForm({ hand: [SHUFFLE], deck: [CLOBBER, GENIUS, CROWN, ARMOR, BLOODGEM, RESOURCE] });
    const was = deckOf(start.state)[0]!;
    const run = step(start, (state) => play(state, SHUFFLE));
    const now = deckOf(run.state)[0]!;
    // Seed 48 moves another card to the top; were it the same card, nothing would be logged.
    expect(now).not.toBe(was);
    expect(shown(run.events)).toEqual([{ playerId: P1, instanceId: now }]);
    expect(everySeatSees(run.state, now)).toEqual([true, true, true]);
    expect(everySeatSees(run.state, was)).toEqual([false, false, false]);
    const order = run.events.flatMap((e) => (e.type === "deckShuffled" || e.type === "deckTopShown" ? [e.type] : []));
    expect(order).toEqual(["deckShuffled", "deckTopShown"]);
    expectReplays(run);
  });

  it("a search that takes the top card shows only the top card of the shuffled deck", () => {
    const start = inHeroForm({ hand: [SEARCH], deck: [ARMOR, GENIUS, CROWN, CLOBBER, BLOODGEM, RESOURCE] });
    const [armor, under] = deckOf(start.state);
    const run = step(start, (state) => play(state, SEARCH));
    const now = deckOf(run.state)[0]!;

    expect(mustPlayer(run.state, P1).hand).toEqual([armor]);
    expect(deckOf(run.state)).toHaveLength(5);
    // The card under the one found is not announced between the take and the shuffle: one line, after the shuffle.
    expect(now).not.toBe(under);
    expect(shown(run.events)).toEqual([{ playerId: P1, instanceId: now }]);
    const order = run.events.flatMap((e) => (e.type === "deckShuffled" || e.type === "deckTopShown" ? [e.type] : []));
    expect(order).toEqual(["deckShuffled", "deckTopShown"]);
    expect(everySeatSees(run.state, now)).toEqual([true, true, true]);
    expectReplays(run);
  });

  it("a card put on top is the one showing, once", () => {
    const start = inHeroForm({ hand: [PUT_ON_TOP, CROWN], deck: [CLOBBER, GENIUS] });
    const was = deckOf(start.state)[0]!;
    const crown = inHand(start.state, CROWN);
    const run = step(start, (state) => play(state, PUT_ON_TOP));

    expect(deckOf(run.state)).toEqual([crown, was, deckOf(start.state)[1]]);
    expect(shown(run.events)).toEqual([{ playerId: P1, instanceId: crown }]);
    expect(everySeatSees(run.state, crown)).toEqual([true, true, true]);
    expect(everySeatSees(run.state, was)).toEqual([false, false, false]);
    // Clobber is under the Crown now: the [physical] condition reads the Crown ([mental]) and is false.
    expect(holds(run.state, TOP_HAS_PHYSICAL)).toBe(false);
    expectReplays(run);
  });

  it("an empty deck shows nothing and logs nothing, in either direction", () => {
    const start = inHeroForm({ hand: [WELL, FLIP, FLIP], deck: [CLOBBER] });
    const clobber = deckOf(start.state)[0]!;
    const well = step(start, (state) => play(state, WELL));
    const wellId = inPlay(well.state, WELL);
    // The last card is drawn by a card that stays in play, so no card reaches the discard pile to make a new deck.
    const empty = step(well, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: wellId,
      abilityId: WELL_DRAW.ref.id,
      payment: [],
    });
    expect(deckOf(empty.state)).toEqual([]);
    expect(mustPlayer(empty.state, P1).hand).toContain(clobber);
    expect(shown(empty.events)).toEqual([]);
    expect(hidden(empty.events)).toEqual([]);
    expect(shownDeckTop(empty.state, deps, P1)).toBeNull();
    expect(empty.state.deckTopsAnnounced).toBeUndefined();
    // The rule still holds; there is no card for a condition to read.
    expect(holds(empty.state, TOP_IS_FACEUP)).toBe(true);
    expect(holds(empty.state, TOP_HAS_PHYSICAL)).toBe(false);

    // Flip resolves with the deck still empty (it reaches the discard pile only afterwards): nothing to hide.
    const alterEgo = step(empty, (state) => play(state, FLIP));
    expect(hidden(alterEgo.events)).toEqual([]);
    // That Flip made a new deck of 1 card, in alter-ego form: nothing shows.
    expect(deckOf(alterEgo.state)).toHaveLength(1);
    expect(shown(alterEgo.events)).toEqual([]);
    expectReplays(alterEgo);
  });

  it("a second player's deck is unaffected: their draws log nothing and show nothing", () => {
    const start = inHeroForm({ hand: [], deck: [CLOBBER, GENIUS] });
    const top = deckOf(start.state)[0]!;
    const theirs = step(start, { type: "endTurn", playerId: P1 });
    expect(theirs.state.step).toMatchObject({ kind: "turn", activePlayerId: P2 });
    const seat = mustPlayer(theirs.state, P2);
    const meditation =
      seat.hand.find((id) => cardAt(theirs.state, id) === MEDITATION.id) ??
      seat.deck.find((id) => cardAt(theirs.state, id) === MEDITATION.id);
    expect(meditation).toBeDefined();
    // P2 holds or is handed Spiritual Meditation (surgery on a fresh session, so its own log replays).
    const handed: GameState = seat.hand.includes(meditation!)
      ? theirs.state
      : {
          ...theirs.state,
          players: theirs.state.players.map((p) =>
            p.playerId === P2
              ? { ...p, deck: p.deck.filter((id) => id !== meditation), hand: [...p.hand, meditation!] }
              : p,
          ),
        };
    const before = deckOf(handed, P2).length;
    const run = step(begin(handed), (state) => play(state, MEDITATION, P2));

    expect(deckOf(run.state, P2)).toHaveLength(before - 2);
    expect(shown(run.events)).toEqual([]);
    expect(hidden(run.events)).toEqual([]);
    expect(everySeatSees(run.state, deckOf(run.state, P2)[0]!)).toEqual([false, false, false]);
    expect(holds(run.state, TOP_IS_FACEUP, P2)).toBe(false);
    // Magik's own card is still showing through another player's turn.
    expect(everySeatSees(run.state, top)).toEqual([true, true, true]);
    expect(run.state.deckTopsAnnounced).toEqual({ [P1]: top });
    expectReplays(run);
  });
});

describe("§3.50 a stat that follows the top card with no ability resolving", () => {
  const withSoulsword = (deck: readonly AnyCard[], hand: readonly AnyCard[] = []) => {
    const start = inHeroForm({ hand: [SOULSWORD, ...hand], deck });
    return step(start, (state) => play(state, SOULSWORD));
  };

  it("1. Soulsword (ATK 2): Clobber on top 3, Bloodgem 3, Genius 2; drawing Clobber onto Genius makes it 2", () => {
    expect(atk(withSoulsword([CLOBBER, GENIUS]).state)).toBe(3);
    expect(atk(withSoulsword([BLOODGEM, GENIUS]).state)).toBe(3);
    expect(atk(withSoulsword([GENIUS, CLOBBER]).state)).toBe(2);

    const run = withSoulsword([CLOBBER, GENIUS, CROWN], [WELL]);
    expect(atk(run.state)).toBe(3);
    const well = step(run, (state) => play(state, WELL));
    const wellId = inPlay(well.state, WELL);
    const drawn = step(well, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: wellId,
      abilityId: WELL_DRAW.ref.id,
      payment: [],
    });
    expect(cardAt(drawn.state, deckOf(drawn.state)[0])).toBe(GENIUS.id);
    expect(atk(drawn.state)).toBe(2);
    expectReplays(drawn);
  });

  it("1. an empty deck: ATK 2", () => {
    const run = withSoulsword([CLOBBER], [WELL]);
    const well = step(run, (state) => play(state, WELL));
    const wellId = inPlay(well.state, WELL);
    const empty = step(well, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: wellId,
      abilityId: WELL_DRAW.ref.id,
      payment: [],
    });
    expect(deckOf(empty.state)).toEqual([]);
    expect(atk(empty.state)).toBe(2);
  });
});
