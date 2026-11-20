/**
 * docs/phase7-wave9.md §3.66: the pod's shared main scheme, and when its completion loses the game with one group
 * (§4.1 Q9 = A, the owner's decision of 2026-10-09: by the insert). Synthetic cards shaped like Worlds Collide (`tt`
 * 55028b) and Mischief and Mayhem 1B's two interrupts (55033b: "place 1 threat on Worlds Collide instead").
 *
 * Sources: MC55 p. 21: at the target "Each group in the middle of a villain phase must finish any abilities currently
 * resolving, then stop play immediately; each group in the middle of a player phase may finish that phase as normal. If
 * Loki, God of Lies is defeated before all player phases in all groups end, all players in all groups win the game!
 * However, if Loki, God of Lies remains undefeated when all player phases in all groups end, all players in all groups
 * lose the game." Card 55028b: "If this stage is completed, the players lose the game." With one group, no player phase
 * is running during the villain phase, so the loss there is at once.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, replay, startSession } from "./engine.js";
import { inboundCommand } from "./pod-commands.js";
import type { GameEvent } from "./events.js";
import { podOf } from "./pod.js";
import { mustInstance, sharedScheme, sharedVillain } from "./query.js";
import type { GameState } from "./state.js";
import { driveSession } from "./testing/drive.js";
import {
  LEDGER,
  ledgerMarks,
  podEvent,
  podTreachery,
  scriptedDeps,
  SHARED_SCHEME,
  SHARED_VILLAIN,
  sharedEvent,
  singleGroup,
  unscriptedDeps,
  type PodScript,
} from "./testing/pod.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  playFree,
} from "./testing/wave3.js";

/** "Place 1 threat on [the shared scheme]", as each of the two ways of MC55 p. 21. */
const COMPLETED_1 = podEvent("completed-1", [sharedEvent("schemeThreatPlaced", 1, "schemeCompleted")]);
const DEFEATED_1 = podEvent("defeated-1", [sharedEvent("schemeThreatPlaced", 1, "identityDefeated")]);
const SHATTER_20 = podEvent("shatter-20", [sharedEvent("villainDamaged", 20)]);
/** Both in one ability: the completion and the defeat are queued together. */
const BOTH = podEvent("both", [sharedEvent("schemeThreatPlaced", 2), sharedEvent("villainDamaged", 20)]);
/** A treachery: "When Revealed: Place 1 threat on [the shared scheme]." */
const DOOM = podTreachery("doom", [sharedEvent("schemeThreatPlaced", 1, "schemeCompleted")]);
const EVENTS = [COMPLETED_1, DEFEATED_1, SHATTER_20, BOTH];
const scripted = scriptedDeps(...EVENTS, DOOM);
const unscripted = unscriptedDeps(...EVENTS, DOOM);

function table(deps: EngineDeps = scripted, players: 1 | 2 = 1): GameState {
  const start = gameAtFirstTurn({
    players,
    cards: [SHARED_VILLAIN, SHARED_SCHEME, LEDGER, DOOM.card, ...EVENTS.map((s) => s.card)],
    deps,
    deck: EVENTS.flatMap((s) => copiesOf(s.card.id, 3)),
    encounter: [LEDGER.id, DOOM.card.id, ...copiesOf(TREACHERY.id, 20)],
    pod: singleGroup(players),
  });
  return encounterCardInVillainArea(start, LEDGER.id).state;
}
const play = (state: GameState, script: PodScript, deps: EngineDeps = scripted) => {
  const played = playFree(state, deps, script.card.id);
  const replayed = replay(played.session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(played.session.state);
  return played;
};
const endTurn = (state: GameState, deps: EngineDeps = scripted) => {
  const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events };
};
/**
 * The pod coordinator's acknowledgement of this group's last shared event (`PodState.awaiting`, `sharedAck`): what a
 * remote coordinator sends once it has applied the event, after which the group plays on.
 */
const acked = (state: GameState, deps: EngineDeps = scripted): GameState => {
  const pod = podOf(state);
  const result = applyCommand(
    state,
    inboundCommand(state, pod.inboundSeq + 1, { kind: "sharedAck", seq: pod.awaiting ?? pod.outboundSeq }),
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
};
const emitted = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "sharedEventEmitted" ? [{ seq: e.seq, event: e.event }] : []));
const has = (events: readonly GameEvent[], type: GameEvent["type"]) => events.some((e) => e.type === type);
const lossTo = (state: GameState) => ({
  result: "loss",
  reason: "cardAbility",
  sourceInstanceId: podOf(state).neutral!.mainSchemeInstanceId,
});
/** DOOM as the first encounter card dealt in the villain phase: under the one boost card the activation takes. */
const doomDealt = (state: GameState): GameState =>
  onTopOfEncounterDeck(onTopOfEncounterDeck(state, DOOM.card.id), TREACHERY.id);

describe("threat on the shared scheme, one group (docs/phase7-wave9.md §3.66)", () => {
  it("is a numbered shared event with its cause; the neutral card holds no threat tokens", () => {
    const first = play(table(), COMPLETED_1);
    expect(emitted(first.events)).toEqual([
      {
        seq: 1,
        event: { type: "sharedSchemeThreatPlaced", groupId: "g1", amount: 1, cause: "schemeCompleted" },
      },
    ]);
    expect(sharedScheme(first.state)).toMatchObject({
      threat: 1,
      target: 2,
      status: "playing",
      finalPlayerPhase: false,
    });
    expect(mustInstance(first.state, podOf(first.state).neutral!.mainSchemeInstanceId).threat).toBe(0);
    expect(first.state.outcome).toBeNull();
    expect(first.state.mainScheme.accelerationTokens).toBe(0);
  });

  it("step one of the villain phase places its threat on the game's own main scheme and none on the shared one", () => {
    const start = table();
    const before = mustInstance(start, start.mainScheme.instanceId).threat;
    const { state } = endTurn(start);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBeGreaterThan(before);
    expect(sharedScheme(state)).toMatchObject({ threat: 0, status: "playing" });
  });
});

describe("Q9 = A: the shared scheme completed in the player phase", () => {
  it("the phase is played to its end, and the players lose when it ends", () => {
    const first = play(table(), COMPLETED_1);
    const second = play(first.state, DEFEATED_1);
    expect(emitted(second.events)[0]?.event).toMatchObject({ cause: "identityDefeated" });
    expect(sharedScheme(second.state)).toMatchObject({ threat: 2, status: "schemeCompleted", finalPlayerPhase: true });
    expect(second.state.outcome).toBeNull();
    expect(second.state.step).toMatchObject({ phase: "player", kind: "turn" });
    // A third threat changes nothing but the count: the completion is reported once.
    const third = play(second.state, COMPLETED_1);
    expect(sharedScheme(third.state)).toMatchObject({ threat: 3, status: "schemeCompleted" });
    expect(third.events.filter((e) => e.type === "sharedResultApplied")).toEqual([]);

    const threatBefore = mustInstance(third.state, third.state.mainScheme.instanceId).threat;
    const { state, events } = endTurn(third.state);
    expect(state.outcome).toEqual(lossTo(state));
    // By the shared scheme's own line, answering the moment.
    expect(ledgerMarks(state).lost).toBe(1);
    expect(podOf(state).shared?.status).toBe("lost");
    // The loss is at the end of the player phase: the villain phase's step one never placed its threat.
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(threatBefore);
    expect(state.round).toBe(1);
    expect(has(events, "gameEnded")).toBe(true);
  });

  it("defeating the shared villain before that phase ends wins instead", () => {
    const first = play(table(), COMPLETED_1);
    const second = play(first.state, COMPLETED_1);
    expect(sharedScheme(second.state)?.finalPlayerPhase).toBe(true);
    const { state } = play(second.state, SHATTER_20);
    expect(podOf(state).shared?.status).toBe("won");
    expect(sharedVillain(state)?.defeated).toBe(true);
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  it("a completion and a defeat queued by one ability resolve as the record stands: the win", () => {
    const { state, events } = play(table(), BOTH);
    expect(emitted(events).map((e) => e.seq)).toEqual([1, 2]);
    expect(podOf(state).shared).toMatchObject({ schemeThreat: 2, villainDamage: 20, status: "won" });
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(ledgerMarks(state)).toEqual({ after: 1 });
  });

  it("with two players the phase runs on through the second player's turn", () => {
    const first = play(table(scripted, 2), COMPLETED_1);
    const second = play(first.state, COMPLETED_1);
    const afterP1 = endTurn(second.state);
    expect(afterP1.state.outcome).toBeNull();
    expect(afterP1.state.step).toMatchObject({ phase: "player", kind: "turn" });
    expect(sharedScheme(afterP1.state)?.finalPlayerPhase).toBe(true);
    const { session } = driveSession(startSession(afterP1.state), scripted, [
      { type: "endTurn", playerId: afterP1.state.players[1]!.playerId },
    ]);
    expect(session.state.outcome).toEqual(lossTo(session.state));
  });
});

describe("Q9 = A: the shared scheme completed in the villain phase", () => {
  it("the game is lost at once, when the card that placed the threat has resolved", () => {
    const first = play(table(), COMPLETED_1);
    expect(first.state.outcome).toBeNull();
    const { state, events } = endTurn(doomDealt(first.state));
    expect(sharedScheme(state)).toMatchObject({ threat: 2, status: "lost", finalPlayerPhase: false });
    expect(state.outcome).toEqual(lossTo(state));
    expect(ledgerMarks(state).lost).toBe(1);
    expect(state.round).toBe(1);
    expect(emitted(events)).toEqual([
      { seq: 2, event: { type: "sharedSchemeThreatPlaced", groupId: "g1", amount: 1, cause: "schemeCompleted" } },
    ]);
  });

  it("below the target the villain phase goes on to the next round", () => {
    const { state } = endTurn(doomDealt(table()));
    expect(sharedScheme(state)).toMatchObject({ threat: 1, status: "playing" });
    expect(state.outcome).toBeNull();
    expect(state.round).toBe(2);
  });

  it("with no neutral card scripted the engine records the same loss itself", () => {
    const first = play(table(unscripted), COMPLETED_1, unscripted);
    const { state } = endTurn(doomDealt(first.state), unscripted);
    expect(state.outcome).toEqual(lossTo(state));
    expect(ledgerMarks(state).lost).toBeUndefined();
    const inPhase = play(play(table(unscripted), COMPLETED_1, unscripted).state, COMPLETED_1, unscripted);
    expect(inPhase.state.outcome).toBeNull();
    expect(endTurn(inPhase.state, unscripted).state.outcome).toEqual(lossTo(inPhase.state));
  });
});

describe("hand-built: a remote coordinator", () => {
  it("threat past the target leaves the record untouched and ends nothing, in either phase", () => {
    const local = table();
    const remote: GameState = {
      ...local,
      pod: { ...podOf(local), coordinator: "remote", groupsInPodAtStart: 2, groupsInGameAtStart: 2 },
    };
    const a = play(remote, COMPLETED_1);
    const b = play(acked(a.state), COMPLETED_1);
    expect(emitted([...a.events, ...b.events]).map((e) => e.seq)).toEqual([1, 2]);
    expect(podOf(b.state).shared).toEqual(podOf(local).shared);
    expect(sharedScheme(b.state)?.finalPlayerPhase).toBe(false);
    const { state: waiting, events } = endTurn(doomDealt(acked(b.state)));
    expect(emitted(events).map((e) => e.seq)).toEqual([3]);
    // The villain phase waits at its next quiet point for the coordinator's answer (`PodState.awaiting`), then goes on.
    expect(podOf(waiting).awaiting).toBe(3);
    expect(waiting.step.phase).toBe("villain");
    const state = acked(waiting);
    expect(state.outcome).toBeNull();
    expect(state.round).toBe(2);
    expect(podOf(state).shared).toEqual(podOf(local).shared);
  });
});
