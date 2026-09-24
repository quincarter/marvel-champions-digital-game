/**
 * An obligation drawn from a player deck goes straight into that player's play area (The Rise of Red Skull's expert
 * campaign obligations, 04163-04166, which have player-card backs).
 *
 * Sources: RRG 1.8 "Obligation" (p. 30): "If a player draws an obligation card from their player deck, they place that
 * obligation into their play area. The player does not draw a card to replace the obligation unless they are refilling
 * their hand to their hand size."; "Only the player with the obligation in their play area can trigger abilities or
 * pay costs on that obligation." MC10 p. 17, "Obligations in Player Decks": "they must immediately put that card into
 * play in their play area. They do not draw a card to replace that obligation. … only the player with the obligation
 * in their play area can use its Alter-Ego Action to deal with that card." RRG 1.8 Appendix II steps 14-15 (p. 51) for
 * the opening hand and the mulligan, both "draw up to" hand size (docs/campaign-mode-design.md, "Obligations drawn at
 * setup").
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { handSize, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubObligation } from "./testing/fixtures.js";
import { newGameAtMulligan, RESOURCE, settle } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const n = (value: number): ValueSpec => ({ kind: "const", value });
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects } satisfies AbilityDefinition);
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};

const DRAW_ONE = event("draw-one", [{ kind: "draw", player: you, amount: n(1) }]);
const DRAW_THREE = event("draw-three", [{ kind: "draw", player: you, amount: n(3) }]);
/** "Draw up to your hand size." (Grand Strategy's shape). */
const DRAW_UP = event("draw-up", [{ kind: "drawUpTo", player: you, amount: { kind: "handSize", player: you } }]);

/** An expert-campaign-style obligation: "Alter-Ego Action: discard this card." */
const OBLIGATION_ACTION = stubAbility("deck-obligation.action", {
  trigger: { kind: "action", form: "alterEgo" },
  effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
});
const OBLIGATION = stubObligation({ id: "deck-obligation", abilities: [OBLIGATION_ACTION.ref] });

const EVENTS = [DRAW_ONE, DRAW_THREE, DRAW_UP];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability), OBLIGATION_ACTION);
const FILL: CardId = RESOURCE.id;
const CARDS = [...EVENTS.map((e) => e.card), OBLIGATION];

const start = (players: 1 | 2 = 1): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    players,
    deck: [...EVENTS.flatMap((e) => [e.card.id, e.card.id]), ...copiesOf(OBLIGATION.id, 3), ...copiesOf(FILL, 8)],
  });

/**
 * Test surgery: `player`'s hand, deck (top first) and discard pile are exactly these cards, taken from the cards they
 * own; every other card is set aside.
 */
function arrange(
  state: GameState,
  piles: { hand: readonly CardId[]; deck: readonly CardId[]; discard?: readonly CardId[] },
  player: PlayerId = P1,
) {
  const owner = mustPlayer(state, player);
  const spare = [...owner.hand, ...owner.deck, ...owner.discard];
  const take = (wanted: readonly CardId[]): InstanceId[] =>
    wanted.map((card) => {
      const index = spare.findIndex((id) => mustInstance(state, id).cardId === card);
      if (index < 0) throw new Error(`${player} has no spare ${card}`);
      return spare.splice(index, 1)[0]!;
    });
  const hand = take(piles.hand);
  const deck = take(piles.deck);
  const discard = take(piles.discard ?? []);
  return {
    hand,
    deck,
    discard,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, hand, deck, discard, setAside: [...p.setAside, ...spare] } : p,
      ),
    },
  };
}

const playFirst = (arranged: { state: GameState; hand: readonly InstanceId[] }) =>
  driveSession(startSession(arranged.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: arranged.hand[0]!, payment: [], attachToInstanceId: null },
  ]);

const obligationsIn = (state: GameState, ids: readonly InstanceId[]): readonly InstanceId[] =>
  ids.filter((id) => mustInstance(state, id).cardId === OBLIGATION.id);
const placed = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "drawnObligationPlaced" ? [e.instanceId] : []));

describe("an obligation drawn from a player deck goes into that player's play area", () => {
  it("a draw of 1 that hits an obligation: play area, faceup, no replacement card", () => {
    const set = arrange(start(), { hand: [DRAW_ONE.card.id, FILL], deck: [OBLIGATION.id, FILL, FILL] });
    const [obligation] = set.deck as [InstanceId];
    const { session, events } = playFirst(set);
    const player = mustPlayer(session.state, P1);
    expect(player.playArea).toContain(obligation);
    expect(player.hand).toEqual([set.hand[1]]);
    expect(player.deck).toEqual(set.deck.slice(1));
    const instance = mustInstance(session.state, obligation);
    expect(instance.faceup).toBe(true);
    // Still an encounter card (MC10 p. 17): nobody controls it; its play area makes it P1's.
    expect(instance.controllerId).toBeNull();
    const trail = events.filter((e) => e.type === "cardDrawn" || e.type === "drawnObligationPlaced");
    expect(trail).toEqual([
      { type: "cardDrawn", playerId: P1, instanceId: obligation },
      { type: "drawnObligationPlaced", playerId: P1, instanceId: obligation },
    ]);
  });

  it("a draw of 3 that hits one obligation puts 2 cards in hand: the obligation counts as a card drawn", () => {
    const set = arrange(start(), { hand: [DRAW_THREE.card.id], deck: [FILL, OBLIGATION.id, FILL, FILL] });
    const { session, events } = playFirst(set);
    const player = mustPlayer(session.state, P1);
    expect(player.hand).toEqual([set.deck[0], set.deck[2]]);
    expect(player.playArea).toContain(set.deck[1]);
    expect(player.deck).toEqual([set.deck[3]]);
    expect(placed(events)).toEqual([set.deck[1]]);
  });

  it("the end-of-phase draw keeps drawing past an obligation until the hand is at hand size", () => {
    const set = arrange(start(), {
      hand: [FILL],
      deck: [FILL, FILL, OBLIGATION.id, FILL, FILL, FILL, FILL, FILL],
    });
    const limit = handSize(set.state, P1, deps);
    expect(limit).toBe(6);
    const { session, events } = driveSession(startSession(set.state), deps, [{ type: "endTurn", playerId: P1 }]);
    const player = mustPlayer(session.state, P1);
    expect(player.playArea).toContain(set.deck[2]);
    expect(placed(events)).toEqual([set.deck[2]]);
    // 1 held + 5 drawn to hand; the obligation was the 3rd of 6 cards drawn and did not count toward hand size.
    expect(player.hand).toHaveLength(limit);
    expect(player.hand).toEqual([set.hand[0], ...set.deck.filter((id) => id !== set.deck[2]).slice(0, 5)]);
  });

  it("a 'draw up to your hand size' effect refills past an obligation too", () => {
    const set = arrange(start(), {
      hand: [DRAW_UP.card.id],
      deck: [OBLIGATION.id, FILL, FILL, FILL, FILL, FILL, FILL, FILL],
    });
    const { session } = playFirst(set);
    const player = mustPlayer(session.state, P1);
    expect(player.playArea).toContain(set.deck[0]);
    expect(player.hand).toHaveLength(handSize(session.state, P1, deps));
    expect(obligationsIn(session.state, player.hand)).toEqual([]);
  });

  it("a deck emptied by drawing an obligation resets and the draw goes on from the new deck", () => {
    const set = arrange(start(), { hand: [DRAW_THREE.card.id], deck: [OBLIGATION.id], discard: [FILL, FILL, FILL] });
    const { session, events } = playFirst(set);
    const player = mustPlayer(session.state, P1);
    expect(player.playArea).toContain(set.deck[0]);
    expect(player.hand).toHaveLength(2);
    expect(player.dealtEncounter).toHaveLength(1);
    const trail = events
      .filter((e) => e.type === "cardDrawn" || e.type === "drawnObligationPlaced" || e.type === "playerDeckReset")
      .map((e) => e.type);
    expect(trail).toEqual(["cardDrawn", "drawnObligationPlaced", "playerDeckReset", "cardDrawn", "cardDrawn"]);
  });

  it("a refill stops when deck and discard are both empty, obligation or not", () => {
    const set = arrange(start(), { hand: [DRAW_UP.card.id], deck: [FILL, OBLIGATION.id] });
    const { session } = playFirst(set);
    const player = mustPlayer(session.state, P1);
    expect(player.playArea).toContain(set.deck[1]);
    expect(player.hand).toEqual([set.deck[0]]);
  });
});

describe("only the player with the obligation in their play area can use its Alter-Ego Action", () => {
  const drawnByP1 = () => {
    const set = arrange(start(2), { hand: [DRAW_ONE.card.id], deck: [OBLIGATION.id, FILL, FILL, FILL] });
    const { session } = playFirst(set);
    return { session, obligation: set.deck[0]! };
  };
  const use = (playerId: PlayerId, obligation: InstanceId) =>
    ({
      type: "useAbility",
      playerId,
      cardInstanceId: obligation,
      abilityId: OBLIGATION_ACTION.ref.id,
      payment: [],
    }) as const;

  it("P1, who drew it, can", () => {
    const { session, obligation } = drawnByP1();
    const used = driveSession(session, deps, [use(P1, obligation)]).session.state;
    expect(mustPlayer(used, P1).playArea).not.toContain(obligation);
    expect(mustPlayer(used, P1).discard).toContain(obligation);
  });

  it("P2, on their own turn and in alter-ego form, cannot", () => {
    const { session, obligation } = drawnByP1();
    const p2Turn = driveSession(session, deps, [{ type: "endTurn", playerId: P1 }]).session;
    expect(p2Turn.state.step).toMatchObject({ kind: "turn", activePlayerId: P2 });
    expect(mustPlayer(p2Turn.state, P2).identity.form).toBe("alterEgo");
    const result = sessionApply(p2Turn, use(P2, obligation), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/only the player with that obligation/);
    expect(mustPlayer(p2Turn.state, P1).playArea).toContain(obligation);
  });
});

describe("obligations drawn at setup (RRG 1.8 Appendix II steps 14-15)", () => {
  // Half the deck is obligations, so the opening draw (seeded) is certain to hit some.
  const setupDeck = [...copiesOf(FILL, 12), ...copiesOf(OBLIGATION.id, 12)];
  const atMulligan = () => newGameAtMulligan({ extraCards: [OBLIGATION], deck: setupDeck, deps, seed: 7 });

  it("the opening hand is drawn up to hand size; each obligation drawn is in play, not in hand", () => {
    const state = atMulligan();
    const player = mustPlayer(state, P1);
    expect(player.hand).toHaveLength(handSize(state, P1, deps));
    expect(obligationsIn(state, player.hand)).toEqual([]);
    expect(obligationsIn(state, player.playArea).length).toBeGreaterThan(0);
    for (const id of obligationsIn(state, player.playArea)) expect(mustInstance(state, id).faceup).toBe(true);
    expect(obligationsIn(state, [...player.deck, ...player.playArea])).toHaveLength(12);
  });

  it("a mulligan draws back up to hand size, placing any obligation it draws", () => {
    const state = atMulligan();
    const before = obligationsIn(state, mustPlayer(state, P1).playArea).length;
    // Mulligan the whole hand.
    const after = settle(state, (s) => s.pendingChoice?.options.map((o) => o.optionId) ?? [], deps);
    const player = mustPlayer(after, P1);
    expect(player.hand).toHaveLength(handSize(after, P1, deps));
    expect(obligationsIn(after, player.hand)).toEqual([]);
    expect(obligationsIn(after, player.playArea).length).toBeGreaterThan(before);
  });
});
