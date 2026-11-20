/**
 * A table host's side of the pod channel (Epic Multiplayer, issue #882; docs/live-game-rooms.md section 10), as plain
 * logic with no socket in it: the engine tells it what its group emitted (`outbound`), the room tells it what the
 * organizer's coordinator answered (`onMessage`), and it turns those into `pod:event` messages and into inbound events
 * for the engine to apply as `externalEvent` commands, in order and once each.
 *
 * - Outbound events are numbered by the engine (`PodOutbound.seq`, from 1) and kept until the coordinator says it has
 *   them: the coordinator applies each number once, so re-sending is always safe. After a (re)connect, and whenever the
 *   organizer's `pod:state` shows a new epoch (it restarted), the link sends a `PodSync` first and holds its events
 *   until the `PodSyncAck` says which ones the coordinator already has.
 * - Inbound events are numbered by the coordinator per group. One already forwarded to the engine is dropped; the next
 *   is forwarded; one past the next is held and a sync asks the organizer to send the gap again.
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

export interface PodLinkOptions {
  /** This link's table (the group's id). */
  readonly table: string;
  /** Puts a message on the socket (or the loopback); false when it could not be sent. */
  readonly send: (message: ClientMessage) => boolean;
  /** Hands an inbound event to the engine, as `Command externalEvent` with this sequence. Called in order, once each. */
  readonly apply: (sequence: number, event: PodInboundEvent) => void;
  /** The organizer's latest shared state arrived (for the pod strip). */
  readonly onState?: (state: PodStateWire) => void;
}

/** What the engine says of its group when the game begins or resumes. */
export interface PodGameInfo {
  /** `PodState.inboundSeq`: inbound events the engine has already applied. */
  readonly inboundSeq: number;
  readonly shared: SharedPodState | null;
}

/** Confirmed events kept behind the coordinator's count, so one that restarted a little behind can be caught up. */
const KEPT_CONFIRMED = 64;

export class PodLink {
  readonly #options: PodLinkOptions;
  /** Events the coordinator has not confirmed, by sequence. */
  #outbox: PodOutbound[] = [];
  /** The highest outbound sequence ever queued (a re-announced game's events below it are not queued twice). */
  #queued = 0;
  /** Outbound sequences the coordinator has confirmed (`PodSyncAck.received`). */
  #received = 0;
  /** The highest outbound sequence sent on this connection. */
  #sentUpTo = 0;
  #connected = false;
  #synced = false;
  /** Inbound sequences forwarded to the engine. */
  #applied = 0;
  readonly #held = new Map<number, PodInboundEvent>();
  #game: PodGameInfo | null = null;
  #epoch: number | null = null;

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

  /** Inbound events forwarded to the engine so far. */
  get applied(): number {
    return this.#applied;
  }

  /** The game began, resumed or was posted again: tells the coordinator where this group stands. */
  game(info: PodGameInfo): void {
    this.#game = info;
    this.#applied = Math.max(this.#applied, info.inboundSeq);
    if (this.#connected) this.#sync();
  }

  /**
   * Events a command produced, and the engine's inbound count after it. `inboundSeq` is what the engine really applied.
   */
  outbound(events: readonly PodOutbound[], inboundSeq: number): void {
    for (const event of events) {
      if (event.seq <= this.#queued) continue;
      this.#queued = event.seq;
      this.#outbox.push(event);
    }
    if (this.#game) this.#game = { ...this.#game, inboundSeq };
    this.#applied = Math.max(this.#applied, inboundSeq);
    this.#flush();
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
    if (sequence <= this.#applied) return;
    if (sequence > this.#applied + 1) {
      // A gap: hold this one and ask for the ones before it.
      this.#held.set(sequence, event);
      if (this.#connected) this.#sync();
      return;
    }
    this.#forward(sequence, event);
    for (let next = this.#applied + 1; this.#held.has(next); next = this.#applied + 1) {
      const held = this.#held.get(next) as PodInboundEvent;
      this.#held.delete(next);
      this.#forward(next, held);
    }
    for (const key of [...this.#held.keys()]) if (key <= this.#applied) this.#held.delete(key);
  }

  #forward(sequence: number, event: PodInboundEvent): void {
    this.#applied = sequence;
    this.#options.apply(sequence, event);
  }

  /** The coordinator has `received` of our events; a window of confirmed ones stays for a coordinator that restarts a little behind. */
  #confirm(received: number): void {
    this.#received = Math.max(this.#received, received);
    this.#outbox = this.#outbox.filter((event) => event.seq > this.#received - KEPT_CONFIRMED);
  }

  #acked(received: number): void {
    // After a sync the count is the coordinator's own, even when lower than one confirmed before (it restarted).
    this.#received = received;
    this.#confirm(received);
    this.#synced = true;
    // Everything the coordinator lacks goes out again, from the first one it is missing.
    this.#sentUpTo = this.#received;
    this.#flush();
  }

  #sync(): void {
    const sync: PodSync = {
      type: "podSync",
      inboundSeq: this.#applied,
      shared: this.#game?.shared ?? null,
    };
    this.#synced = false;
    this.#post(POD_LINK_SEQ, sync);
  }

  #flush(): void {
    if (!this.#connected || !this.#synced) return;
    for (const event of this.#outbox) {
      if (event.seq <= this.#sentUpTo) continue;
      if (!this.#post(event.seq, event.event)) return;
      this.#sentUpTo = event.seq;
    }
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
