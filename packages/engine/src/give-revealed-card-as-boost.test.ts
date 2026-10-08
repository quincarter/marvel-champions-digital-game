/**
 * `giveBoostCard.card` naming the card being revealed (docs/phase7-wave8.md §3.79). Synthetic treachery shaped like
 * "When Revealed: Give the villain a tough status card. Give this card to that villain as a facedown boost card.
 * Boost: this activation gets 2 more boost icons' worth" (here simply two printed boost icons).
 *
 * Sources: RRG 1.8 "Boost, Boost Icon" (p. 11): a boost card dealt outside an activation waits facedown on the enemy
 * until it activates and is resolved in addition to the automatic one; "Treachery" (p. 45): discarded after resolving,
 * so one its own effect moved onto the enemy is not; "Reveal" (p. 37).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { activeEncounterDeck, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playFree } from "./testing/wave3.js";

const theVillain = { kind: "each", query: { categories: ["villain"] } } as const;
const self = { kind: "self" } as const;
// "When Revealed: Give the villain a tough status card. Give this card to that villain as a facedown boost card."
const LURK_REVEALED = stubAbility("lurk.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "giveStatus", target: theVillain, status: "tough" },
    { kind: "giveBoostCard", enemy: theVillain, card: self },
  ],
});
const LURK = stubTreachery({ id: "lurk", boostIcons: 2, abilities: [LURK_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
// "Action: Give this card to the villain as a facedown boost card." A card being played is resolving, not revealed.
const SNEAK = stubAbility("sneak.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "giveBoostCard", enemy: theVillain, card: self }],
});
const SNEAK_CARD = stubEvent({ id: "sneak", cost: 0, abilities: [SNEAK.ref] });

const deps: EngineDeps = depsOf(LURK_REVEALED, SNEAK);

const start = (): GameState =>
  gameAtFirstTurn({
    cards: [LURK, BLANK, SNEAK_CARD],
    deps,
    encounter: [LURK.id, ...copiesOf(BLANK.id, 29)],
    deck: [SNEAK_CARD.id],
  });
const stacked = (state: GameState, ...cards: readonly string[]): GameState =>
  [...cards].reverse().reduce((current, card) => onTopOfEncounterDeck(current, card as never), state);
const villainPhase = (state: GameState) => driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]);
const villainOf = (state: GameState) => state.villains[0]!.instanceId;
const lurkOf = (state: GameState) =>
  Object.values(state.instances).find((instance) => instance.cardId === LURK.id)!.instanceId;

describe("a card being revealed gives itself as a facedown boost card", () => {
  it("revealed: the villain is tough and holds it facedown; it is not discarded and not in front of the player", () => {
    // The villain's own boost card, then the card revealed to the player.
    const { session, events } = villainPhase(stacked(start(), BLANK.id, LURK.id));
    const state = session.state;
    const lurk = lurkOf(state);
    expect(mustInstance(state, villainOf(state)).statuses.tough).toBe(1);
    expect(mustInstance(state, villainOf(state)).boostCards).toEqual([lurk]);
    expect(mustInstance(state, lurk).faceup).toBe(false);
    expect(locateCard(state, lurk)).toEqual({ kind: "boost", hostInstanceId: villainOf(state) });
    expect(activeEncounterDeck(state).discard).not.toContain(lurk);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([]);
    expect(events.filter((e) => e.type === "boostCardDealt" && e.instanceId === lurk)).toEqual([
      { type: "boostCardDealt", enemyInstanceId: villainOf(state), instanceId: lurk, outsideActivation: true },
    ]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("at the villain's next activation it is resolved with the automatic boost card, then discarded", () => {
    const first = villainPhase(stacked(start(), BLANK.id, LURK.id)).session.state;
    const lurk = lurkOf(first);
    const threatBefore = mustInstance(first, first.mainScheme.instanceId).threat;
    const { session } = villainPhase(stacked(first, BLANK.id, BLANK.id));
    const state = session.state;
    expect(mustInstance(state, villainOf(state)).boostCards).toEqual([]);
    expect(activeEncounterDeck(state).discard).toContain(lurk);
    // The alter-ego is schemed against: step-one acceleration 1, then SCH 1 plus the waiting card's 2 boost icons.
    expect(mustInstance(state, state.mainScheme.instanceId).threat - threatBefore).toBe(1 + 1 + 2);
  });

  it("only a card being revealed: an event giving itself while it resolves gives nothing", () => {
    const run = playFree(start(), deps, SNEAK_CARD.id);
    expect(mustInstance(run.state, villainOf(run.state)).boostCards).toEqual([]);
    expect(mustPlayer(run.state, P1).discard.map((id) => mustInstance(run.state, id).cardId)).toContain(SNEAK_CARD.id);
  });
});
