/**
 * docs/phase7-wave6-handoff.md §3.76: "the topmost [X] in the encounter discard pile" (`CardSelector encounter`'s
 * `topmostOnly`): Sentinel Mark VIII (`mut_gen` 32114), Master of Magnetism (32151), Zola's Experiments (`trors` 04124).
 * The first matching card from the top of the pile, no choice; nothing when none matches. The discard pile's array
 * runs newest-first (`moveCard` puts a discarded card on top), the deck's top-down.
 */

import { describe, expect, it } from "vitest";
import { replay } from "./engine.js";
import type { CardId } from "@mc/content";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, activeEncounterDeckId, mustInstance } from "./query.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const TARGET = stubTreachery({ id: "wanted" });
const found = { kind: "ref", ref: { kind: "slot", slot: "found" } } as const;
const topmost = (zone: "deck" | "discard"): CardSelector => ({
  kind: "encounter",
  zones: [zone],
  filter: { name: TARGET.name },
  topmostOnly: true,
});

/** "Set aside the topmost Wanted in the encounter `zone`" (after shuffling the encounter deck, if `shuffle`). */
function takeTopmost(zone: "deck" | "discard", shuffle = false): EffectSpec[] {
  return [
    ...(shuffle ? [{ kind: "shuffleEncounterDeck" } as const] : []),
    { kind: "selectCards", slot: "found", cards: topmost(zone) },
    { kind: "moveCards", cards: found, to: "encounterSetAside" },
  ];
}
const FROM_DISCARD = stubAbility("from-discard.action", {
  trigger: { kind: "action" },
  effects: takeTopmost("discard"),
});
const AFTER_SHUFFLE = stubAbility("after-shuffle.action", {
  trigger: { kind: "action" },
  effects: takeTopmost("deck", true),
});
const SHUFFLE_ONLY = stubAbility("shuffle-only.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "shuffleEncounterDeck" }],
});
const TAKE = stubEvent({ id: "take", cost: 0, abilities: [FROM_DISCARD.ref] });
const SHUFFLE_TAKE = stubEvent({ id: "shuffle-take", cost: 0, abilities: [AFTER_SHUFFLE.ref] });
const SHUFFLE = stubEvent({ id: "shuffle", cost: 0, abilities: [SHUFFLE_ONLY.ref] });
const deps = depsOf(FROM_DISCARD, AFTER_SHUFFLE, SHUFFLE_ONLY);

const isTarget = (state: GameState) => (id: InstanceId) => mustInstance(state, id).cardId === TARGET.id;

function start(copies: number): GameState {
  return gameAtFirstTurn({
    cards: [TARGET, TAKE, SHUFFLE_TAKE, SHUFFLE],
    deps,
    deck: [TAKE.id, TAKE.id, SHUFFLE_TAKE.id, SHUFFLE.id],
    encounter: [...copiesOf(TARGET.id, copies), ...copiesOf(TREACHERY.id, 12)],
  });
}

/** Test surgery before the session starts (so the replay reproduces it): the encounter discard pile becomes a blank
 * card, then each Wanted copy followed by a blank, top-down, so the topmost match is not the pile's top card. */
function discardInterleaved(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const deck = activeEncounterDeck(state).deck;
  const targets = deck.filter(isTarget(state));
  const blanks = deck.filter((id) => !isTarget(state)(id)).slice(0, targets.length + 1);
  const discard = [blanks[0]!, ...targets.flatMap((id, i) => [id, blanks[i + 1]!])];
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: deck.filter((id) => !discard.includes(id)), discard },
    },
  };
}

/** Plays `card` and checks the log replays to the same state. */
function play(state: GameState, card: CardId): GameState {
  const { session, state: after } = playFree(state, deps, card);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(after);
  return after;
}

describe("§3.76 encounterCards topmostOnly", () => {
  it("with three matching cards in the discard pile, takes only the topmost", () => {
    const before = discardInterleaved(start(3));
    const discard = activeEncounterDeck(before).discard;
    const matches = discard.filter(isTarget(before));
    expect(matches).toHaveLength(3);
    expect(discard[0]).not.toBe(matches[0]);
    const after = play(before, TAKE.id);
    expect(after.encounterSetAside).toEqual([matches[0]]);
    expect(activeEncounterDeck(after).discard).toEqual(discard.filter((id) => id !== matches[0]));
  });

  it("takes the next topmost on a second resolution", () => {
    const before = discardInterleaved(start(3));
    const matches = activeEncounterDeck(before).discard.filter(isTarget(before));
    const twice = play(play(before, TAKE.id), TAKE.id);
    expect([...twice.encounterSetAside].sort()).toEqual([matches[0], matches[1]].sort());
  });

  it("takes nothing (and does not error) when no card matches", () => {
    const before = discardInterleaved(start(0));
    expect(activeEncounterDeck(before).discard.filter(isTarget(before))).toEqual([]);
    const after = play(before, TAKE.id);
    expect(after.encounterSetAside).toEqual(before.encounterSetAside);
    expect(activeEncounterDeck(after).discard).toEqual(activeEncounterDeck(before).discard);
  });

  it("ignores matches in the deck when only the discard pile is named", () => {
    const before = start(3);
    expect(activeEncounterDeck(before).discard).toEqual([]);
    expect(play(before, TAKE.id).encounterSetAside).toEqual(before.encounterSetAside);
  });

  it("follows the pile's order after a shuffle", () => {
    const before = start(3);
    // The same seed shuffles the same way: the shuffle-only event shows the order the other one searches.
    const shuffled = activeEncounterDeck(play(before, SHUFFLE.id)).deck;
    expect(shuffled).not.toEqual(activeEncounterDeck(before).deck);
    const first = shuffled.find(isTarget(before));
    const after = play(before, SHUFFLE_TAKE.id);
    expect(after.encounterSetAside).toEqual([first]);
    expect(activeEncounterDeck(after).deck).toEqual(shuffled.filter((id) => id !== first));
  });
});
