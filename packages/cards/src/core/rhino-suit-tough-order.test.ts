/**
 * Armored Rhino Suit (01098) against a tough status card on Rhino. RRG v1.8 "Damage" (p. 14): abilities that trigger
 * "when [character] would be dealt any amount of damage" (step 1) resolve before tough status cards (step 2), so the
 * suit's "place it here instead" takes the whole hit and Rhino keeps his tough card. RRG v1.8 p. 14; owner decision
 * 2026-10-16 (audit finding 17), superseding the 2026-10-06 "status cards first" row of docs/phase7-wave7.md §4.1;
 * FFG's July 20, 2023 ruling on Armored Rhino Suit agrees. The engine primitive is `trigger.wouldBeDealt`
 * (`packages/engine/src/damage-stage-order.test.ts`).
 */

import { cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { CORE_DEPS } from "./index.js";
import { coreScenario } from "./setup.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  run,
  settle,
  stackEncounterDeck,
  startCoreGame,
  toHero,
} from "../testing/harness.js";
import { driveEvents } from "../testing/staging.js";

/** Spider-Man (ATK 2) in hero form against Rhino, the suit revealed onto Rhino and Rhino given a tough status card. */
function toughRhinoWithSuit(): { state: GameState; suit: InstanceId; rhino: InstanceId } {
  const start = startCoreGame(
    coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 }),
  );
  const revealed = settle(
    run(stackEncounterDeck(start, "01186", "01098"), endTurn()),
    firstLegal,
    undefined,
    CORE_DEPS,
  );
  const [suit] = instancesOf(revealed, "01098").filter((id) => cardsInPlay(revealed).includes(id)) as [InstanceId];
  const hero = settle(run(revealed, toHero()), firstLegal, undefined, CORE_DEPS);
  const rhino = hero.activeVillainId;
  const state = patchInstance(hero, rhino, { statuses: { ...inst(hero, rhino).statuses, tough: 1 } });
  return { state, suit, rhino };
}
const hitRhino = (state: GameState) =>
  driveEvents(CORE_DEPS, state, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(state),
    targetInstanceId: state.activeVillainId,
  });

describe("Armored Rhino Suit before Rhino's tough status card (RRG v1.8 p. 14; owner decision 2026-10-16, finding 17)", () => {
  it("the hit goes onto the suit: Rhino keeps his tough card and takes no damage", () => {
    const { state, suit, rhino } = toughRhinoWithSuit();
    const before = inst(state, rhino).damage;
    const { state: after, events } = hitRhino(state);
    expect(inst(after, suit).damage).toBe(2);
    expect(inst(after, rhino).statuses.tough).toBe(1);
    expect(inst(after, rhino).damage).toBe(before);
    expect(events.some((e) => e.type === "interruptsPreempted")).toBe(false);
  });

  it("the hit that brings the suit to 5 is still absorbed in full and the suit is discarded; the tough card stays", () => {
    const { state, suit, rhino } = toughRhinoWithSuit();
    const before = inst(state, rhino).damage;
    const { state: after } = hitRhino(patchInstance(state, suit, { damage: 3 }));
    expect(cardsInPlay(after)).not.toContain(suit);
    expect(inst(after, rhino).statuses.tough).toBe(1);
    expect(inst(after, rhino).damage).toBe(before);
  });
});
