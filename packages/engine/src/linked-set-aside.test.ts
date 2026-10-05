/**
 * docs/phase7-wave7.md §3.75: RRG 1.8 "Linked (Card Title)" (p. 27): "Cards with the linked keyword cannot be included
 * in any deck. Instead, they are set aside at the start of the game if any deck includes the card that brings the
 * linked cards into play (indicated in the parentheses following the keyword)."
 *
 * - "The number of linked cards set aside during setup is equal to the number of those cards included in the product
 *   from which the linked card came" (`quantityInSet`), and "if multiple decks contain the same card named on one or
 *   more linked cards, set aside the appropriate number of cards for each deck that contains the named card": one set
 *   per deck, whatever number of copies of the naming card that deck runs.
 * - `createGame` finds them by scanning the caller's card pool for the keyword, creates them with no owner in the shared
 *   set-aside area (`GameState.encounterSetAside`, where a campaign's ownerless player cards already wait) and logs
 *   `linkedCardsSetAside` per deck. A pool without them sets nothing aside and is not an error.
 * - "When a player takes control of a card with the linked keyword, that player becomes the owner of that card": the
 *   existing `putIntoPlay` writes the owner (`ownershipChanged`), so it is discarded to that player's discard pile
 *   (RRG 1.8 "Ownership and Control", p. 31).
 * - "Set-aside cards are out of play and have no interaction with the game until they are referenced" (RRG 1.8 "Set
 *   Aside", p. 39). Appendix II (p. 51) names no step for linked cards; they are set aside before any deck is shuffled.
 *
 * Synthetic cards only; the engine never names a card.
 */
import { trait, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { validateDeck } from "./deck.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  HERO,
  MAIN_SCHEME,
  RESOURCE,
  TREACHERY,
  VILLAIN,
  defaultPick,
  seatIdentities,
} from "./testing/scenario.js";
import { copiesOf, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const DRILL = trait("Drill");
const scoped = { kind: "scoped" } as const;
const DRILL_UPGRADE: TargetQuery = { categories: ["upgrade"], trait: DRILL };

/**
 * "Each player who does not control a [Drill] upgrade chooses 1 set-aside [Drill] upgrade and puts it into play under
 * their control", in player order: the composition a card's When Defeated needs, from primitives that already exist.
 */
const EACH_PLAYER_TAKES: readonly EffectSpec[] = [
  {
    kind: "forEachPlayer",
    players: { kind: "each" },
    effects: [
      {
        kind: "if",
        condition: { kind: "not", of: { kind: "exists", query: { ...DRILL_UPGRADE, controlledBy: scoped } } },
        then: [
          {
            kind: "chooseCards",
            slot: "taken",
            from: { kind: "encounterSetAside", filter: DRILL_UPGRADE },
            chooser: scoped,
            min: 1,
            max: 1,
          },
          { kind: "putIntoPlay", card: { kind: "slot", slot: "taken" }, controller: scoped },
        ],
      },
    ],
  },
];
const TAKE = stubAbility("course.take", { trigger: { kind: "action" }, effects: EACH_PLAYER_TAKES });
/** "Action: Discard each [Drill] upgrade you control." */
const DROP = stubAbility("course.drop", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "moveCards",
      cards: {
        kind: "ref",
        ref: { kind: "each", query: { ...DRILL_UPGRADE, controlledBy: { kind: "controller" } } },
      },
      to: "discard",
    },
  ],
});
const deps: EngineDeps = depsOf(TAKE, DROP);

/** The card the linked cards name: any card in a deck with that title. */
const COURSE = stubSupport({ id: "course", cost: 0, abilities: [TAKE.ref, DROP.ref] });
const linkedTo = (title: string) => [{ name: "linked", cardTitle: title }] as const;
const DRILL_A = stubUpgrade({ id: "drill-a", cost: 2, traits: [DRILL], keywords: linkedTo(COURSE.name) });
/** Its product holds two copies. */
const DRILL_B = {
  ...stubUpgrade({ id: "drill-b", cost: 2, traits: [DRILL], keywords: linkedTo(COURSE.name) }),
  quantityInSet: 2,
};
/** Linked to a title no deck here holds. */
const ELSEWHERE = stubUpgrade({ id: "elsewhere", cost: 2, traits: [DRILL], keywords: linkedTo("another title") });
/** A [Drill] upgrade of a player's own deck, not linked. */
const OWN_DRILL = stubUpgrade({ id: "own-drill", cost: 0, traits: [DRILL] });
const UNIQUE_DRILL = {
  ...stubUpgrade({ id: "unique-drill", cost: 2, traits: [DRILL], keywords: linkedTo(COURSE.name) }),
  unique: true,
};

const LINKED: readonly AnyCard[] = [DRILL_A, DRILL_B, ELSEWHERE];
const WITH_COURSE: readonly CardId[] = [...DEFAULT_DECK, COURSE.id, COURSE.id, OWN_DRILL.id];
const WITHOUT: readonly CardId[] = [...DEFAULT_DECK, OWN_DRILL.id];

function create(decks: readonly (readonly CardId[])[], linked: readonly AnyCard[] = LINKED, seed = 11) {
  const identities = seatIdentities(HERO, decks.length);
  const result = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, ...identities.slice(1), COURSE, OWN_DRILL, ...linked],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copiesOf(TREACHERY.id, 30),
      includeIdentitySets: false,
      players: identities.map((identity, seat) => ({ identityCardId: identity.id, deck: decks[seat]! })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}
/** Past setup, at the first player's first turn. */
const started = (decks: readonly (readonly CardId[])[], linked?: readonly AnyCard[]): GameState =>
  driveSession(startSession(create(decks, linked).state), deps).session.state;

const linkedEvents = (events: readonly GameEvent[]) => events.filter((e) => e.type === "linkedCardsSetAside");
const cardIdsOf = (state: GameState, ids: readonly InstanceId[]) => ids.map((id) => mustInstance(state, id).cardId);
const drillsControlledBy = (state: GameState, player: PlayerId) =>
  mustPlayer(state, player).playArea.filter((id) => mustInstance(state, id).cardId !== COURSE.id);

/** `player` uses an ability of the Course they control. */
const use = (state: GameState, ability: typeof TAKE, player: PlayerId = P1): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: mustPlayer(state, player).playArea.find((id) => mustInstance(state, id).cardId === COURSE.id)!,
  abilityId: ability.ref.id,
  payment: [],
});
/** Answers each choice with the first set-aside copy of the next card listed, then the default. */
const picking = (...cards: readonly CardId[]) => {
  const queue = [...cards];
  return (state: GameState): readonly string[] => {
    const wanted = queue.shift();
    const option = state.pendingChoice?.options.find(
      (o) =>
        state.instances[o.optionId]?.cardId === wanted && state.encounterSetAside.includes(o.optionId as InstanceId),
    );
    return option ? [option.optionId] : defaultPick(state);
  };
};

describe("§3.75 linked cards are set aside at setup", () => {
  it("a deck holding the named card sets its linked cards aside: ownerless, in no deck, hand or discard pile", () => {
    for (const seed of [1, 2, 3, 4]) {
      const { state, events } = create([WITH_COURSE], LINKED, seed);
      const kept = driveSession(startSession(state), deps).session.state;
      // One set however many copies of the naming card the deck runs; `quantityInSet` copies of each; pool order.
      const [a, b1, b2] = kept.encounterSetAside as [InstanceId, InstanceId, InstanceId];
      expect(cardIdsOf(kept, kept.encounterSetAside)).toEqual([DRILL_A.id, DRILL_B.id, DRILL_B.id]);
      expect(linkedEvents(events)).toEqual([
        {
          type: "linkedCardsSetAside",
          forPlayer: P1,
          cardIds: [DRILL_A.id, DRILL_B.id, DRILL_B.id],
          instanceIds: [a, b1, b2],
        },
      ]);
      const player = mustPlayer(kept, P1);
      for (const id of [a, b1, b2]) {
        expect(mustInstance(kept, id)).toMatchObject({ ownerId: null, controllerId: null, faceup: true });
        for (const zone of [player.deck, player.hand, player.discard, player.playArea, player.setAside])
          expect(zone).not.toContain(id);
      }
      // The deck is exactly the cards listed: the linked cards add nothing to it.
      expect(player.deck.length + player.hand.length).toBe(WITH_COURSE.length);
      // Right after gameCreated, before any deck is shuffled.
      const at = events.findIndex((e) => e.type === "linkedCardsSetAside");
      expect(events[at - 1]?.type).toBe("gameCreated");
      const firstShuffle = events.findIndex((e) => e.type === "deckShuffled");
      if (firstShuffle >= 0) expect(at).toBeLessThan(firstShuffle);
    }
  });

  it("a deck without the named card sets nothing aside and logs nothing", () => {
    const { state, events } = create([WITHOUT]);
    expect(state.encounterSetAside).toEqual([]);
    expect(linkedEvents(events)).toEqual([]);
    expect(Object.values(state.instances).some((i) => i.cardId === DRILL_A.id)).toBe(false);
  });

  it("two decks holding the named card: one set for each deck, in one shared ownerless area (p. 27)", () => {
    const { state, events } = create([WITH_COURSE, WITH_COURSE]);
    expect(cardIdsOf(state, state.encounterSetAside)).toEqual([
      DRILL_A.id,
      DRILL_B.id,
      DRILL_B.id,
      DRILL_A.id,
      DRILL_B.id,
      DRILL_B.id,
    ]);
    expect(linkedEvents(events)).toEqual([
      expect.objectContaining({ forPlayer: P1, instanceIds: state.encounterSetAside.slice(0, 3) }),
      expect.objectContaining({ forPlayer: P2, instanceIds: state.encounterSetAside.slice(3) }),
    ]);
    expect(state.encounterSetAside.every((id) => mustInstance(state, id).ownerId === null)).toBe(true);
  });

  it("only the deck that holds it gets a set: the other player's deck sets nothing aside", () => {
    const { state, events } = create([WITHOUT, WITH_COURSE]);
    expect(cardIdsOf(state, state.encounterSetAside)).toEqual([DRILL_A.id, DRILL_B.id, DRILL_B.id]);
    expect(linkedEvents(events)).toEqual([expect.objectContaining({ forPlayer: P2 })]);
  });

  it("a pool without the linked cards: setup proceeds, nothing set aside, no error", () => {
    const { state, events } = create([WITH_COURSE], []);
    expect(state.encounterSetAside).toEqual([]);
    expect(linkedEvents(events)).toEqual([]);
  });

  it("the linked cards never shift another instance's id: every other card is the same with or without them", () => {
    const withLinked = create([WITH_COURSE]).state;
    const without = create([WITH_COURSE], []).state;
    for (const [id, instance] of Object.entries(without.instances)) expect(withLinked.instances[id]).toEqual(instance);
    expect(mustPlayer(withLinked, P1).deck).toEqual(mustPlayer(without, P1).deck);
  });

  it("deck legality: the naming card needs no linked card in the deck, and a linked card in a deck is refused", () => {
    const pool = [...DEFAULT_CARDS, COURSE, OWN_DRILL, ...LINKED];
    const problems = (cards: readonly { cardId: CardId; quantity: number }[]) => {
      const verdict = validateDeck({ identityCardId: HERO.id, aspects: [], cards }, pool);
      return verdict.ok ? [] : verdict.problems.map((p) => p.code);
    };
    const base = [
      { cardId: RESOURCE.id, quantity: 39 },
      { cardId: COURSE.id, quantity: 1 },
    ];
    expect(problems(base)).not.toContain("linked_card");
    expect(problems(base)).not.toContain("deck_size");
    expect(problems([...base, { cardId: DRILL_A.id, quantity: 1 }])).toContain("linked_card");
  });
});

describe("§3.75 taking a set-aside linked card", () => {
  /** Two players, both decks naming the cards, P1's Course in play. */
  const table = (linked: readonly AnyCard[] = LINKED) =>
    playerCardIntoPlay(started([WITH_COURSE, WITH_COURSE], linked), COURSE.id, P1).state;

  it("each player without one chooses in player order; the taker controls and owns it; the pool shrinks", () => {
    const state = table();
    expect(state.encounterSetAside).toHaveLength(6);
    const asked: PlayerId[] = [];
    const pick = picking(DRILL_B.id, DRILL_A.id);
    const { session, events } = driveSession(startSession(state), deps, [use(state, TAKE)], (s) => {
      asked.push(s.pendingChoice!.playerId);
      return pick(s);
    });
    const after = session.state;
    expect(asked).toEqual([P1, P2]);
    const [mine] = drillsControlledBy(after, P1) as [InstanceId];
    const [theirs] = drillsControlledBy(after, P2) as [InstanceId];
    expect(mustInstance(after, mine)).toMatchObject({ cardId: DRILL_B.id, ownerId: P1, controllerId: P1 });
    expect(mustInstance(after, theirs)).toMatchObject({ cardId: DRILL_A.id, ownerId: P2, controllerId: P2 });
    expect(events.filter((e) => e.type === "ownershipChanged")).toEqual([
      { type: "ownershipChanged", instanceId: mine, playerId: P1 },
      { type: "ownershipChanged", instanceId: theirs, playerId: P2 },
    ]);
    // P1 took the first deck's first copy of B, P2 the first deck's A: the rest wait, in order.
    expect(cardIdsOf(after, after.encounterSetAside)).toEqual([DRILL_B.id, DRILL_A.id, DRILL_B.id, DRILL_B.id]);
    expect(after.encounterSetAside.every((id) => mustInstance(after, id).ownerId === null)).toBe(true);

    // Everyone controls one now: nobody is asked, nothing moves.
    const again = driveSession(startSession(after), deps, [use(after, TAKE)], (s) => {
      throw new Error(`unexpected choice for ${s.pendingChoice?.playerId}`);
    });
    expect(again.session.state.encounterSetAside).toEqual(after.encounterSetAside);

    // It is its taker's card: discarded, it goes to their discard pile (RRG 1.8 "Ownership and Control", p. 31).
    const dropped = driveSession(startSession(after), deps, [use(after, DROP)]).session.state;
    expect(mustPlayer(dropped, P1).discard).toContain(mine);
    expect(dropped.encounterSetAside).toEqual(after.encounterSetAside);
    expect(mustInstance(dropped, mine).ownerId).toBe(P1);
  });

  it("a player who already controls one of the trait is skipped; only the other chooses", () => {
    const state = playerCardIntoPlay(table(), OWN_DRILL.id, P2).state;
    const asked: PlayerId[] = [];
    const { session } = driveSession(startSession(state), deps, [use(state, TAKE)], (s) => {
      asked.push(s.pendingChoice!.playerId);
      return defaultPick(s);
    });
    expect(asked).toEqual([P1]);
    expect(cardIdsOf(session.state, drillsControlledBy(session.state, P1))).toEqual([DRILL_A.id]);
    expect(cardIdsOf(session.state, drillsControlledBy(session.state, P2))).toEqual([OWN_DRILL.id]);
    expect(session.state.encounterSetAside).toHaveLength(5);
  });

  it("with nothing set aside, a player without one gets nothing", () => {
    const state = playerCardIntoPlay(started([WITH_COURSE], []), COURSE.id, P1).state;
    const { session } = driveSession(startSession(state), deps, [use(state, TAKE)]);
    expect(drillsControlledBy(session.state, P1)).toEqual([]);
    expect(session.state.pendingChoice).toBeNull();
  });

  it("a second copy of a unique linked card cannot enter play: no effect, it stays set aside with no owner", () => {
    const state = table([UNIQUE_DRILL]);
    const [first, second] = state.encounterSetAside as [InstanceId, InstanceId];
    const { session, events } = driveSession(startSession(state), deps, [use(state, TAKE)]);
    const after = session.state;
    expect(drillsControlledBy(after, P1)).toEqual([first]);
    expect(drillsControlledBy(after, P2)).toEqual([]);
    // RRG 1.8 "Unique" (p. 46): a player card that matches a card in play "cannot be played or put into play".
    expect(events.filter((e) => e.type === "uniqueEntryBlocked")).toEqual([
      expect.objectContaining({ instanceId: second, matchedInstanceId: first, disposition: "noEffect" }),
    ]);
    expect(after.encounterSetAside).toEqual([second]);
    expect(mustInstance(after, second).ownerId).toBeNull();
    expect(Object.values(after.encounterDecks).flatMap((piles) => piles.discard)).not.toContain(second);
  });

  it("serialization round trip and replay: the set-aside pool and a taken card survive both", () => {
    const { state } = create([WITH_COURSE, WITH_COURSE]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    const { session } = driveSession(startSession(state), deps);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);

    const taken = driveSession(startSession(table()), deps, [use(table(), TAKE)]).session;
    expect(JSON.parse(JSON.stringify(taken.state))).toEqual(taken.state);
    const retaken = replay(taken.log, deps);
    if (!retaken.ok) throw new Error(retaken.error.message);
    expect(retaken.state).toEqual(taken.state);
  });

  it("a game with no linked card in its pool is unchanged", () => {
    const result = createGame({
      seed: 3,
      cards: DEFAULT_CARDS,
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: [],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(linkedEvents(result.events)).toEqual([]);
    expect(result.state.encounterSetAside).toEqual([]);
  });

  it.todo(
    "an owned linked card another player takes control of changes owner (p. 27): no effect moves a player's own upgrade to another player yet",
  );
  it.todo(
    "a set-aside copy whose title is already in play is not offered: needs a 'can enter play' filter on the choice (scripting, 43021 with two decks)",
  );
});
