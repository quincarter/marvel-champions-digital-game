/**
 * A card the reveal procedure has no step for (RRG 1.8 "Reveal", p. 38, step 2 names only encounter card types) fails
 * the reveal with a named invariant error. Before the guard it entered play nowhere, stayed in the player's dealt
 * encounter cards, and villain phase step 4 revealed it again until the flow loop gave up: a set-aside Ironheart
 * version shuffled into the encounter deck by Shadow of the Past (random-deck seed 1117).
 */

import { describe, expect, it } from "vitest";
import { startSession } from "./engine.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { RESOURCE } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const deps = depsOf();

/** Moves one of P1's own resource cards from their deck into their dealt encounter cards (test-only surgery). */
function resourceDealtAsEncounterCard(state: GameState): GameState {
  const seat = mustPlayer(state, P1);
  const id = seat.deck.find((candidate) => state.instances[candidate]?.cardId === RESOURCE.id);
  if (!id) throw new Error("no resource in P1's deck");
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((x) => x !== id), dealtEncounter: [id, ...p.dealtEncounter] } : p,
    ),
  };
}

describe("revealing a card that is not an encounter card", () => {
  it("fails the command with a named invariant error instead of re-revealing it until the flow loop gives up", () => {
    const state = resourceDealtAsEncounterCard(gameAtFirstTurn({ cards: [], deps }));
    expect(() => driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }])).toThrow(
      /cannot reveal res \(resource, instance \w+, from .*dealtEncounter.*\): not an encounter card/,
    );
  });
});
