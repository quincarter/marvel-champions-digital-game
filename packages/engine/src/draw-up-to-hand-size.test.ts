/**
 * Refilling to hand size draws one card at a time: RRG 1.8 "Hand Size" (p. 21), "a player draws cards one at a time,
 * checking after each card is drawn whether they are at their hand size"; FFG ruling August 14, 2025: "if you
 * draw Shapeshifter Surprise when drawing up to your hand size, you immediately resolve it before finishing drawing
 * cards." So an ability a drawn card's arrival triggers resolves before the next card is drawn: a card's "after this
 * enters your hand", and a drawn obligation's entering play. RRG 1.8 p. 21 supersedes MC27's "drawn simultaneously"
 * for a refill; MC27's separate instruction to deal the drawn encounter cards afterward (MC27 p. 21) still applies, as
 * it does not conflict with drawing one at a time, so Mysterio's encounter cards are dealt after the whole draw.
 */
import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, handSize, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubObligation, stubTreachery } from "./testing/fixtures.js";
import { RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;

/** A player card: "Forced Response: After this card enters your hand, draw 1 card." (Shapeshifter Surprise's timing). */
const ENTERS_HAND = stubAbility("surprise.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersHand", selfIs: "target" } },
  activeIn: "hand",
  effects: [{ kind: "draw", player: you, amount: { kind: "const", value: 1 } }],
} satisfies AbilityDefinition);
const SURPRISE = stubEvent({ id: "surprise", cost: 0, abilities: [ENTERS_HAND.ref] });

/** An obligation in a player deck: "Forced Response: After this card enters play, discard it." */
const ENTERS_PLAY = stubAbility("deck-obligation.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
} satisfies AbilityDefinition);
const OBLIGATION = stubObligation({ id: "deck-obligation", abilities: [ENTERS_PLAY.ref] });

/** An encounter card shuffled into a player deck that nothing replaces (Mysterio's cards; the engine's fallback deals it). */
const PHANTOM = stubTreachery({ id: "phantom", boostIcons: 0 });

/** "Draw up to your hand size." (Grand Strategy's shape). */
const DRAW_UP_ACTION = stubAbility("draw-up.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "drawUpTo", player: you, amount: { kind: "handSize", player: you } }],
} satisfies AbilityDefinition);
const DRAW_UP = stubEvent({ id: "draw-up", cost: 0, abilities: [DRAW_UP_ACTION.ref] });

/** "Forced Response: After this card enters your hand, draw up to your hand size.": a refill nested in a refill. */
const NESTS = stubAbility("nester.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersHand", selfIs: "target" } },
  activeIn: "hand",
  effects: [{ kind: "drawUpTo", player: you, amount: { kind: "handSize", player: you } }],
} satisfies AbilityDefinition);
const NESTER = stubEvent({ id: "nester", cost: 0, abilities: [NESTS.ref] });

const FILL: CardId = RESOURCE.id;
const deps: EngineDeps = depsOf(ENTERS_HAND, ENTERS_PLAY, DRAW_UP_ACTION, NESTS);

const start = (players: 1 | 2 = 1): GameState =>
  gameAtFirstTurn({
    cards: [SURPRISE, OBLIGATION, PHANTOM, DRAW_UP, NESTER],
    deps,
    players,
    encounter: copiesOf(PHANTOM.id, 20),
    deck: [DRAW_UP.id, NESTER.id, ...copiesOf(SURPRISE.id, 2), ...copiesOf(OBLIGATION.id, 2), ...copiesOf(FILL, 8)],
  });

/**
 * Test surgery: `player`'s hand is `hand` (empty by default) and their deck (top first) is these cards, taken from the cards they own, or,
 * for "phantom", from the encounter deck; every other card they own is set aside.
 */
function arrange(state: GameState, deck: readonly CardId[], player = P1, hand: readonly CardId[] = []) {
  const owner = mustPlayer(state, player);
  const spare = [...owner.hand, ...owner.deck, ...owner.discard];
  const encounterId = activeEncounterDeckId(state);
  const encounter = [...state.encounterDecks[encounterId]!.deck];
  const held = hand.map((card) => {
    const index = spare.findIndex((id) => mustInstance(state, id).cardId === card);
    if (index < 0) throw new Error(`no spare ${card}`);
    return spare.splice(index, 1)[0]!;
  });
  const ids = deck.map((card) => {
    const pile = card === PHANTOM.id ? encounter : spare;
    const index = pile.findIndex((id) => mustInstance(state, id).cardId === card);
    if (index < 0) throw new Error(`no spare ${card}`);
    return pile.splice(index, 1)[0]!;
  });
  return {
    deck: ids,
    hand: held,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [encounterId]: { ...state.encounterDecks[encounterId]!, deck: encounter },
      },
      instances: Object.fromEntries(
        Object.entries(state.instances).map(([id, i]) => [
          id,
          ids.includes(id as InstanceId) ? { ...i, faceup: false } : i,
        ]),
      ),
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, hand: held, deck: ids, discard: [], setAside: [...p.setAside, ...spare] } : p,
      ),
    } as GameState,
  };
}

const indexOf = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);
const drawnAt = (events: readonly GameEvent[], id: InstanceId): number =>
  indexOf(events, (e) => e.type === "cardDrawn" && e.instanceId === id);
const resolvedAt = (events: readonly GameEvent[], abilityId: string): number =>
  indexOf(events, (e) => e.type === "abilityResolved" && e.abilityId === abilityId);
const refills = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "handRefilled" ? [{ playerId: e.playerId, drawn: e.drawn }] : []));

describe("the end-of-phase refill draws one card at a time (RRG 1.8 p. 21; ruling Aug 14, 2025)", () => {
  it("a card's 'after this enters your hand' resolves before the next card is drawn; one handRefilled counts all", () => {
    const set = arrange(start(), [FILL, SURPRISE.id, FILL, FILL, FILL, FILL, FILL, FILL, FILL]);
    const { session, events } = driveSession(startSession(set.state), deps, [{ type: "endTurn", playerId: P1 }]);
    const resolved = resolvedAt(events, ENTERS_HAND.ref.id);
    expect(resolved).toBeGreaterThan(drawnAt(events, set.deck[1]!));
    // Its own "draw 1" is the 3rd card drawn; the refill then goes on from the 4th.
    expect(resolved).toBeLessThan(drawnAt(events, set.deck[3]!));
    const limit = handSize(session.state, P1, deps);
    expect(mustPlayer(session.state, P1).hand).toHaveLength(limit);
    expect(refills(events)).toEqual([{ playerId: P1, drawn: limit - 1 }]);
  });

  it("a drawn obligation's entering play resolves before the next card is drawn", () => {
    const set = arrange(start(), [FILL, OBLIGATION.id, FILL, FILL, FILL, FILL, FILL, FILL]);
    const { session, events } = driveSession(startSession(set.state), deps, [{ type: "endTurn", playerId: P1 }]);
    const resolved = resolvedAt(events, ENTERS_PLAY.ref.id);
    expect(resolved).toBeGreaterThan(drawnAt(events, set.deck[1]!));
    expect(resolved).toBeLessThan(drawnAt(events, set.deck[2]!));
    expect(mustPlayer(session.state, P1).hand).toHaveLength(handSize(session.state, P1, deps));
    expect(refills(events)).toEqual([{ playerId: P1, drawn: 7 }]);
  });

  it("an encounter card drawn earlier in the refill is dealt only after the whole draw (MC27 p. 21 FAQ)", () => {
    const set = arrange(start(), [PHANTOM.id, SURPRISE.id, FILL, FILL, FILL, FILL, FILL, FILL, FILL, FILL]);
    const { events } = driveSession(startSession(set.state), deps, [{ type: "endTurn", playerId: P1 }]);
    const phantom = set.deck[0]!;
    const dealt = indexOf(
      events,
      (e) => e.type === "cardMoved" && e.instanceId === phantom && e.to.kind === "dealtEncounter",
    );
    const refilled = indexOf(events, (e) => e.type === "handRefilled" && e.playerId === P1);
    expect(resolvedAt(events, ENTERS_HAND.ref.id)).toBeLessThan(refilled);
    expect(dealt).toBeGreaterThan(refilled);
  });

  it("a refill nested in the paused one (same player) deals only its own encounter cards when it finishes", () => {
    // The end-of-phase refill draws the phantom, then the nester, and pauses for its "draw up to your hand size",
    // which fills the hand. That inner refill finishing must not deal the outer refill's phantom: it is dealt after
    // the outer refill, as MC27 p. 21's "Afterward" asks.
    const set = arrange(start(), [PHANTOM.id, NESTER.id, FILL, FILL, FILL, FILL, FILL, FILL, FILL, FILL]);
    const { events } = driveSession(startSession(set.state), deps, [{ type: "endTurn", playerId: P1 }]);
    const phantom = set.deck[0]!;
    const dealt = indexOf(
      events,
      (e) => e.type === "cardMoved" && e.instanceId === phantom && e.to.kind === "dealtEncounter",
    );
    const refilled = indexOf(events, (e) => e.type === "handRefilled" && e.playerId === P1);
    expect(resolvedAt(events, NESTS.ref.id)).toBeLessThan(refilled);
    expect(dealt).toBeGreaterThan(refilled);
  });

  it("with two players, the first finishes refilling (its card's ability and all) before the second draws", () => {
    const one = arrange(start(2), [FILL, SURPRISE.id, FILL, FILL, FILL, FILL, FILL, FILL, FILL], P1);
    const two = arrange(one.state, [FILL, FILL, FILL, FILL, FILL, FILL, FILL], P2);
    const { events } = driveSession(startSession(two.state), deps, [
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    ]);
    const lastOfP1 = events.findLastIndex((e) => e.type === "cardDrawn" && e.playerId === P1);
    const firstOfP2 = indexOf(events, (e) => e.type === "cardDrawn" && e.playerId === P2);
    expect(resolvedAt(events, ENTERS_HAND.ref.id)).toBeLessThan(lastOfP1);
    expect(lastOfP1).toBeLessThan(firstOfP2);
    expect(refills(events).map((r) => r.playerId)).toEqual([P1, P2]);
  });

  it("a 'draw up to your hand size' effect pauses the same way and then finishes the refill", () => {
    const set = arrange(start(), [FILL, SURPRISE.id, FILL, FILL, FILL, FILL, FILL, FILL, FILL], P1, [DRAW_UP.id]);
    const { session, events } = driveSession(startSession(set.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: set.hand[0]!, payment: [], attachToInstanceId: null },
    ]);
    const resolved = resolvedAt(events, ENTERS_HAND.ref.id);
    expect(resolved).toBeGreaterThan(drawnAt(events, set.deck[1]!));
    expect(resolved).toBeLessThan(drawnAt(events, set.deck[3]!));
    expect(mustPlayer(session.state, P1).hand).toHaveLength(handSize(session.state, P1, deps));
  });
});
