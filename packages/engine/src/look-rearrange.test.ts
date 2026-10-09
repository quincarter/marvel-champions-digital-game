/**
 * `EffectSpec lookAt` with `rearrange` over dealt encounter cards and the top of the encounter deck
 * (docs/phase7-wave9.md §3.12). Synthetic event shaped like "look at each encounter card dealt to each player and the
 * top card of the encounter deck. You may swap any number of those cards."
 *
 * Sources: RRG 1.8 "Look, Looked-At" (p. 27): "only the player who is resolving the ability can look at those cards";
 * "'Swap'" (p. 42); "Deal, Deal an Encounter Card" (p. 15): a player reveals their facedown encounter cards in the
 * order they came to them.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard, withEncounterPiles } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";
import { faceVisible, lookedAtBy } from "./visibility.js";

const EVERY_DEALT_AND_THE_TOP: CardSelector = {
  kind: "anyOf",
  of: [
    { kind: "dealtEncounter", player: { kind: "each" } },
    { kind: "encounter", zones: ["deck"], top: { kind: "const", value: 1 } },
  ],
};
const LOOK_AND_SWAP: EffectSpec = {
  kind: "lookAt",
  cards: EVERY_DEALT_AND_THE_TOP,
  viewer: { kind: "controller" },
  rearrange: true,
  bind: "seen",
};
const INTEL_ABILITY = stubAbility("intel.event", { trigger: { kind: "action" }, effects: [LOOK_AND_SWAP] });
const INTEL = stubEvent({ id: "intel", cost: 0, abilities: [INTEL_ABILITY.ref] });

const names = ["x", "x2", "y", "z", "under"] as const;
const CARDS = names.map((id) => stubTreachery({ id, boostIcons: 0 }));
const deps: EngineDeps = depsOf(INTEL_ABILITY);

interface Table {
  readonly state: GameState;
  readonly id: Readonly<Record<(typeof names)[number], InstanceId>>;
}

/**
 * Two players in the first player's turn. `dealt` puts those cards facedown in front of each player, in order, as
 * cards dealt off the encounter deck; `deck` is the encounter deck, top first (test surgery).
 */
function table(dealt: { readonly p1: readonly string[]; readonly p2: readonly string[] }, deck: readonly string[]) {
  const base = gameAtFirstTurn({
    cards: [INTEL, ...CARDS],
    deps,
    players: 2,
    deck: [INTEL.id],
    encounter: names.map((name) => name as CardId),
  });
  const instanceOf = (name: string): InstanceId => {
    const found = activeEncounterDeck(base).deck.find((id) => mustInstance(base, id).cardId === name);
    if (!found) throw new Error(`no ${name} in the encounter deck`);
    return found;
  };
  const id = Object.fromEntries(names.map((name) => [name, instanceOf(name)])) as Table["id"];
  const queues: Readonly<Record<string, readonly InstanceId[]>> = {
    [P1]: dealt.p1.map(instanceOf),
    [P2]: dealt.p2.map(instanceOf),
  };
  const facedownDealt = [...queues[P1]!, ...queues[P2]!];
  const piled = withEncounterPiles(base, { deck: deck.map(instanceOf), discard: [] });
  const state: GameState = {
    ...piled,
    players: piled.players.map((p) => ({ ...p, dealtEncounter: queues[p.playerId] ?? [] })),
    instances: {
      ...piled.instances,
      ...Object.fromEntries(
        facedownDealt.map((dealtId) => [
          dealtId,
          { ...mustInstance(piled, dealtId), faceup: false, dealtFromEncounterDeck: true as const },
        ]),
      ),
    },
  };
  return { state, id } satisfies Table;
}

/** P1 plays the event; the game stops at whatever it asks. */
function look(t: Table): {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly intel: InstanceId;
} {
  const given = giveCard(t.state, P1, INTEL.id);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { state: result.state, events: result.events, intel: given.id };
}
const answer = (state: GameState, selected: readonly string[], playerId: PlayerId = P1) =>
  applyCommand(
    state,
    { type: "resolveChoice", playerId, choiceId: state.pendingChoice!.choiceId, selectedOptionIds: selected },
    deps,
  );
function arranged(state: GameState, selected: readonly string[]) {
  const result = answer(state, selected);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}
const queueOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).dealtEncounter;
const deckOf = (state: GameState) => activeEncounterDeck(state).deck;
const sees = (state: GameState, id: InstanceId, viewer: PlayerId) => faceVisible(state, id, { viewer, deps });

describe("lookAt with rearrange: every dealt encounter card and the top of the encounter deck", () => {
  it("asks the looking player for an arrangement of the cards over their positions", () => {
    const t = table({ p1: ["x"], p2: ["y"] }, ["z", "under"]);
    const { state, events } = look(t);
    const { x, y, z } = t.id;

    expect(events).toContainEqual({ type: "cardsLookedAt", playerId: P1, instanceIds: [x, y, z] });
    expect(state.pendingChoice).toMatchObject({
      playerId: P1,
      prompt: {
        kind: "rearrange",
        positions: [
          { zone: { kind: "dealtEncounter", playerId: P1 }, index: 0 },
          { zone: { kind: "dealtEncounter", playerId: P2 }, index: 0 },
          { zone: { kind: "encounterDeck", deckId: activeEncounterDeckId(state) }, index: 0 },
        ],
      },
      minSelections: 3,
      maxSelections: 3,
      ordered: true,
    });
    expect(state.pendingChoice!.options.map((o) => o.optionId)).toEqual([x, y, z]);
    // Looking moves nothing.
    expect([queueOf(state, P1), queueOf(state, P2), deckOf(state)]).toEqual([[x], [y], [z, t.id.under]]);
  });

  it("shows the faces to the looking player only: another player's view has none of the looked-at cards", () => {
    const t = table({ p1: ["x"], p2: ["y"] }, ["z", "under"]);
    const lookedAt = [t.id.x, t.id.y, t.id.z];
    for (const id of lookedAt) for (const viewer of [P1, P2]) expect(sees(t.state, id, viewer)).toBe(false);

    const { state } = look(t);
    expect(lookedAtBy(state, P1)).toEqual(lookedAt);
    expect(lookedAtBy(state, P2)).toEqual([]);
    for (const id of lookedAt) {
      expect(sees(state, id, P1)).toBe(true);
      // Not even the card facedown in front of P2 themself, nor the deck's top card.
      expect(sees(state, id, P2)).toBe(false);
      expect(mustInstance(state, id).faceup).toBe(false);
    }
    // Only what is looked at: the second card of the deck stays closed to the looking player too.
    expect(sees(state, t.id.under, P1)).toBe(false);

    const after = arranged(state, [t.id.z, t.id.x, t.id.y]).state;
    expect(lookedAtBy(after, P1)).toEqual([]);
    for (const id of lookedAt) for (const viewer of [P1, P2]) expect(sees(after, id, viewer)).toBe(false);
  });

  it("player 1 holds X, player 2 holds Y, Z is on top: after the choice 1 holds Z, 2 holds X, Y is on top", () => {
    const t = table({ p1: ["x"], p2: ["y"] }, ["z", "under"]);
    const { x, y, z, under } = t.id;
    const { state } = look(t);
    const result = arranged(state, [z, x, y]);
    const after = result.state;

    expect(queueOf(after, P1)).toEqual([z]);
    expect(queueOf(after, P2)).toEqual([x]);
    expect(deckOf(after)).toEqual([y, under]);
    expect([queueOf(after, P1).length, queueOf(after, P2).length, deckOf(after).length]).toEqual([1, 1, 2]);
    // Still facedown, nothing revealed, shuffled or discarded.
    for (const id of [x, y, z]) expect(mustInstance(after, id).faceup).toBe(false);
    expect(activeEncounterDeck(after).discard).toEqual([]);
    expect(result.events.filter((e) => e.type === "encounterCardRevealed" || e.type === "deckShuffled")).toEqual([]);
    // A card that came off the deck reveals as one dealt from it; the one put back on the deck is a deck card again.
    expect(mustInstance(after, z).dealtFromEncounterDeck).toBe(true);
    expect(mustInstance(after, x).dealtFromEncounterDeck).toBe(true);
    expect(mustInstance(after, y).dealtFromEncounterDeck).toBeUndefined();

    const logged = result.events.filter((e) => e.type === "cardsRearranged");
    expect(logged).toEqual([
      {
        type: "cardsRearranged",
        playerId: P1,
        positions: [
          { zone: { kind: "dealtEncounter", playerId: P1 }, index: 0 },
          { zone: { kind: "dealtEncounter", playerId: P2 }, index: 0 },
          { zone: { kind: "encounterDeck", deckId: activeEncounterDeckId(after) }, index: 0 },
        ],
        instanceIds: [z, x, y],
        moved: 3,
      },
    ]);
    expect(after.pendingChoice).toBeNull();
  });

  it("choosing no swap is allowed: nothing moves, and the event is still discarded", () => {
    const t = table({ p1: ["x"], p2: ["y"] }, ["z", "under"]);
    const { x, y, z, under } = t.id;
    const { state, intel } = look(t);
    const result = arranged(state, [x, y, z]);

    expect([queueOf(result.state, P1), queueOf(result.state, P2), deckOf(result.state)]).toEqual([
      [x],
      [y],
      [z, under],
    ]);
    expect(result.events.filter((e) => e.type === "cardMoved" && [x, y, z].includes(e.instanceId))).toEqual([]);
    expect(result.events.find((e) => e.type === "cardsRearranged")).toMatchObject({ moved: 0, instanceIds: [x, y, z] });
    expect(locateCard(result.state, intel)).toEqual({ kind: "discard", playerId: P1 });
  });

  it("keeps each queue's length and places: two cards in one queue, swapped with the others", () => {
    const t = table({ p1: ["x", "x2"], p2: ["y"] }, ["z", "under"]);
    const { x, x2, y, z, under } = t.id;
    const { state } = look(t);
    expect(state.pendingChoice!.options.map((o) => o.optionId)).toEqual([x, x2, y, z]);

    // P1's first card becomes Z and second Y; P2 gets X2; X goes on top of the deck.
    const after = arranged(state, [z, y, x2, x]).state;
    expect(queueOf(after, P1)).toEqual([z, y]);
    expect(queueOf(after, P2)).toEqual([x2]);
    expect(deckOf(after)).toEqual([x, under]);

    // Within one queue: only the order P1 will reveal in changes.
    const again = look(table({ p1: ["x", "x2"], p2: [] }, ["z", "under"]));
    const swapped = arranged(again.state, [x2, x, z]).state;
    expect(queueOf(swapped, P1)).toEqual([x2, x]);
    expect(deckOf(swapped)).toEqual([z, under]);
  });

  it("cards that are not looked at keep their places: three deck positions with a card between them", () => {
    // The deck is X, under, Y, Z and the look names X, Y and Z by title: positions 0, 2 and 3.
    const named = (name: string): CardSelector => ({ kind: "encounter", zones: ["deck"], filter: { name } });
    const gapped = stubAbility("gapped.event", {
      trigger: { kind: "action" },
      effects: [
        {
          kind: "lookAt",
          cards: { kind: "anyOf", of: [named("x"), named("y"), named("z")] },
          viewer: { kind: "controller" },
          rearrange: true,
        },
      ],
    });
    const card = stubEvent({ id: "gapped", cost: 0, abilities: [gapped.ref] });
    const gappedDeps = depsOf(gapped);
    const t = table({ p1: [], p2: [] }, ["x", "under", "y", "z"]);
    const { x, y, z, under } = t.id;
    const pooled: GameState = { ...t.state, cardPool: { ...t.state.cardPool, [card.id]: card } };
    const given = giveCard(pooled, P1, INTEL.id);
    const asGapped: GameState = {
      ...given.state,
      instances: { ...given.state.instances, [given.id]: { ...mustInstance(given.state, given.id), cardId: card.id } },
    };
    const played = applyCommand(
      asGapped,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      gappedDeps,
    );
    if (!played.ok) throw new Error(played.error.message);
    expect(played.state.pendingChoice!.prompt).toMatchObject({
      kind: "rearrange",
      positions: [{ index: 0 }, { index: 2 }, { index: 3 }],
    });

    const done = applyCommand(
      played.state,
      {
        type: "resolveChoice",
        playerId: P1,
        choiceId: played.state.pendingChoice!.choiceId,
        selectedOptionIds: [y, z, x],
      },
      gappedDeps,
    );
    if (!done.ok) throw new Error(done.error.message);
    expect(deckOf(done.state)).toEqual([y, under, z, x]);
    // No card changed zones, so the one log line is the arrangement.
    expect(done.events.filter((e) => e.type === "cardMoved" && [x, y, z].includes(e.instanceId))).toEqual([]);
    expect(done.events.find((e) => e.type === "cardsRearranged")).toMatchObject({ moved: 3, instanceIds: [y, z, x] });
  });

  it("refuses anything but every looked-at card once", () => {
    const t = table({ p1: ["x"], p2: ["y"] }, ["z", "under"]);
    const { x, y, z, under } = t.id;
    const { state } = look(t);

    expect(answer(state, [z])).toMatchObject({ ok: false, error: { code: "invalid_choice" } });
    expect(answer(state, [])).toMatchObject({ ok: false, error: { code: "invalid_choice" } });
    expect(answer(state, [z, z, x])).toMatchObject({ ok: false, error: { code: "invalid_choice" } });
    expect(answer(state, [z, x, under])).toMatchObject({ ok: false, error: { code: "invalid_choice" } });
    // And only the looking player answers.
    expect(answer(state, [z, x, y], P2)).toMatchObject({ ok: false, error: { code: "invalid_choice" } });
  });

  it("swapping the only card of the encounter deck does not empty it: no reset, no acceleration token", () => {
    const t = table({ p1: ["x"], p2: [] }, ["z"]);
    const { x, z } = t.id;
    const { state } = look(t);
    const tokens = state.mainScheme.accelerationTokens;

    const result = arranged(state, [z, x]);
    expect(queueOf(result.state, P1)).toEqual([z]);
    expect(deckOf(result.state)).toEqual([x]);
    expect(result.state.mainScheme.accelerationTokens).toBe(tokens);
    expect(result.events.filter((e) => e.type === "deckShuffled")).toEqual([]);
  });

  it("with one card to look at there is nothing to swap: the plain look", () => {
    const t = table({ p1: [], p2: [] }, ["z", "under"]);
    const { state } = look(t);

    expect(state.pendingChoice).toMatchObject({ prompt: { kind: "lookAt" }, minSelections: 0, maxSelections: 0 });
    expect(lookedAtBy(state, P1)).toEqual([t.id.z]);
    expect(lookedAtBy(state, P2)).toEqual([]);
    const done = arranged(state, []);
    expect(done.events.filter((e) => e.type === "cardsRearranged")).toEqual([]);
    expect(deckOf(done.state)).toEqual([t.id.z, t.id.under]);
  });

  it("a dealt card that is faceup (its reveal has begun) is not one of the cards looked at", () => {
    const t = table({ p1: ["x", "x2"], p2: ["y"] }, ["z", "under"]);
    const revealing: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.id.x]: { ...mustInstance(t.state, t.id.x), faceup: true } },
    };
    const { state } = look({ ...t, state: revealing });
    expect(state.pendingChoice!.options.map((o) => o.optionId)).toEqual([t.id.x2, t.id.y, t.id.z]);
  });

  it("replays to the same state", () => {
    const t = table({ p1: ["x"], p2: ["y"] }, ["z", "under"]);
    const given = giveCard(t.state, P1, INTEL.id);
    const play: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    const pick = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "rearrange" ? [t.id.z, t.id.x, t.id.y] : defaultPick(state);
    const { session } = driveSession(startSession(given.state), deps, [play], pick);
    expect(queueOf(session.state, P1)).toEqual([t.id.z]);

    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
