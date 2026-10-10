/**
 * docs/phase7-wave9.md §3.42: "During the player phase, play with the top card of the encounter deck faceup." (`RuleSpec
 * topOfDeckFaceup { deck: "encounter" }`) and `Predicate topOfDeckFaceup { deck: "encounter" }`, the predicate that
 * reads the card it shows. Proven with synthetic cards shaped like Falcon's kit (53001a, 53002, 53003), each test
 * driving real commands.
 *
 * Sources: RRG 1.8 "Encounter Deck" (p. 17): an emptied deck is reset at once, with an acceleration token; "Look,
 * Looked-At" (p. 27): a card kept faceup is not looked at; "Text Box" (p. 44). RRG 1.8 FAQ "Redwing (#2)" (p. 65) and
 * the rulings of January 26, 2026 – Ruling 6 (1) and March 19, 2026 – Ruling 5: an ability whose whole effect is read
 * from a visible card with no icons cannot be triggered, and can against a facedown card, known or not. Wave 8 §4.1
 * Q26 = B: a facedown top card answers no question. Wave 9 §4.1 Q6 = B: an optional discard beside another effect is
 * offered whatever the card shows.
 */

import type { AnyCard, CardId, HeroIdentityCard, Trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeEncounterDeck, activeVillain, mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay, encounterTopFaceup, evaluate, shownEncounterTop } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubMinion, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_CARDS, HERO, MAIN_SCHEME, RESOURCE, VILLAIN, withEncounterPiles } from "./testing/scenario.js";
import { copiesOf, P1, P2 } from "./testing/wave3.js";
import { faceVisible, zoneHidden } from "./visibility.js";

const you = { kind: "controller" } as const;
const theVillain: TargetRef = { kind: "villain" };
const n = (value: number): ValueSpec => ({ kind: "const", value });
const abilities: StubAbility[] = [];
const ability = (id: string, definition: AbilityDefinition): StubAbility => {
  const stub = stubAbility(id, definition);
  abilities.push(stub);
  return stub;
};
const event = (id: string, effects: readonly EffectSpec[], definition: Partial<AbilityDefinition> = {}) =>
  stubEvent({
    id,
    cost: 0,
    abilities: [ability(`${id}.action`, { trigger: { kind: "action" }, effects, ...definition }).ref],
  });

// --- The encounter cards the top of the deck is read for: their type, traits and boost area are what matters. --------
const SERPENT = "SERPENT SOCIETY" as Trait;
/** No icon at all in the boost area. */
const BLANK_CARD = stubTreachery({ id: "blank-card", boostIcons: 0 });
const TWO_PIPS = stubTreachery({ id: "two-pips", boostIcons: 2 });
/** Two boost icons and a star: 3 icons in the boost area. */
const STARRED = stubTreachery({ id: "starred", boostIcons: 2, starIcon: true });
/** A star alone: 1 icon. */
const STAR_ONLY = stubTreachery({ id: "star-only", boostIcons: 0, starIcon: true });
const SOLDIER = stubMinion({ id: "soldier", atk: 1, sch: 1, hp: 2, boostIcons: 1, traits: [SERPENT] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 1 });
const ENCOUNTER: readonly AnyCard[] = [BLANK_CARD, TWO_PIPS, STARRED, STAR_ONLY, SOLDIER, FILLER];

// --- The rule and what reads it. ------------------------------------------------------------------------------------
const PLAYER_PHASE: Predicate = { kind: "gameStep", phase: "player" };
const FACEUP_RULE: RuleSpec = { kind: "topOfDeckFaceup", deck: "encounter", while: PLAYER_PHASE };
/** Falcon's hero face: "During the player phase, play with the top card of the encounter deck faceup." */
const EAGLE = ability("falcon.constant", { trigger: { kind: "constant", rules: [FACEUP_RULE] }, effects: [] });
const FALCON: HeroIdentityCard = stubIdentity({
  id: "falcon",
  hp: 11,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [EAGLE.ref],
});
/** A second source of the same rule, on a card in play, with no `while`: on in every phase and either form. */
const RADAR_RULE = ability("radar.constant", {
  trigger: { kind: "constant", rules: [{ kind: "topOfDeckFaceup", deck: "encounter" }] },
  effects: [],
});
const RADAR = stubUpgrade({ id: "radar", cost: 0, abilities: [RADAR_RULE.ref] });
const SCRAP_RADAR = event("scrap-radar", [
  { kind: "discardFromPlay", target: { kind: "each", query: { name: RADAR.name } } },
]);

const TOP_FACEUP: Predicate = { kind: "topOfDeckFaceup", deck: "encounter" };
const topIs = (matches: NonNullable<Extract<Predicate, { deck: "encounter" }>["matches"]>): Predicate => ({
  kind: "topOfDeckFaceup",
  deck: "encounter",
  matches,
});
const topIcons = (bound: { readonly atLeast?: number; readonly atMost?: number }): Predicate => ({
  kind: "topOfDeckFaceup",
  deck: "encounter",
  boostAreaIcons: bound,
});
const SHOWS_NO_ICONS = topIcons({ atMost: 0 });

// --- What moves encounter cards. ------------------------------------------------------------------------------------
const DISCARD_TWO = event("discard-two", [{ kind: "discardEncounterCards", count: n(2) }]);
const DISCARD_ONE = event("discard-one", [{ kind: "discardEncounterCards", count: n(1) }]);
const GIVE_BOOST = event("give-boost", [{ kind: "giveBoostCard", enemy: theVillain }]);
const DEAL = event("deal", [{ kind: "dealEncounterCard", player: { kind: "id", playerId: P2 } }]);
const DEAL_SELF = event("deal-self", [{ kind: "dealEncounterCard", player: you }]);
const SHUFFLE = event("shuffle", [{ kind: "shuffleEncounterDeck" }]);
/**
 * Redwing's shape: its whole effect is a number read from the icons of the card it discards, so it is refused while
 * that card is showing and prints none (the ability's own condition, not an engine rule about one card).
 */
const REDWING = event(
  "redwing",
  [
    { kind: "discardEncounterCards", count: n(1), bind: "top" },
    { kind: "dealDamage", target: theVillain, amount: { kind: "var", name: "top.boostIcons" } as ValueSpec },
  ],
  { trigger: { kind: "action", while: { kind: "not", of: SHOWS_NO_ICONS } } },
);
/**
 * Bird of Prey's shape: "Deal 4 damage to an enemy. You may discard the top card of the encounter deck to deal
 * additional damage equal to the number of icons in its boost area." It has an effect of its own, and its discard is
 * offered whatever the top card shows (§4.1 Q6 = B).
 */
const BIRD_OF_PREY = event("bird-of-prey", [
  {
    kind: "chooseOne",
    chooser: you,
    options: [
      {
        label: "Discard the top card of the encounter deck",
        effects: [
          { kind: "discardEncounterCards", count: n(1), bind: "top" },
          { kind: "dealDamage", target: theVillain, amount: { kind: "var", name: "top.boostIcons" } as ValueSpec },
        ],
      },
      { label: "Do not discard", effects: [] },
    ],
  },
  { kind: "dealDamage", target: theVillain, amount: n(4) },
]);

const KIT: readonly AnyCard[] = [
  DISCARD_TWO,
  DISCARD_ONE,
  GIVE_BOOST,
  DEAL,
  DEAL_SELF,
  SHUFFLE,
  REDWING,
  BIRD_OF_PREY,
  RADAR,
  SCRAP_RADAR,
];
const deps: EngineDeps = depsOf(...abilities);

/** Two seats at the first turn: P1 plays Falcon (in alter-ego form), P2 the plain stub hero. */
function table(): GameState {
  const result = createGame(
    {
      seed: 42,
      cards: [...DEFAULT_CARDS, FALCON, ...KIT, ...ENCOUNTER],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: ENCOUNTER.flatMap((card) => copiesOf(card.id, 6)),
      players: [FALCON, HERO].map((card) => ({
        identityCardId: card.id,
        deck: [...copiesOf(RESOURCE.id, 12), ...KIT.flatMap((kit) => [kit.id, kit.id])],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

/**
 * Test surgery, before a session starts (so its log replays): the encounter deck (top first) and its discard pile hold
 * exactly the named cards, the rest of the deck is out of the game, and P1 holds one copy of every kit card.
 */
function arrange(
  state: GameState,
  deck: readonly AnyCard[],
  discard: readonly AnyCard[] = [],
  holder: PlayerId = P1,
): GameState {
  const piles = activeEncounterDeck(state);
  const pool = [...piles.deck, ...piles.discard];
  const take = (cards: readonly AnyCard[]): InstanceId[] =>
    cards.map((card) => {
      const at = pool.findIndex((id) => state.instances[id]!.cardId === card.id);
      if (at < 0) throw new Error(`no spare ${card.id} in the encounter deck`);
      return pool.splice(at, 1)[0]!;
    });
  const next = withEncounterPiles(state, { deck: take(deck), discard: take(discard) });
  const seat = mustPlayer(next, holder);
  const cards = [...seat.hand, ...seat.deck];
  const hand = KIT.map((kit) => cards.find((id) => next.instances[id]!.cardId === kit.id)!);
  return {
    ...next,
    removedFromGame: [...next.removedFromGame, ...pool],
    players: next.players.map((p) =>
      p.playerId === holder ? { ...p, hand, deck: cards.filter((id) => !hand.includes(id)) } : p,
    ),
  };
}

const inHand = (state: GameState, card: AnyCard, player: PlayerId = P1): InstanceId => {
  const id = mustPlayer(state, player).hand.find((x) => state.instances[x]!.cardId === card.id);
  if (!id) throw new Error(`${player} holds no ${card.id}`);
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
/** One command (built from the state it is applied to), choices answered by `pick` (the default pick when absent). */
function step(
  run: Run,
  command: Command | ((state: GameState) => Command),
  pick?: (state: GameState) => readonly string[],
): Run {
  const next = typeof command === "function" ? command(run.state) : command;
  const { session, events } = driveSession(run.session, deps, [next], pick);
  return { session, state: session.state, events };
}
function expectReplays(run: Run): void {
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.state);
}

const deckOf = (state: GameState) => activeEncounterDeck(state).deck;
const cardAt = (state: GameState, id: InstanceId | undefined): CardId | undefined =>
  id === undefined ? undefined : mustInstance(state, id).cardId;
const SEATS = [P1, P2] as const;
/** Whether each seat, and the table with no seat named, reads the card's face. */
const seatsSeeing = (state: GameState, id: InstanceId): boolean[] => [
  ...SEATS.map((viewer) => faceVisible(state, id, { viewer, deps })),
  faceVisible(state, id, { deps }),
];
const ALL = [true, true, true];
const NONE = [false, false, false];
const shown = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterTopShown" ? [e.instanceId] : []));
const hiddenCount = (events: readonly GameEvent[]) => events.filter((e) => e.type === "encounterTopHidden").length;
const holds = (state: GameState, predicate: Predicate, player: PlayerId = P1): boolean =>
  evaluate(state, predicate, { selfInstanceId: null, controllerId: player, event: null, bindings: {}, deps });
const villainDamage = (state: GameState): number => mustInstance(state, activeVillain(state).instanceId).damage;
const playable = (state: GameState, card: AnyCard, player: PlayerId = P1): boolean => {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return false;
  const id = inHand(state, card, player);
  return actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};

describe("§3.42 the top card of the encounter deck kept faceup", () => {
  it("is facedown in alter-ego form, and faceup to every player once the hero face is up in the player phase", () => {
    const start = arrange(table(), [TWO_PIPS, STARRED, FILLER]);
    const top = deckOf(start)[0]!;
    expect(encounterTopFaceup(start, deps)).toBe(false);
    expect(shownEncounterTop(start, deps)).toBeNull();
    expect(seatsSeeing(start, top)).toEqual(NONE);
    expect(holds(start, TOP_FACEUP)).toBe(false);

    const hero = step(begin(start), toHero());
    expect(shown(hero.events)).toEqual([top]);
    expect(hero.events.find((e) => e.type === "encounterTopShown")).toMatchObject({ cardId: TWO_PIPS.id });
    expect(shownEncounterTop(hero.state, deps)).toBe(top);
    expect(seatsSeeing(hero.state, top)).toEqual(ALL);
    expect(zoneHidden(hero.state, top, { deps })).toBe(false);
    // Only the top card, nothing written on it, and no answer without the rules being read.
    expect(seatsSeeing(hero.state, deckOf(hero.state)[1]!)).toEqual(NONE);
    expect(mustInstance(hero.state, top).faceup).toBe(false);
    expect(faceVisible(hero.state, top)).toBe(false);
    expect(hero.state.encounterTopAnnounced).toBe(top);
    // Not a look or a reveal: nothing but the form change and the log line happened to the deck.
    expect(hero.events.some((e) => e.type === "cardsLookedAt" || e.type === "cardMoved")).toBe(false);
    expect(deckOf(hero.state)).toEqual(deckOf(start));
    expectReplays(hero);
  });

  it("is facedown again when the villain phase begins, and faceup when the next player phase does", () => {
    const start = arrange(table(), [FILLER, FILLER, FILLER, FILLER, FILLER, FILLER, TWO_PIPS, STARRED]);
    let run = step(begin(start), toHero());
    run = step(run, { type: "endTurn", playerId: P1 });
    expect(hiddenCount(run.events)).toBe(0);
    expect(seatsSeeing(run.state, deckOf(run.state)[0]!)).toEqual(ALL);
    run = step(run, { type: "endTurn", playerId: P2 });

    const types = run.events.map((e) => e.type);
    const toVillain = run.events.findIndex((e) => e.type === "stepChanged" && e.to.phase === "villain");
    const toPlayer = run.events.findIndex(
      (e, i) => i > toVillain && e.type === "stepChanged" && e.to.phase === "player",
    );
    const hiddenAt = types.indexOf("encounterTopHidden");
    const shownAt = types.indexOf("encounterTopShown");
    expect(toVillain).toBeGreaterThanOrEqual(0);
    expect(toPlayer).toBeGreaterThan(toVillain);
    // Facedown before the villain phase moves a card, and nothing is shown until the player phase is back.
    expect(hiddenAt).toBeGreaterThanOrEqual(toVillain);
    const firstMove = run.events.findIndex((e, i) => i > toVillain && e.type === "cardMoved");
    expect(firstMove).toBeGreaterThan(hiddenAt);
    expect(shownAt).toBeGreaterThanOrEqual(toPlayer);
    expect(hiddenCount(run.events)).toBe(1);
    expect(shown(run.events)).toEqual([deckOf(run.state)[0]]);
    expect(run.state.step.phase).toBe("player");
    expect(seatsSeeing(run.state, deckOf(run.state)[0]!)).toEqual(ALL);
    expectReplays(run);
  });

  it("shows each new top card at once as cards are discarded from the top", () => {
    const start = arrange(table(), [TWO_PIPS, STARRED, SOLDIER, FILLER]);
    const [first, second, third] = deckOf(start);
    let run = step(begin(start), toHero());
    expect(shown(run.events)).toEqual([first]);
    run = step(run, (s) => play(s, DISCARD_TWO));
    // One line per card that came to the top: the second while the discard was still going, then the third.
    expect(shown(run.events)).toEqual([second, third]);
    expect(hiddenCount(run.events)).toBe(0);
    expect(deckOf(run.state)[0]).toBe(third);
    expect(seatsSeeing(run.state, third!)).toEqual(ALL);
    // The discarded cards are in an open pile, faceup like any discard.
    expect(activeEncounterDeck(run.state).discard).toEqual(expect.arrayContaining([first, second]));
    expectReplays(run);
  });

  it("a boost card and a dealt card off a faceup top are facedown where they land; the log is what remembers them", () => {
    const start = arrange(table(), [STARRED, SOLDIER, TWO_PIPS, FILLER]);
    const [boost, dealt, dealtSelf, next] = deckOf(start);
    let run = step(begin(start), toHero());
    const log: GameEvent[] = [...run.events];

    run = step(run, (s) => play(s, GIVE_BOOST));
    log.push(...run.events);
    expect(mustInstance(run.state, activeVillain(run.state).instanceId).boostCards).toContain(boost);
    expect(seatsSeeing(run.state, boost!)).toEqual(NONE);
    expect(shown(run.events)).toEqual([dealt]);

    run = step(run, (s) => play(s, DEAL));
    log.push(...run.events);
    expect(mustPlayer(run.state, P2).dealtEncounter).toContain(dealt);
    expect(seatsSeeing(run.state, dealt!)).toEqual(NONE);
    expect(shown(run.events)).toEqual([dealtSelf]);

    run = step(run, (s) => play(s, DEAL_SELF));
    log.push(...run.events);
    expect(mustPlayer(run.state, P1).dealtEncounter).toContain(dealtSelf);
    expect(seatsSeeing(run.state, dealtSelf!)).toEqual(NONE);
    expect(shown(run.events)).toEqual([next]);
    expect(seatsSeeing(run.state, next!)).toEqual(ALL);

    // Facedown but known (ruling, March 19, 2026 – Ruling 5): every player saw each of them on top, and the log says so.
    expect(shown(log)).toEqual([boost, dealt, dealtSelf, next]);
    // A known facedown card is not a showing one: the predicate reads the card on top now and no other.
    expect(holds(run.state, topIs({ categories: ["minion"] }))).toBe(false);
    expectReplays(run);
  });

  it("a shuffle shows the card that is on top afterwards", () => {
    const start = arrange(table(), [TWO_PIPS, STARRED, SOLDIER, FILLER, FILLER, BLANK_CARD, STAR_ONLY, FILLER]);
    let run = step(begin(start), toHero());
    const before = deckOf(run.state)[0]!;
    run = step(run, (s) => play(s, SHUFFLE));
    const after = deckOf(run.state)[0]!;
    expect([...deckOf(run.state)].sort()).toEqual([...deckOf(start)].sort());
    // Seeded: this shuffle brings another card to the top.
    expect(after).not.toBe(before);
    expect(shown(run.events)).toEqual([after]);
    expect(hiddenCount(run.events)).toBe(0);
    expect(run.state.encounterTopAnnounced).toBe(after);
    expect(seatsSeeing(run.state, after)).toEqual(ALL);
    expect(seatsSeeing(run.state, before)).toEqual(NONE);
    expectReplays(run);
  });

  it("an emptied deck is reset with one acceleration token and the new deck's top card is shown at once", () => {
    const start = arrange(table(), [TWO_PIPS], [STARRED, SOLDIER, FILLER]);
    const last = deckOf(start)[0]!;
    let run = step(begin(start), toHero());
    const tokens = run.state.mainScheme.accelerationTokens;
    run = step(run, (s) => play(s, DISCARD_ONE));
    // The last card went to the discard pile and came back in the new deck of 4 (RRG 1.8 "Encounter Deck", p. 17).
    expect(deckOf(run.state)).toHaveLength(4);
    expect(deckOf(run.state)).toContain(last);
    expect(activeEncounterDeck(run.state).discard).toEqual([]);
    expect(run.state.mainScheme.accelerationTokens).toBe(tokens + 1);
    // No "facedown again" for the card that left an emptied deck; the new top card is shown, once, even if it is the
    // same card back on top.
    expect(hiddenCount(run.events)).toBe(0);
    expect(shown(run.events)).toEqual([deckOf(run.state)[0]]);
    expect(seatsSeeing(run.state, deckOf(run.state)[0]!)).toEqual(ALL);
    expectReplays(run);
  });

  it("an empty deck shows nothing: the rule holds, and no question about a card is answered", () => {
    const hero = step(begin(arrange(table(), [TWO_PIPS])), toHero()).state;
    const empty = withEncounterPiles(hero, { deck: [], discard: [] });
    expect(encounterTopFaceup(empty, deps)).toBe(true);
    expect(shownEncounterTop(empty, deps)).toBeNull();
    expect(holds(empty, TOP_FACEUP)).toBe(true);
    expect(holds(empty, topIs({ categories: ["treachery"] }))).toBe(false);
    expect(holds(empty, SHOWS_NO_ICONS)).toBe(false);
    expect(holds(empty, topIcons({ atLeast: 0 }))).toBe(false);
  });
});

describe("§3.42 the predicate reads the showing card, and only while it shows", () => {
  const reads = (state: GameState) => ({
    faceup: holds(state, TOP_FACEUP),
    minion: holds(state, topIs({ categories: ["minion"] })),
    treachery: holds(state, topIs({ categories: ["treachery"] })),
    serpent: holds(state, topIs({ trait: SERPENT })),
    star: holds(state, topIs({ starIcon: true })),
    noIcons: holds(state, SHOWS_NO_ICONS),
    oneOrMore: holds(state, topIcons({ atLeast: 1 })),
    exactlyThree: holds(state, topIcons({ atLeast: 3, atMost: 3 })),
    starredTreachery: holds(state, {
      kind: "topOfDeckFaceup",
      deck: "encounter",
      matches: { categories: ["treachery"] },
      boostAreaIcons: { atLeast: 3 },
    }),
  });
  const NOTHING = {
    faceup: false,
    minion: false,
    treachery: false,
    serpent: false,
    star: false,
    noIcons: false,
    oneOrMore: false,
    exactlyThree: false,
    starredTreachery: false,
  };
  const heroWith = (top: AnyCard): GameState => step(begin(arrange(table(), [top, FILLER])), toHero()).state;

  it("type, trait, star icon and the icons of the boost area (boost icons and the star together)", () => {
    expect(reads(heroWith(SOLDIER))).toEqual({
      ...NOTHING,
      faceup: true,
      minion: true,
      serpent: true,
      oneOrMore: true,
    });
    // 2 boost icons and a star are 3 icons (Redwing's "icons (★ and boost)"; §3.43).
    expect(reads(heroWith(STARRED))).toEqual({
      ...NOTHING,
      faceup: true,
      treachery: true,
      star: true,
      oneOrMore: true,
      exactlyThree: true,
      starredTreachery: true,
    });
    expect(reads(heroWith(STAR_ONLY))).toEqual({
      ...NOTHING,
      faceup: true,
      treachery: true,
      star: true,
      oneOrMore: true,
    });
    expect(reads(heroWith(BLANK_CARD))).toEqual({ ...NOTHING, faceup: true, treachery: true, noIcons: true });
    // The same for either player asking: the rule shows the card to the table.
    expect(holds(heroWith(SOLDIER), topIs({ trait: SERPENT }), P2)).toBe(true);
  });

  it("a facedown top card answers nothing, whatever it is (wave 8 Q26 = B)", () => {
    for (const top of [SOLDIER, STARRED, BLANK_CARD]) {
      expect(reads(arrange(table(), [top, FILLER]))).toEqual(NOTHING);
    }
  });
});

describe("§3.42 two sources of the rule", () => {
  it("show the card once, keep it up while either holds, and turn it down when the last one stops", () => {
    const start = arrange(table(), [FILLER, FILLER, FILLER, FILLER, FILLER, FILLER, TWO_PIPS, STARRED, SOLDIER]);
    const top = deckOf(start)[0]!;
    // Radar (no `while`) comes into play with Falcon in alter-ego form: its rule alone shows the card.
    let run = step(begin(start), (s) => play(s, RADAR));
    expect(shown(run.events)).toEqual([top]);
    expect(cardsInPlay(run.state).some((id) => cardAt(run.state, id) === RADAR.id)).toBe(true);
    // Falcon's own rule coming on over a card already showing logs nothing more.
    run = step(run, toHero());
    expect(shown(run.events)).toEqual([]);
    expect(hiddenCount(run.events)).toBe(0);
    expect(seatsSeeing(run.state, top)).toEqual(ALL);

    // Through the villain phase Falcon's rule is off and Radar's holds: the card is never logged as facedown, and each
    // card that comes to the top of the deck in that phase (boost cards and encounter cards leave it) is shown.
    run = step(run, { type: "endTurn", playerId: P1 });
    run = step(run, { type: "endTurn", playerId: P2 });
    expect(run.state.step.phase).toBe("player");
    expect(hiddenCount(run.events)).toBe(0);
    const during = shown(run.events);
    expect(during.length).toBeGreaterThanOrEqual(3);
    expect(during.at(-1)).toBe(deckOf(run.state)[0]);
    expect(new Set(during).size).toBe(during.length);

    // Radar leaves: Falcon's rule still holds in the player phase. Nothing is logged, the card stays up.
    const shownNow = deckOf(run.state)[0]!;
    run = step(run, (s) => play(s, SCRAP_RADAR));
    expect(shown(run.events)).toEqual([]);
    expect(hiddenCount(run.events)).toBe(0);
    expect(seatsSeeing(run.state, shownNow)).toEqual(ALL);
    expectReplays(run);
  });

  it("the last source leaving play turns the card facedown", () => {
    const start = arrange(table(), [TWO_PIPS, STARRED]);
    const top = deckOf(start)[0]!;
    let run = step(begin(start), (s) => play(s, RADAR));
    expect(seatsSeeing(run.state, top)).toEqual(ALL);
    run = step(run, (s) => play(s, SCRAP_RADAR));
    expect(hiddenCount(run.events)).toBe(1);
    expect(seatsSeeing(run.state, top)).toEqual(NONE);
    expect(run.state.encounterTopAnnounced).toBeUndefined();
    expect("encounterTopAnnounced" in run.state).toBe(false);
    expectReplays(run);
  });
});

describe("§3.42 an ability read from the showing card", () => {
  it("Redwing's shape is refused against a showing card with no icons, and offered against the same card facedown", () => {
    // Facedown (alter-ego form): offered, and it resolves for what the card prints, 0 included.
    const facedown = arrange(table(), [BLANK_CARD, FILLER]);
    expect(playable(facedown, REDWING)).toBe(true);
    const blind = step(begin(facedown), (s) => play(s, REDWING));
    expect(villainDamage(blind.state)).toBe(0);
    expect(cardAt(blind.state, activeEncounterDeck(blind.state).discard[0])).toBe(BLANK_CARD.id);

    // Showing with no icons: "the player knows that the ability will not be able to affect its target" (FAQ p. 65).
    const showing = step(begin(facedown), toHero());
    expect(holds(showing.state, SHOWS_NO_ICONS)).toBe(true);
    expect(playable(showing.state, REDWING)).toBe(false);

    // Showing with a star alone: 1 icon is not none.
    const starred = step(begin(arrange(table(), [STAR_ONLY, FILLER])), toHero());
    expect(playable(starred.state, REDWING)).toBe(true);
    // And another player is refused or offered by the same showing card.
    const other = step(begin(arrange(table(), [BLANK_CARD, FILLER], [], P2)), toHero());
    expect(playable(other.state, REDWING, P2)).toBe(false);
  });

  it("Q6 = B: Bird of Prey's optional discard is offered against a showing card with no icons, for 0 additional", () => {
    const start = arrange(table(), [BLANK_CARD, TWO_PIPS, FILLER]);
    const blank = deckOf(start)[0]!;
    const hero = step(begin(start), toHero());
    expect(seatsSeeing(hero.state, blank)).toEqual(ALL);
    expect(holds(hero.state, SHOWS_NO_ICONS)).toBe(true);
    expect(playable(hero.state, BIRD_OF_PREY)).toBe(true);

    // The choice is put to the player with both options, the discard included.
    const asked = sessionApply(hero.session, play(hero.state, BIRD_OF_PREY), deps);
    if (!asked.ok) throw new Error(asked.error.message);
    const choice = asked.session.state.pendingChoice;
    expect(choice?.playerId).toBe(P1);
    expect(choice?.options.map((o) => o.label)).toEqual([
      "Discard the top card of the encounter deck",
      "Do not discard",
    ]);

    // Taken: the card is discarded for 0 additional, 4 damage in all, and the next card is shown.
    const discard = (s: GameState) => [s.pendingChoice!.options[0]!.optionId];
    const taken = step(hero, (s) => play(s, BIRD_OF_PREY), discard);
    expect(activeEncounterDeck(taken.state).discard).toContain(blank);
    expect(villainDamage(taken.state)).toBe(4);
    expect(shown(taken.events)).toEqual([deckOf(taken.state)[0]]);
    expect(cardAt(taken.state, deckOf(taken.state)[0])).toBe(TWO_PIPS.id);
    expectReplays(taken);

    // Declined: the card stays on top, showing, and the damage is the same 4.
    const keep = (s: GameState) => [s.pendingChoice!.options[1]!.optionId];
    const declined = step(hero, (s) => play(s, BIRD_OF_PREY), keep);
    expect(deckOf(declined.state)[0]).toBe(blank);
    expect(villainDamage(declined.state)).toBe(4);

    // With icons showing the same discard adds them: 4 + 2.
    const rich = step(begin(arrange(table(), [TWO_PIPS, FILLER])), toHero());
    expect(villainDamage(step(rich, (s) => play(s, BIRD_OF_PREY), discard).state)).toBe(6);
  });
});
