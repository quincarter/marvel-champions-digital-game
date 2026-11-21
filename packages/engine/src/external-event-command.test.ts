import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { isAuthorityCommand } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import { groupId, playerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { podOf, type PodInboundEvent } from "./pod.js";
import { inboundCommand } from "./pod-commands.js";
import type { GameState } from "./state.js";
import {
  LEDGER,
  podEvent,
  scriptedDeps,
  SHARED_SCHEME,
  SHARED_VILLAIN,
  sharedEvent,
  singleGroup,
} from "./testing/pod.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, playFree } from "./testing/wave3.js";

/**
 * `Command externalEvent` and `Command podRelease` at the engine level (docs/phase7-wave9.md §3.68; Epic Multiplayer,
 * docs/epic-multiplayer-plan.md §4 item 1). Every state is a one-player table made a remote group of a two-group pod by
 * hand, as the remote cases of `shared-villain-event.test.ts` are.
 */
const P1 = playerId("p1");
const ONE = podEvent("shatter-one", [sharedEvent("villainDamaged", 3)]);
/** Two shared events in one command. */
const TWO = podEvent("shatter-two", [sharedEvent("villainDamaged", 3), sharedEvent("villainDamaged", 4)]);
const SCRIPTS = [ONE, TWO];
const DEPS: EngineDeps = scriptedDeps(...SCRIPTS);

function local(): GameState {
  const start = gameAtFirstTurn({
    players: 1,
    cards: [SHARED_VILLAIN, SHARED_SCHEME, LEDGER, ...SCRIPTS.map((s) => s.card)],
    deps: DEPS,
    deck: SCRIPTS.flatMap((s) => copiesOf(s.card.id, 3)),
    encounter: [LEDGER.id, ...copiesOf(TREACHERY.id, 20)],
    pod: singleGroup(1),
  });
  return encounterCardInVillainArea(start, LEDGER.id).state;
}

const remote = (): GameState => {
  const state = local();
  return {
    ...state,
    pod: {
      ...podOf(state),
      coordinator: "remote",
      groupsInPodAtStart: 2,
      groupsInGameAtStart: 2,
      groupIdsInPod: [groupId("g1"), groupId("g2")],
    },
  };
};

const ok = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, DEPS);
  if (!result.ok) throw new Error(`${command.type}: ${result.error.code}: ${result.error.message}`);
  return result.state;
};
const code = (state: GameState, command: Command): string | null => {
  const result = applyCommand(state, command, DEPS);
  return result.ok ? null : result.error.code;
};
const inbound = (state: GameState, event: PodInboundEvent): GameState =>
  ok(state, inboundCommand(state, podOf(state).inboundSeq + 1, event));

describe("who may send it", () => {
  it("is an authority command, never offered to a seat, and refused without a remote coordinator", () => {
    const state = remote();
    const command = inboundCommand(state, 1, { kind: "gameWon" });
    expect(isAuthorityCommand(command)).toBe(true);
    expect(isAuthorityCommand({ type: "podRelease", playerId: P1 })).toBe(true);
    expect(isAuthorityCommand({ type: "endTurn", playerId: P1 })).toBe(false);
    const offered = legalActions(state, P1, DEPS);
    const types = "legal" in offered ? offered.legal.map((a) => (a as { command?: Command }).command?.type) : [];
    expect(types).not.toContain("externalEvent");
    expect(types).not.toContain("podRelease");
    expect(code(local(), inboundCommand(local(), 1, { kind: "gameWon" }))).toBe("no_remote_coordinator");
    expect(code(local(), { type: "podRelease", playerId: P1 })).toBe("no_remote_coordinator");
  });

  it("tells a re-send (already applied) from a gap (out of order)", () => {
    const state = inbound(remote(), { kind: "sharedAck", seq: 0 });
    expect(code(state, inboundCommand(state, 1, { kind: "gameWon" }))).toBe("external_event_already_applied");
    expect(code(state, inboundCommand(state, 3, { kind: "gameWon" }))).toBe("external_event_out_of_order");
    expect(code(state, inboundCommand(state, 2, { kind: "gameWon" }))).toBeNull();
  });
});

describe("waiting for the coordinator's answer (PodState.awaiting)", () => {
  it("two shared events in one command: an ack for the first does not release the group, the second's does", () => {
    const played = playFree(remote(), DEPS, TWO.card.id);
    let state = played.state;
    expect(podOf(state)).toMatchObject({ outboundSeq: 2, awaiting: 2 });
    expect(code(state, { type: "endTurn", playerId: P1 })).toBe("pod_waiting");
    state = inbound(state, { kind: "sharedAck", seq: 1 });
    expect(podOf(state).awaiting).toBe(2);
    expect(code(state, { type: "endTurn", playerId: P1 })).toBe("pod_waiting");
    state = inbound(state, { kind: "sharedAck", seq: 2 });
    expect(podOf(state).awaiting).toBeUndefined();
    expect(code(state, { type: "endTurn", playerId: P1 })).toBeNull();
  });

  it("the authority may release a wait for a coordinator that is gone; a late ack then changes nothing", () => {
    const waiting = playFree(remote(), DEPS, ONE.card.id).state;
    expect(code(remote(), { type: "podRelease", playerId: P1 })).toBe("no_valid_target");
    const released = ok(waiting, { type: "podRelease", playerId: P1 });
    expect(podOf(released).awaiting).toBeUndefined();
    expect(code(released, { type: "endTurn", playerId: P1 })).toBeNull();
    const late = inbound(released, { kind: "sharedAck", seq: 1 });
    expect(podOf(late).awaiting).toBeUndefined();
  });
});

describe("applied at the next quiet point (MC55 p. 20; M3)", () => {
  it("accepted during a villain-phase prompt, waits there, and stops the group once the prompt is answered (M4)", () => {
    let state = ok(remote(), { type: "endTurn", playerId: P1 });
    const choice = state.pendingChoice;
    expect(choice, "the villain phase asks something").toBeTruthy();
    state = inbound(state, { kind: "stopAfterPhase" });
    expect(state.pendingChoice?.choiceId).toBe(choice!.choiceId);
    expect(podOf(state).pendingInbound).toEqual([{ kind: "stopAfterPhase" }]);
    for (let guard = 0; state.pendingChoice && guard < 50; guard++) {
      const open = state.pendingChoice;
      state = ok(state, {
        type: "resolveChoice",
        playerId: open.playerId,
        choiceId: open.choiceId,
        selectedOptionIds: open.options.slice(0, open.minSelections).map((o) => o.optionId),
      });
    }
    expect(podOf(state)).toMatchObject({ halted: true });
    expect(podOf(state).pendingInbound).toBeUndefined();
    expect(state.step.phase).toBe("villain");
    expect(code(state, { type: "endTurn", playerId: P1 })).toBe("pod_halted");
  });
});

describe("bookkeeping takes no draw (docs/phase7-wave9.md §3.69)", () => {
  it("sharedStateChanged, sharedAck, gameWon and gameLost leave the rng where it was", () => {
    const start = remote();
    const shared = { ...podOf(start).shared!, villainDamage: 5 };
    for (const event of [
      { kind: "sharedStateChanged", shared },
      { kind: "sharedAck", seq: 1 },
      { kind: "gameWon" },
      { kind: "gameLost" },
    ] as const) {
      const after = inbound(start, event);
      expect(after.rng, event.kind).toEqual(start.rng);
    }
  });

  it("a log with inbound events replays alone", () => {
    let session = startSession(remote());
    for (const event of [{ kind: "sharedAck", seq: 0 }, { kind: "gameLost" }] as const) {
      const state = session.state;
      const command = inboundCommand(state, podOf(state).inboundSeq + 1, event);
      const result = applyCommand(state, command, DEPS);
      if (!result.ok) throw new Error(result.error.message);
      session = { state: result.state, log: { ...session.log, commands: [...session.log.commands, command] } };
    }
    const replayed = replay(session.log, DEPS);
    expect(replayed.ok && replayed.state).toEqual(session.state);
    expect(session.state.outcome).toMatchObject({ result: "loss" });
  });
});
