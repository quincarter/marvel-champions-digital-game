/**
 * `EffectSpec lookAt`: an informational look with no decision attached ("Look at the top card of any deck", Jessica
 * Drew). The viewer sees the cards through a `lookAt` prompt that allows no selections, nothing moves, and the look is
 * logged. Proven with synthetic cards.
 *
 * Sources: RRG 1.8 "Look, Looked-At" (p. 27), "Deck" (p. 15), "'Then'" (p. 44).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO, seatIdentities } from "./testing/scenario.js";
import { faceVisible } from "./visibility.js";

const p1 = playerId("p1");
const you = { kind: "controller" } as const;
const one = { kind: "const", value: 1 } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({
  id: "quiet",
  stages: [
    { hp: flat(30), atk: 0, sch: 0 },
    { hp: flat(30), atk: 0, sch: 0 },
  ],
});
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

/** "Look at the top card of the encounter deck." */
const PEEK_ENCOUNTER = actionEvent("peek-encounter", [
  { kind: "lookAt", cards: { kind: "encounter", zones: ["deck"], top: one }, viewer: you },
]);
/** "Look at the top 2 cards of your deck, then …": bound, with a gated follow-up to prove the "then" gate. */
const PEEK_OWN = actionEvent("peek-own", [
  {
    kind: "lookAt",
    cards: { kind: "zone", zone: "deck", player: you, top: { kind: "const", value: 2 } },
    viewer: you,
    bind: "seen",
  },
  {
    kind: "then",
    effects: [
      {
        kind: "addCounters",
        target: { kind: "identityOf", player: you },
        counterType: "looked",
        amount: { kind: "var", name: "seen.count" },
      },
    ],
  },
]);

const EVENTS = [PEEK_ENCOUNTER, PEEK_OWN];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const CARDS = [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, ...EVENTS.map((e) => e.card)];

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const config: GameSetupConfig = {
    seed: 5,
    cards: [...CARDS, ...identities],
    villainCardId: QUIET_VILLAIN.id,
    mainSchemeCardId: LONG_SCHEME.id,
    encounterDeck: Array.from({ length: 16 }, () => BLANK.id as CardId),
    includeIdentitySets: false,
    players: identities.map((identity) => ({
      identityCardId: identity.id,
      deck: [...DEFAULT_DECK, ...EVENTS.map((e) => e.card.id)],
    })),
  };
  const result = createGame(config, deps);
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

/** Moves the event to p1's hand; `play` plays it. */
const inHand = (state: GameState, card: { readonly id: CardId }) => giveCard(state, p1, card.id);

/** Plays the event and stops at whatever it asks (no auto-answering). */
function play(state: GameState, card: { readonly id: CardId }, given = inHand(state, card)) {
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

const acknowledge = (state: GameState, selected: readonly string[] = []) =>
  applyCommand(
    state,
    { type: "resolveChoice", playerId: p1, choiceId: state.pendingChoice!.choiceId, selectedOptionIds: selected },
    deps,
  );

describe("EffectSpec lookAt", () => {
  it("shows the top encounter card to the viewer through a zero-selection prompt, and moves nothing", () => {
    const given = inHand(game(), PEEK_ENCOUNTER.card);
    const deckBefore = activeEncounterDeck(given.state).deck;
    const top = deckBefore[0]!;
    expect(faceVisible(given.state, top)).toBe(false);

    const { state, events } = play(given.state, PEEK_ENCOUNTER.card, given);
    const choice = state.pendingChoice!;
    expect(choice.prompt).toEqual({ kind: "lookAt" });
    expect(choice.playerId).toBe(p1);
    expect(choice.minSelections).toBe(0);
    expect(choice.maxSelections).toBe(0);
    expect(choice.options.map((o) => o.optionId)).toEqual([top]);
    expect(events).toContainEqual({ type: "cardsLookedAt", playerId: p1, instanceIds: [top] });
    // RRG 1.8 "Look, Looked-At" (p. 27): the card is readable while it is looked at, and is still in the deck.
    expect(faceVisible(state, top)).toBe(true);
    expect(activeEncounterDeck(state).deck).toEqual(deckBefore);

    // Selecting the card is not an answer: the only legal answer is the empty acknowledge.
    expect(acknowledge(state, [top]).ok).toBe(false);
    const done = acknowledge(state);
    if (!done.ok) throw new Error(done.error.message);
    expect(done.state.pendingChoice).toBeNull();
    expect(activeEncounterDeck(done.state).deck).toEqual(deckBefore);
    expect(faceVisible(done.state, top)).toBe(false);
  });

  it("binds what was seen, in deck order, and a following 'then' resolves", () => {
    const given = inHand(game(), PEEK_OWN.card);
    const top2 = mustPlayer(given.state, p1).deck.slice(0, 2);
    const { state } = play(given.state, PEEK_OWN.card, given);
    expect(state.pendingChoice?.options.map((o) => o.optionId)).toEqual(top2);
    const done = acknowledge(state);
    if (!done.ok) throw new Error(done.error.message);
    const identity = mustPlayer(done.state, p1).identity.instanceId;
    expect(mustInstance(done.state, identity).counters.looked).toBe(2);
    expect(mustPlayer(done.state, p1).deck.slice(0, 2)).toEqual(top2);
  });

  it("an empty deck opens no prompt, and the look leaves the text before a 'then' unresolved", () => {
    const given = inHand(game(), PEEK_OWN.card);
    const emptied: GameState = {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === p1 ? { ...p, deck: [] as readonly InstanceId[] } : p)),
    };
    const { state, events } = play(emptied, PEEK_OWN.card, { state: emptied, id: given.id });
    expect(state.pendingChoice).toBeNull();
    expect(events.some((e) => e.type === "cardsLookedAt")).toBe(false);
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "lookFoundNothing" });
    expect(events.some((e) => e.type === "thenSkipped")).toBe(true);
  });
});
