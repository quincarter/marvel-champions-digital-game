/** "Cards left": counts from a real Rhino game, with the hidden-information edges moved into place by hand. */
import { beforeAll, describe, expect, test } from "vitest";
import { playableStarterDeckSetup, wave11Scenario } from "@mc/cards";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  cardOf,
  createGame,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { revealedSetsIn, type BlindReveal } from "./civil-war-blind.js";
import { boostSummaryOf, deckLeftTabsOf, deckLeftViewOf, type DeckLeftTab } from "./deck-left-model.js";

let state: GameState;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  state = store.state.game!;
});

const LIST = { list: true, boost: true };
const seat = (game: GameState) => game.players[0]!;
const viewOf = (game: GameState, tab: DeckLeftTab, shown = LIST, reveal: BlindReveal | null = null) =>
  deckLeftViewOf(game, POOL_DEPS, tab, seat(game).playerId, shown, reveal);
const total = (game: GameState, tab: DeckLeftTab): number =>
  viewOf(game, tab).rows.reduce((sum, row) => sum + row.count, 0);

const withEncounterDeck = (game: GameState, deck: readonly InstanceId[]): GameState => {
  const deckId = activeEncounterDeckId(game) as string;
  return {
    ...game,
    encounterDecks: { ...game.encounterDecks, [deckId]: { ...game.encounterDecks[deckId]!, deck } },
  };
};
/** The encounter deck's top card dealt facedown to the first player. */
const dealTop = (game: GameState): GameState => {
  const [top, ...rest] = activeEncounterDeck(game).deck;
  const dealt = withEncounterDeck(game, rest);
  const player = seat(dealt);
  return {
    ...dealt,
    players: [{ ...player, dealtEncounter: [...player.dealtEncounter, top!] }, ...dealt.players.slice(1)],
  };
};

describe("the hero deck", () => {
  test("lists every card in it, whose counts add up to the pile", () => {
    const view = viewOf(state, "hero");
    expect(view.inDeck).toBe(seat(state).deck.length);
    expect(total(state, "hero")).toBe(seat(state).deck.length);
    expect(view.rows.length).toBeLessThan(view.inDeck);
    expect(view.boost).toBeNull();
    expect(view.facedown).toBe(0);
  });

  test("gives nothing of the deck's order away", () => {
    const shuffled = { ...seat(state), deck: [...seat(state).deck].reverse() };
    const again = { ...state, players: [shuffled, ...state.players.slice(1)] };
    expect(viewOf(again, "hero").rows).toEqual(viewOf(state, "hero").rows);
  });

  test("a card facedown in play as a Drone stays unseen with its owner's deck", () => {
    const [top, ...rest] = seat(state).deck;
    const instance = state.instances[top as string]!;
    const drone = {
      ...state,
      players: [{ ...seat(state), deck: rest }, ...state.players.slice(1)],
      instances: {
        ...state.instances,
        [top as string]: { ...instance, facedownAs: { kind: "minion" as const, traits: [] } },
      },
    };
    const view = viewOf(drone, "hero");
    expect(view.inDeck).toBe(rest.length);
    expect(view.facedown).toBe(1);
    expect(view.rows).toEqual(viewOf(state, "hero").rows);
    expect(view.summary[0]).toBe(`${rest.length + 1} unseen: ${rest.length} in deck, 1 facedown`);
  });

  test("a card tucked facedown from the deck stays unseen with it (Operation Zero Tolerance)", () => {
    const [top, ...rest] = seat(state).deck;
    const hostId = state.villains[0]!.instanceId as string;
    const tucked = {
      ...state,
      players: [{ ...seat(state), deck: rest }, ...state.players.slice(1)],
      instances: { ...state.instances, [hostId]: { ...state.instances[hostId]!, tucked: [top!] } },
    };
    const view = viewOf(tucked, "hero");
    expect(view.inDeck).toBe(rest.length);
    expect(view.facedown).toBe(1);
    expect(view.rows).toEqual(viewOf(state, "hero").rows);

    const instance = tucked.instances[top as string]!;
    const faceup = { ...tucked, instances: { ...tucked.instances, [top as string]: { ...instance, faceup: true } } };
    expect(viewOf(faceup, "hero").facedown).toBe(0);
  });

  test("a reshuffled deck counts what it now holds", () => {
    const player = seat(state);
    const drawn = { ...player, deck: player.deck.slice(30), discard: player.deck.slice(0, 30) };
    const emptied = { ...state, players: [drawn, ...state.players.slice(1)] };
    expect(total(emptied, "hero")).toBe(player.deck.length - 30);
    const reshuffled = { ...drawn, deck: [...player.deck], discard: [] };
    expect(viewOf({ ...state, players: [reshuffled, ...state.players.slice(1)] }, "hero").rows).toEqual(
      viewOf(state, "hero").rows,
    );
  });
});

describe("the encounter deck", () => {
  test("lists its cards by type, then name", () => {
    const { rows } = viewOf(state, "encounter");
    const deck = activeEncounterDeck(state).deck;
    expect(total(state, "encounter")).toBe(deck.length);
    const types = rows.map(
      (row) =>
        cardOf(
          state,
          deck.find((id) => cardOf(state, id)?.id === row.key)!,
        )!.type,
    );
    const lastMinion = types.lastIndexOf("minion");
    expect(types.slice(0, lastMinion + 1).every((type) => type === "minion")).toBe(true);
    const minions = rows.slice(0, lastMinion + 1).map((row) => row.name);
    expect(minions).toEqual([...minions].sort((a, b) => a.localeCompare(b)));
  });

  test("a card dealt facedown cannot be told by elimination: it stays in the list and the boost", () => {
    const dealt = dealTop(state);
    const before = viewOf(state, "encounter");
    const after = viewOf(dealt, "encounter");
    expect(after.inDeck).toBe(before.inDeck - 1);
    expect(after.facedown).toBe(1);
    expect(after.rows).toEqual(before.rows);
    expect(after.boost).toEqual(before.boost);
    expect(after.summary[0]).toBe(`${before.inDeck} unseen: ${after.inDeck} in deck, 1 facedown`);
  });

  test("a facedown boost card on an enemy does too; turned faceup, it leaves the list", () => {
    const [top, ...rest] = activeEncounterDeck(state).deck;
    const villainId = state.villains[0]!.instanceId as string;
    const given = withEncounterDeck(state, rest);
    const boosted = {
      ...given,
      instances: { ...given.instances, [villainId]: { ...given.instances[villainId]!, boostCards: [top!] } },
    };
    const facedown = viewOf(boosted, "encounter");
    expect(facedown.facedown).toBe(1);
    expect(facedown.rows).toEqual(viewOf(state, "encounter").rows);

    const instance = boosted.instances[top as string]!;
    const flipped = { ...boosted, instances: { ...boosted.instances, [top as string]: { ...instance, faceup: true } } };
    expect(viewOf(flipped, "encounter").facedown).toBe(0);
    expect(total(flipped, "encounter")).toBe(rest.length);
  });

  test("a facedown card of another villain's deck is not this deck's", () => {
    const dealt = dealTop(state);
    const id = seat(dealt).dealtEncounter[0] as string;
    const home = { kind: "encounterDeck" as const, deckId: "elsewhere" as never };
    const other = { ...dealt, instances: { ...dealt.instances, [id]: { ...dealt.instances[id]!, home } } };
    expect(viewOf(other, "encounter").facedown).toBe(0);
  });

  test("an encounter card tucked facedown is not listed: it came from the set-aside area", () => {
    const [top, ...rest] = activeEncounterDeck(state).deck;
    const hostId = state.villains[0]!.instanceId as string;
    const given = withEncounterDeck(state, rest);
    const tucked = {
      ...given,
      instances: { ...given.instances, [hostId]: { ...given.instances[hostId]!, tucked: [top!] } },
    };
    expect(viewOf(tucked, "encounter").facedown).toBe(0);
    expect(total(tucked, "encounter")).toBe(rest.length);
  });

  test("a set-aside card is not listed", () => {
    const [top, ...rest] = activeEncounterDeck(state).deck;
    const aside = { ...withEncounterDeck(state, rest), encounterSetAside: [...state.encounterSetAside, top!] };
    expect(viewOf(aside, "encounter").facedown).toBe(0);
    expect(total(aside, "encounter")).toBe(rest.length);
  });

  test("the boost line averages icons over the cards left and keeps stars apart", () => {
    const { boost } = viewOf(state, "encounter");
    const deck = activeEncounterDeck(state).deck;
    const printed = deck.reduce((sum, id) => {
      const card = cardOf(state, id);
      return sum + (card && "boostIcons" in card ? card.boostIcons : 0);
    }, 0);
    expect(boost).toMatchObject({ icons: printed, cards: deck.length });
    expect(boost!.average).toBeCloseTo(printed / deck.length);
    const starred = deck.filter((id) => (cardOf(state, id) as { starIcon?: boolean }).starIcon === true);
    expect(boost!.stars).toBe(starred.length);
  });

  test("the boost line's words", () => {
    const tally = { icons: 31, cards: 22, average: 31 / 22, stars: 0, hidden: 0 };
    expect(boostSummaryOf(tally)).toBe("Boost: 1.4 icons per card (31 icons in 22 cards)");
    expect(boostSummaryOf({ ...tally, stars: 3 })).toBe("Boost: 1.4 icons per card (31 icons in 22 cards), plus 3 ★");
    expect(boostSummaryOf({ icons: 0, cards: 0, average: 0, stars: 0, hidden: 0 })).toBe("Boost: no cards left");
  });

  test("the boost line alone: no rows, and only the line above them", () => {
    const view = viewOf(state, "encounter", { list: false, boost: true });
    expect(view.rows).toEqual([]);
    expect(view.summary).toHaveLength(1);
    expect(view.summary[0]).toMatch(/^Boost:/);
  });

  test("the list alone: no boost line", () => {
    const view = viewOf(state, "encounter", { list: true, boost: false });
    expect(view.boost).toBeNull();
    expect(view.summary.join(" ")).not.toContain("Boost");
  });

  test("blind: an unrevealed modular set is counted, never named, and left out of the boost line", () => {
    const named = viewOf(state, "encounter");
    const minion = activeEncounterDeck(state)
      .deck.map((id) => cardOf(state, id)!)
      .find((card) => card.type === "minion")!;
    const setId = (minion as { encounterSetIds: readonly string[] }).encounterSetIds[0]!;
    const reveal: BlindReveal = {
      stage2Reached: false,
      stage2Id: null,
      modularSetIds: [setId],
      revealedSetIds: new Set(),
    };
    const blind = viewOf(state, "encounter", LIST, reveal);
    const hidden = blind.rows.find((row) => row.key === "hidden")!;
    expect(hidden).toMatchObject({ name: "Hidden cards", face: null });
    expect(blind.rows.map((row) => row.name)).not.toContain(minion.name);
    expect(blind.rows.reduce((sum, row) => sum + row.count, 0)).toBe(named.inDeck);
    expect(blind.boost!.hidden).toBe(hidden.count);
    expect(blind.boost!.cards).toBe(named.inDeck - hidden.count);
    expect(boostSummaryOf(blind.boost!)).toContain("not counted");

    const shown = viewOf(state, "encounter", LIST, { ...reveal, revealedSetIds: new Set([setId]) });
    expect(shown.rows).toEqual(named.rows);
  });

  test("blind: a card of a hidden set dealt facedown has not turned it up; faceup, it has", () => {
    const setsOf = (id: InstanceId) => (cardOf(state, id) as { encounterSetIds: readonly string[] }).encounterSetIds;
    const deck = activeEncounterDeck(state).deck;
    const top = deck.find((id) => setsOf(id).some((set) => !revealedSetsIn(state, [set]).has(set)))!;
    const setId = setsOf(top).find((set) => !revealedSetsIn(state, [set]).has(set))!;
    const dealt = dealTop(withEncounterDeck(state, [top, ...deck.filter((id) => id !== top)]));
    expect(revealedSetsIn(dealt, [setId]).has(setId)).toBe(false);
    const instance = dealt.instances[top as string]!;
    const flipped = { ...dealt, instances: { ...dealt.instances, [top as string]: { ...instance, faceup: true } } };
    expect(revealedSetsIn(flipped, [setId]).has(setId)).toBe(true);

    const rest = deck.filter((id) => id !== top);
    const villainId = state.villains[0]!.instanceId as string;
    const boosted = {
      ...withEncounterDeck(state, rest),
      instances: { ...state.instances, [villainId]: { ...state.instances[villainId]!, boostCards: [top] } },
    };
    expect(revealedSetsIn(boosted, [setId]).has(setId)).toBe(false);
  });

  test("Shadow Labyrinth: the cards of the villain waiting facedown are counted, never named, until it is in play", () => {
    const config = wave11Scenario("shadow-labyrinth", {
      difficulty: "standard",
      players: [playableStarterDeckSetup("core-spider-man-justice")],
      seed: 5,
    });
    const created = createGame(config, POOL_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const game = created.state;
    const villain = game.chosenVillainId as InstanceId;

    const view = viewOf(game, "encounter");
    const names = (rows: typeof view.rows) => rows.map((row) => row.name);
    const hidden = view.rows.find((row) => row.key === "hidden")!;
    expect(hidden.count).toBe(5);
    expect(view.boost!.hidden).toBe(5);
    expect(view.rows.reduce((sum, row) => sum + row.count, 0)).toBe(view.inDeck);

    const turned = {
      ...game,
      encounterSetAside: game.encounterSetAside.filter((id) => id !== villain),
      instances: { ...game.instances, [villain as string]: { ...game.instances[villain as string]!, faceup: true } },
    };
    const open = viewOf(turned, "encounter");
    expect(open.rows.some((row) => row.key === "hidden")).toBe(false);
    expect(names(open.rows).length).toBeGreaterThan(names(view.rows).length);
  });
});

describe("deckLeftTabsOf", () => {
  const settings = { deckCountsHero: false, deckCountsEncounter: false, deckBoostAverage: false };
  test("each setting opens its own tab; none opens nothing", () => {
    expect(deckLeftTabsOf(settings)).toEqual([]);
    expect(deckLeftTabsOf({ ...settings, deckCountsHero: true })).toEqual(["hero"]);
    expect(deckLeftTabsOf({ ...settings, deckCountsEncounter: true })).toEqual(["encounter"]);
    expect(deckLeftTabsOf({ ...settings, deckBoostAverage: true })).toEqual(["encounter"]);
    expect(deckLeftTabsOf({ deckCountsHero: true, deckCountsEncounter: true, deckBoostAverage: true })).toEqual([
      "hero",
      "encounter",
    ]);
  });
});
