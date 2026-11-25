/** `PodLink` sync retry and outbox gap handling (Epic Multiplayer, issue #882), with injectable timers and a plain `send`. */
import type { PodOutbound } from "@mc/engine";
import { groupId } from "@mc/engine";
import type { ClientMessage, ServerMessage } from "@mc/sync-worker/room-protocol";
import { describe, expect, it } from "vitest";
import { POD_LINK_SEQ } from "./pod-wire.js";
import { PodLink, POD_RECONCILE_MS, POD_SYNC_RETRY_MAX_MS, POD_SYNC_RETRY_MS } from "./pod-link.js";

const event = (seq: number): PodOutbound =>
  ({ seq, event: { type: "sharedVillainDamaged", groupId: groupId("t1"), amount: seq } }) as unknown as PodOutbound;

function setup(online = true) {
  const sent: ClientMessage[] = [];
  const timers = new Map<number, { run: () => void; ms: number }>();
  let next = 1;
  let accept = online;
  const link = new PodLink({
    table: "t1",
    send: (m) => {
      if (accept) sent.push(m);
      return accept;
    },
    apply: () => {},
    setTimer: (run, ms) => {
      timers.set(next, { run, ms });
      return next++;
    },
    clearTimer: (h) => void timers.delete(h as number),
  });
  const syncs = () => sent.filter((m) => m.ch === "pod" && m.kind === "event" && m.seq === POD_LINK_SEQ).length;
  const events = () => sent.filter((m) => m.ch === "pod" && m.kind === "event" && m.seq !== POD_LINK_SEQ);
  /** Fires the armed sync retry timer (its delay is within the backoff range; the stuck clock is 20 s, so tell by order). */
  const fireRetry = () => {
    for (const [h, t] of [...timers]) {
      if (t.ms !== 20_000 && t.ms !== POD_RECONCILE_MS) {
        timers.delete(h);
        t.run();
        return t.ms;
      }
    }
    return null;
  };
  const ack = (received: number) =>
    link.onMessage({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t1",
      seq: POD_LINK_SEQ,
      event: { kind: "podSyncAck", received },
    } as unknown as ServerMessage);
  const state = (received: number) =>
    link.onMessage({
      v: 1,
      ch: "pod",
      kind: "state",
      state: {
        epoch: 1,
        shared: { villainDamage: 0 },
        outcome: "playing",
        groups: [{ groupId: "t1", podId: "p", players: 1, received, status: {}, reachable: [], dropped: false }],
      },
    } as unknown as ServerMessage);
  return { link, sent, timers, syncs, events, fireRetry, ack, state, setAccept: (v: boolean) => (accept = v) };
}

describe("PodLink sync retry", () => {
  it("retries a dropped initial sync with doubling backoff, then flushes a later event without a reconnect", () => {
    const t = setup(false);
    t.link.game({ inboundSeq: 0, shared: null });
    t.link.onWelcome();
    expect(t.syncs()).toBe(0);
    t.setAccept(true);
    t.link.outbound([event(1)], 0);
    // Not synced: the event waits.
    expect(t.events()).toHaveLength(0);
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS);
    expect(t.syncs()).toBe(1);
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS * 2);
    expect(t.syncs()).toBe(2);
    t.ack(0);
    expect(t.events()).toHaveLength(1);
    // Acknowledged and confirmed: no more retries.
    t.state(1);
    expect(t.fireRetry()).toBeNull();
    expect(t.syncs()).toBe(2);
    // A later event goes straight out.
    t.link.outbound([event(2)], 0);
    expect(t.events()).toHaveLength(2);
  });

  it("caps the backoff and stops on disconnect and dispose", () => {
    const t = setup();
    t.link.game({ inboundSeq: 0, shared: null });
    t.link.onWelcome();
    let ms = 0;
    for (let i = 0; i < 10; i++) ms = t.fireRetry() ?? ms;
    expect(ms).toBe(POD_SYNC_RETRY_MAX_MS);
    t.link.onDisconnected();
    expect(t.fireRetry()).toBeNull();
    t.link.onWelcome();
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS);
    t.link.dispose();
    expect(t.fireRetry()).toBeNull();
  });
});

describe("PodLink ack-progress retry", () => {
  const refused = (reason: string) => ({ v: 1, ch: "room", kind: "refused", reason }) as unknown as ServerMessage;

  it("re-sends a sent but unconfirmed event with backoff until confirmed, with no reconnect", () => {
    const t = setup();
    t.link.game({ inboundSeq: 0, shared: null });
    t.link.onWelcome();
    t.ack(0);
    t.link.outbound([event(1)], 0);
    expect(t.events()).toHaveLength(1);
    // The room dropped it: no confirmation comes. First wait, then the event is sent again.
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS);
    expect(t.events()).toHaveLength(2);
    expect(t.syncs()).toBe(1);
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS * 2);
    expect(t.events()).toHaveLength(3);
    // The coordinator confirms: the clock stops.
    t.state(1);
    expect(t.fireRetry()).toBeNull();
    expect(t.events()).toHaveLength(3);
  });

  it("caps the backoff, resets it on progress, and stops on disconnect and dispose", () => {
    const t = setup();
    t.link.game({ inboundSeq: 0, shared: null });
    t.link.onWelcome();
    t.ack(0);
    t.link.outbound([event(1), event(2)], 0);
    let ms = 0;
    for (let i = 0; i < 10; i++) ms = t.fireRetry() ?? ms;
    expect(ms).toBe(POD_SYNC_RETRY_MAX_MS);
    t.state(1);
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS);
    t.link.onDisconnected();
    expect(t.fireRetry()).toBeNull();
    t.link.onWelcome();
    t.ack(1);
    t.link.dispose();
    expect(t.fireRetry()).toBeNull();
  });

  it("keeps retrying after a rate-limit refusal of a pod event, without a new event or reconnect", () => {
    const t = setup();
    t.link.game({ inboundSeq: 0, shared: null });
    t.link.onWelcome();
    t.ack(0);
    t.link.outbound([event(1)], 0);
    expect(t.link.onMessage(refused("rate-limited"))).toBe(false);
    expect(t.link.onMessage(refused("no-such-participant"))).toBe(false);
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS);
    expect(t.events()).toHaveLength(2);
    t.state(1);
    expect(t.fireRetry()).toBeNull();
  });
});

describe("PodLink outbox gap", () => {
  it("keeps a gap through a state broadcast that confirms nothing new", () => {
    const t = setup();
    t.link.game({ inboundSeq: 0, shared: null, outbox: [event(3), event(4)] });
    t.link.onWelcome();
    // The coordinator has 1; the outbox begins at 3: event 2 is lost.
    t.ack(1);
    expect(t.events()).toHaveLength(0);
    t.state(1);
    t.link.outbound([event(5)], 0);
    expect(t.events()).toHaveLength(0);
    // Once the coordinator's count reaches the hole's far side, the gap clears.
    t.state(2);
    t.link.outbound([], 0);
    expect(t.events().length).toBeGreaterThan(0);
  });
});

describe("PodLink awaited inbound response retry", () => {
  const podSyncs = (t: ReturnType<typeof setup>) =>
    t.sent.filter((m) => m.ch === "pod" && m.kind === "event" && m.seq === POD_LINK_SEQ) as unknown as {
      event: { inboundSeq: number };
    }[];

  it("syncs with the applied count, backing off, when the reply to a confirmed event is dropped and no traffic follows", () => {
    const t = setup();
    t.link.game({ inboundSeq: 3, shared: null });
    t.link.onWelcome();
    t.ack(0);
    // The table's event is sent and confirmed; the engine awaits the coordinator's sharedAck, which never arrives.
    t.link.outbound([event(1)], 3, true);
    t.state(1);
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS);
    expect(t.syncs()).toBe(2);
    expect(podSyncs(t).at(-1)?.event.inboundSeq).toBe(3);
    // The sync is acknowledged; the wait goes on, doubled.
    t.ack(1);
    expect(t.fireRetry()).toBe(POD_SYNC_RETRY_MS * 2);
    expect(t.syncs()).toBe(3);
  });

  it("stops on progress, on disconnect and on dispose", () => {
    const t = setup();
    t.link.game({ inboundSeq: 0, shared: null });
    t.link.onWelcome();
    t.ack(0);
    t.link.outbound([event(1)], 0, true);
    t.state(1);
    // The response arrives and the engine applies it: the clock stops.
    t.link.outbound([], 1, false);
    // No short wait for a response remains (the idle reconcile is not a retry).
    expect(t.fireRetry()).toBeNull();
    t.link.outbound([event(2)], 1, true);
    t.state(2);
    t.link.onDisconnected();
    expect(t.fireRetry()).toBeNull();
    t.link.onWelcome();
    t.ack(2);
    t.link.dispose();
    expect(t.fireRetry()).toBeNull();
  });
});

describe("PodLink idle inbound reconciliation", () => {
  it("recovers a lost final unsolicited event on an idle table, exactly once, with no further traffic", () => {
    const applied: number[] = [];
    const sent: ClientMessage[] = [];
    const timers = new Map<number, { run: () => void; ms: number }>();
    let next = 1;
    const link = new PodLink({
      table: "t1",
      send: (m) => (sent.push(m), true),
      apply: (seq) => applied.push(seq),
      setTimer: (run, ms) => (timers.set(next, { run, ms }), next++),
      clearTimer: (h) => void timers.delete(h as number),
    });
    const inbound = (seq: number, event: unknown) =>
      link.onMessage({ v: 1, ch: "pod", kind: "inbound", table: "t1", seq, event } as unknown as ServerMessage);
    const syncAck = (received: number) => inbound(POD_LINK_SEQ, { kind: "podSyncAck", received });
    const reconcile = () => {
      const entry = [...timers].find(([, t]) => t.ms === POD_RECONCILE_MS);
      if (!entry) return false;
      timers.delete(entry[0]);
      entry[1].run();
      return true;
    };
    const podSyncs = () =>
      sent.filter((m) => m.ch === "pod" && m.kind === "event" && m.seq === POD_LINK_SEQ) as unknown as {
        event: { inboundSeq: number };
      }[];
    link.game({ inboundSeq: 0, shared: null });
    link.onWelcome();
    syncAck(0);
    // The final event from the coordinator (seq 1, say a remote-power request) is lost: nothing arrives, nothing is awaited.
    const before = podSyncs().length;
    expect(reconcile()).toBe(true);
    expect(podSyncs()).toHaveLength(before + 1);
    expect(podSyncs().at(-1)?.event.inboundSeq).toBe(0);
    // The coordinator answers the sync with an ack and the missing event.
    syncAck(0);
    inbound(1, { kind: "remotePower" });
    link.outbound([], 1, false);
    expect(applied).toEqual([1]);
    // The clock keeps running; a redelivery of the same event is dropped.
    expect(reconcile()).toBe(true);
    expect(podSyncs().at(-1)?.event.inboundSeq).toBe(1);
    syncAck(0);
    inbound(1, { kind: "remotePower" });
    expect(applied).toEqual([1]);
    link.onDisconnected();
    expect(reconcile()).toBe(false);
  });

  it("does not run while unsynced, and stops on dispose", () => {
    const t = setup();
    t.link.game({ inboundSeq: 0, shared: null });
    t.link.onWelcome();
    const idle = () => [...t.timers.values()].some((x) => x.ms === POD_RECONCILE_MS);
    expect(idle()).toBe(false);
    t.ack(0);
    expect(idle()).toBe(true);
    t.link.dispose();
    expect(idle()).toBe(false);
  });
});
