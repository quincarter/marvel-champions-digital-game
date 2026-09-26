/**
 * docs/phase7-wave5.md §3.10: scheme icons printed on cards that are not schemes (`BaseCard.schemeIcons`, §1.3).
 * Synthetic cards shaped like the Venom ally / Symbiote Suit (`sm` 27190/27191: a hazard icon), Public Outcry (27174a/b:
 * an environment with an acceleration face and a hazard face) and Team Leader (27105: a crisis icon on an attachment).
 *
 * Sources: RRG 1.8 "Hazard Icon" (p. 21): "for each hazard icon on cards in play"; "Acceleration Icon" (p. 5) and
 * "Crisis Icon" (p. 13) count icons in play the same way.
 */

import type { AnyCard, SchemeIcon } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance } from "./query.js";
import { iconsInPlay } from "./rules.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, playerCardIntoPlay } from "./testing/wave3.js";

const withIcons = <C extends AnyCard>(card: C, schemeIcons: readonly SchemeIcon[]): C => ({ ...card, schemeIcons });

const SUIT = withIcons(stubSupport({ id: "suit", cost: 0 }), ["hazard"]);
const OUTCRY = {
  ...withIcons(stubEnvironment({ id: "outcry", flipSide: { name: "outcry-expert" } }), ["acceleration"]),
} as AnyCard;
const OUTCRY_FLIPPED: AnyCard =
  OUTCRY.type === "environment" && OUTCRY.flipSide
    ? { ...OUTCRY, flipSide: { ...OUTCRY.flipSide, schemeIcons: ["hazard"] } }
    : OUTCRY;
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf();

function start(): GameState {
  return gameAtFirstTurn({
    cards: [SUIT, OUTCRY_FLIPPED, FILLER],
    deps,
    encounter: [OUTCRY_FLIPPED.id, ...copiesOf(FILLER.id, 30)],
    deck: [SUIT.id],
  });
}

function villainPhase(state: GameState) {
  const step = state.step;
  if (step.kind !== "turn") throw new Error(step.kind);
  const before = mustInstance(state, state.mainScheme.instanceId).threat;
  const { session, events } = driveSession(startSession(state), deps, [
    { type: "endTurn", playerId: step.activePlayerId },
  ]);
  const dealt = events.filter(
    (e: GameEvent) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.cardId === FILLER.id,
  ).length;
  const after = session.state;
  return { session, dealt, threat: mustInstance(after, after.mainScheme.instanceId).threat - before };
}

describe("§3.10 scheme icons printed on any card", () => {
  it("a player card's hazard icon deals one more encounter card; replay deep-equal", () => {
    const plain = villainPhase(start());
    const suited = playerCardIntoPlay(start(), SUIT.id).state;
    expect(iconsInPlay(suited, deps, "hazard")).toBe(1);
    const withSuit = villainPhase(suited);
    expect(withSuit.dealt).toBe(plain.dealt + 1);
    const replayed = replay(withSuit.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(withSuit.session.state);
  });

  it("an environment's acceleration icon adds 1 threat at step one", () => {
    const plain = villainPhase(start());
    const withOutcry = encounterCardInVillainArea(start(), OUTCRY_FLIPPED.id).state;
    expect(iconsInPlay(withOutcry, deps, "acceleration")).toBe(1);
    expect(villainPhase(withOutcry).threat).toBe(plain.threat + 1);
  });

  it("a flipped card shows its other face's icons, a facedown card none", () => {
    const { state, id } = encounterCardInVillainArea(start(), OUTCRY_FLIPPED.id);
    const flipped = {
      ...state,
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), flipped: true } },
    };
    expect(iconsInPlay(flipped, deps, "acceleration")).toBe(0);
    expect(iconsInPlay(flipped, deps, "hazard")).toBe(1);
    const facedown = {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), facedownAs: { kind: "blank" as const, traits: [] } },
      },
    };
    expect(iconsInPlay(facedown, deps, "acceleration")).toBe(0);
  });
});
