/**
 * docs/phase7-wave7.md §3.74 (§4 Q44: A): an encounter set that is in the game exactly when a player chose an aspect.
 *
 * - Deadpool insert, "Using the 'Pool Aspect": "When setting up a game in which at least one player is using the 'Pool
 *   aspect, shuffle 1 copy of the Crisis of Infinite Deadpools (#37) treachery card into the encounter deck. Set the
 *   rest of the Dreadpool modular encounter set aside. This encounter set is shuffled into the encounter deck when
 *   Crisis of Infinite Deadpools is revealed."
 * - RRG 1.8 FAQ, Crisis of Infinite Deadpools (#37), p. 64: not included "if an ability allows a player to include one
 *   or more 'Pool aspect cards from outside of their chosen aspect in their deck"; it "is only included if at least
 *   one player in the game chooses the 'Pool aspect as (one of) their chosen aspect(s)". So the test is the declared
 *   choice (`PlayerSetup.aspects`, and a campaign seat's `aspects`), never the cards in a deck.
 * - RRG 1.8 Appendix II step 10 (p. 51) shuffles the encounter deck; the shuffled-in card is in it by then. "Set-aside
 *   cards are out of play and have no interaction with the game until they are referenced" (RRG 1.8 "Set Aside",
 *   p. 39).
 *
 * Synthetic cards only; the engine never names a card or a set.
 */
import { campaignId, encounterSetId, type AnyCard, type CardId, type CoreAspect } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { CampaignGameInput } from "./campaign.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard } from "./query.js";
import { createGame, type AutoIncludedSetSetup, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubMinion, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  HERO,
  MAIN_SCHEME,
  TREACHERY,
  VILLAIN,
  seatIdentities,
} from "./testing/scenario.js";
import { copiesOf, P1, P2 } from "./testing/wave3.js";

const SET = "dread";
const inSet = { inEncounterSet: SET } as const;

/**
 * "When Revealed: Reveal the set-aside [minion] and [side scheme]. Shuffle the rest of the set-aside [set] into the
 * encounter deck. Remove this card from the game.", from primitives that already exist.
 */
const HERALD_REVEALED = stubAbility("herald.revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "selectCards",
      slot: "named",
      cards: { kind: "encounterSetAside", filter: { ...inSet, categories: ["minion", "sideScheme"] } },
    },
    { kind: "revealCard", cards: { kind: "slot", slot: "named" }, player: { kind: "firstPlayer" } },
    { kind: "moveCards", cards: { kind: "encounterSetAside", filter: inSet }, to: "encounterDeckShuffle" },
    { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "removedFromGame" },
  ],
});
const deps: EngineDeps = depsOf(HERALD_REVEALED);

/** The one card shuffled in. */
const HERALD = stubTreachery({ id: "herald", encounterSetIds: [SET], abilities: [HERALD_REVEALED.ref] });
const BRUTE = stubMinion({ id: "brute", encounterSetIds: [SET], atk: 2, sch: 2, hp: 3 });
const PLOT = stubSideScheme({ id: "plot", encounterSetIds: [SET], startingThreat: 2 });
const RAY = { ...stubAttachment({ id: "ray" }), encounterSetIds: [encounterSetId(SET)] };
/** Its product holds two copies. */
const HEX = { ...stubTreachery({ id: "hex", encounterSetIds: [SET] }), quantityInSet: 2 };
const TWIST = stubTreachery({ id: "twist", encounterSetIds: [SET] });
/** A card of some other set. */
const OUTSIDER = stubTreachery({ id: "outsider", encounterSetIds: ["elsewhere"] });
const SET_CARDS: readonly AnyCard[] = [HERALD, BRUTE, PLOT, RAY, HEX, TWIST, OUTSIDER];

/** Seven cards, one entry per copy: one shuffled in, six set aside. */
const DREAD: AutoIncludedSetSetup = {
  encounterSetId: SET,
  when: { kind: "aspectChosen", aspect: "pool" },
  shuffledIn: [HERALD.id],
  cardIds: [HERALD.id, BRUTE.id, PLOT.id, RAY.id, HEX.id, HEX.id, TWIST.id],
};
const REMAINDER: readonly CardId[] = [BRUTE.id, PLOT.id, RAY.id, HEX.id, HEX.id, TWIST.id];
const FILLER = 20;

type Seats = readonly (readonly CoreAspect[] | undefined)[];

function configOf(seats: Seats, overrides: Partial<GameSetupConfig> = {}): GameSetupConfig {
  const identities = seatIdentities(HERO, seats.length);
  return {
    seed: 7,
    cards: [...DEFAULT_CARDS, ...identities.slice(1), ...SET_CARDS],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: copiesOf(TREACHERY.id, FILLER),
    includeIdentitySets: false,
    players: identities.map((identity, seat) => {
      const aspects = seats[seat];
      return { identityCardId: identity.id, deck: DEFAULT_DECK, ...(aspects ? { aspects } : {}) };
    }),
    autoIncludedSets: [DREAD],
    ...overrides,
  };
}

function create(seats: Seats, overrides: Partial<GameSetupConfig> = {}) {
  const result = createGame(configOf(seats, overrides), deps);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}
const errorOf = (seats: Seats, overrides: Partial<GameSetupConfig>): string => {
  const result = createGame(configOf(seats, overrides), deps);
  return result.ok ? "ok" : result.error.message;
};

const included = (events: readonly GameEvent[]) => events.filter((e) => e.type === "encounterSetAutoIncluded");
const cardIdsOf = (state: GameState, ids: readonly InstanceId[]) => ids.map((id) => state.instances[id]?.cardId);
const deckCards = (state: GameState) => cardIdsOf(state, state.encounterDecks["e1"]?.deck ?? []);
const countOf = (cards: readonly (CardId | undefined)[], id: CardId) => cards.filter((card) => card === id).length;
/** Every instance of a card of the set, wherever it is. */
const setInstances = (state: GameState) =>
  Object.values(state.instances).filter((instance) => DREAD.cardIds.includes(instance.cardId));

describe("§3.74 an encounter set included when a player chose an aspect", () => {
  it("a seat that declared the aspect: one card shuffled into the encounter deck, the other six set aside", () => {
    for (const seed of [1, 2, 3, 4]) {
      const { state, events } = create([["pool"]], { seed });
      const deck = deckCards(state);
      expect(deck).toHaveLength(FILLER + 1);
      expect(countOf(deck, HERALD.id)).toBe(1);
      expect(cardIdsOf(state, state.encounterSetAside)).toEqual(REMAINDER);
      expect(setInstances(state)).toHaveLength(7);
      const [entry] = included(events);
      expect(included(events)).toHaveLength(1);
      expect(entry).toEqual({
        type: "encounterSetAutoIncluded",
        setId: SET,
        because: { kind: "aspectChosen", aspect: "pool", playerIds: [P1] },
        deckId: "e1",
        shuffledIn: [state.encounterDecks["e1"]?.deck.find((id) => state.instances[id]?.cardId === HERALD.id)],
        setAside: state.encounterSetAside,
      });
    }
  });

  it("the set-aside cards are ownerless encounter cards, facedown and out of play, and no set-aside modular set", () => {
    const { state } = create([["pool"]]);
    for (const id of state.encounterSetAside) {
      const instance = state.instances[id];
      expect(instance?.ownerId).toBeNull();
      expect(instance?.controllerId).toBeNull();
      expect(instance?.home).toEqual({ kind: "encounterDeck", deckId: "e1" });
    }
    expect(state.villainArea).toEqual([]);
    // A random "set-aside modular set" pick or count never sees it.
    expect(state.setAsideModularSets).toBeUndefined();
  });

  it("the shuffled-in card is in the deck before the setup shuffle, so its position follows the seed", () => {
    const positions = [1, 2, 3, 4, 5, 6].map((seed) =>
      deckCards(create([["pool"]], { seed }).state).indexOf(HERALD.id),
    );
    expect(positions.every((at) => at >= 0)).toBe(true);
    expect(new Set(positions).size).toBeGreaterThan(1);
    expect(deckCards(create([["pool"]], { seed: 3 }).state)).toEqual(deckCards(create([["pool"]], { seed: 3 }).state));
  });

  it("no seat declared the aspect: none of the set's cards exist, nothing is logged, and the game is unchanged", () => {
    const without = create([["justice"]]);
    expect(setInstances(without.state)).toEqual([]);
    expect(deckCards(without.state)).toHaveLength(FILLER);
    expect(without.state.encounterSetAside).toEqual([]);
    expect(included(without.events)).toEqual([]);
    // Byte for byte the game a config without the field sets up.
    const { autoIncludedSets: _dropped, ...plain } = configOf([["justice"]]);
    const baseline = createGame(plain, deps);
    expect(baseline.ok && baseline.state).toEqual(without.state);
    expect(baseline.ok && baseline.events).toEqual(without.events);
  });

  it("the declared choice decides, never the deck: a seat with no `aspects` has chosen none", () => {
    // RRG 1.8 FAQ p. 64: cards of the aspect in a deck that did not choose it do not include the set.
    const { state, events } = create([undefined]);
    expect(setInstances(state)).toEqual([]);
    expect(included(events)).toEqual([]);
    expect(create([[]]).state.encounterSetAside).toEqual([]);
  });

  it("`aspects` is read without requireLegalDecks, and one of two chosen aspects is enough", () => {
    const config = configOf([["aggression", "pool"]]);
    expect(config.requireLegalDecks).toBeUndefined();
    const { state, events } = create([["aggression", "pool"]]);
    expect(countOf(deckCards(state), HERALD.id)).toBe(1);
    expect(state.encounterSetAside).toHaveLength(6);
    expect(included(events)).toHaveLength(1);
  });

  it("two seats declared it: still one copy shuffled in and one set of six aside; the log names both seats", () => {
    const { state, events } = create([["pool"], ["pool"]]);
    expect(countOf(deckCards(state), HERALD.id)).toBe(1);
    expect(deckCards(state)).toHaveLength(FILLER + 1);
    expect(cardIdsOf(state, state.encounterSetAside)).toEqual(REMAINDER);
    expect(setInstances(state)).toHaveLength(7);
    const [entry] = included(events);
    expect(entry?.type === "encounterSetAutoIncluded" && entry.because.playerIds).toEqual([P1, P2]);
  });

  it("only the second seat declared it: included, and the log names that seat alone", () => {
    const { state, events } = create([["protection"], ["pool"]]);
    expect(state.encounterSetAside).toHaveLength(6);
    const [entry] = included(events);
    expect(entry?.type === "encounterSetAutoIncluded" && entry.because.playerIds).toEqual([P2]);
  });

  it("a campaign seat's declared aspects count as well", () => {
    const identities = seatIdentities(HERO, 1);
    const campaign: CampaignGameInput = {
      campaignId: campaignId("auto-included-test"),
      nodeId: "one",
      definitionVersion: "1",
      modes: { campaign: { campaignId: campaignId("auto-included-test") } },
      log: { shared: {}, perSeat: [{ seatNumber: 1, fields: {} }] },
      instructions: [],
      removedFromCampaign: [],
      seats: [
        { seatNumber: 1, identityCardId: identities[0]!.id, deck: DEFAULT_DECK, aspects: ["pool"], grantedCardIds: [] },
      ],
      seed: 5,
    };
    const { state, events } = create([undefined], { campaign });
    expect(countOf(deckCards(state), HERALD.id)).toBe(1);
    expect(cardIdsOf(state, state.encounterSetAside)).toEqual(REMAINDER);
    expect(included(events)).toHaveLength(1);
    // The same campaign game with no 'Pool seat has no such set.
    const plain = create([undefined], { campaign: { ...campaign, seats: [{ ...campaign.seats[0]!, aspects: [] }] } });
    expect(setInstances(plain.state)).toEqual([]);
  });

  it("with several villains the shuffled-in card joins the first villain's deck and the rest are homed to it", () => {
    const second = { ...VILLAIN, id: "villain-two" as CardId, name: "villain-two" };
    const { state, events } = create([["pool"]], {
      cards: [...DEFAULT_CARDS, second, ...SET_CARDS],
      encounterDeck: [],
      villains: [
        { villainCardId: VILLAIN.id, encounterDeck: copiesOf(TREACHERY.id, 5) },
        { villainCardId: second.id, encounterDeck: copiesOf(TREACHERY.id, 5) },
      ],
    });
    expect(countOf(deckCards(state), HERALD.id)).toBe(1);
    expect(deckCards(state)).toHaveLength(6);
    expect(state.encounterDecks["e2"]?.deck).toHaveLength(5);
    expect(state.encounterSetAside.map((id) => state.instances[id]?.home)).toEqual(
      copiesOf("x" as CardId, 6).map(() => ({ kind: "encounterDeck", deckId: "e1" })),
    );
    const [entry] = included(events);
    expect(entry?.type === "encounterSetAutoIncluded" && entry.deckId).toBe("e1");
  });

  it("a stacked setup can put the shuffled-in card on top, and the game replays from its baseline", () => {
    const { state } = create([["pool"]], { stack: { encounter: [HERALD.id] } });
    expect(deckCards(state)[0]).toBe(HERALD.id);
    const { session } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("refuses a malformed list whether or not the condition holds", () => {
    for (const seats of [[["pool"]], [["justice"]]] as const) {
      expect(errorOf(seats, { autoIncludedSets: [DREAD, DREAD] })).toBe("auto-included set dread is listed twice");
      expect(errorOf(seats, { autoIncludedSets: [{ ...DREAD, cardIds: [...DREAD.cardIds, OUTSIDER.id] }] })).toBe(
        "outsider is not a card of the auto-included set dread",
      );
      expect(errorOf(seats, { autoIncludedSets: [{ ...DREAD, cardIds: [...DREAD.cardIds, "nope" as CardId] }] })).toBe(
        "nope is not a card of the auto-included set dread",
      );
      expect(errorOf(seats, { autoIncludedSets: [{ ...DREAD, shuffledIn: [] }] })).toBe(
        "auto-included set dread shuffles no card in",
      );
      // Two copies asked for, one held.
      expect(errorOf(seats, { autoIncludedSets: [{ ...DREAD, shuffledIn: [HERALD.id, HERALD.id] }] })).toBe(
        "auto-included set dread shuffles in herald, which the set does not hold (that many times)",
      );
    }
  });

  it("shuffling in both copies of a two-copy card leaves neither aside", () => {
    const { state } = create([["pool"]], { autoIncludedSets: [{ ...DREAD, shuffledIn: [HERALD.id, HEX.id, HEX.id] }] });
    const deck = deckCards(state);
    expect(deck).toHaveLength(FILLER + 3);
    expect(countOf(deck, HEX.id)).toBe(2);
    expect(cardIdsOf(state, state.encounterSetAside)).toEqual([BRUTE.id, PLOT.id, RAY.id, TWIST.id]);
  });
});

describe("§3.74 the shuffled-in card's When Revealed composes from existing primitives", () => {
  /**
   * The first villain phase: the villain's boost card comes off the top of the deck (a filler treachery), so the
   * herald, stacked second, is the encounter card dealt to and revealed by the player.
   */
  function revealed() {
    const { state } = create([["pool"]], { stack: { encounter: [TREACHERY.id, HERALD.id] } });
    const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]);
    return { state: session.state, events };
  }
  const instancesOf = (state: GameState, id: CardId) =>
    Object.values(state.instances).filter((instance) => instance.cardId === id);

  it("reveals the set-aside minion and side scheme, shuffles the other four in, and removes itself from the game", () => {
    const { state } = revealed();
    expect(state.encounterSetAside).toEqual([]);
    // The minion engages the player it was revealed to; the side scheme enters play with its 2 starting threat.
    const [brute] = instancesOf(state, BRUTE.id);
    expect(brute && locateCard(state, brute.instanceId)).toEqual({ kind: "playArea", playerId: P1 });
    expect(brute?.engagedWith).toBe(P1);
    const [plot] = instancesOf(state, PLOT.id);
    expect(plot && locateCard(state, plot.instanceId)).toEqual({ kind: "villainArea" });
    expect(plot?.threat).toBe(2);
    expect(cardIdsOf(state, state.removedFromGame)).toEqual([HERALD.id]);
    // Ray, both Hexes and Twist are encounter deck cards now.
    const rest = [RAY.id, HEX.id, HEX.id, TWIST.id];
    const deck = deckCards(state);
    expect(rest.map((id) => countOf(deck, id))).toEqual([1, 2, 2, 1]);
    // 20 fillers and the herald, less the boost card and the herald, plus the four.
    expect(deck).toHaveLength(FILLER + 1 - 2 + 4);
  });

  it("the remainder is shuffled, not stacked: its place in the deck follows the seed", () => {
    const orders = [1, 2, 3, 4, 5, 6].map((seed) => {
      const { state } = create([["pool"]], { seed, stack: { encounter: [TREACHERY.id, HERALD.id] } });
      const after = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]).session.state;
      return deckCards(after).join(",");
    });
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("the herald never returns: it is in no deck or discard pile afterward", () => {
    const { state } = revealed();
    const piles = [...(state.encounterDecks["e1"]?.deck ?? []), ...(state.encounterDecks["e1"]?.discard ?? [])];
    expect(countOf(cardIdsOf(state, piles), HERALD.id)).toBe(0);
    expect(instancesOf(state, HERALD.id)).toHaveLength(1);
  });

  it("discarded as a boost card instead, the herald goes to the discard pile and the set stays aside", () => {
    // Stacked on top, it is the villain's boost card: never revealed, so its When Revealed does not resolve.
    const { state } = create([["pool"]], { stack: { encounter: [HERALD.id] } });
    const after = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]).session.state;
    expect(cardIdsOf(after, after.encounterDecks["e1"]?.discard ?? [])).toContain(HERALD.id);
    expect(cardIdsOf(after, after.encounterSetAside)).toEqual(REMAINDER);
    expect(after.removedFromGame).toEqual([]);
  });
});
