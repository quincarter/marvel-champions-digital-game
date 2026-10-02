import { cardId } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  cardsInPlay,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import { WAVE6_CARDS } from "../cards.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  use,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { intoPlayArea } from "../mut_gen/magneto-testing.js";
import { MOJO_SCENARIO_ABILITIES } from "./mojo.js";
import {
  SHOW_CODES,
  encounterDiscard,
  inEncounterPiles,
  inPlay,
  mojoGame,
  mojoGameKeeping,
  mojoGameWithEvents,
  mojoOf,
  setAsideSets,
  wheelOf,
  withEncounterDeck,
  withMojoStage,
  withoutShow,
  withWheelStopped,
} from "./mojo-testing.js";

const deps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const mainScheme = (state: GameState) => state.mainScheme.instanceId;
const threat = (state: GameState, id: InstanceId): number => inst(state, id).threat;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;

/** Mojo-set cards (they never put threat on a hero through his turn-end discards) and Core cards that are not. */
const MOJO_CARDS = ["39032", "39034", "39029"] as const;
const CORE_FILLER = ["01186", "01188", "01189", "01190", "01186", "01187"] as const;
/** Assault, a boost card with no boost icons (the standard set also holds two Advance, 01186, of the same kind). */
const NO_BOOST = "01187";
/** Boost cards with no icons and no star: the villain's activations draw these and nothing happens. */
const BLANK_BOOST = "01186";
/** Cards with nothing to resolve beyond entering play: a side scheme, and an attachment to Mojo. Used as a player's reveal. */
const INERT = ["39031", "39027"] as const;

const ENERGY = "01088";
const GENIUS = "01089";
const STRENGTH = "01090";
/** Retypes the first hand cards of `player` into `codes` (surgery: the starter decks hold none of those at hand). */
const conjure = (state: GameState, codes: readonly string[], player: PlayerId = P1) => {
  const ids = playerOf(state, player).hand.slice(0, codes.length);
  return { state: ids.reduce((s, id, i) => patchInstance(s, id, { cardId: cardId(codes[i]!) }), state), ids };
};

const heroGame = (options: Parameters<typeof mojoGame>[0] = {}) => run(mojoGame(options), toHero(P1));

/** The events of an end of turn up to the villain's own activation: the turn-end responses, and nothing of the villain phase's deals. */
const untilActivation = (events: readonly GameEvent[]): GameEvent[] => {
  const at = events.findIndex((e) => e.type === "enemyActivated");
  return at < 0 ? [...events] : events.slice(0, at);
};
const discardedFromDeck = (events: readonly GameEvent[]): string[] =>
  of(events, "cardMoved")
    .filter((e) => e.from.kind === "encounterDeck" && e.to.kind === "encounterDiscard")
    .map((e) => e.cardId as string);
const threatPlacedOn = (events: readonly GameEvent[], id: InstanceId): number[] =>
  of(events, "threatPlaced")
    .filter((e) => e.schemeInstanceId === id)
    .map((e) => e.amount);
const threatRemovedFrom = (events: readonly GameEvent[], id: InstanceId): number[] =>
  of(events, "threatRemoved")
    .filter((e) => e.schemeInstanceId === id)
    .map((e) => e.amount);

const damageTo = (events: readonly GameEvent[], id: InstanceId): number[] =>
  of(events, "damageDealt")
    .filter((e) => e.targetInstanceId === id)
    .map((e) => e.amount);

/** Ends `player`'s turn with the top of the encounter deck stacked, answering every choice with `pick`. */
const endTurn = (state: GameState, top: readonly string[], player: PlayerId = P1, pick: Picker = firstLegal) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...top), pick, { type: "endTurn", playerId: player });

describe("registry", () => {
  it("registers every ability ref of the Mojo set (both faces, boost abilities included)", () => {
    expect(Object.keys(MOJO_SCENARIO_ABILITIES).sort()).toEqual(
      [
        "39022.mojo-forced-response",
        "39023.when-revealed",
        "39023.mojo-forced-response",
        "39024.when-revealed",
        "39024.mojo-forced-response",
        "39025a.setup",
        "39025b.when-revealed",
        "39025b.mojomania-forced-interrupt",
        "39026a.wheel-of-genres-forced-response",
        "39026b.wheel-of-genres-forced-interrupt",
        "39027.major-domo-forced-response",
        "39027.major-domo-action",
        "39028.stinger-tail-constant",
        "39028.stinger-tail-forced-interrupt",
        "39028.boost",
        "39029.supporting-actor-forced-response",
        "39029.boost",
        "39030.obligation",
        "39030.paparazzi-action",
        "39030.paparazzi-forced-interrupt",
        "39031.undercover-mojo-forced-interrupt",
        "39032.when-revealed",
        "39032.boost",
        "39033.when-revealed",
        "39034.when-revealed",
        "39034.boost",
      ].sort(),
    );
  });
});

describe("MojoMania 1A Setup and 1B When Revealed (39025a.setup, 39025b.when-revealed)", () => {
  it("puts the Wheel of Genres into play SPINNING and Mojo I at the front; the Wheel is not in the encounter deck", () => {
    const state = mojoGame();
    expect(inPlay(state, "39026a")).toHaveLength(1);
    expect(inst(state, wheelOf(state)).flipped).toBe(false);
    expect(state.instances[mojoOf(state)]!.cardId).toBe("39022");
    expect(activeVillain(state).stageIndex).toBe(0);
    expect(inEncounterPiles(state, "39026a")).toEqual([]);
    expect(state.instances[mainScheme(state)]!.cardId).toBe("39025a");
  });

  it("1B reveals one set-aside set's SHOW environment (in play, not in the deck) and shuffles the rest of that set in", () => {
    const state = mojoGame();
    // Two sets were set aside (1 + 1 per player); one is out of the set-aside area now.
    expect(setAsideSets(state)).toHaveLength(1);
    const shows = Object.values(SHOW_CODES).filter((code) => inPlay(state, code).length === 1);
    expect(shows).toHaveLength(1);
    const brought = ["sci-fi", "western"].find((set) => !setAsideSets(state).includes(set))!;
    expect(shows[0]).toBe(SHOW_CODES[brought as keyof typeof SHOW_CODES]);
    const setCards = WAVE6_CARDS.filter(
      (c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(brought),
    );
    expect(setCards.length).toBeGreaterThan(1);
    // Every other card of the brought-in set is in the encounter deck, with its quantity.
    const deck = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!.deck.map(
      (id) => state.instances[id]!.cardId as string,
    );
    for (const card of setCards.filter((c) => c.id !== shows[0])) {
      const quantity = "quantityInSet" in card ? (card.quantityInSet as number) : 1;
      expect(
        deck.filter((id) => id === card.id),
        card.id,
      ).toHaveLength(quantity);
    }
    expect(deck).not.toContain(shows[0]);
  });

  it("the SHOW revealed by 1B does not surge: it is the only card revealed, and nothing is drawn from the deck", () => {
    const { state, events } = mojoGameWithEvents();
    const shows = Object.values(SHOW_CODES).filter((code) => inPlay(state, code).length === 1);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId as string)).toEqual(shows);
    // Nothing was discarded either (a surge would have revealed the top card and sent it to the discard pile or into play).
    const deck = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!;
    expect(deck.discard).toEqual([]);
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ])("%i player(s): 1 + 1 per player sets are set aside, one is brought in, %i remain", (players, remaining) => {
    const seats = [
      { starterDeckId: "core-spider-man-justice" },
      { starterDeckId: "core-captain-marvel-leadership" },
      { starterDeckId: "core-black-panther-protection" },
      { starterDeckId: "core-iron-man-aggression" },
    ].slice(0, players);
    const state = mojoGame({ players: seats });
    expect(setAsideSets(state)).toHaveLength(remaining);
  });

  it("the SHOW brought in is random: different seeds bring in different genres", () => {
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => setAsideSets(mojoGame({ seed })).join(",")));
    expect(seen.size).toBeGreaterThan(1);
    expect(setAsideSets(mojoGame({ seed: 3 }))).toEqual(setAsideSets(mojoGame({ seed: 3 })));
  });
});

describe("Mojo I-III: Forced Response (Hero), after your turn ends (39022-39024.mojo-forced-response)", () => {
  const stage = (index: number, players: Parameters<typeof mojoGame>[0] = {}) =>
    run(withMojoStage(mojoGame(players), index), toHero(P1));

  it.each([
    [0, 3],
    [1, 4],
    [2, 5],
  ])("stage %i discards the top %i cards of the encounter deck, and no more", (index, n) => {
    const top = [...CORE_FILLER, ...CORE_FILLER].slice(0, n + 1);
    const { events } = endTurn(stage(index), top);
    expect(discardedFromDeck(untilActivation(events))).toEqual(top.slice(0, n));
  });

  it.each([
    [0, 3],
    [1, 4],
    [2, 5],
  ])("stage %i places 1 threat on your hero for each of the %i cards that is not a Mojo card", (index, n) => {
    const state = stage(index);
    const hero = identityOf(state);
    // A Mojo card (it does not count), then Core cards.
    const top = [MOJO_CARDS[0], ...CORE_FILLER.slice(0, n - 1), NO_BOOST];
    const { events } = endTurn(state, top);
    expect(discardedFromDeck(untilActivation(events))).toEqual(top.slice(0, n));
    expect(threatPlacedOn(untilActivation(events), hero)).toEqual(Array(n - 1).fill(1));
  });

  it("only Mojo-set cards: no threat at all", () => {
    const state = heroGame();
    const { events } = endTurn(state, [...MOJO_CARDS, NO_BOOST]);
    expect(discardedFromDeck(untilActivation(events))).toEqual([...MOJO_CARDS]);
    expect(threatPlacedOn(untilActivation(events), identityOf(state))).toEqual([]);
  });

  it("only cards of other sets: 1 threat for each of the three", () => {
    const state = heroGame();
    const { events } = endTurn(state, ["01186", "01188", "01189", NO_BOOST]);
    expect(threatPlacedOn(untilActivation(events), identityOf(state))).toEqual([1, 1, 1]);
  });

  it("the cards of the genre set shuffled in are not Mojo cards, so they count", () => {
    const state = heroGame();
    const brought = ["sci-fi", "western"].find((set) => !setAsideSets(state).includes(set))!;
    const deck = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!.deck;
    const inGenre = [...new Set(deck.map((id) => state.instances[id]!.cardId as string))].filter((code) =>
      (WAVE6_CARDS.find((c) => c.id === code) as { encounterSetIds?: readonly string[] }).encounterSetIds?.includes(
        brought,
      ),
    );
    expect(inGenre.length).toBeGreaterThanOrEqual(3);
    const top = [...inGenre.slice(0, 3), NO_BOOST];
    const { events } = endTurn(state, top);
    expect(discardedFromDeck(untilActivation(events))).toEqual(inGenre.slice(0, 3));
    expect(threatPlacedOn(untilActivation(events), identityOf(state))).toEqual([1, 1, 1]);
  });

  it("in alter-ego form it does nothing: no cards are discarded and no threat is placed", () => {
    const state = mojoGame();
    expect(inst(state, identityOf(state)).threat).toBe(0);
    const { events } = endTurn(state, ["01186", "01188", "01189", NO_BOOST]);
    expect(discardedFromDeck(untilActivation(events))).toEqual([]);
    expect(threatPlacedOn(untilActivation(events), identityOf(state))).toEqual([]);
  });

  it("threat goes on the hero, not on an ally you control", () => {
    const { state: withAlly, id: ally } = intoPlayArea(heroGame(), P1, "01002");
    const { events } = endTurn(withAlly, ["01186", "01188", "01189", NO_BOOST]);
    expect(threatPlacedOn(untilActivation(events), ally)).toEqual([]);
    expect(threatPlacedOn(untilActivation(events), identityOf(withAlly))).toEqual([1, 1, 1]);
  });

  it("two players: 'you' is the player whose turn ended, once for each hero", () => {
    const state = run(mojoGame({ players: TWO }), toHero(P1));
    const first = endTurn(state, ["01186", "01188", "01189", NO_BOOST], P1);
    expect(threatPlacedOn(first.events, identityOf(state, P1))).toEqual([1, 1, 1]);
    expect(threatPlacedOn(first.events, identityOf(state, P2))).toEqual([]);
    expect(discardedFromDeck(first.events)).toEqual(["01186", "01188", "01189"]);
    const second = endTurn(run(first.state, toHero(P2)), ["01190", "01186", "01187", NO_BOOST], P2);
    const afterTurn = untilActivation(second.events);
    expect(discardedFromDeck(afterTurn)).toEqual(["01190", "01186", "01187"]);
    expect(threatPlacedOn(afterTurn, identityOf(state, P2))).toEqual([1, 1, 1]);
    expect(threatPlacedOn(afterTurn, identityOf(state, P1))).toEqual([]);
  });

  it("two players: the one in alter-ego form is skipped", () => {
    const state = run(mojoGame({ players: TWO }), toHero(P1));
    const first = endTurn(state, ["01186", "01188", "01189", NO_BOOST], P1);
    expect(discardedFromDeck(first.events)).toEqual(["01186", "01188", "01189"]);
    const second = endTurn(first.state, ["01190", "01186", "01187", NO_BOOST], P2);
    expect(discardedFromDeck(untilActivation(second.events))).toEqual([]);
    expect(threatPlacedOn(untilActivation(second.events), identityOf(state, P2))).toEqual([]);
  });
});

describe("Mojo II and III: When Revealed (39023.when-revealed, 39024.when-revealed)", () => {
  it("expert mode starts at Mojo II: 2 threat on each player's identity at setup, and none on the main scheme from it", () => {
    const state = mojoGame({ players: TWO, difficulty: "expert" });
    expect(state.instances[mojoOf(state)]!.cardId).toBe("39022");
    expect(activeVillain(state).stageIndex).toBe(1);
    expect(threat(state, identityOf(state, P1))).toBe(2);
    expect(threat(state, identityOf(state, P2))).toBe(2);
  });

  it("standard: Mojo I -> II puts 2 threat on every identity and ally, and none on an enemy", () => {
    let state = heroGame({ players: TWO });
    const black = intoPlayArea(state, P1, "01002");
    state = black.state;
    const maria = intoPlayArea(state, P2, "01067");
    state = maria.state;
    const minion = engageMinion(state, "39029", P1);
    state = minion.state;
    expect(threat(state, black.id)).toBe(0);
    // Mojo I -> II.
    state = defeatWithAttack(deps, state, mojoOf(state));
    expect(activeVillain(state).stageIndex).toBe(1);
    expect(threat(state, identityOf(state, P1))).toBe(2);
    expect(threat(state, identityOf(state, P2))).toBe(2);
    expect(threat(state, black.id)).toBe(2);
    expect(threat(state, maria.id)).toBe(2);
    expect(threat(state, minion.id)).toBe(0);
  });

  it("expert: Mojo II -> III puts 3 more on every identity and ally, and a victory over Mojo III ends the game", () => {
    let state = heroGame({ players: TWO, difficulty: "expert" });
    const black = intoPlayArea(state, P1, "01002");
    state = black.state;
    const maria = intoPlayArea(state, P2, "01067");
    state = maria.state;
    const minion = engageMinion(state, "39029", P1);
    state = minion.state;
    // Mojo II's 2 threat on P1's identity went to the main scheme when P1 changed to hero form (1B).
    expect(threat(state, identityOf(state, P1))).toBe(0);
    expect(threat(state, identityOf(state, P2))).toBe(2);
    expect(threat(state, black.id)).toBe(0);
    state = defeatWithAttack(deps, state, mojoOf(state));
    expect(activeVillain(state).stageIndex).toBe(2);
    expect(threat(state, identityOf(state, P1))).toBe(3);
    expect(threat(state, identityOf(state, P2))).toBe(5);
    expect(threat(state, black.id)).toBe(3);
    expect(threat(state, maria.id)).toBe(3);
    expect(threat(state, minion.id)).toBe(0);
    state = patchInstance(state, identityOf(state), { exhausted: false });
    state = defeatWithAttack(deps, state, mojoOf(state));
    expect(state.outcome).toMatchObject({ result: "win" });
  });
});

describe("MojoMania 1B: Forced Interrupt, a character flips or leaves play (39025b.mojomania-forced-interrupt)", () => {
  const withThreat = (state: GameState, id: InstanceId, n: number) => patchInstance(state, id, { threat: n });

  it("a hero changing to hero form moves all its threat to the main scheme", () => {
    let state = mojoGame();
    const hero = identityOf(state);
    state = withThreat(state, hero, 3);
    const before = threat(state, mainScheme(state));
    const { state: after, events } = driveEventsPicking(deps, state, firstLegal, toHero(P1));
    expect(threat(after, hero)).toBe(0);
    expect(threat(after, mainScheme(after))).toBe(before + 3);
    expect(threatRemovedFrom(events, hero)).toEqual([3]);
    expect(threatPlacedOn(events, mainScheme(after))).toEqual([3]);
  });

  it("and back to alter-ego form", () => {
    // Hero form from the start of the round, so the voluntary change back is allowed (surgery).
    let state = withForm(mojoGame(), { heroForm: 0 });
    const hero = identityOf(state);
    state = patchInstance(state, hero, { threat: 2 });
    const before = threat(state, mainScheme(state));
    const { state: after } = driveEventsPicking(deps, state, firstLegal, toHero(P1));
    expect(after.players[0]!.identity.form).toBe("alterEgo");
    expect(threat(after, hero)).toBe(0);
    expect(threat(after, mainScheme(after))).toBe(before + 2);
  });

  it("a hero with no threat flips and the main scheme is untouched", () => {
    const state = mojoGame();
    const before = threat(state, mainScheme(state));
    const { state: after, events } = driveEventsPicking(deps, state, firstLegal, toHero(P1));
    expect(threat(after, mainScheme(after))).toBe(before);
    expect(threatPlacedOn(events, mainScheme(after))).toEqual([]);
  });

  it("two players: only the character that flips loses its threat", () => {
    let state = mojoGame({ players: TWO });
    state = withThreat(withThreat(state, identityOf(state, P1), 3), identityOf(state, P2), 4);
    const { state: after } = driveEventsPicking(deps, state, firstLegal, toHero(P1));
    expect(threat(after, identityOf(after, P1))).toBe(0);
    expect(threat(after, identityOf(after, P2))).toBe(4);
  });

  it("a minion defeated moves its threat to the main scheme", () => {
    let state = heroGame();
    const minion = engageMinion(state, "39029", P1);
    state = withThreat(minion.state, minion.id, 4);
    const before = threat(state, mainScheme(state));
    const after = defeatWithAttack(deps, state, minion.id);
    expect(inPlay(after, "39029")).toHaveLength(0);
    expect(threat(after, mainScheme(after))).toBe(before + 4);
  });

  it("an ally defeated moves its threat to the main scheme", () => {
    const { state: staged, id: ally } = intoPlayArea(heroGame(), P1, "01002"); // Black Cat
    let state = patchInstance(staged, ally, { threat: 3, damage: 2 }); // 1 hit point left of 3
    const defend: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === ally)
        ? [ally as string]
        : firstLegal(s);
    // Mojo's own attack (ATK 1) is defended by Black Cat, who has 1 hit point left.
    const { state: after, events } = endTurn(state, [...MOJO_CARDS, NO_BOOST], P1, defend);
    state = after;
    expect(cardsInPlay(state)).not.toContain(ally);
    expect(threatRemovedFrom(events, ally)).toEqual([3]);
    expect(threatPlacedOn(events, mainScheme(state))).toContain(3);
  });

  it("not otherwise: threat stays on a hero that takes damage or exhausts, and on an ally that is damaged but survives", () => {
    const { state: staged, id: ally } = intoPlayArea(heroGame(), P1, "01002");
    let state = patchInstance(staged, ally, { threat: 2 });
    const hero = identityOf(state);
    state = withThreat(state, hero, 2);
    const minion = engageMinion(state, "39029", P1);
    state = minion.state;
    const before = threat(state, mainScheme(state));
    // The hero attacks (and exhausts) and the minion is hit but not defeated; the ally is damaged by a direct hit.
    state = run(state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero,
      targetInstanceId: minion.id,
    });
    state = patchInstance(state, ally, { damage: 1 });
    expect(inst(state, hero).exhausted).toBe(true);
    expect(threat(state, hero)).toBe(2);
    expect(threat(state, ally)).toBe(2);
    expect(threat(state, mainScheme(state))).toBe(before);
  });
});

describe("Wheel of Genres (39026a.wheel-of-genres-forced-response, 39026b.wheel-of-genres-forced-interrupt)", () => {
  const SHOWS = Object.values(SHOW_CODES) as string[];
  const showsInPlay = (state: GameState) => SHOWS.filter((code) => inPlay(state, code).length > 0);
  /**
   * The encounter deck is the boost card and one more, and the player is in alter-ego form (so Mojo's own discards do
   * not reset it first): Mojo's boost card leaves one card, step three's deal takes it and the deck resets there.
   */
  const resetAtTheDeal = (state: GameState) => withEncounterDeck(state, NO_BOOST, "39034");
  const flips = (events: readonly GameEvent[], id: InstanceId) =>
    of(events, "cardFlipped").filter((e) => e.instanceId === id);

  it("SPINNING: after the deck resets, with a set still set aside, the Wheel flips to STOPPED and the game goes on", () => {
    const state = resetAtTheDeal(mojoGame());
    expect(setAsideSets(state)).toHaveLength(1);
    const wheel = wheelOf(state);
    const { state: after, events } = driveEventsPicking(deps, state, firstLegal, { type: "endTurn", playerId: P1 });
    expect(after.outcome).toBeNull();
    expect(flips(events, wheel)).toHaveLength(1);
    expect(inst(after, wheel).flipped).toBe(true);
    // The reset happened as the card was dealt, and the set is still set aside until STOPPED acts (next round's step three).
    expect(setAsideSets(after)).toHaveLength(1);
  });

  it("SPINNING: the flip is not a reveal (nothing is revealed for the Wheel)", () => {
    const state = resetAtTheDeal(mojoGame());
    const { events } = driveEventsPicking(deps, state, firstLegal, { type: "endTurn", playerId: P1 });
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId as string)).not.toContain("39026a");
  });

  it("SPINNING: with no set-aside modular set remaining, the reset loses the game", () => {
    const state = { ...resetAtTheDeal(mojoGame()), setAsideModularSets: [] };
    const { state: after } = driveEventsPicking(deps, state, firstLegal, { type: "endTurn", playerId: P1 });
    expect(after.outcome).toMatchObject({ result: "loss" });
    expect(inst(after, wheelOf(after)).flipped).toBe(false);
  });

  it("SPINNING: a deck that does not reset leaves the Wheel alone", () => {
    const state = mojoGame();
    const wheel = wheelOf(state);
    const { state: after, events } = driveEventsPicking(deps, state, firstLegal, { type: "endTurn", playerId: P1 });
    expect(flips(events, wheel)).toHaveLength(0);
    expect(inst(after, wheel).flipped).toBe(false);
    expect(after.outcome).toBeNull();
  });

  describe("STOPPED, at the start of step three of the villain phase", () => {
    /** The sci-fi set is the one still set aside (its cards have no conditional surge of their own). */
    const stoppedGame = (options: Parameters<typeof mojoGame>[0] = {}) =>
      withWheelStopped(mojoGameKeeping("sci-fi", options), true);
    /** The villain phase of a solo game in alter-ego form: Mojo schemes with the boost card stacked first. */
    const phase = (state: GameState, pick: Picker = firstLegal) =>
      driveEventsPicking(deps, stackEncounterDeck(state, NO_BOOST), pick, { type: "endTurn", playerId: P1 });

    it("reveals the set-aside set's SHOW environment (in play), shuffles the rest on top, deals the first player 2 cards", () => {
      const state = stoppedGame();
      const aside = setAsideSets(state)[0]!;
      const show = SHOW_CODES[aside as keyof typeof SHOW_CODES];
      const brought = showsInPlay(state);
      const { state: after, events } = phase(state);
      expect(setAsideSets(after)).toEqual([]);
      // Exactly one show at a time: the SHOW setup brought in was discarded by the new one's When Revealed.
      expect(showsInPlay(after)).toEqual([show]);
      expect(brought).not.toContain(show);
      const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
      expect(revealed[0]).toBe(show);
      // Two facedown cards for the first player plus the villain phase's own: three cards of the set are revealed.
      const setCardIds = (
        WAVE6_CARDS.filter(
          (c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(aside),
        ).map((c) => c.id) as string[]
      ).filter((id) => id !== show);
      expect(revealed.slice(1)).toHaveLength(3);
      for (const id of revealed.slice(1)) expect(setCardIds, id).toContain(id);
    });

    it("the rest of the set is shuffled on top of the encounter deck: the first player's three cards come from it, in order", () => {
      const state = stoppedGame();
      const aside = setAsideSets(state)[0]!;
      const show = SHOW_CODES[aside as keyof typeof SHOW_CODES];
      const rest = (
        WAVE6_CARDS.filter(
          (c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(aside),
        ).flatMap((c) => Array<string>("quantityInSet" in c ? (c.quantityInSet as number) : 1).fill(c.id)) as string[]
      ).filter((id) => id !== show);
      const { events } = phase(state);
      const shuffled = of(events, "setAsideModularSetShuffledIn");
      expect(shuffled).toHaveLength(1);
      expect(shuffled[0]!.encounterSetId).toBe(aside);
      expect(shuffled[0]!.placement).toBe("shuffledOnTop");
      // Every other card of the set, none of them the SHOW.
      expect(shuffled[0]!.instanceIds).toHaveLength(rest.length);
      // The cards that then leave the top of the deck (the SHOW's own reveal came before) are the set's first three.
      const at = events.indexOf(shuffled[0]!);
      const leaving = of(events.slice(at), "cardMoved")
        .filter((e) => e.from.kind === "encounterDeck" && e.to.kind !== "encounterDiscard")
        .map((e) => e.instanceId);
      expect(leaving.slice(0, 3)).toEqual(shuffled[0]!.instanceIds.slice(0, 3));
    });

    it("the SHOW revealed by the Wheel does not surge", () => {
      const state = stoppedGame();
      const { events } = phase(state);
      const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
      // The SHOW and exactly the three dealt cards: a surge would reveal a fourth.
      expect(revealed).toHaveLength(4);
    });

    it("the Wheel's own flip is not a reveal, and it flips back to SPINNING", () => {
      const state = stoppedGame();
      const wheel = wheelOf(state);
      const { state: after, events } = phase(state);
      expect(flips(events, wheel)).toHaveLength(1);
      expect(inst(after, wheel).flipped).toBe(false);
      expect(of(events, "encounterCardRevealed").map((e) => e.cardId as string)).not.toContain("39026a");
    });

    it("the first player (not the other seats) gets the two extra cards; each player still gets the step's own card", () => {
      const state = stoppedGame({ players: TWO });
      const { events } = driveEventsPicking(
        deps,
        stackEncounterDeck(state, NO_BOOST),
        firstLegal,
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: P2 },
      );
      const revealed = of(events, "encounterCardRevealed");
      const by = (p: PlayerId) => revealed.filter((e) => e.playerId === p).length;
      // The first player reveals the SHOW as well as 2 + 1 cards.
      expect(by(P1)).toBe(4);
      expect(by(P2)).toBe(1);
    });

    it("it acts at the start of step three: the boost card was drawn before it, from the old deck", () => {
      const state = stoppedGame();
      const { events } = phase(state);
      const boostAt = events.findIndex((e) => e.type === "boostCardDealt");
      const showRevealedAt = events.findIndex(
        (e) => e.type === "encounterCardRevealed" && SHOWS.includes(e.cardId as string),
      );
      expect(boostAt).toBeGreaterThanOrEqual(0);
      expect(showRevealedAt).toBeGreaterThan(boostAt);
    });
  });

  it("the whole cycle: the deck resets at one round's deal, the next round's step three brings in a set, the Wheel is SPINNING again", () => {
    let state = resetAtTheDeal(mojoGame());
    const wheel = wheelOf(state);
    state = driveEventsPicking(deps, state, firstLegal, { type: "endTurn", playerId: P1 }).state;
    expect(inst(state, wheel).flipped).toBe(true);
    expect(setAsideSets(state)).toHaveLength(1);
    state = driveEventsPicking(deps, stackEncounterDeck(state, NO_BOOST), firstLegal, {
      type: "endTurn",
      playerId: P1,
    }).state;
    expect(inst(state, wheel).flipped).toBe(false);
    expect(setAsideSets(state)).toEqual([]);
    expect(state.outcome).toBeNull();
  });
});

describe("Mojo's attachments, Undercover Mojo and the insert p. 18 fixtures", () => {
  const quiet = (options: Parameters<typeof mojoGame>[0] = {}) => withoutShow(mojoGame(options));
  const attackMojo = (state: GameState, pick: Picker = firstLegal) =>
    driveEventsPicking(deps, state, pick, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: mojoOf(state),
    });
  /** What the hero's basic attack deals, read from a plain attack on an unattached Mojo. */
  const heroAttack = (): number => {
    const base = run(quiet(), toHero(P1));
    return damageTo(attackMojo(base).events, mojoOf(base))[0]!;
  };

  describe("Major Domo (39027)", () => {
    const withDomo = (state: GameState) => attachToHost(state, "39027", mojoOf(state));

    it("Mojo gets +1 ATK from it (data), and after he attacks, as many cards are discarded as the attack dealt", () => {
      const staged = run(quiet(), toHero(P1));
      const { state } = withDomo(staged);
      // Boost cards and the turn-end discards come first; every deck card discarded after the attack is Major Domo's.
      const { events } = endTurn(state, ["01186", "01188", "01189", NO_BOOST]);
      expect(of(events, "enemyActivated").length).toBeGreaterThanOrEqual(1);
      const dealt = of(events, "damageDealt").filter((e) => e.targetInstanceId === identityOf(state));
      const amount = dealt[0]!.amount;
      expect(amount).toBe(2); // ATK 1 + Major Domo's 1
      const afterAttack = events.slice(events.findIndex((e) => e.type === "damageDealt"));
      const domoDiscards = discardedFromDeck(
        afterAttack.slice(
          0,
          afterAttack.findIndex((e) => e.type === "stepChanged"),
        ),
      );
      expect(domoDiscards).toHaveLength(amount);
    });

    it("without it Mojo's attack discards nothing beyond the turn-end cards", () => {
      const state = run(quiet(), toHero(P1));
      const { events } = endTurn(state, ["01186", "01188", "01189", NO_BOOST]);
      const dealt = of(events, "damageDealt").filter((e) => e.targetInstanceId === identityOf(state));
      expect(dealt[0]!.amount).toBe(1);
      const afterAttack = events.slice(events.findIndex((e) => e.type === "damageDealt"));
      expect(
        discardedFromDeck(
          afterAttack.slice(
            0,
            afterAttack.findIndex((e) => e.type === "stepChanged"),
          ),
        ),
      ).toEqual([]);
    });

    it("a defended attack discards as many cards as the damage dealt, whoever took it", () => {
      const { state: ally0, id: ally } = intoPlayArea(run(quiet(), toHero(P1)), P1, "01002"); // Black Cat, 3 hit points
      const { state } = withDomo(ally0);
      const defend: Picker = (s) =>
        s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === ally)
          ? [ally as string]
          : firstLegal(s);
      const { events } = endTurn(state, ["01186", "01188", "01189", NO_BOOST], P1, defend);
      expect(damageTo(events, ally)).toEqual([2]);
      const afterAttack = events.slice(events.findIndex((e) => e.type === "damageDealt"));
      expect(
        discardedFromDeck(
          afterAttack.slice(
            0,
            afterAttack.findIndex((e) => e.type === "stepChanged"),
          ),
        ),
      ).toHaveLength(2);
    });

    it("Hero Action: spending [energy][mental][physical] resources discards it; two of the three types do not", () => {
      const domo = withDomo(run(quiet(), toHero(P1)));
      const conjured = conjure(domo.state, [ENERGY, GENIUS, STRENGTH]);
      const pay = (n: number) => conjured.ids.slice(0, n).map((fromHand) => ({ fromHand }));
      const ACTION = "39027.major-domo-action";
      const paid = applyCommand(conjured.state, use(P1, domo.id, ACTION, pay(3)), deps);
      expect(paid.ok).toBe(true);
      if (paid.ok) {
        const after = settle(paid.state, firstLegal, undefined, deps);
        expect(inst(after, mojoOf(after)).attachments).not.toContain(domo.id);
        expect(encounterDiscard(after)).toContain("39027");
      }
      // [energy][mental] only: the cost is not met.
      expect(applyCommand(conjured.state, use(P1, domo.id, ACTION, pay(2)), deps).ok).toBe(false);
    });

    it("it is a Hero Action: not in alter-ego form", () => {
      const domo = withDomo(quiet());
      const conjured = conjure(domo.state, [ENERGY, GENIUS, STRENGTH]);
      const result = applyCommand(
        conjured.state,
        use(
          P1,
          domo.id,
          "39027.major-domo-action",
          conjured.ids.map((fromHand) => ({ fromHand })),
        ),
        deps,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("Stinger Tail (39028)", () => {
    const withTail = (state: GameState) => attachToHost(state, "39028", mojoOf(state));
    const armed = () => {
      const { state, id } = withTail(run(quiet(), toHero(P1)));
      return { state, tail: id };
    };

    it("Forced Interrupt: damage that would be dealt to Mojo is placed on Stinger Tail instead", () => {
      const { state, tail } = armed();
      const { state: after, events } = attackMojo(state);
      const dealt = heroAttack();
      expect(dealt).toBeGreaterThan(0);
      expect(inst(after, tail).damage).toBe(dealt);
      expect(inst(after, mojoOf(after)).damage).toBe(0);
      expect(damageTo(events, mojoOf(after))).toEqual([]);
    });

    it("Mojo gains retaliate 2: the attacker takes 2 damage, and none without it", () => {
      const { state } = armed();
      const hero = identityOf(state);
      expect(damageTo(attackMojo(state).events, hero)).toEqual([2]);
      const plain = run(quiet(), toHero(P1));
      expect(damageTo(attackMojo(plain).events, identityOf(plain))).toEqual([]);
    });

    it("Then, with 5 or more damage on it, it is discarded; all the damage was placed there, none spills to Mojo", () => {
      const { state, tail } = armed();
      const hurt = patchInstance(state, tail, { damage: 4 });
      const { state: after } = attackMojo(hurt);
      expect(inst(after, mojoOf(after)).attachments).not.toContain(tail);
      expect(encounterDiscard(after)).toContain("39028");
      expect(inst(after, mojoOf(after)).damage).toBe(0);
    });

    it("with fewer than 5 damage on it, it stays attached", () => {
      const { state, tail } = armed();
      const hurt = patchInstance(state, tail, { damage: 5 - heroAttack() - 1 });
      const { state: after } = attackMojo(hurt);
      expect(inst(after, tail).damage).toBe(4);
      expect(inst(after, mojoOf(after)).attachments).toContain(tail);
    });

    it("insert p. 18: Stinger Tail discarded by an attack's damage is gone before its retaliate 2", () => {
      const { state, tail } = armed();
      const hero = identityOf(state);
      const { state: after, events } = attackMojo(patchInstance(state, tail, { damage: 4 }));
      expect(encounterDiscard(after)).toContain("39028");
      expect(damageTo(events, hero)).toEqual([]);
      expect(inst(after, hero).damage).toBe(0);
    });

    it("[star] Boost: attach this card to Mojo", () => {
      const state = quiet();
      const { events, state: after } = endTurn(state, ["39028", "01186"]);
      const [tail] = inEncounterPiles(after, "39028").length ? inEncounterPiles(after, "39028") : [undefined];
      expect(tail).toBeUndefined();
      expect(of(events, "boostCardFlipped").length).toBeGreaterThanOrEqual(1);
      const attachedTo = Object.values(after.instances).find((i) => i.cardId === "39028")!;
      expect(attachedTo.attachedTo).toBe(mojoOf(after));
      expect(inst(after, mojoOf(after)).attachments).toContain(attachedTo.instanceId);
    });
  });

  describe("Undercover Mojo (39031)", () => {
    const withUndercover = (state: GameState, threatOnIt: number) =>
      encounterCardInVillainArea(state, "39031", threatOnIt);

    it("Hinder 2[per_hero]: it enters play with its 2 threat and 2 more per player", () => {
      const solo = endTurn(quiet(), [NO_BOOST, "39031"]).state;
      const [one] = inPlay(solo, "39031");
      expect(threat(solo, one!)).toBe(2 + 2);
      let two = quiet({ players: TWO });
      two = driveEventsPicking(deps, two, firstLegal, { type: "endTurn", playerId: P1 }).state;
      two = endTurn(two, [NO_BOOST, NO_BOOST, "39031", "01186"], P2).state;
      const [other] = inPlay(two, "39031");
      expect(threat(two, other!)).toBe(2 + 4);
    });

    it("Forced Interrupt: damage to Mojo removes an equal amount of threat from it instead; Mojo takes none", () => {
      const staged = run(quiet(), toHero(P1));
      const { state, id } = withUndercover(staged, 9);
      const dealt = heroAttack();
      const { state: after, events } = attackMojo(state);
      expect(threat(after, id)).toBe(9 - dealt);
      expect(inst(after, mojoOf(after)).damage).toBe(0);
      expect(damageTo(events, mojoOf(after))).toEqual([]);
      expect(threatRemovedFrom(events, id)).toEqual([dealt]);
    });

    it("with less threat than the damage, all the damage is replaced and the scheme is defeated (pending default, Q47)", () => {
      const staged = run(quiet(), toHero(P1));
      const { state, id } = withUndercover(staged, 1);
      expect(heroAttack()).toBeGreaterThan(1);
      const { state: after } = attackMojo(state);
      expect(inPlay(after, "39031")).toHaveLength(0);
      expect(inst(after, mojoOf(after)).damage).toBe(0);
      expect(threat(after, id)).toBe(0);
    });

    it("damage to anything else is not replaced", () => {
      const staged = run(quiet(), toHero(P1));
      const { state, id } = withUndercover(staged, 5);
      const minion = engageMinion(state, "39029", P1);
      const { state: after } = driveEventsPicking(deps, minion.state, firstLegal, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(minion.state),
        targetInstanceId: minion.id,
      });
      expect(inst(after, minion.id).damage).toBe(heroAttack());
      expect(threat(after, id)).toBe(5);
    });
  });

  describe("insert p. 18: Stinger Tail and Undercover Mojo in play together", () => {
    const both = () => {
      const staged = run(quiet(), toHero(P1));
      const tail = attachToHost(staged, "39028", mojoOf(staged));
      const undercover = encounterCardInVillainArea(tail.state, "39031", 9);
      return { state: undercover.state, tail: tail.id, undercover: undercover.id };
    };
    const putting =
      (first: InstanceId): Picker =>
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind !== "orderTriggers") return firstLegal(s);
        const ids = choice.options.map((o) => o.optionId);
        return [...ids.filter((id) => id.startsWith(`${first}:`)), ...ids.filter((id) => !id.startsWith(`${first}:`))];
      };

    it("the first player orders them: Stinger Tail first takes the damage, and Undercover Mojo has nothing left to replace", () => {
      const { state, tail, undercover } = both();
      const dealt = heroAttack();
      const { state: after, events } = attackMojo(state, putting(tail));
      expect(events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "orderTriggers")).toBe(true);
      expect(inst(after, tail).damage).toBe(dealt);
      expect(threat(after, undercover)).toBe(9);
      expect(inst(after, mojoOf(after)).damage).toBe(0);
      expect(threatRemovedFrom(events, undercover)).toEqual([]);
    });

    it("Undercover Mojo first removes the threat, and Stinger Tail has nothing left to take", () => {
      const { state, tail, undercover } = both();
      const dealt = heroAttack();
      const { state: after, events } = attackMojo(state, putting(undercover));
      expect(threat(after, undercover)).toBe(9 - dealt);
      expect(inst(after, tail).damage).toBe(0);
      expect(inst(after, mojoOf(after)).damage).toBe(0);
      expect(threatRemovedFrom(events, undercover)).toEqual([dealt]);
    });
  });
});

/** Both players of a two-player game end their turns (the first player first), the encounter deck stacked at the start. */
const bothTurns = (state: GameState, top: readonly string[], pick: Picker = firstLegal) => {
  const order = [state.firstPlayerId, ...state.players.map((p) => p.playerId).filter((p) => p !== state.firstPlayerId)];
  return driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...top),
    pick,
    ...order.map((playerId) => ({ type: "endTurn" as const, playerId })),
  );
};

describe("Supporting Actor (39029)", () => {
  const quiet = (options: Parameters<typeof mojoGame>[0] = {}) => withoutShow(mojoGame(options));
  const actorGame = (form: "alterEgo" | "hero") => {
    const base = form === "hero" ? run(quiet(), toHero(P1)) : quiet();
    return engageMinion(base, "39029", P1);
  };

  it.each(["alterEgo", "hero"] as const)(
    "[star] Forced Response: after it activates against you (%s form), 2 threat is placed on it",
    (form) => {
      const { state, id } = actorGame(form);
      // The villain's and the minion's own boost cards, then an inert card for the player's reveal. In hero form Mojo's
      // turn-end discards come first, then the activations.
      const top =
        form === "hero" ? ["01188", "01189", "01190", BLANK_BOOST, NO_BOOST, INERT[0]] : [NO_BOOST, NO_BOOST, INERT[0]];
      const { state: after, events } = endTurn(state, top);
      expect(threatPlacedOn(events, id)).toEqual([2]);
      expect(threat(after, id)).toBe(2);
    },
  );

  it("it adds 2 each time it activates", () => {
    const { state, id } = actorGame("alterEgo");
    const once = endTurn(state, [NO_BOOST, NO_BOOST, INERT[0]]).state;
    expect(threat(once, id)).toBe(2);
    const twice = endTurn(once, [BLANK_BOOST, BLANK_BOOST, INERT[1]]).state;
    expect(threat(twice, id)).toBe(4);
  });

  it("only its own activations: Supporting Actor engaged with the other player gets 2 threat once, for the activation against them", () => {
    const base = quiet({ players: TWO });
    const { state, id } = engageMinion(base, "39029", P2);
    const { events } = bothTurns(state, [NO_BOOST, BLANK_BOOST, NO_BOOST, BLANK_BOOST, INERT[0], INERT[1]]);
    expect(threatPlacedOn(events, id)).toEqual([2]);
  });

  it("Boost: place 1 threat on each character you control (the player the activation is against)", () => {
    const { state: staged, id: ally } = intoPlayArea(quiet({ players: TWO }), P1, "01002");
    const maria = intoPlayArea(staged, P2, "01067");
    // The first player's activation (P1 is first) is boosted by Supporting Actor; the second player's by a blank card.
    const { events } = bothTurns(maria.state, ["39029", BLANK_BOOST, INERT[0], INERT[1]]);
    expect(threatPlacedOn(events, identityOf(maria.state, P1))).toEqual([1]);
    expect(threatPlacedOn(events, ally)).toEqual([1]);
    expect(threatPlacedOn(events, identityOf(maria.state, P2))).toEqual([]);
    expect(threatPlacedOn(events, maria.id)).toEqual([]);
  });
});

describe("Paparazzi (39030)", () => {
  const quiet = (options: Parameters<typeof mojoGame>[0] = {}) => withoutShow(mojoGame(options));
  /** A game in which Paparazzi was revealed (alter-ego form, villain phase) and a new round has begun. */
  const withPaparazzi = (options: Parameters<typeof mojoGame>[0] = {}) => {
    const seats = options.players?.length ?? 1;
    const state0 = quiet(options);
    // Each player's activation draws a boost card, then the first player reveals Paparazzi and the others an inert card.
    const stack = [...Array<string>(seats).fill(BLANK_BOOST), "39030", ...INERT.slice(0, seats - 1)];
    const state = seats === 1 ? endTurn(state0, stack, P1).state : bothTurns(state0, stack).state;
    const id = Object.values(state.instances).find((i) => i.cardId === "39030")!.instanceId;
    return { state, id };
  };

  it("Hinder 10: it enters play with 10 threat on it, however many players", () => {
    const solo = withPaparazzi();
    expect(cardsInPlay(solo.state)).toContain(solo.id);
    expect(threat(solo.state, solo.id)).toBe(10);
    expect(solo.state.players[0]!.playArea).toContain(solo.id);
  });

  const remove = (state: GameState, id: InstanceId, branch: 0 | 1, choices: Record<string, InstanceId[]>) =>
    driveEventsPicking(deps, state, firstLegal, use(P1, id, "39030.paparazzi-action", [], choices, { branch }));

  it("Action, exhausting a character you control: removes 3 threat in alter-ego form", () => {
    const { state, id } = withPaparazzi();
    const hero = identityOf(state);
    const { state: after, events } = remove(state, id, 0, { exhausted: [hero] });
    expect(inst(after, hero).exhausted).toBe(true);
    expect(threatRemovedFrom(events, id)).toEqual([3]);
    expect(threat(after, id)).toBe(7);
  });

  it("Action, discarding a card from your hand: removes 3 threat in alter-ego form and the identity stays ready", () => {
    const { state, id } = withPaparazzi();
    const hero = identityOf(state);
    const card = state.players[0]!.hand[0]!;
    const { state: after } = remove(state, id, 1, { discard: [card] });
    expect(inst(after, hero).exhausted).toBe(false);
    expect(after.players[0]!.discard).toContain(card);
    expect(threat(after, id)).toBe(7);
  });

  it("Action in hero form removes 2 threat, by either cost", () => {
    const { state: staged, id } = withPaparazzi();
    const state = run(staged, toHero(P1));
    const hero = identityOf(state);
    const exhaust = remove(state, id, 0, { exhausted: [hero] });
    expect(threat(exhaust.state, id)).toBe(8);
    expect(inst(exhaust.state, hero).exhausted).toBe(true);
    const card = state.players[0]!.hand[0]!;
    const discard = remove(state, id, 1, { discard: [card] });
    expect(threat(discard.state, id)).toBe(8);
    expect(inst(discard.state, hero).exhausted).toBe(false);
  });

  it("Action: an ally you control can be the character exhausted", () => {
    const { state: staged, id } = withPaparazzi();
    const { state, id: ally } = intoPlayArea(run(staged, toHero(P1)), P1, "01002");
    const { state: after } = remove(state, id, 0, { exhausted: [ally] });
    expect(inst(after, ally).exhausted).toBe(true);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(threat(after, id)).toBe(8);
  });

  it("Action: it removes no more than the threat there is", () => {
    const { state, id } = withPaparazzi();
    const near = patchInstance(state, id, { threat: 1 });
    const { state: after } = remove(near, id, 0, { exhausted: [identityOf(near)] });
    expect(threat(after, id)).toBe(0);
  });

  it("Forced Interrupt: when your turn ends, all its threat moves to the main scheme and it is discarded", () => {
    const { state, id } = withPaparazzi();
    const worn = patchInstance(state, id, { threat: 6 });
    const { events, state: after } = driveEventsPicking(deps, worn, firstLegal, { type: "endTurn", playerId: P1 });
    expect(threatRemovedFrom(events, id)).toEqual([6]);
    expect(threatPlacedOn(events, mainScheme(after))).toContain(6);
    expect(cardsInPlay(after)).not.toContain(id);
    expect(encounterDiscard(after)).toContain("39030");
  });

  it("Forced Interrupt: it is your turn ending, not another player's", () => {
    const { state, id } = withPaparazzi({ players: TWO });
    expect(threat(state, id)).toBe(10);
    expect(state.players.find((p) => p.playerId === P1)!.playArea).toContain(id);
    // A new round: the first player token moved on, so P2 goes first and P1 (the controller) second.
    expect(state.firstPlayerId).toBe(P2);
    const other = driveEventsPicking(deps, state, firstLegal, { type: "endTurn", playerId: P2 });
    expect(cardsInPlay(other.state)).toContain(id);
    expect(threat(other.state, id)).toBe(10);
    const own = driveEventsPicking(deps, other.state, firstLegal, { type: "endTurn", playerId: P1 });
    expect(cardsInPlay(own.state)).not.toContain(id);
    expect(threatPlacedOn(own.events, mainScheme(own.state))).toContain(10);
  });
});

describe("Curtain Call (39032)", () => {
  const quiet = (options: Parameters<typeof mojoGame>[0] = {}) => withoutShow(mojoGame(options));
  const choosing =
    (id: InstanceId): Picker =>
    (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === id) ? [id as string] : firstLegal(s);
  /** P1 (alter-ego, solo) reveals Curtain Call in the villain phase. */
  const reveal = (state: GameState, pick: Picker = firstLegal) => endTurn(state, [NO_BOOST, "39032"], P1, pick);

  it("moves all threat from the character with the most threat to the main scheme", () => {
    const { state: staged, id: ally } = intoPlayArea(quiet(), P1, "01002");
    const hero = identityOf(staged);
    const state = patchInstance(patchInstance(staged, ally, { threat: 4 }), hero, { threat: 1 });
    const { state: after, events } = reveal(state);
    expect(threatRemovedFrom(events, ally)).toEqual([4]);
    expect(threatPlacedOn(events, mainScheme(after))).toContain(4);
    expect(threat(after, ally)).toBe(0);
    expect(threat(after, hero)).toBe(1);
  });

  it("any character: another player's hero, or a minion, can be the one with the most", () => {
    const base = quiet({ players: TWO });
    const state = patchInstance(patchInstance(base, identityOf(base, P1), { threat: 2 }), identityOf(base, P2), {
      threat: 5,
    });
    const { events } = bothTurns(state, [NO_BOOST, NO_BOOST, "39032", INERT[0]]);
    expect(threatRemovedFrom(events, identityOf(base, P2))).toEqual([5]);
    expect(threatRemovedFrom(events, identityOf(base, P1))).toEqual([]);

    const minion = engageMinion(quiet(), "39029", P1);
    const hero = identityOf(minion.state);
    // Supporting Actor's own activation adds 2 first: 6 + 2 on it against the hero's 3.
    const withMinion = patchInstance(patchInstance(minion.state, minion.id, { threat: 6 }), hero, { threat: 3 });
    const moved = endTurn(withMinion, [NO_BOOST, BLANK_BOOST, "39032"]);
    expect(threatRemovedFrom(moved.events, minion.id)).toEqual([8]);
    expect(threat(moved.state, hero)).toBe(3);
  });

  it("a tie is the revealing player's pick", () => {
    const { state: staged, id: ally } = intoPlayArea(quiet(), P1, "01002");
    const hero = identityOf(staged);
    const state = patchInstance(patchInstance(staged, ally, { threat: 3 }), hero, { threat: 3 });
    const pickAlly = reveal(state, choosing(ally));
    expect(threat(pickAlly.state, ally)).toBe(0);
    expect(threat(pickAlly.state, hero)).toBe(3);
    const pickHero = reveal(state, choosing(hero));
    expect(threat(pickHero.state, hero)).toBe(0);
    expect(threat(pickHero.state, ally)).toBe(3);
  });

  it("if no threat was moved, 1 threat goes on each character you control and on nobody else's", () => {
    const { state: staged, id: ally } = intoPlayArea(quiet({ players: TWO }), P1, "01002");
    const maria = intoPlayArea(staged, P2, "01067");
    const { events } = bothTurns(maria.state, [NO_BOOST, BLANK_BOOST, "39032", INERT[0]]);
    expect(threatPlacedOn(events, identityOf(staged, P1))).toEqual([1]);
    expect(threatPlacedOn(events, ally)).toEqual([1]);
    expect(threatPlacedOn(events, identityOf(staged, P2))).toEqual([]);
    expect(threatPlacedOn(events, maria.id)).toEqual([]);
    // Nothing was moved off any character.
    expect(of(events, "threatRemoved").filter((e) => e.schemeInstanceId !== mainScheme(staged))).toEqual([]);
  });

  it("[star] Boost: reveal this card", () => {
    const { state: staged, id: ally } = intoPlayArea(quiet(), P1, "01002");
    const state = patchInstance(staged, ally, { threat: 3 });
    // Mojo's activation is boosted by Curtain Call, which is revealed and resolves its When Revealed ability.
    const { events, state: after } = endTurn(state, ["39032", INERT[0]]);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId as string)).toContain("39032");
    expect(threatRemovedFrom(events, ally)).toEqual([3]);
    expect(threat(after, ally)).toBe(0);
  });
});

describe("Director's Directions (39033)", () => {
  const quiet = (options: Parameters<typeof mojoGame>[0] = {}) => withoutShow(mojoGame(options));
  const choosingOption =
    (label: string, rest: Picker = firstLegal): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      const hit =
        choice?.prompt.kind === "chooseOption" ? choice.options.find((o) => o.label.startsWith(label)) : undefined;
      return hit ? [hit.optionId] : rest(s);
    };
  /** P1 (alter-ego, solo) reveals Directions; an inert card behind it is the surge's reveal. */
  const reveal = (state: GameState, pick: Picker) => endTurn(state, [NO_BOOST, "39033", INERT[0]], P1, pick);
  const revealed = (events: readonly GameEvent[]) => of(events, "encounterCardRevealed").map((e) => e.cardId as string);

  it("Mojo schemes: the villain activates a second time and the main scheme takes his SCH again", () => {
    const state = quiet();
    const control = endTurn(state, [NO_BOOST, INERT[0]]);
    // The scheme draws its own boost card (a blank one here) from behind Directions.
    const { events, state: after } = endTurn(
      state,
      [NO_BOOST, "39033", BLANK_BOOST],
      P1,
      choosingOption("Mojo schemes"),
    );
    expect(of(control.events, "schemeResolved")).toHaveLength(1);
    expect(of(events, "schemeResolved")).toHaveLength(2);
    expect(threatPlacedOn(events, mainScheme(after))).toEqual([1, 2, 2]);
    expect(revealed(events)).toEqual(["39033"]);
  });

  it.each([
    [3, 3, false],
    [2, 2, false],
    [1, 1, true],
    [0, 0, true],
  ])("take damage: %i threat on your identity is %i damage, and surge is %s", (threatOnIt, damage, surges) => {
    const staged = quiet();
    const hero = identityOf(staged);
    const state = patchInstance(staged, hero, { threat: threatOnIt });
    const { events } = reveal(state, choosingOption("Take 1 damage"));
    // Mojo's own scheme (alter-ego form) deals no damage, so the identity's damage is the card's.
    expect(damageTo(events, hero)).toEqual(damage > 0 ? [damage] : []);
    expect(revealed(events)).toEqual(surges ? ["39033", INERT[0]] : ["39033"]);
    expect(of(events, "surgeTriggered")).toHaveLength(surges ? 1 : 0);
  });

  it("spend 2 different resources: an [energy] and a [mental] card are discarded, and nothing else happens", () => {
    const staged = quiet();
    const conjured = conjure(staged, [ENERGY, GENIUS]);
    const pay: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "spendResources" ? conjured.ids.map((id) => `hand:${id}`) : firstLegal(s);
    const { events, state: after } = reveal(conjured.state, choosingOption("Spend 2 different", pay));
    for (const id of conjured.ids) expect(after.players[0]!.discard).toContain(id);
    expect(of(events, "schemeResolved")).toHaveLength(1);
    expect(damageTo(events, identityOf(staged))).toEqual([]);
    expect(of(events, "surgeTriggered")).toHaveLength(0);
  });

  it("spend 2 different resources: two cards of one type do not pay it", () => {
    const staged = quiet();
    const conjured = conjure(staged, [ENERGY, ENERGY]);
    // Stop at the spend prompt (the option chosen, the payment not yet made).
    const atPrompt = settle(
      run(stackEncounterDeck(conjured.state, NO_BOOST, "39033", INERT[0]), { type: "endTurn", playerId: P1 }),
      choosingOption("Spend 2 different"),
      (s) => s.pendingChoice?.prompt.kind === "spendResources",
      deps,
    );
    const choice = atPrompt.pendingChoice!;
    expect(choice.prompt.kind).toBe("spendResources");
    const answer = (ids: readonly string[]) =>
      applyCommand(
        atPrompt,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: ids },
        deps,
      );
    const result = answer(conjured.ids.map((id) => `hand:${id}`));
    // Either the payment is refused, or it is accepted and nothing was spent: the cards stay in hand.
    if (result.ok) {
      const after = settle(result.state, firstLegal, undefined, deps);
      for (const id of conjured.ids) expect(after.players[0]!.hand).toContain(id);
    }
  });

  // Pending default Q51 = B: "Spend 2 different resources" is offered only to a player who can pay it. There is no
  // "can pay" predicate in the DSL yet, so it is always offered; this documents the intended behavior.
  it.fails("Q51: the spend option is not offered to a player who cannot pay it (an empty hand, no resources)", () => {
    const staged = quiet();
    const empty = {
      ...staged,
      players: staged.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] })),
    };
    let offered: string[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") {
        offered = s.pendingChoice.options.map((o) => o.label);
        return choosingOption("Mojo schemes")(s);
      }
      return firstLegal(s);
    };
    endTurn(empty, [NO_BOOST, "39033", INERT[0]], P1, pick);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered).not.toContain("Spend 2 different resources");
  });
});

describe("Top Billing (39034)", () => {
  const quiet = (options: Parameters<typeof mojoGame>[0] = {}) => withoutShow(mojoGame(options));

  it("When Revealed: heals 1 damage from each character you control and places 2 threat on each, and on nobody else", () => {
    const { state: s1, id: ally } = intoPlayArea(quiet({ players: TWO }), P1, "01002");
    const hero = identityOf(s1, P1);
    const other = identityOf(s1, P2);
    const state = patchInstance(patchInstance(patchInstance(s1, hero, { damage: 3 }), ally, { damage: 2 }), other, {
      damage: 3,
    });
    const { state: after, events } = bothTurns(state, [NO_BOOST, BLANK_BOOST, "39034", INERT[0]]);
    expect(inst(after, hero).damage).toBe(2);
    expect(inst(after, ally).damage).toBe(1);
    expect(inst(after, other).damage).toBe(3);
    expect(threatPlacedOn(events, hero)).toEqual([2]);
    expect(threatPlacedOn(events, ally)).toEqual([2]);
    expect(threatPlacedOn(events, other)).toEqual([]);
  });

  it("a character with no damage heals nothing but still gets the threat", () => {
    const state = quiet();
    const { state: after, events } = endTurn(state, [NO_BOOST, "39034"]);
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(threatPlacedOn(events, identityOf(after))).toEqual([2]);
  });

  it("[star] Boost: place 1 threat on each character you control", () => {
    const { state: staged, id: ally } = intoPlayArea(quiet(), P1, "01002");
    const { events } = endTurn(staged, ["39034", INERT[0]]);
    expect(threatPlacedOn(events, identityOf(staged))).toEqual([1]);
    expect(threatPlacedOn(events, ally)).toEqual([1]);
  });
});
