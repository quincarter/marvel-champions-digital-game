/**
 * docs/phase7-wave3.md §3.6 and §1.2: the amplify icon. Each one in play adds a boost icon to every boost card turned
 * faceup during an enemy activation. Synthetic cards shaped like Vendetta and Cannonade (a side scheme printing one),
 * The Beyonder's Blazer (an attachment) and There Is No Escape (a double-sided card printing it on one face only).
 *
 * Sources: RRG 1.8 "Amplify Icon" (p. 7), "Boost, Boost Icon" (p. 11); ruling Jan 11, 2026 (1) (an amplify icon on a
 * defeated side scheme stays in effect until the card leaves play).
 */

import type { CardId, EnvironmentCard, SideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

/** Vendetta: a side scheme with no text and one amplify icon. */
const VENDETTA: SideSchemeCard = { ...stubSideScheme({ id: "vendetta", startingThreat: 2 }), amplifyIcons: 1 };
/** Two amplify icons on one card, for the count. */
const DOUBLE: SideSchemeCard = { ...stubSideScheme({ id: "double", startingThreat: 2 }), amplifyIcons: 2 };
/** A double-sided card that prints amplify only on its other face. */
const TWO_FACED_BASE = stubEnvironment({ id: "two-faced", flipSide: { name: "Other face" } });
const TWO_FACED: EnvironmentCard = { ...TWO_FACED_BASE, flipSide: { ...TWO_FACED_BASE.flipSide!, amplifyIcons: 1 } };
/** The boost deck: every card prints exactly one boost icon. */
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });

const deps: EngineDeps = depsOf();
const CARDS = [VENDETTA, DOUBLE, TWO_FACED, ONE_ICON];
const ENCOUNTER: readonly CardId[] = [VENDETTA.id, DOUBLE.id, TWO_FACED.id, ...copiesOf(ONE_ICON.id, 30)];

/** A game at p1's first turn, in hero form, so the villain (ATK 2) attacks during the villain phase. */
function start(): GameState {
  const state = gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}

/** Plays out the villain phase (the villain attacks undefended) and returns the attack's boost card flips. */
function villainPhase(state: GameState) {
  const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]);
  const flips = events.filter(
    (event): event is Extract<GameEvent, { type: "boostCardFlipped" }> => event.type === "boostCardFlipped",
  );
  const damage = mustInstance(session.state, mustPlayer(session.state, P1).identity.instanceId).damage;
  return { session, flips, damage };
}

describe("§3.6 the amplify icon", () => {
  it("with none in play, a boost card counts its printed icons", () => {
    const { flips, damage } = villainPhase(start());
    expect(flips[0]?.boostIcons).toBe(1);
    expect(damage).toBe(2 + 1);
  });

  it("one amplify icon in play adds a boost icon to the attack's boost card", () => {
    const { flips, damage } = villainPhase(encounterCardInVillainArea(start(), VENDETTA.id, 2).state);
    expect(flips[0]?.boostIcons).toBe(2);
    expect(damage).toBe(2 + 2);
  });

  it("every amplify icon counts: 1 + 2 in play adds 3", () => {
    let state = encounterCardInVillainArea(start(), VENDETTA.id, 2).state;
    state = encounterCardInVillainArea(state, DOUBLE.id, 2).state;
    const { damage } = villainPhase(state);
    expect(damage).toBe(2 + 1 + 3);
  });

  it("a double-sided card counts the icons of the face that is up", () => {
    const placed = encounterCardInVillainArea(start(), TWO_FACED.id);
    expect(villainPhase(placed.state).damage).toBe(2 + 1);
    const flipped: GameState = {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), flipped: true },
      },
    };
    expect(villainPhase(flipped).damage).toBe(2 + 2);
  });

  it("replays to the same state", () => {
    const { session } = villainPhase(encounterCardInVillainArea(start(), VENDETTA.id, 2).state);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
