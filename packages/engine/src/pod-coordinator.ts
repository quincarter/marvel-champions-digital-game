/**
 * The pod coordinator of Epic Multiplayer Mode (docs/epic-multiplayer-plan.md §2 option B, §4 item 1; issue #882): a
 * pure, deterministic reducer over the outbound events of every group of the game, with its own log.
 *
 * MC55 p. 11 and 55028b: one Loki, God of Lies and one Worlds Collide per game; pods only scope "your pod" abilities
 * (MC55 pp. 4, 13). So the coordinator is game-wide: it owns the one shared record (the shared villain's hit points and
 * flip, the shared scheme's threat and target, `SharedPodState`) and the game's outcome, and knows which pod each group
 * is in only to route the "your pod" events (a synergy grant, an attack on The Mangog, a thwart of Door Between Worlds).
 *
 * Each group is its own engine with its own log. What a group tells the coordinator (`PodOutboundEvent`) is numbered
 * by the group; the coordinator applies each number once (a re-sent event is a duplicate, a gap is refused so the group
 * re-sends from the first missing one). What the coordinator tells a group (`PodInboundEvent`) is numbered per group
 * and kept, so a reconnecting group can be sent what it missed (`inboundSince`). The group applies an inbound event as
 * a `Command externalEvent`, which its own log records: a group replays alone, with no coordinator.
 *
 * Nothing here reads a `GameState`, draws a random number or names a card.
 */

import type { GroupId, InstanceId } from "./ids.js";
import {
  applySharedEvent,
  sharedLost,
  type GroupStatus,
  type PodInboundEvent,
  type PodOutbound,
  type ReachableCard,
  type RemotePower,
  type SharedPodState,
} from "./pod.js";

/** One group as the coordinator is set up with it. */
export interface PodCoordinatorGroupSetup {
  readonly groupId: GroupId;
  /** The pod the organizer put it in (MC55 p. 13). */
  readonly podId: string;
  /** Its players at the start of the scenario. */
  readonly players: number;
  /** Its status as setup left it (`groupStatusOf` of its first state). Absent: setup, round 0, not halted. */
  readonly status?: GroupStatus;
}

export interface PodCoordinatorSetup {
  /** Every group of the game, in the order the organizer listed them. */
  readonly groups: readonly PodCoordinatorGroupSetup[];
  /**
   * The shared record as setup made it: every group's engine builds the same one from the game's counts (Q3: Loki's
   * hit points and flip count every player in the game, Worlds Collide's target every group), so any group's
   * `pod.shared` at setup is it.
   */
  readonly shared: SharedPodState;
}

/** An inbound event as numbered for its group (`Command externalEvent.sequence`). */
export interface PodInbound {
  readonly sequence: number;
  readonly event: PodInboundEvent;
}

/** An inbound event addressed: what a host relays to the group's authority. */
export interface PodDelivery extends PodInbound {
  readonly groupId: GroupId;
}

export interface CoordinatorGroupState {
  readonly groupId: GroupId;
  readonly podId: string;
  readonly players: number;
  /** The last outbound number applied from this group (0: none yet). */
  readonly received: number;
  /** Every inbound event sent to this group, by sequence from 1. */
  readonly inbound: readonly PodInbound[];
  /** Its last reported status. A group begins in setup. */
  readonly status: GroupStatus;
  /** Its reachable cards as last reported (The Mangog, Door Between Worlds). */
  readonly reachable: readonly ReachableCard[];
  /**
   * The organizer marked it dropped (plan Q-C, default (b) pending the owner): it no longer holds up the stop rule.
   * Its numbers stay (Q2: the per group count is fixed at setup).
   */
  readonly dropped: boolean;
}

/** One entry of the coordinator's log, in the order applied. Replaying it rebuilds the state (`replayCoordinator`). */
export type CoordinatorLogEntry =
  | ({ readonly kind: "outbound"; readonly groupId: GroupId } & PodOutbound)
  | { readonly kind: "dropped"; readonly groupId: GroupId };

/** A remote power forwarded and not yet answered (`PodCoordinatorState.pending`). */
export interface PendingRemotePower {
  readonly fromGroupId: GroupId;
  readonly toGroupId: GroupId;
  readonly ref: InstanceId;
  readonly targetInstanceId: InstanceId;
  readonly power: RemotePower;
}

export interface PodCoordinatorState {
  readonly shared: SharedPodState;
  /** The game's outcome: every group wins or loses together (MC55 p. 21). */
  readonly outcome: "playing" | "won" | "lost";
  /**
   * Remote powers forwarded to their owning group and not yet answered there: refused back to their group if the owning
   * group drops (`markGroupDropped`). Absent when none.
   */
  readonly pending?: readonly PendingRemotePower[];
  readonly groups: readonly CoordinatorGroupState[];
  readonly log: readonly CoordinatorLogEntry[];
}

export type CoordinatorErrorCode = "unknown_group" | "out_of_order" | "invalid_setup";

export type CoordinatorResult =
  | {
      readonly ok: true;
      readonly state: PodCoordinatorState;
      /** New inbound events, in the order they were made. Empty for a duplicate. */
      readonly delivered: readonly PodDelivery[];
      /** The event was applied before (same group and number): nothing changed. */
      readonly duplicate: boolean;
    }
  | { readonly ok: false; readonly error: { readonly code: CoordinatorErrorCode; readonly message: string } };

const fail = (code: CoordinatorErrorCode, message: string): CoordinatorResult => ({
  ok: false,
  error: { code, message },
});

/** The coordinator at the start of the game. Throws on a malformed setup (a configuration bug, not a game event). */
export function createPodCoordinator(setup: PodCoordinatorSetup): PodCoordinatorState {
  const ids = setup.groups.map((group) => group.groupId);
  if (ids.length === 0) throw new Error("a pod coordinator needs at least one group");
  if (new Set(ids).size !== ids.length) throw new Error("a pod coordinator names each group once");
  for (const group of setup.groups) {
    if (!Number.isInteger(group.players) || group.players < 1 || group.players > 4)
      throw new Error(`group ${group.groupId} has ${group.players} players; a group is 1 to 4 (MC55 p. 13)`);
  }
  return {
    shared: setup.shared,
    outcome: "playing",
    groups: setup.groups.map((group) => ({
      groupId: group.groupId,
      podId: group.podId,
      players: group.players,
      received: 0,
      inbound: [],
      status: group.status ?? { phase: "setup", round: 0, halted: false },
      reachable: [],
      dropped: false,
    })),
    log: [],
  };
}

/** A group of the coordinator, or undefined. */
export const coordinatorGroup = (state: PodCoordinatorState, groupId: GroupId): CoordinatorGroupState | undefined =>
  state.groups.find((group) => group.groupId === groupId);

/**
 * The groups of `groupId`'s pod, it included, in setup order: what "your pod" means for it (Epic Multiplayer Reminder
 * card: groups that began the scenario in that pod (cf. RRG Per Player Icon p. 32)). Dropped groups stay listed.
 */
export const podmatesOf = (state: PodCoordinatorState, groupId: GroupId): readonly GroupId[] => {
  const podId = coordinatorGroup(state, groupId)?.podId;
  return podId === undefined ? [] : state.groups.filter((g) => g.podId === podId).map((g) => g.groupId);
};

/** The inbound events sent to `groupId` after `afterSequence`: what a reconnecting group's host re-sends. */
export const inboundSince = (
  state: PodCoordinatorState,
  groupId: GroupId,
  afterSequence: number,
): readonly PodInbound[] =>
  coordinatorGroup(state, groupId)?.inbound.filter((entry) => entry.sequence > afterSequence) ?? [];

/** Accumulates one step's changes: groups by id, and the deliveries in the order made. */
class Step {
  readonly groups: Map<GroupId, CoordinatorGroupState>;
  readonly delivered: PodDelivery[] = [];
  shared: SharedPodState;
  outcome: PodCoordinatorState["outcome"];
  pending: readonly PendingRemotePower[];

  constructor(readonly state: PodCoordinatorState) {
    this.groups = new Map(state.groups.map((group) => [group.groupId, group]));
    this.shared = state.shared;
    this.outcome = state.outcome;
    this.pending = state.pending ?? [];
  }

  update(groupId: GroupId, change: (group: CoordinatorGroupState) => CoordinatorGroupState): void {
    const group = this.groups.get(groupId);
    if (group) this.groups.set(groupId, change(group));
  }

  send(groupId: GroupId, event: PodInboundEvent): void {
    this.update(groupId, (group) => {
      const sequence = group.inbound.length + 1;
      this.delivered.push({ groupId, sequence, event });
      return { ...group, inbound: [...group.inbound, { sequence, event }] };
    });
  }

  /** To every group of the game, in setup order (Q5, Q6: the shared villain and scheme concern all of them). */
  broadcast(event: PodInboundEvent): void {
    for (const group of this.state.groups) this.send(group.groupId, event);
  }

  finish(entry: CoordinatorLogEntry): CoordinatorResult {
    return {
      ok: true,
      state: {
        shared: this.shared,
        outcome: this.outcome,
        ...(this.pending.length > 0 ? { pending: this.pending } : {}),
        groups: this.state.groups.map((group) => this.groups.get(group.groupId) ?? group),
        log: [...this.state.log, entry],
      },
      delivered: this.delivered,
      duplicate: false,
    };
  }
}

/** A group no longer playing for the stop rule: halted, its game over, or dropped. */
const finished = (group: CoordinatorGroupState): boolean =>
  group.dropped || group.status.halted || group.status.phase === "over";

/**
 * MC55 p. 21: "if Loki, God of Lies remains undefeated when all player phases in all groups end, all players in all
 * groups lose the game." Each group reports its halt once the shared scheme's completion has stopped it (at once in a
 * villain phase or in setup, at its player phase's end otherwise; M4, owner question 1 option A pending), so the loss
 * lands when the last group still playing halts.
 */
function settleLoss(step: Step): void {
  if (step.outcome !== "playing" || step.shared.status !== "schemeCompleted") return;
  if (![...step.groups.values()].every(finished)) return;
  step.shared = sharedLost(step.shared);
  step.outcome = "lost";
  step.broadcast({ kind: "sharedStateChanged", shared: step.shared });
  step.broadcast({ kind: "gameLost" });
}

/**
 * Applies one outbound event of `groupId`, numbered `seq`. A number already applied is a duplicate (no change, nothing
 * delivered); a number past the next one is `out_of_order`, so the group's host re-sends from the first missing.
 */
export function receiveOutbound(
  state: PodCoordinatorState,
  groupId: GroupId,
  outbound: PodOutbound,
): CoordinatorResult {
  const group = coordinatorGroup(state, groupId);
  if (!group) return fail("unknown_group", `${groupId} is not a group of this game`);
  if (outbound.seq <= group.received) return { ok: true, state, delivered: [], duplicate: true };
  if (outbound.seq !== group.received + 1)
    return fail("out_of_order", `${groupId} sent ${outbound.seq}; the next expected is ${group.received + 1}`);
  const { event } = outbound;
  if (event.groupId !== groupId) return fail("unknown_group", `${groupId} sent an event of ${event.groupId}`);

  const step = new Step(state);
  step.update(groupId, (g) => ({ ...g, received: outbound.seq }));
  const inPod = (other: GroupId): boolean => other !== groupId && podmatesOf(state, groupId).includes(other);

  switch (event.type) {
    case "sharedVillainDamaged":
    case "sharedSchemeThreatPlaced": {
      // After the outcome the record is final (the reducer leaves a won or lost record alone).
      const { shared, results } = applySharedEvent(step.shared, event);
      if (shared !== step.shared) {
        step.shared = shared;
        step.broadcast({ kind: "sharedStateChanged", shared });
      }
      for (const result of results) {
        if (result === "sharedVillainFlipped") step.broadcast({ kind: "sharedVillainFlipped" });
        else if (result === "sharedSchemeCompleted") step.broadcast({ kind: "stopAfterPhase" });
        else if (step.outcome === "playing") {
          // 55027b: "If Loki, God of Lies is defeated, all players in all groups win the game." (Q6.)
          step.outcome = "won";
          step.broadcast({ kind: "gameWon" });
        }
      }
      settleLoss(step);
      // Last, so the sender has heard everything its event brought about before it plays on (`PodState.awaiting`).
      step.send(groupId, { kind: "sharedAck", seq: outbound.seq });
      break;
    }
    case "podEffectRequested":
      // "Choose a group in your pod" (M2): only a group of the sender's pod receives it.
      if (inPod(event.toGroupId) && step.outcome === "playing")
        step.send(event.toGroupId, {
          kind: "podEffect",
          fromGroupId: groupId,
          sourceCardId: event.sourceCardId,
          abilityId: event.abilityId,
          block: event.block,
        });
      break;
    case "groupStatus":
      step.update(groupId, (g) => ({ ...g, status: event.status }));
      // An ended table refuses every inbound event (game_over), so it will never answer a power still pending on it.
      if (event.status.phase === "over") settlePendingOf(step, groupId, "that group is no longer playing");
      settleLoss(step);
      break;
    case "reachableCards":
      step.update(groupId, (g) => ({ ...g, reachable: event.cards }));
      // Every other group of the pod keeps a copy, so its remote power is checked before anything is paid there.
      for (const mate of podmatesOf(state, groupId))
        if (mate !== groupId) step.send(mate, { kind: "podReachable", groupId, cards: event.cards });
      break;
    case "remotePowerUsed": {
      // M6: another group's player may attack The Mangog and thwart Door Between Worlds "as if it were in their game
      // area", only from the same pod (55041, 55046). The coordinator refuses what the owning group's last report
      // already rules out; the owning group's engine judges the card itself when it arrives.
      const target = coordinatorGroup(state, event.toGroupId);
      const reported = target?.reachable.some(
        (card) => card.instanceId === event.targetInstanceId && card.by === event.power,
      );
      const refused =
        step.outcome !== "playing"
          ? "the game is over"
          : !target || !inPod(event.toGroupId)
            ? "that group is not in your pod"
            : target.dropped || target.status.phase === "over"
              ? "that group is no longer playing"
              : !reported
                ? "that card is no longer reachable from your pod"
                : null;
      if (refused === null) {
        step.pending = [
          ...step.pending,
          {
            fromGroupId: groupId,
            toGroupId: event.toGroupId,
            ref: event.ref,
            targetInstanceId: event.targetInstanceId,
            power: event.power,
          },
        ];
        step.send(event.toGroupId, {
          kind: "remotePower",
          fromGroupId: groupId,
          playerId: event.playerId,
          targetInstanceId: event.targetInstanceId,
          ref: event.ref,
          power: event.power,
          amount: event.amount,
          overkill: event.overkill,
          piercing: event.piercing,
        });
      } else
        step.send(groupId, {
          kind: "remotePowerResolved",
          fromGroupId: event.toGroupId,
          ref: event.ref,
          targetInstanceId: event.targetInstanceId,
          power: event.power,
          retaliate: 0,
          refused,
        });
      break;
    }
    case "remotePowerResolved": {
      // A ref is the sender's own instance id, so it is unique only per sending table: two groups may send the same ref
      // to one owning group. The answer settles the one entry its sender, receiver, ref, target and power all match, and
      // nothing is forwarded without one (an answer after the receiver dropped was already refused back to the sender).
      const index = step.pending.findIndex(
        (p) =>
          p.fromGroupId === event.toGroupId &&
          p.toGroupId === groupId &&
          p.ref === event.ref &&
          p.targetInstanceId === event.targetInstanceId &&
          p.power === event.power,
      );
      if (index < 0) break;
      step.pending = step.pending.filter((_, i) => i !== index);
      if (inPod(event.toGroupId))
        step.send(event.toGroupId, {
          kind: "remotePowerResolved",
          fromGroupId: groupId,
          ref: event.ref,
          targetInstanceId: event.targetInstanceId,
          power: event.power,
          retaliate: event.retaliate,
          ...(event.refused === undefined ? {} : { refused: event.refused }),
          ...(event.lost ? { lost: true as const } : {}),
        });
      break;
    }
    case "overkillExcess":
      if (inPod(event.toGroupId) && step.outcome === "playing")
        step.send(event.toGroupId, {
          kind: "overkillExcess",
          fromGroupId: groupId,
          ref: event.ref,
          amount: event.amount,
        });
      break;
  }
  return step.finish({ kind: "outbound", groupId, ...outbound });
}

/**
 * A group that will take no more inbound events (dropped, or its game over) leaves the pending list. Powers sent to it
 * will not be answered now: each is refused back to its own sender, so that group refunds it (not initiated). Powers it
 * sent are discarded, as it cannot receive their answers. A power already answered is no longer pending, so it is
 * never refunded twice; the group's events arrive in sequence order, so an answer it sent before ending is applied
 * first.
 */
function settlePendingOf(step: Step, groupId: GroupId, refused: string): void {
  for (const p of step.pending.filter((entry) => entry.toGroupId === groupId))
    step.send(p.fromGroupId, {
      kind: "remotePowerResolved",
      fromGroupId: groupId,
      ref: p.ref,
      targetInstanceId: p.targetInstanceId,
      power: p.power,
      retaliate: 0,
      refused,
    });
  step.pending = step.pending.filter((entry) => entry.toGroupId !== groupId && entry.fromGroupId !== groupId);
}

/**
 * The organizer marks a group dropped (plan Q-C; pending the owner, default (b): the game goes on without it). A
 * dropped group no longer holds up the stop rule; its threat on the shared scheme stays and the per group counts do
 * not change (Q2).
 */
export function markGroupDropped(state: PodCoordinatorState, groupId: GroupId): CoordinatorResult {
  const group = coordinatorGroup(state, groupId);
  if (!group) return fail("unknown_group", `${groupId} is not a group of this game`);
  if (group.dropped) return { ok: true, state, delivered: [], duplicate: true };
  const step = new Step(state);
  step.update(groupId, (g) => ({ ...g, dropped: true }));
  settlePendingOf(step, groupId, "that group has dropped");
  settleLoss(step);
  return step.finish({ kind: "dropped", groupId });
}

/**
 * The coordinator rebuilt from its setup and log: the consistency check of plan §2 ("replay a pod by replaying the
 * coordinator log, which regenerates the inbound events each group must have received").
 */
export function replayCoordinator(
  setup: PodCoordinatorSetup,
  log: readonly CoordinatorLogEntry[],
): PodCoordinatorState {
  let state = createPodCoordinator(setup);
  for (const entry of log) {
    const result =
      entry.kind === "dropped"
        ? markGroupDropped(state, entry.groupId)
        : receiveOutbound(state, entry.groupId, { seq: entry.seq, event: entry.event });
    if (!result.ok) throw new Error(`coordinator log entry ${state.log.length} refused: ${result.error.message}`);
    state = result.state;
  }
  return state;
}
