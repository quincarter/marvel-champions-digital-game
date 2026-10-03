/**
 * docs/phase7-wave6.md §3.10's plan, with no `staysInHand` rule anywhere: an encounter card drawn from a player's deck
 * stays in the hand when it has its own hand-active (`activeIn: "hand"`) interrupt or response to itself entering the
 * hand, and that ability resolves. Misled (`rogue` 38027, Rogue's nemesis set, shuffled into a player's deck):
 * "Forced Response: After this card enters your hand, place 2 threat on the main scheme." MC32 p. 7 (Mystique's
 * treacheries, the same shape): "If one of these treachery cards subsequently enters your hand, trigger its Forced
 * Response at that time … Each treachery in your hand remains until you discard it". Every other encounter card drawn
 * keeps the wave 5 §4.1 Q4 fallback (dealt facedown, draw 1). Synthetic cards.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const toYou = {
  kind: "dealDamage",
  target: { kind: "identityOf", player: { kind: "controller" } },
  amount: { kind: "const", value: 1 },
} as const;

/** Misled-like: "Forced Response: After this card enters your hand, [you take 1 damage]." Nothing else. */
const MISLED_ENTERS = stubAbility("misled.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersHand", selfIs: "target" } },
  activeIn: "hand",
  effects: [toYou],
} satisfies AbilityDefinition);
const MISLED = stubTreachery({ id: "misled", boostIcons: 0, abilities: [MISLED_ENTERS.ref] });
/** Near miss: a hand-active response to *any* card entering the hand, not to this card. */
const WATCHER_ENTERS = stubAbility("watcher.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersHand" } },
  activeIn: "hand",
  effects: [toYou],
} satisfies AbilityDefinition);
const WATCHER = stubTreachery({ id: "watcher", boostIcons: 0, abilities: [WATCHER_ENTERS.ref] });
/** Near miss: a response to entering the hand that works in play, not in the hand. */
const INPLAY_ENTERS = stubAbility("inplay.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersHand", selfIs: "target" } },
  effects: [toYou],
} satisfies AbilityDefinition);
const INPLAY = stubTreachery({ id: "inplay", boostIcons: 0, abilities: [INPLAY_ENTERS.ref] });
/** A plain treachery: the Q4 fallback. */
const PLAIN = stubTreachery({ id: "plain", boostIcons: 0 });

const DRAW_ABILITY = stubAbility("draw-one.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
});
const DRAW_ONE = stubEvent({ id: "draw-one", cost: 0, abilities: [DRAW_ABILITY.ref] });

const deps: EngineDeps = depsOf(MISLED_ENTERS, WATCHER_ENTERS, INPLAY_ENTERS, DRAW_ABILITY);
type StubCard = typeof MISLED;

function start(): GameState {
  return gameAtFirstTurn({
    cards: [MISLED, WATCHER, INPLAY, PLAIN, DRAW_ONE],
    deps,
    encounter: [MISLED.id, WATCHER.id, INPLAY.id, PLAIN.id, ...copiesOf(PLAIN.id, 20)],
    deck: copiesOf(DRAW_ONE.id, 12),
  });
}

/** Test surgery: one copy of `card` from the encounter deck on top of P1's deck, facedown and unowned. */
function onTopOfDeck(state: GameState, card: StubCard): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((i) => mustInstance(state, i).cardId === card.id)!;
  const seat = mustPlayer(state, P1);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [id, ...seat.deck] } : p)),
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: false } },
    },
  };
}

const dealtIds = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "cardMoved" && e.to.kind === "dealtEncounter" ? [e.instanceId] : []));
const drawnIds = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "cardDrawn" ? [e.instanceId] : []));
const resolvedOn = (events: readonly GameEvent[], id: InstanceId) =>
  events
    .filter((e) => e.type === "abilityResolved" && e.instanceId === id)
    .map((e) => (e as { abilityId: string }).abilityId);
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;

describe("§3.10: an encounter card with its own 'after this card enters your hand' stays in the hand", () => {
  it("drawn, it stays in the hand, is not dealt, nothing replaces it, and its forced response resolves", () => {
    const run = playAndDraw(MISLED);
    expect(locateCard(run.session.state, run.id)?.kind).toBe("hand");
    expect(dealtIds(run.events)).not.toContain(run.id);
    expect(drawnIds(run.events)).toEqual([run.id]);
    expect(resolvedOn(run.events, run.id)).toEqual([MISLED_ENTERS.ref.id]);
    expect(identityDamage(run.session.state)).toBe(run.damageBefore + 1);
  });

  it("near miss: a hand-active response to any card entering the hand (not 'this card') takes the Q4 fallback", () => {
    const run = playAndDraw(WATCHER);
    expect(dealtIds(run.events)).toContain(run.id);
    expect(locateCard(run.session.state, run.id)?.kind).toBe("dealtEncounter");
    expect(drawnIds(run.events)).toHaveLength(2);
  });

  it("near miss: an 'enters your hand' response that is not active in the hand takes the Q4 fallback", () => {
    const run = playAndDraw(INPLAY);
    expect(dealtIds(run.events)).toContain(run.id);
    expect(resolvedOn(run.events, run.id)).toEqual([]);
  });

  it("a plain treachery takes the Q4 fallback: dealt facedown, and a replacement draw", () => {
    const run = playAndDraw(PLAIN);
    expect(dealtIds(run.events)).toContain(run.id);
    expect(drawnIds(run.events)).toHaveLength(2);
  });

  it("replays deep-equal", () => {
    const run = playAndDraw(MISLED);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});

/** Plays "draw 1 card" through a session from the state with `card` on top of P1's deck. */
function playAndDraw(card: StubCard) {
  const seeded = onTopOfDeck(start(), card);
  const damageBefore = identityDamage(seeded.state);
  const given = giveCard(seeded.state, P1, DRAW_ONE.id);
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    defaultPick,
  );
  return { id: seeded.id, damageBefore, session, events };
}
