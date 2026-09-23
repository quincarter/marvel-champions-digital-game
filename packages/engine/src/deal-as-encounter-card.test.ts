/**
 * docs/phase7-wave3.md §3.47: `EffectSpec dealAsEncounterCard`, dealing a card that is already identified (not the
 * encounter deck's top card) to a player as a facedown encounter card. Shaped like You Dare Oppose Me? (`ron` 90005):
 * "Discard the top 5 cards of the encounter deck. Each time a card belonging to the Kree Fanatic set is discarded this
 * way, deal that card to yourself as a facedown encounter card." Here the effect is on a player event, so the test
 * reads the dealt zone before any villain phase; the card's own test (`ron/kree-fanatic.test.ts`) drives the real
 * card through a villain phase.
 *
 * Sources: RRG 1.8 "Deal, Deal an Encounter Card" (p. 15): the dealt card is placed facedown in front of the player and
 * "added to the queue of cards that player resolves during the villain phase"; "Each Time" (p. 7, whose example is
 * this very card).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, def({ trigger: { kind: "action" }, effects }));

/** "Discard the top 5 cards of the encounter deck. Each time a zealot is discarded this way, deal it to yourself." */
const DUMP_ABILITY = action("dump.action", [
  {
    kind: "discardEncounterCards",
    count: n(5),
    forEachDiscarded: {
      slot: "discarded",
      effects: [
        {
          kind: "if",
          condition: {
            kind: "refMatches",
            ref: { kind: "slot", slot: "discarded" },
            query: { name: "zealot" },
            anywhere: true,
          },
          then: [
            {
              kind: "dealAsEncounterCard",
              cards: { kind: "slot", slot: "discarded" },
              player: { kind: "controller" },
            },
          ],
        },
      ],
    },
  },
]);
/** "Deal each minion to yourself": only to prove a card in play is never dealt. */
const IN_PLAY_ABILITY = action("in-play.action", [
  {
    kind: "dealAsEncounterCard",
    cards: { kind: "each", query: { categories: ["minion"] } },
    player: { kind: "controller" },
  },
]);
const DUMP = stubEvent({ id: "dump", cost: 0, abilities: [DUMP_ABILITY.ref] });
const IN_PLAY = stubEvent({ id: "in-play", cost: 0, abilities: [IN_PLAY_ABILITY.ref] });
const ZEALOT = stubMinion({ id: "zealot", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const OUTSIDER = stubMinion({ id: "outsider", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps = depsOf(DUMP_ABILITY, IN_PLAY_ABILITY);

/** Test surgery: these cards (distinct copies) on top of the active encounter deck, in this order. */
function stack(state: GameState, order: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const picked: InstanceId[] = [];
  for (const card of order) {
    const id = piles.deck.find((c) => !picked.includes(c) && state.instances[c]?.cardId === card);
    if (!id) throw new Error(`no ${card} left in the encounter deck`);
    picked.push(id);
  }
  const deck = [...picked, ...piles.deck.filter((id) => !picked.includes(id))];
  return {
    state: { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } } },
    ids: picked,
  };
}

/** The deck's top: zealot, blank, outsider, zealot, blank (the 5 discarded), then a blank the effect must not touch. */
function start() {
  const base = gameAtFirstTurn({
    cards: [DUMP, IN_PLAY, ZEALOT, OUTSIDER, BLANK],
    deps,
    encounter: [...copiesOf(ZEALOT.id, 2), ...copiesOf(OUTSIDER.id, 2), ...copiesOf(BLANK.id, 20)],
    deck: [DUMP.id, IN_PLAY.id],
  });
  const { state, ids } = stack(base, [ZEALOT.id, BLANK.id, OUTSIDER.id, ZEALOT.id, BLANK.id, BLANK.id]);
  const [zealotA, blankA, outsider, zealotB, blankB, next] = ids as [InstanceId, ...InstanceId[]];
  return { state, zealotA, blankA: blankA!, outsider: outsider!, zealotB: zealotB!, blankB: blankB!, next: next! };
}

const playFree = (state: GameState, card: CardId, more: readonly Command[] = []) => {
  const given = giveCard(state, P1, card);
  return driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ...more,
  ]).session;
};

describe("§3.47 dealAsEncounterCard: dealing a card already identified", () => {
  it("deals exactly the named cards to the player, facedown and in order, and leaves the deck's top alone", () => {
    const { state, zealotA, zealotB, blankA, outsider, blankB, next } = start();
    const after = playFree(state, DUMP.id).state;
    expect(mustPlayer(after, P1).dealtEncounter).toEqual([zealotA, zealotB]);
    for (const id of [zealotA, zealotB]) expect(mustInstance(after, id).faceup).toBe(false);
    const piles = after.encounterDecks[activeEncounterDeckId(after)]!;
    // The other discards stay in the discard pile; neither zealot is left there.
    for (const id of [blankA, outsider, blankB]) expect(piles.discard).toContain(id);
    for (const id of [zealotA, zealotB]) expect(piles.discard).not.toContain(id);
    // `dealEncounterCard` would have taken the top card; this takes none.
    expect(piles.deck[0]).toBe(next);
  });

  it("the dealt cards join the queue the next villain phase reveals (RRG 1.8 'Deal', p. 15)", () => {
    const { state, zealotA, zealotB } = start();
    const after = playFree(state, DUMP.id, [{ type: "endTurn", playerId: P1 }]).state;
    for (const id of [zealotA, zealotB]) expect(mustInstance(after, id).engagedWith).toBe(P1);
  });

  it("never deals a card in play", () => {
    const { state } = start();
    const engaged = minionEngagedWith(state, OUTSIDER.id, P1);
    const after = playFree(engaged.state, IN_PLAY.id).state;
    expect(mustPlayer(after, P1).dealtEncounter).toEqual([]);
    expect(mustInstance(after, engaged.id).engagedWith).toBe(P1);
  });

  it("replays to the same state", () => {
    const { state } = start();
    const session = playFree(state, DUMP.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
