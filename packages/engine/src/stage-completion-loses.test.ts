/**
 * docs/phase7-wave3.md §3.37: "If this stage is completed, the players lose the game." printed on a main scheme stage
 * that is not the last (`MainSchemeStage.completionLoses`). Synthetic schemes shaped like The Missing Milano 1B (`gmw`
 * 16082b): "Forced Interrupt: When the last threat is removed from this scheme, advance to stage 2A (the players win
 * by advancing). If this stage is completed, the players lose the game."
 *
 * Sources: RRG 1.8 "Main Scheme, Main Scheme Deck" (p. 27): "If the amount of threat on a main scheme is equal to or
 * greater than its target threat value, that main scheme is completed and the main scheme deck advances"; "If the
 * villain completes the final stage of the main scheme deck, the villain wins the game"; "If the main scheme advances
 * other than through having threat on it equal to or greater than its target threat value, that main scheme is
 * **not** considered completed."
 */

import { flat, type MainSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;

/** Two stages; stage 1 prints the loss sentence when `loses`. */
function scheme(loses: boolean): MainSchemeCard {
  const base = stubMainScheme({
    id: loses ? "milano" : "plain",
    stages: [
      { startingThreat: flat(0), targetThreat: flat(5), acceleration: flat(0) },
      { startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(0) },
    ],
  });
  if (!loses) return base;
  const [first, second] = base.stages;
  return { ...base, stages: [{ ...first, completionLoses: true }, second!] };
}
/** "Place 5 threat on the main scheme." — enough to complete stage 1. */
const PUSH_ABILITY = stubAbility(
  "push.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(5) }],
  }),
);
const PUSH = stubEvent({ id: "push", cost: 0, abilities: [PUSH_ABILITY.ref] });
/** "Advance to stage 2A." — leaving the stage some other way. */
const LEAVE_ABILITY = stubAbility(
  "leave.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "advanceMainScheme" }] }),
);
const LEAVE = stubEvent({ id: "leave", cost: 0, abilities: [LEAVE_ABILITY.ref] });
const deps = depsOf(PUSH_ABILITY, LEAVE_ABILITY);

function playing(loses: boolean, card: typeof PUSH | typeof LEAVE): GameState {
  const main = scheme(loses);
  const state = gameAtFirstTurn({ cards: [main, PUSH, LEAVE], deps, mainScheme: main, deck: [PUSH.id, LEAVE.id] });
  const given = giveCard(state, P1, card.id);
  return driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]).session.state;
}

describe("§3.37 'If this stage is completed, the players lose the game.' on a stage that is not the last", () => {
  it("completing the stage loses, where an unmarked stage 1 advances", () => {
    const lost = playing(true, PUSH);
    expect(lost.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
    const advanced = playing(false, PUSH);
    expect(advanced.outcome).toBeNull();
    expect(advanced.mainScheme.stageIndex).toBe(1);
  });

  it("leaving the stage by an advance is not completing it (RRG 1.8 p. 27)", () => {
    const left = playing(true, LEAVE);
    expect(left.outcome).toBeNull();
    expect(left.mainScheme.stageIndex).toBe(1);
  });

  it("replays deep-equal", () => {
    const main = scheme(true);
    const state = gameAtFirstTurn({ cards: [main, PUSH], deps, mainScheme: main, deck: [PUSH.id] });
    const given = giveCard(state, P1, PUSH.id);
    const { session } = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
