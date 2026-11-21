/**
 * A table host's side of the pod channel (Epic Multiplayer, issue #882; docs/live-game-rooms.md section 10), as plain
 * logic with no socket in it: the engine tells it what its group emitted (`outbound`), the room tells it what the
 * organizer's coordinator answered (`onMessage`), and it turns those into `pod:event` messages and into inbound events
 * for the engine to apply as `externalEvent` commands, in order and once each.
 *
 * - Outbound events are numbered by the engine (`PodOutbound.seq`, from 1) and kept until the coordinator says it has
 *   them: the coordinator applies each number once, so re-sending is always safe. After a (re)connect, and whenever the
 *   organizer's `pod:state` shows a new epoch (it restarted), the link sends a `PodSync` first and holds its events
 *   until the `PodSyncAck` says which ones the coordinator already has. A reloaded table host rebuilds its outbox from
 *   its saved log (`PodGameInfo.outbox`).
 * - Inbound events are numbered by the coordinator per group. One already forwarded to the engine is dropped; the next
 *   is forwarded; one past the next is held and a sync asks the organizer to send the gap again. A sync reports the
 *   engine's own count of applied events, never what was merely forwarded, so an event the engine did not accept is
 *   sent again.
 * - A wait that does not clear (an event the coordinator never confirms, a `sharedAck` that never comes, a hole in the
 *   outbox) is reported as stuck after `stuckMs`, for the table host to release (`Command podRelease`).
 *
 * The organizer's own table uses the same link with a loopback `send` (its coordinator is on its device).
 */
import { ROOM_PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from "@mc/sync-worker/room-protocol";
import type { PodInboundEvent, PodOutbound, SharedPodState } from "@mc/engine";
import {
  isPodSyncAck,
  isTaggedEvent,
  POD_LINK_SEQ,
  readPodState,
  type PodStateWire,
  type PodSync,
} from "./pod-wire.js";

/** How long a wait for the coordinator lasts before the table host is offered a release. */
export const POD_STUCK_MS = 20_000;

export interface PodLinkOptions {
  /** This link's table (the group's id). */
  readonly table: string;
  /** Puts a message on the socket (or the loopback); false when it could not be sent. */
  readonly send: (message: ClientMessage) => boolean;
  /** Hands an inbound event to the engine, as `Command externalEvent` with this sequence. Called in order, once each. */
  readonly apply: (sequence: number, event: PodInboundEvent) => void;
  /** The organizer's latest shared state arrived (for the pod strip). */
  readonly onState?: (state: PodStateWire) => void;
  /** The wait for the coordinator became stuck (true) or cleared (false). */
  readonly onStuck?: (stuck: boolean) => void;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly stuckMs?: number;
}

/** What the engine says of its group when the game begins or resumes. */
export interface PodGameInfo {
  /** `PodState.inboundSeq`: inbound events the engine has already applied. */
  readonly inboundSeq: number;
  readonly shared: SharedPodState | null;
  /** Every outbound event the saved log produced (a replay of it), so a reloaded host can re-send what is lacking. */
  readonly outbox?: readonly PodOutbound[];
  /** The engine is waiting for the coordinator's `sharedAck` (`PodState.awaiting`). */
  readonly awaiting?: boolean;
}

/** Confirmed events kept behind the coordinator's count, so one that restarted a little behind can be caught up. */
const KEPT_CONFIRMED = 64;

export class PodLink {
  readonly #options: PodLinkOptions;
  /** Events the coordinator has not confirmed, by sequence (and a window of confirmed ones). */
  #outbox: PodOutbound[] = [];
  /** The highest outbound sequence ever queued (a re-announced game's events below it are not queued twice). */
  #queued = 0;
  /** Outbound sequences the coordinator has confirmed (`PodSyncAck.received`). */
  #received = 0;
  /** The highest outbound sequence sent on this connection. */
  #sentUpTo = 0;
  #connected = false;
  #synced = false;
  /** The `received` an ack last flushed from on this sync: the same ack again changes nothing (and would loop). */
  #flushedFrom: number | null = null;
  /** The outbox has a hole between the coordinator's count and its oldest kept event: re-sending cannot fill it. */
  #gap = false;
  /** Inbound sequences the engine reports applied, and the ones forwarded to it. */
  #applied = 0;
  #forwarded = 0;
  readonly #held = new Map<number, PodInboundEvent>();
  #game: PodGameInfo | null = null;
  #epoch: number | null = null;
  #awaiting = false;
  #stuck = false;
  #stuckTimer: unknown = null;

  constructor(options: PodLinkOptions) {
    this.#options = options;
  }

  get table(): string {
    return this.#options.table;
  }

  /** Events the coordinator has not confirmed yet (tests, status). */
  get unacked(): number {
    return this.#outbox.filter((event) => event.seq > this.#received).length;
  }

  /** The engine's own count of applied inbound events: what a sync tells the organizer. */
  get applied(): number {
    return this.#applied;
  }

  /** The wait for the coordinator is not clearing (see `onStuck`). */
  get stuck(): boolean {
    return this.#stuck;
  }

  /** The game began, resumed or was posted again: tells the coordinator where this group stands. */
  game(info: PodGameInfo): void {
    this.#game = info;
    this.#applied = info.inboundSeq;
    this.#forwarded = info.inboundSeq;
    this.#awaiting = info.awaiting === true;
    this.#queue(info.outbox ?? []);
    this.#watch();
    if (this.#connected) this.#sync();
  }

  /**
   * Events a command produced, the engine's inbound count after it (what it really applied) and whether it now waits
   * for the coordinator's `sharedAck`.
   */
  outbound(events: readonly PodOutbound[], inboundSeq: number, awaiting = false): void {
    this.#queue(events);
    if (this.#game) this.#game = { ...this.#game, inboundSeq };
    this.#applied = inboundSeq;
    this.#forwarded = Math.max(this.#forwarded, inboundSeq);
    this.#awaiting = awaiting;
    this.#flush();
    this.#watch();
  }

  #queue(events: readonly PodOutbound[]): void {
    for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
      if (event.seq <= this.#queued) continue;
      this.#queued = event.seq;
      this.#outbox.push(event);
    }
  }

  /**
   * Dev jumps only: queues an outbound event as if the engine had emitted it, numbered after the last one. The engine does
   * not know of it, so a real event it emits next takes the same number and is dropped as a duplicate: for an end to end
   * run that needs a shared event (damage to Loki) without playing a whole game to it.
   */
  injectOutbound(event: PodOutbound["event"]): void {
    this.outbound([{ seq: this.#queued + 1, event }], this.#applied, this.#awaiting);
  }

  /** The room welcomed this socket (again): sync, then the events the coordinator lacks. */
  onWelcome(): void {
    this.#connected = true;
    this.#synced = false;
    this.#sync();
  }

  onDisconnected(): void {
    this.#connected = false;
    this.#synced = false;
  }

  /** The link is being dropped: stop the clock. */
  dispose(): void {
    this.#clearTimer();
  }

  /** A room message; false for one that is not on the pod channel. */
  onMessage(message: ServerMessage): boolean {
    if (message.ch !== "pod") return false;
    if (message.kind === "state") {
      const state = readPodState(message.state);
      if (!state) return true;
      const restarted = this.#epoch !== null && this.#epoch !== state.epoch;
      this.#epoch = state.epoch;
      // Each broadcast also says how many of this table's events the coordinator has applied.
      const mine = state.groups.find((g) => g.groupId === this.#options.table)?.received;
      if (mine !== undefined) this.#confirm(mine);
      this.#options.onState?.(state);
      // A new organizer epoch: its coordinator was rebuilt, so what it has of this table must be asked again.
      if (restarted && this.#connected) this.#sync();
      return true;
    }
    if (message.kind !== "inbound" || message.table !== this.#options.table) return true;
    if (message.seq === POD_LINK_SEQ) {
      if (isPodSyncAck(message.event)) this.#acked(message.event.received);
      return true;
    }
    if (!isTaggedEvent(message.event, "kind")) return true;
    this.#inbound(message.seq, message.event as PodInboundEvent);
    return true;
  }

  #inbound(sequence: number, event: PodInboundEvent): void {
    if (sequence <= this.#forwarded) return;
    if (sequence > this.#forwarded + 1) {
      // A gap: hold this one and ask for the ones before it.
      this.#held.set(sequence, event);
      if (this.#connected) this.#sync();
      return;
    }
    this.#forward(sequence, event);
    for (let next = this.#forwarded + 1; this.#held.has(next); next = this.#forwarded + 1) {
      const held = this.#held.get(next) as PodInboundEvent;
      this.#held.delete(next);
      this.#forward(next, held);
    }
    for (const key of [...this.#held.keys()]) if (key <= this.#forwarded) this.#held.delete(key);
  }

  #forward(sequence: number, event: PodInboundEvent): void {
    // Forwarded, not yet applied: the engine's count (reported with each command) says when it has.
    this.#forwarded = sequence;
    this.#options.apply(sequence, event);
  }

  /** The coordinator has `received` of our events; a window of confirmed ones stays for a coordinator that restarts a little behind. */
  #confirm(received: number): void {
    this.#received = Math.max(this.#received, received);
    this.#outbox = this.#outbox.filter((event) => event.seq > this.#received - KEPT_CONFIRMED);
    this.#gap = false;
    this.#watch();
  }

  #acked(received: number): void {
    // The same ack again (the coordinator refused what was just sent from there): nothing new, and answering it would loop.
    if (this.#synced && this.#flushedFrom === received) return;
    // After a sync the count is the coordinator's own, even when lower than one confirmed before (it restarted).
    this.#received = received;
    this.#confirm(received);
    this.#synced = true;
    this.#flushedFrom = received;
    // A hole between what the coordinator has and the oldest event kept cannot be filled by re-sending.
    const first = this.#outbox.find((event) => event.seq > received);
    this.#gap = first !== undefined && first.seq !== received + 1;
    if (this.#gap) {
      this.#watch();
      return;
    }
    // Everything the coordinator lacks goes out again, from the first one it is missing.
    this.#sentUpTo = this.#received;
    this.#flush();
    this.#watch();
  }

  #sync(): void {
    const sync: PodSync = {
      type: "podSync",
      // The engine's own count, not what was forwarded: an event it never accepted is sent again.
      inboundSeq: this.#applied,
      shared: this.#game?.shared ?? null,
    };
    this.#forwarded = this.#applied;
    this.#synced = false;
    this.#flushedFrom = null;
    this.#post(POD_LINK_SEQ, sync);
  }

  #flush(): void {
    if (!this.#connected || !this.#synced || this.#gap) return;
    for (const event of this.#outbox) {
      if (event.seq <= this.#sentUpTo) continue;
      if (!this.#post(event.seq, event.event)) return;
      this.#sentUpTo = event.seq;
    }
  }

  /** Starts or stops the clock on a wait for the coordinator. */
  #watch(): void {
    const waiting = this.#awaiting || this.#gap || this.unacked > 0;
    if (!waiting) {
      this.#clearTimer();
      this.#setStuck(false);
      return;
    }
    if (this.#stuck || this.#stuckTimer !== null || !this.#options.setTimer) return;
    this.#stuckTimer = this.#options.setTimer(() => {
      this.#stuckTimer = null;
      this.#setStuck(true);
    }, this.#options.stuckMs ?? POD_STUCK_MS);
  }

  #clearTimer(): void {
    if (this.#stuckTimer === null) return;
    this.#options.clearTimer?.(this.#stuckTimer);
    this.#stuckTimer = null;
  }

  #setStuck(stuck: boolean): void {
    if (this.#stuck === stuck) return;
    this.#stuck = stuck;
    this.#options.onStuck?.(stuck);
  }

  #post(seq: number, event: unknown): boolean {
    return this.#options.send({
      v: ROOM_PROTOCOL_VERSION,
      ch: "pod",
      kind: "event",
      table: this.#options.table,
      seq,
      event,
    });
  }
}
