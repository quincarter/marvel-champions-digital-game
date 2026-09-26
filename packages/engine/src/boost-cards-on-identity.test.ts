/**
 * docs/phase7-wave5.md §3.6: boost cards held on a card that does not activate, then moved to an enemy. Synthetic cards
 * shaped like Venom I (`sm` 27073: "place 1 facedown boost card on your identity") and "Leave Us Alone!" 1B (27071b:
 * "Forced Interrupt: When Venom activates against you, move each facedown boost card from your identity to Venom").
 *
 * Sources: MC27 p. 11 "Boost Cards on Your Identity" ("That boost card remains on your identity until a card ability
 * … instructs you to move that card to Venom during an activation"); RRG 1.8 "Boost, Boost Icon" (p. 11): a boost card
 * dealt outside an enemy's activation "remains facedown on that enemy until that enemy activates", and the villain
 * "still gets dealt another boost card at the start of its activation as normal".
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });

const LEAVE_US_ALONE = stubAbility("leave-us-alone.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyActivating", sourceIs: { categories: ["villain"] } } },
  effects: [
    {
      kind: "moveBoostCards",
      from: { kind: "identityOf", player: { kind: "eventPlayer" } },
      to: { kind: "eventSource" },
    },
  ],
});
const scheme = (abilities: readonly StubAbility[]) =>
  stubMainScheme({
    id: "leave-us-alone",
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(99),
        acceleration: flat(0),
        abilities: abilities.map((a) => a.ref),
      },
    ],
  });
const VENOM = stubVillain({ id: "venom", stages: [{ hp: flat(30), atk: 0, sch: 1 }] });

const VENGEANCE = stubAbility("vengeance.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "giveBoostCard",
      enemy: { kind: "identityOf", player: { kind: "controller" } },
      count: { kind: "const", value: 2 },
    },
  ],
});
const VENGEANCE_CARD = stubEvent({ id: "vengeance", cost: 0, abilities: [VENGEANCE.ref] });

function start(deps: EngineDeps, abilities: readonly StubAbility[]): GameState {
  return gameAtFirstTurn({
    cards: [ONE_ICON, VENGEANCE_CARD],
    deps,
    villain: VENOM,
    mainScheme: scheme(abilities),
    encounter: copiesOf(ONE_ICON.id, 30),
    deck: copiesOf(VENGEANCE_CARD.id, 2),
  });
}

const identityOf = (state: GameState) => mustInstance(state, mustPlayer(state, P1).identity.instanceId);

function villainPhase(state: GameState, deps: EngineDeps) {
  const step = state.step;
  if (step.kind !== "turn") throw new Error(step.kind);
  const before = mustInstance(state, state.mainScheme.instanceId).threat;
  const { session } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: step.activePlayerId }]);
  const after = session.state;
  return { session, state: after, threat: mustInstance(after, after.mainScheme.instanceId).threat - before };
}

describe("§3.6 boost cards on an identity", () => {
  it("wait facedown on the identity, which never resolves them", () => {
    const deps = depsOf(VENGEANCE);
    const held = playFree(start(deps, []), deps, VENGEANCE_CARD.id).state;
    const boosts = identityOf(held).boostCards;
    expect(boosts).toHaveLength(2);
    expect(boosts.every((id) => !mustInstance(held, id).faceup)).toBe(true);
    const { state, threat } = villainPhase(held, deps);
    // SCH 1 + the villain's own boost card (1 icon); the identity's two are untouched.
    expect(threat).toBe(2);
    expect(identityOf(state).boostCards).toEqual(boosts);
  });

  it("moved to the villain as it activates, resolve in that activation; replay deep-equal", () => {
    const deps = depsOf(VENGEANCE, LEAVE_US_ALONE);
    const held = playFree(start(deps, [LEAVE_US_ALONE]), deps, VENGEANCE_CARD.id).state;
    const boosts = identityOf(held).boostCards;
    const { session, state, threat } = villainPhase(held, deps);
    // SCH 1 + the two moved cards + the villain's own boost card.
    expect(threat).toBe(4);
    expect(identityOf(state).boostCards).toHaveLength(0);
    const deckId = Object.keys(state.encounterDecks)[0]!;
    for (const id of boosts) expect(state.encounterDecks[deckId]!.discard).toContain(id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
