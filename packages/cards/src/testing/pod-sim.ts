import {
  createGame,
  createPodCoordinator,
  groupStatusOf,
  inboundCommand,
  podOutboundOf,
  receiveOutbound,
  replay,
  replayCoordinator,
  sessionApply,
  startSession,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameSession,
  type GameSetupConfig,
  type GameState,
  type GroupId,
  type PodCoordinatorSetup,
  type PodCoordinatorState,
  type PodInbound,
  type SharedPodState,
} from "@mc/engine";
import { driverCommand, driverMemory, type DriverMemory } from "./driver.js";
import type { Picker } from "./harness.js";

/**
 * Simulated pods (docs/epic-multiplayer-plan.md §4 item 2): several headless engines, one per group, each with its own
 * session and log, joined by a pod coordinator in memory, as a host per group and the organizer's coordinator would be
 * joined over the network. No networking: every outbound event of a group goes straight to the coordinator, and every
 * inbound event waits in its group's inbox until the harness applies it as a `Command externalEvent` (which a group
 * accepts at any command boundary, a pending choice included; the engine itself makes it wait for what is resolving).
 *
 * Test surgery on a group (`edit`) starts a new session for it, as the single-table tests do; each session's log must
 * replay alone to its last state (`expectReplays`), which is the option B property: a group's log is a complete record
 * of its inputs, the coordinator's events included.
 */
export interface SimGroupSetup {
  readonly podId: string;
  readonly config: GameSetupConfig;
}

export interface SimGroup {
  readonly groupId: GroupId;
  session: GameSession;
  /** Sessions before surgery, each to be replayed. */
  readonly past: GameSession[];
  readonly memory: DriverMemory;
  /** Inbound events received and not yet applied, in sequence order. */
  readonly inbox: PodInbound[];
  /** Every event of every command applied to this group since the last `clearEvents`. */
  events: GameEvent[];
}

export class PodSim {
  readonly groups = new Map<GroupId, SimGroup>();
  readonly setup: PodCoordinatorSetup;
  coordinator: PodCoordinatorState;

  constructor(
    setups: readonly SimGroupSetup[],
    readonly deps: EngineDeps,
    /**
     * Setup-time staging of the shared record (a game that starts with Loki already damaged, or threat on Worlds
     * Collide), applied alike to every group's starting state and to the coordinator, so every log still replays.
     */
    stageShared?: (shared: SharedPodState) => SharedPodState,
  ) {
    const states = setups.map(({ config }) => {
      const created = createGame(config, deps);
      if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
      const pod = created.state.pod;
      return stageShared && pod?.shared
        ? { ...created.state, pod: { ...pod, shared: stageShared(pod.shared) } }
        : created.state;
    });
    for (const state of states) {
      const groupId = state.pod?.groupId;
      if (!groupId || state.pod?.coordinator !== "remote") throw new Error("every simulated group needs a remote pod");
      this.groups.set(groupId, {
        groupId,
        session: startSession(state),
        past: [],
        memory: driverMemory(),
        inbox: [],
        events: [],
      });
    }
    const shared = states[0]?.pod?.shared;
    if (!shared) throw new Error("the scenario has no shared record");
    this.setup = {
      groups: states.map((state, i) => ({
        groupId: state.pod!.groupId,
        podId: setups[i]!.podId,
        players: state.startingPlayerCount,
        status: groupStatusOf(state),
      })),
      shared,
    };
    this.coordinator = createPodCoordinator(this.setup);
  }

  group(groupId: GroupId): SimGroup {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`no group ${groupId}`);
    return group;
  }

  state(groupId: GroupId): GameState {
    return this.group(groupId).session.state;
  }

  /** Applies `command` to the group, or returns the error code. Outbound events reach the coordinator at once. */
  tryApply(groupId: GroupId, command: Command): string | null {
    const group = this.group(groupId);
    const result = sessionApply(group.session, command, this.deps);
    if (!result.ok) return `${result.error.code}: ${result.error.message}`;
    group.session = result.session;
    group.events.push(...result.events);
    for (const outbound of podOutboundOf(result.session.state, result.events)) {
      const received = receiveOutbound(this.coordinator, groupId, outbound);
      if (!received.ok) throw new Error(`coordinator refused ${groupId} #${outbound.seq}: ${received.error.message}`);
      this.coordinator = received.state;
      for (const delivery of received.delivered) this.group(delivery.groupId).inbox.push(delivery);
    }
    return null;
  }

  /** `tryApply` that throws on a refusal, then delivers what the coordinator sent (`pump`). */
  apply(groupId: GroupId, command: Command): void {
    const refused = this.tryApply(groupId, command);
    if (refused) throw new Error(`${groupId} refused ${command.type}: ${refused}`);
    this.pump();
  }

  /** Answers the group's pending choices with `pick` until none is open (inbound events delivered in between). */
  answer(groupId: GroupId, pick: Picker): void {
    for (let guard = 0; ; guard++) {
      const state = this.state(groupId);
      const choice = state.pendingChoice;
      if (!choice || state.outcome) return;
      if (guard > 400) throw new Error(`${groupId}: choices did not settle (${choice.prompt.kind})`);
      this.apply(groupId, {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(state),
      });
    }
  }

  /** Applies a command and answers what it opens with `pick`. */
  act(groupId: GroupId, command: Command, pick: Picker): void {
    this.apply(groupId, command);
    this.answer(groupId, pick);
  }

  /**
   * Every inbox applied in turn as `externalEvent` commands, until nothing is left (applying one may make more). A
   * group whose game has ended drops the rest: there is nothing left to tell it.
   */
  pump(): void {
    for (let guard = 0; ; guard++) {
      if (guard > 10_000) throw new Error("inbound events did not settle");
      const group = [...this.groups.values()].find((g) => g.inbox.length > 0);
      if (!group) {
        // The in-memory coordinator answers every shared event at once: a group still waiting means a lost answer.
        // (An answer still queued behind an open choice is fine: it applies once that choice is answered.)
        const waiting = [...this.groups.values()].find((g) => {
          const pod = g.session.state.pod;
          return pod?.awaiting !== undefined && !pod.pendingInbound?.some((e) => e.kind === "sharedAck");
        });
        if (waiting && !waiting.session.state.outcome)
          throw new Error(`${waiting.groupId} still waits for the coordinator after every inbound event was applied`);
        return;
      }
      const next = group.inbox.shift()!;
      if (group.session.state.outcome) {
        group.inbox.length = 0;
        continue;
      }
      const refused = this.tryApply(group.groupId, inboundCommand(group.session.state, next.sequence, next.event));
      if (refused) throw new Error(`${group.groupId} refused inbound #${next.sequence} ${next.event.kind}: ${refused}`);
    }
  }

  /** Whether the driver has something to do for the group: a choice, or a player turn; not once halted or over. */
  playable(groupId: GroupId): boolean {
    const state = this.state(groupId);
    if (state.outcome) return false;
    if (state.pendingChoice) return true;
    return !state.pod?.halted && state.step.phase === "player" && state.step.kind === "turn";
  }

  /** One greedy-driver command for the group (testing/driver.ts, which knows no card names). */
  step(groupId: GroupId): void {
    const group = this.group(groupId);
    this.apply(groupId, driverCommand(group.session.state, this.deps, group.memory));
  }

  /**
   * Round robin over the groups, one driver command each, until `until` holds, no group can play, or `maxCommands`.
   * Returns the number of commands issued.
   */
  run(options: { readonly maxCommands?: number; readonly until?: (sim: PodSim) => boolean } = {}): number {
    const max = options.maxCommands ?? 20_000;
    let issued = 0;
    while (issued < max && !options.until?.(this)) {
      const playable = [...this.groups.keys()].filter((id) => this.playable(id));
      if (playable.length === 0) break;
      for (const id of playable) {
        if (!this.playable(id) || options.until?.(this)) continue;
        this.step(id);
        issued++;
      }
    }
    return issued;
  }

  /** Test surgery on one group: a new session from the changed state, the old one kept for `expectReplays`. */
  edit(groupId: GroupId, change: (state: GameState) => GameState): void {
    const group = this.group(groupId);
    group.past.push(group.session);
    group.session = startSession(change(group.session.state));
  }

  clearEvents(): void {
    for (const group of this.groups.values()) group.events = [];
  }

  /**
   * The option B property: every session of every group replays alone from its own log (inbound events included) to
   * its state, and the coordinator's log replays to the coordinator. Returns the first mismatch, or null.
   */
  replayFault(): string | null {
    for (const group of this.groups.values()) {
      for (const session of [...group.past, group.session]) {
        const replayed = replay(session.log, this.deps);
        if (!replayed.ok)
          return `${group.groupId}: command ${replayed.commandIndex} refused: ${replayed.error.message}`;
        if (JSON.stringify(replayed.state) !== JSON.stringify(session.state))
          return `${group.groupId}: the log replays to a different state`;
      }
    }
    if (JSON.stringify(replayCoordinator(this.setup, this.coordinator.log)) !== JSON.stringify(this.coordinator))
      return "the coordinator's log replays to a different state";
    return null;
  }
}
