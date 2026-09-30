/**
 * docs/phase7-wave5.md §3.4: acceleration tokens on any card, moved between cards, and announced. Synthetic cards shaped
 * like Tracking Prey (`sm` 27057: "If you are in alter-ego form, place 1 acceleration token here"), Hapless Pedestrians
 * 1B (27064b: "Forced Response: After an acceleration token is placed on this scheme, deal 3 indirect damage to the first
 * player") and the Manhattan environments (27117b–27119b: "Move … each acceleration token from here to the main scheme").
 *
 * Sources: RRG 1.8 "Acceleration Token" (p. 5): tokens "placed on cards other than the main scheme still add threat to
 * the main scheme during step one of the villain phase" and "are removed from play when the card they are placed on
 * leaves play"; "Encounter Deck" (p. 17) for the empty-deck token.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "./testing/scenario.js";
import { copiesOf, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const PEDESTRIANS = stubAbility("pedestrians.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "accelerationTokenPlaced", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: tracker, counterType: "heard", amount: { kind: "const", value: 1 } }],
});
const HAPLESS = stubMainScheme({
  id: "hapless",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(1), abilities: [PEDESTRIANS.ref] }],
});
const PREY = stubSideScheme({ id: "prey", startingThreat: 1, boostIcons: 0 });
const TRACKER = stubSupport({ id: "tracker", cost: 0 });
const VILLAIN = stubVillain({ id: "sandman", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const prey: TargetRef = { kind: "each", query: { categories: ["sideScheme"], name: "prey" } };
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL_PREY = event("reveal-prey", [
  { kind: "selectCards", slot: "p", cards: { kind: "encounter", zones: ["deck"], filter: { name: "prey" } } },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "p" }, controller: { kind: "controller" } },
  { kind: "addAccelerationToken", target: prey },
]);
const TOKEN = event("token", [{ kind: "addAccelerationToken" }]);
const TO_MAIN = event("to-main", [
  { kind: "moveCounters", from: prey, to: { kind: "mainScheme" }, counterType: "acceleration" },
]);
const CLEAR_PREY = event("clear-prey", [{ kind: "removeThreat", target: prey, amount: { kind: "const", value: 5 } }]);
const EVENTS = [REVEAL_PREY, TOKEN, TO_MAIN, CLEAR_PREY];

const deps: EngineDeps = depsOf(PEDESTRIANS, ...EVENTS.map((e) => e.ability));

function start(): GameState {
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, HAPLESS, PREY, TRACKER, VILLAIN, FILLER, ...EVENTS.map((e) => e.card)],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: HAPLESS.id,
      encounterDeck: [...copiesOf(FILLER.id, 20), PREY.id],
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, TRACKER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return playerCardIntoPlay(driveSession(startSession(result.state), deps).session.state, TRACKER.id).state;
}

const preyId = (state: GameState): InstanceId | undefined =>
  state.villainArea.find((id) => mustInstance(state, id).cardId === PREY.id);
const heardCount = (state: GameState): number => {
  const id = state.players[0]!.playArea.find((i) => mustInstance(state, i).cardId === TRACKER.id)!;
  return mustInstance(state, id).counters["heard"] ?? 0;
};
function stepOneThreat(state: GameState): number {
  const before = mustInstance(state, state.mainScheme.instanceId).threat;
  const step = state.step;
  if (step.kind !== "turn") throw new Error(step.kind);
  const after = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: step.activePlayerId }]).session
    .state;
  return mustInstance(after, after.mainScheme.instanceId).threat - before;
}

describe("§3.4 an acceleration token on a card that is not the main scheme", () => {
  it("sits on the side scheme and adds to the main scheme's step one; gone when the side scheme leaves play", () => {
    const { state, session } = playFree(start(), deps, REVEAL_PREY.card.id);
    expect(mustInstance(state, preyId(state)!).counters["acceleration"]).toBe(1);
    expect(state.mainScheme.accelerationTokens).toBe(0);
    expect(stepOneThreat(state)).toBe(2);
    const cleared = playFree(state, deps, CLEAR_PREY.card.id).state;
    expect(preyId(cleared)).toBeUndefined();
    expect(stepOneThreat(cleared)).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("moves to the main scheme with the other tokens", () => {
    const withPrey = playFree(start(), deps, REVEAL_PREY.card.id).state;
    const moved = playFree(withPrey, deps, TO_MAIN.card.id).state;
    expect(mustInstance(moved, preyId(moved)!).counters["acceleration"] ?? 0).toBe(0);
    expect(moved.mainScheme.accelerationTokens).toBe(1);
    expect(stepOneThreat(moved)).toBe(2);
  });
});

describe("§3.4 'After an acceleration token is placed on this scheme'", () => {
  it("hears a token placed on the main scheme, and not one placed on a side scheme", () => {
    const placed = playFree(start(), deps, TOKEN.card.id).state;
    expect(placed.mainScheme.accelerationTokens).toBe(1);
    expect(heardCount(placed)).toBe(1);
    const elsewhere = playFree(start(), deps, REVEAL_PREY.card.id).state;
    expect(heardCount(elsewhere)).toBe(0);
  });
});
