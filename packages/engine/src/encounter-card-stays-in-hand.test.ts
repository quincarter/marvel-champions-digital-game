/**
 * docs/phase7-wave6.md §3.10, §4.1 Q7: encounter treacheries that stay in a player's hand (`RuleSpec staysInHand`).
 * Synthetic cards shaped like Infiltration (`mut_gen` 32082: "Forced Response: After this card enters your hand, discard
 * an ally or support you control."). MC32 p. 7: "If one of these treachery cards subsequently enters your hand, trigger
 * its Forced Response at that time. Drawing a treachery card from your deck counts as drawing a card. Each treachery in
 * your hand remains until you discard it, which you may do any time you could discard a player card from your hand …
 * When you discard a treachery card from your hand or deck, it is placed in the encounter discard pile."
 *
 * Every other encounter card drawn keeps the wave 5 §4.1 Q4 fallback (dealt facedown, draw 1;
 * `encounter-card-drawn-fallback.test.ts`).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

/** Infiltration-like: its own hand-active rule, and a forced response to its own draw (1 damage to "you"). */
const INFIL_STAYS = stubAbility("infil.stays", {
  trigger: { kind: "constant", rules: [{ kind: "staysInHand", cards: {} }] },
  activeIn: "hand",
  effects: [],
} satisfies AbilityDefinition);
const INFIL_ENTERS = stubAbility("infil.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "encounterCardFromPlayerDeck", selfIs: "target", eventIs: { how: "draw" } },
  },
  activeIn: "hand",
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 1 },
    },
  ],
} satisfies AbilityDefinition);
const INFIL = stubTreachery({ id: "infil", boostIcons: 0, abilities: [INFIL_STAYS.ref, INFIL_ENTERS.ref] });
/** A plain treachery a scenario rule names (`scenarioRuleSpecs`). */
const NAMED = stubTreachery({ id: "named", boostIcons: 0 });
/** A plain treachery nothing names: the Q4 fallback. */
const PHANTOM = stubTreachery({ id: "phantom", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DRAW_ONE = event("draw-one", [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } },
]);
const MILL_ONE = event("mill-one", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: { kind: "controller" }, top: { kind: "const", value: 1 } },
    to: "discard",
  },
]);
const DISCARD_ONE = event("discard-one", [
  { kind: "discardFromHand", player: { kind: "controller" }, amount: { kind: "const", value: 1 } },
]);
const EVENTS = [DRAW_ONE, MILL_ONE, DISCARD_ONE];

const deps: EngineDeps = depsOf(INFIL_STAYS, INFIL_ENTERS, ...EVENTS.map((e) => e.ability));

function start(): GameState {
  return gameAtFirstTurn({
    cards: [INFIL, NAMED, PHANTOM, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...copiesOf(INFIL.id, 2), ...copiesOf(NAMED.id, 2), ...copiesOf(PHANTOM.id, 20)],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    scenarioRuleSpecs: [{ kind: "staysInHand", cards: { printedId: NAMED.id } }],
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
type StubCard = typeof INFIL;

const drawnIds = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "cardDrawn" ? [e.instanceId] : []));
const dealtIds = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "cardMoved" && e.to.kind === "dealtEncounter" ? [e.instanceId] : []));
const resolvedAbilities = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [{ abilityId: e.abilityId, instanceId: e.instanceId }] : []));
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;
const encounterDiscard = (state: GameState): readonly InstanceId[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.discard;
/** P1's hand size once `card` is handed to them and played, before the event does anything. */
const handBeforePlaying = (state: GameState, card: string): number =>
  mustPlayer(giveCard(state, P1, card).state, P1).hand.length - 1;

function expectReplays(session: GameSession): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

/** P1 draws a held Infiltration-like card: the state right after. */
function drawInfil() {
  const seeded = onTopOfDeck(start(), INFIL);
  const handBefore = handBeforePlaying(seeded.state, DRAW_ONE.card.id);
  const damageBefore = identityDamage(seeded.state);
  return { ...seeded, handBefore, damageBefore, played: playFree(seeded.state, deps, DRAW_ONE.card.id) };
}

describe("§3.10 an encounter card with staysInHand drawn from a player's deck", () => {
  it("stays in the hand, counts as the card drawn, with no deal and no replacement draw; its forced response fires", () => {
    const { id, handBefore, damageBefore, played } = drawInfil();
    const { state, session, events } = played;
    const seat = mustPlayer(state, P1);
    expect(locateCard(state, id)).toEqual({ kind: "hand", playerId: P1 });
    expect(seat.hand).toContain(id);
    expect(seat.hand.length).toBe(handBefore + 1);
    expect(seat.dealtEncounter).toEqual([]);
    expect(mustInstance(state, id)).toMatchObject({ ownerId: null, cardId: INFIL.id });
    // "Draw 1 card" drew exactly this card: the draw counts, and nothing replaced it.
    expect(drawnIds(events)).toEqual([id]);
    expect(dealtIds(events)).toEqual([]);
    // The forced response resolved once, from hand, as P1 ("you"), with no choice offered.
    expect(resolvedAbilities(events).filter((r) => r.abilityId === INFIL_ENTERS.ref.id)).toEqual([
      { abilityId: INFIL_ENTERS.ref.id, instanceId: id },
    ]);
    expect(
      events.some((e) => e.type === "abilityResolved" && e.abilityId === INFIL_ENTERS.ref.id && e.controllerId === P1),
    ).toBe(true);
    expect(identityDamage(state) - damageBefore).toBe(1);
    expect(state.pendingEncounterFromDeck).toBeUndefined();
    expectReplays(session);
  });

  it("a scenario rule naming a card keeps it in hand too (no response: it has none)", () => {
    const seeded = onTopOfDeck(start(), NAMED);
    const handBefore = handBeforePlaying(seeded.state, DRAW_ONE.card.id);
    const { state, events } = playFree(seeded.state, deps, DRAW_ONE.card.id);
    const seat = mustPlayer(state, P1);
    expect(locateCard(state, seeded.id)).toEqual({ kind: "hand", playerId: P1 });
    expect(seat.hand.length).toBe(handBefore + 1);
    expect(drawnIds(events)).toEqual([seeded.id]);
    expect(dealtIds(events)).toEqual([]);
  });

  it("one the rule does not name keeps the Q4 fallback: dealt facedown, and a card drawn in its place", () => {
    const seeded = onTopOfDeck(start(), PHANTOM);
    const [, next] = mustPlayer(seeded.state, P1).deck;
    const handBefore = handBeforePlaying(seeded.state, DRAW_ONE.card.id);
    const { state, session, events } = playFree(seeded.state, deps, DRAW_ONE.card.id);
    const seat = mustPlayer(state, P1);
    expect(seat.dealtEncounter).toEqual([seeded.id]);
    expect(mustInstance(state, seeded.id)).toMatchObject({ ownerId: null, faceup: false });
    expect(seat.hand).not.toContain(seeded.id);
    expect(drawnIds(events)).toEqual([seeded.id, next]);
    expect(dealtIds(events)).toEqual([seeded.id]);
    expect(seat.hand.length).toBe(handBefore + 1);
    expect(resolvedAbilities(events).filter((r) => r.abilityId === INFIL_ENTERS.ref.id)).toEqual([]);
    expectReplays(session);
  });

  it("discarded from the deck, it goes to the encounter discard pile: not dealt, nothing drawn, no response", () => {
    const seeded = onTopOfDeck(start(), INFIL);
    const handBefore = handBeforePlaying(seeded.state, MILL_ONE.card.id);
    const { state, events } = playFree(seeded.state, deps, MILL_ONE.card.id);
    const seat = mustPlayer(state, P1);
    expect(encounterDiscard(state)[0]).toBe(seeded.id);
    expect(seat.discard).not.toContain(seeded.id);
    expect(seat.dealtEncounter).toEqual([]);
    expect(drawnIds(events)).toEqual([]);
    expect(seat.hand.length).toBe(handBefore);
    expect(resolvedAbilities(events).filter((r) => r.abilityId === INFIL_ENTERS.ref.id)).toEqual([]);
  });
});

describe("§3.10 discarding it from hand", () => {
  /** Picks the held card whenever a discard from P1's hand offers it; otherwise the default. */
  const discarding =
    (id: InstanceId) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      const kind = choice?.prompt.kind;
      const offers = choice?.options.some((o) => o.optionId === id);
      if (offers && (kind === "discardDownToHandSize" || kind === "chooseTarget")) return [id];
      return defaultPick(state);
    };

  it("a 'discard a card from your hand' effect may pick it, and it goes to the encounter discard pile", () => {
    const { id, played } = drawInfil();
    const given = giveCard(played.state, P1, DISCARD_ONE.card.id);
    const handBefore = mustPlayer(given.state, P1).hand.length;
    const { session, events } = driveSession(
      startSession(given.state),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
      discarding(id),
    );
    const state = session.state;
    const seat = mustPlayer(state, P1);
    expect(locateCard(state, id)).toEqual({ kind: "encounterDiscard", deckId: activeEncounterDeckId(state) });
    expect(encounterDiscard(state)[0]).toBe(id);
    expect(mustInstance(state, id).faceup).toBe(true);
    expect(seat.discard).not.toContain(id);
    expect(seat.hand).not.toContain(id);
    // The event card played and the treachery discarded.
    expect(seat.hand.length).toBe(handBefore - 2);
    expect(events).toContainEqual({ type: "cardDiscardedFromHand", playerId: P1, instanceId: id });
    expectReplays(session);
  });

  it("the end-of-phase discard may pick it, and it goes to the encounter discard pile", () => {
    const { id, played } = drawInfil();
    const { session, events } = driveSession(
      startSession(played.state),
      deps,
      [{ type: "endTurn", playerId: P1 }],
      discarding(id),
    );
    const moved = events.filter((e) => e.type === "cardMoved" && e.instanceId === id);
    expect(moved).toEqual([
      {
        type: "cardMoved",
        instanceId: id,
        cardId: INFIL.id,
        from: { kind: "hand", playerId: P1 },
        to: { kind: "encounterDiscard", deckId: activeEncounterDeckId(played.state) },
      },
    ]);
    expect(events).toContainEqual({ type: "cardDiscardedFromHand", playerId: P1, instanceId: id });
    const seat = mustPlayer(session.state, P1);
    expect(seat.discard).not.toContain(id);
    expect(seat.hand).not.toContain(id);
    expectReplays(session);
  });
});
