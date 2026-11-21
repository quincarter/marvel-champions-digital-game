/**
 * What travels on the room's pod channel in Epic Multiplayer (issue #882, docs/live-game-rooms.md section 10), as plain
 * data. The room relays `pod:event`, `pod:inbound` and `pod:state` untouched, so these shapes are the clients' own
 * agreement; they reuse the engine's `PodOutbound` / `PodInboundEvent` (the coordinator's own words) and add only the
 * link's housekeeping, which travels under sequence 0 (the engine numbers its events from 1, so 0 is never one of them).
 *
 * - table host to organizer, `pod:event`: `{ seq >= 1, event: PodOutboundEvent }`, or `{ seq: 0, event: PodSync }`;
 * - organizer to table host, `pod:inbound`: `{ seq >= 1, event: PodInboundEvent }`, or `{ seq: 0, event: PodSyncAck }`;
 * - organizer to everyone, `pod:state`: a `PodStateWire`.
 */
import type {
  GroupId,
  GroupStatus,
  PodCoordinatorState,
  PodInboundEvent,
  PodOutboundEvent,
  ReachableCard,
  SharedPodState,
} from "@mc/engine";

/** The link's own sequence number on the pod channel. */
export const POD_LINK_SEQ = 0;

/**
 * A table host says where it stands (on every welcome, on a new organizer epoch and at the start of its game): its
 * group, how many inbound events its engine has applied, and the shared record as its engine built it (the organizer
 * starts the coordinator from the first one it hears, since the record is fixed at setup from the whole game's counts).
 */
export interface PodSync {
  readonly type: "podSync";
  readonly inboundSeq: number;
  readonly shared: SharedPodState | null;
}

/** The organizer's answer to a sync: how many of the table's events it has applied. It then re-sends what the table missed. */
export interface PodSyncAck {
  readonly kind: "podSyncAck";
  readonly received: number;
}

export const isPodSync = (value: unknown): value is PodSync =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "podSync" &&
  Number.isInteger((value as { inboundSeq?: unknown }).inboundSeq) &&
  ((value as { inboundSeq: number }).inboundSeq as number) >= 0;

export const isPodSyncAck = (value: unknown): value is PodSyncAck =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === "podSyncAck" &&
  Number.isInteger((value as { received?: unknown }).received);

/** An engine event as a message carries it: an object with a string tag, else not one (the room relays anything). */
export const isTaggedEvent = (value: unknown, tag: "type" | "kind"): boolean =>
  typeof value === "object" && value !== null && typeof (value as Record<string, unknown>)[tag] === "string";

/** One group as the organizer broadcasts it. */
export interface PodGroupWire {
  readonly groupId: GroupId;
  readonly podId: string;
  readonly players: number;
  readonly received: number;
  readonly status: GroupStatus;
  readonly reachable: readonly ReachableCard[];
  readonly dropped: boolean;
}

/**
 * The organizer's `pod:state`: the shared record, the outcome and every group. `epoch` is new for each coordinator the
 * organizer starts (a reload rebuilds it from its log), so a table host that sees it change syncs again.
 */
export interface PodStateWire {
  readonly epoch: number;
  readonly shared: SharedPodState;
  readonly outcome: PodCoordinatorState["outcome"];
  readonly groups: readonly PodGroupWire[];
}

export function podStateWireOf(state: PodCoordinatorState, epoch: number): PodStateWire {
  return {
    epoch,
    shared: state.shared,
    outcome: state.outcome,
    groups: state.groups.map((group) => ({
      groupId: group.groupId,
      podId: group.podId,
      players: group.players,
      received: group.received,
      status: group.status,
      reachable: group.reachable,
      dropped: group.dropped,
    })),
  };
}

/** A `pod:state` as read off the wire (anything), or null when it is not one. */
export function readPodState(value: unknown): PodStateWire | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<PodStateWire>;
  if (typeof v.epoch !== "number" || typeof v.shared !== "object" || v.shared === null) return null;
  if (v.outcome !== "playing" && v.outcome !== "won" && v.outcome !== "lost") return null;
  if (!Array.isArray(v.groups)) return null;
  const groups = v.groups.filter(
    (g): g is PodGroupWire =>
      typeof g === "object" &&
      g !== null &&
      typeof g.groupId === "string" &&
      typeof g.podId === "string" &&
      typeof g.status === "object" &&
      g.status !== null &&
      Array.isArray(g.reachable),
  );
  return { epoch: v.epoch, shared: v.shared, outcome: v.outcome, groups };
}

export type { PodInboundEvent, PodOutboundEvent };
