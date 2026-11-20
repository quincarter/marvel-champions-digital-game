/**
 * The pod channel end to end without a socket (Epic Multiplayer, issue #882): `PodLink`s of table hosts and the
 * organizer's `EpicCoordinator`, joined by a fake room that relays `pod:event` to the organizer, `pod:inbound` to one
 * table and `pod:state` to everyone, the way `GameRoom` does. The engine's own pod tests cover the reducer; these cover
 * the wire: sync, acks, gaps, reconnects, drops, the organizer's reload and a remote power's round trip.
 */
import { groupId, instanceId, playerId, type PodInboundEvent, type PodOutbound, type SharedPodState } from "@mc/engine";
import type { ClientMessage, ServerMessage } from "@mc/sync-worker/room-protocol";
import { describe, expect, it } from "vitest";
import { EpicCoordinator, MemoryEpicLogStore, type EpicCoordinatorOptions } from "./epic-coordinator.js";
import { PodLink } from "./pod-link.js";
import type { PodStateWire } from "./pod-wire.js";

const SHARED: SharedPodState = {
  villainHp: 120,
  villainDamage: 0,
  villainFlipAtRemaining: 60,
  villainFlipped: false,
  schemeThreat: 0,
  schemeTarget: 6,
  status: "playing",
};

const GROUPS: EpicCoordinatorOptions["groups"] = [
  { groupId: groupId("t1"), podId: "a", players: 2 },
  { groupId: groupId("t2"), podId: "a", players: 1 },
  { groupId: groupId("t3"), podId: "b", players: 1 },
];

interface Table {
  readonly link: PodLink;
  readonly applied: { readonly seq: number; readonly event: PodInboundEvent }[];
  connected: boolean;
  states: PodStateWire[];
  /** What this group's engine has emitted so far. */
  out: number;
}

/** A fake room with an organizer (t1, local) and two table hosts. */
class Hub {
  readonly store = new MemoryEpicLogStore();
  /** Whether the coordinator saves its log (only the reload tests need it: a save defers what is sent after it). */
  useStore = false;
  readonly stuck: boolean[] = [];
  readonly timers: (() => void)[] = [];
  readonly tables = new Map<string, Table>();
  coordinator!: EpicCoordinator;
  organizerUp = true;
  clock = 1_000_000;
  /** Every message the organizer put on the socket. */
  sent: ClientMessage[] = [];

  static async make(useStore = false): Promise<Hub> {
    const hub = new Hub();
    hub.useStore = useStore;
    await hub.startCoordinator();
    for (const id of ["t1", "t2", "t3"]) hub.addTable(id);
    return hub;
  }

  async startCoordinator(): Promise<void> {
    this.coordinator?.dispose();
    this.coordinator = await EpicCoordinator.restore({
      roomId: "room",
      groups: GROUPS,
      ...(this.useStore ? { store: this.store } : {}),
      send: (message) => this.fromOrganizer(message),
      local: { table: "t1", deliver: (seq, event) => this.deliverTo("t1", seq, event) },
      now: () => this.clock,
      setTimer: (run) => this.timers.push(run),
      clearTimer: () => {},
    });
  }

  addTable(id: string): Table {
    const table: Table = {
      applied: [],
      connected: false,
      states: [],
      out: 0,
      link: new PodLink({
        table: id,
        send: (message) => this.toOrganizer(id, message),
        // The engine accepts the event and reports its own inbound count with the next command.
        apply: (seq, event) => {
          table.applied.push({ seq, event });
          table.link.outbound([], seq);
        },
        onStuck: (stuck) => this.stuck.push(stuck),
        setTimer: (run) => this.timers.push(run),
        clearTimer: () => {},
        onState: (state) => table.states.push(state),
      }),
    };
    this.tables.set(id, table);
    return table;
  }

  table(id: string): Table {
    return this.tables.get(id) as Table;
  }

  /** The table's socket is welcomed. */
  connect(id: string, inboundSeq = 0): void {
    const table = this.table(id);
    table.connected = true;
    table.link.game({ inboundSeq: Math.max(inboundSeq, table.link.applied), shared: SHARED });
    table.link.onWelcome();
  }

  disconnect(id: string): void {
    this.table(id).connected = false;
    this.table(id).link.onDisconnected();
  }

  /** What an engine does after a command: emit these events. */
  emit(id: string, ...events: PodOutbound["event"][]): void {
    const table = this.table(id);
    const numbered = events.map((event) => ({ seq: ++table.out, event }));
    table.link.outbound(numbered, table.link.applied);
  }

  private toOrganizer(id: string, message: ClientMessage): boolean {
    if (message.ch !== "pod" || message.kind !== "event") return true;
    // The organizer's own table is a loopback; a host's event goes through the room only while both are connected.
    if (id === "t1" || (this.organizerUp && this.table(id).connected)) {
      this.coordinator.receive(message.table, message.seq, message.event);
    }
    return true;
  }

  private fromOrganizer(message: ClientMessage): boolean {
    this.sent.push(message);
    if (message.ch !== "pod") return true;
    if (message.kind === "inbound") {
      if (this.table(message.table).connected) this.deliverTo(message.table, message.seq, message.event);
    } else if (message.kind === "state") {
      for (const table of this.tables.values()) {
        if (table.connected) table.link.onMessage({ v: 1, ch: "pod", kind: "state", state: message.state });
      }
    }
    return true;
  }

  deliverTo(id: string, seq: number, event: unknown): void {
    this.table(id).link.onMessage({ v: 1, ch: "pod", kind: "inbound", table: id, seq, event } as ServerMessage);
  }
}

const damaged = (group: string, amount: number) => ({
  type: "sharedVillainDamaged" as const,
  groupId: groupId(group),
  amount,
});
const kinds = (table: Table): string[] => table.applied.map((a) => a.event.kind);

describe("the pod channel", () => {
  it("a table's shared event comes back as the shared state for everyone and an ack for the sender, in order", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.emit("t2", damaged("t2", 10));
    expect(kinds(hub.table("t2"))).toEqual(["sharedStateChanged", "sharedAck"]);
    expect(hub.table("t2").applied.map((a) => a.seq)).toEqual([1, 2]);
    // The ack is last: the sender has heard everything its event brought about (`PodState.awaiting`).
    expect(hub.table("t2").applied.at(-1)?.event).toEqual({ kind: "sharedAck", seq: 1 });
    // The organizer's own table is reached directly, other hosts through the room.
    expect(kinds(hub.table("t1"))).toEqual(["sharedStateChanged"]);
    expect(kinds(hub.table("t3"))).toEqual(["sharedStateChanged"]);
    const shared = hub.coordinator.state?.shared;
    expect(shared?.villainDamage).toBe(10);
    // Every device's pod strip: the broadcast carries the shared record and every table's standing.
    const state = hub.table("t3").states.at(-1);
    expect(state?.shared.villainDamage).toBe(10);
    expect(state?.groups.map((g) => g.groupId)).toEqual(["t1", "t2", "t3"]);
  });

  it("a flip goes to every table, a table of another pod included, once", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.emit("t3", damaged("t3", 60));
    for (const id of ["t1", "t2", "t3"]) {
      expect(kinds(hub.table(id))).toContain("sharedVillainFlipped");
      expect(kinds(hub.table(id)).filter((k) => k === "sharedVillainFlipped")).toHaveLength(1);
    }
  });

  it("applies an event once: a re-sent number changes nothing and delivers nothing", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.emit("t2", damaged("t2", 10));
    const before = hub.table("t2").applied.length;
    hub.coordinator.receive("t2", 1, damaged("t2", 10));
    expect(hub.table("t2").applied).toHaveLength(before);
    expect(hub.coordinator.state?.shared.villainDamage).toBe(10);
  });

  it("holds a table's events until the organizer has answered its sync", async () => {
    const hub = await Hub.make();
    hub.emit("t2", damaged("t2", 5));
    hub.connect("t2");
    // The sync came first, the event after the ack: the coordinator made itself from the sync's shared record.
    expect(hub.coordinator.state?.shared.villainDamage).toBe(5);
    expect(hub.table("t2").link.unacked).toBe(0);
  });

  it("re-sends only the events the coordinator lacks after a reconnect", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.emit("t2", damaged("t2", 5));
    hub.disconnect("t2");
    // Offline: three more events, none of which the organizer hears.
    hub.emit("t2", damaged("t2", 1), damaged("t2", 1), damaged("t2", 1));
    expect(hub.coordinator.state?.groups[1]?.received).toBe(1);
    expect(hub.table("t2").link.unacked).toBe(3);
    hub.connect("t2");
    expect(hub.coordinator.state?.groups[1]?.received).toBe(4);
    expect(hub.coordinator.state?.shared.villainDamage).toBe(8);
    expect(hub.table("t2").link.unacked).toBe(0);
    // Nothing is applied twice: a second sync changes nothing.
    hub.connect("t2");
    expect(hub.coordinator.state?.shared.villainDamage).toBe(8);
  });

  it("re-sends the inbound events a table missed while it was away, and the ack that ends its pause", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.disconnect("t3");
    hub.emit("t2", damaged("t2", 7));
    expect(hub.table("t3").applied).toHaveLength(0);
    hub.connect("t3");
    expect(kinds(hub.table("t3"))).toEqual(["sharedStateChanged"]);
    // A table whose own event's ack was lost gets it on its next sync.
    hub.emit("t3", damaged("t3", 1));
    hub.disconnect("t3");
    hub.connect("t3");
    expect(kinds(hub.table("t3"))).toEqual(["sharedStateChanged", "sharedStateChanged", "sharedAck"]);
    expect(hub.table("t3").applied.map((a) => a.seq)).toEqual([1, 2, 3]);
  });

  it("asks for a gap again: an inbound event past the next is held, and the sync fills it", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    // The organizer's first two answers to t3 never arrive; the third does.
    hub.table("t3").connected = false;
    hub.emit("t2", damaged("t2", 1), damaged("t2", 1));
    hub.table("t3").connected = true;
    hub.emit("t2", damaged("t2", 1));
    // The third `sharedStateChanged` was held; the sync it caused brought the missing two, then it was released.
    expect(hub.table("t3").applied.map((a) => a.seq)).toEqual([1, 2, 3]);
    expect(hub.table("t3").link.applied).toBe(3);
  });

  it("refuses a gap in a table's own events with an ack that makes it re-send from the first missing one", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.coordinator.receive("t2", 3, damaged("t2", 1));
    expect(hub.coordinator.state?.groups[1]?.received).toBe(0);
    const ack = hub.sent.filter((m) => m.ch === "pod" && m.kind === "inbound" && m.seq === 0).at(-1);
    expect(ack).toMatchObject({ table: "t2", event: { kind: "podSyncAck", received: 0 } });
  });

  it("a dropped table no longer holds up the stop rule, and the game is lost when the rest have halted", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    const status = (group: string, halted: boolean) => ({
      type: "groupStatus" as const,
      groupId: groupId(group),
      status: { phase: "player" as const, round: 2, halted },
    });
    hub.emit("t1", { type: "sharedSchemeThreatPlaced", groupId: groupId("t1"), amount: 6, cause: "schemeCompleted" });
    expect(kinds(hub.table("t2"))).toContain("stopAfterPhase");
    hub.emit("t1", status("t1", true));
    hub.emit("t2", status("t2", true));
    // t3 is away and has not halted: the game waits for it.
    hub.disconnect("t3");
    expect(hub.coordinator.state?.outcome).toBe("playing");
    hub.coordinator.dropTable("t3");
    expect(hub.coordinator.state?.groups[2]?.dropped).toBe(true);
    expect(hub.coordinator.state?.outcome).toBe("lost");
    expect(kinds(hub.table("t2"))).toContain("gameLost");
    expect(kinds(hub.table("t1"))).toContain("gameLost");
    expect(hub.coordinator.wire?.groups[2]?.dropped).toBe(true);
    // Dropping twice changes nothing.
    const length = hub.coordinator.state?.log.length;
    hub.coordinator.dropTable("t3");
    expect(hub.coordinator.state?.log.length).toBe(length);
  });

  it("an organizer that reloaded rebuilds the coordinator from its saved log, and the tables sync again", async () => {
    const hub = await Hub.make(true);
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.emit("t2", damaged("t2", 9));
    hub.coordinator.dropTable("t3");
    await hub.coordinator.flushed();
    const before = hub.coordinator.state;
    const oldEpoch = hub.coordinator.epoch;

    // The organizer's worker restarts: new coordinator, same store; tables 2 and 3 are still up with their engines.
    hub.organizerUp = false;
    await hub.startCoordinator();
    expect(hub.coordinator.state?.shared).toEqual(before?.shared);
    expect(hub.coordinator.state?.log).toEqual(before?.log);
    expect(hub.coordinator.epoch).not.toBe(oldEpoch);
    // Meanwhile t2 played on, unheard.
    hub.emit("t2", damaged("t2", 1));
    expect(hub.coordinator.state?.shared.villainDamage).toBe(9);
    hub.organizerUp = true;
    // The organizer is back: its state broadcast carries a new epoch, so each table syncs and its unacked event goes out.
    hub.coordinator.broadcast();
    // The broadcast and then the syncs it causes each wait for the save before them.
    for (let i = 0; i < 4; i++) await hub.coordinator.flushed();
    expect(hub.coordinator.state?.shared.villainDamage).toBe(10);
    expect(hub.table("t2").link.unacked).toBe(0);
    expect(hub.coordinator.state?.groups[2]?.dropped).toBe(true);
  });

  it("starts fresh when the saved log belongs to other groups", async () => {
    const hub = await Hub.make(true);
    hub.connect("t1");
    await hub.coordinator.flushed();
    hub.store.records.set("room", {
      roomId: "room",
      setup: { groups: [{ groupId: groupId("x1"), podId: "a", players: 1 }], shared: SHARED },
      log: [],
      savedAt: Date.now(),
    });
    await hub.startCoordinator();
    expect(hub.coordinator.state).toBeNull();
    expect(hub.store.records.has("room")).toBe(false);
  });

  it("routes a remote power to the owning table and its result back, only inside the pod", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    const target = instanceId("mangog-1");
    // The engine's remote power events are still gaining detail fields; the wire only needs these.
    const used = (to: string) =>
      ({
        type: "remotePowerUsed",
        groupId: groupId("t1"),
        playerId: playerId("p1"),
        toGroupId: groupId(to),
        targetInstanceId: target,
        power: "attack",
        amount: 6,
        overkill: true,
      }) as unknown as PodOutbound["event"];
    // t2 reports The Mangog as reachable: its pod mate hears it, another pod does not.
    hub.emit("t2", {
      type: "reachableCards",
      groupId: groupId("t2"),
      cards: [{ instanceId: target, cardId: "55041", by: "attack", remainingHitPoints: 20 }],
    } as unknown as PodOutbound["event"]);
    expect(kinds(hub.table("t1"))).toContain("podReachable");
    expect(kinds(hub.table("t3"))).not.toContain("podReachable");
    expect(hub.coordinator.wire?.groups[1]?.reachable).toHaveLength(1);
    // t1's player attacks The Mangog in t2 (same pod): t2's engine is told.
    hub.emit("t1", used("t2"));
    const power = hub.table("t2").applied.find((a) => a.event.kind === "remotePower");
    expect(power?.event).toMatchObject({
      kind: "remotePower",
      fromGroupId: "t1",
      targetInstanceId: target,
    });
    // t2's engine resolves it and says so; t1 hears the result, with Overkill's excess.
    hub.emit("t2", {
      type: "remotePowerResolved",
      groupId: groupId("t2"),
      toGroupId: groupId("t1"),
      targetInstanceId: target,
      power: "attack",
      excess: 2,
    } as unknown as PodOutbound["event"]);
    expect(hub.table("t1").applied.at(-1)?.event).toMatchObject({
      kind: "remotePowerResolved",
      fromGroupId: "t2",
      targetInstanceId: target,
    });
    // Another pod's card is refused, and the attacker is told.
    hub.emit("t1", used("t3"));
    expect(hub.table("t1").applied.at(-1)?.event).toMatchObject({
      kind: "remotePowerResolved",
      fromGroupId: "t3",
      refused: "that group is not in your pod",
    });
    expect(kinds(hub.table("t3")).includes("remotePower")).toBe(false);
  });

  it("paces a long burst of messages under the room's pod limit", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    for (let n = 0; n < 40; n++) hub.emit("t2", damaged("t2", 1));
    // Past the burst, answers wait for the timer; running it sends them, in order.
    expect(hub.timers.length).toBeGreaterThan(0);
    const early = hub.table("t2").applied.length;
    expect(early).toBeLessThan(80);
    let guard = 0;
    while (hub.timers.length > 0 && guard++ < 200) {
      hub.clock += 300;
      hub.timers.shift()?.();
    }
    expect(hub.coordinator.state?.shared.villainDamage).toBe(40);
    expect(hub.table("t2").applied).toHaveLength(80);
    expect(hub.table("t2").applied.map((a) => a.seq)).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
  });

  it("a table host that reloaded rebuilds its outbox from its saved log, and sends only what the coordinator lacks", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    hub.emit("t2", damaged("t2", 5), damaged("t2", 2));
    expect(hub.coordinator.state?.groups[1]?.received).toBe(2);
    // The coordinator lost event 2 (an older save), and t2's page reloaded: a new link, the outbox rebuilt by replay.
    const events = [1, 2].map((seq) => ({ seq, event: damaged("t2", seq === 1 ? 5 : 2) }));
    const table = hub.addTable("t2");
    // A coordinator a step behind: it has event 1 only.
    await hub.startCoordinator();
    hub.coordinator.receive("t2", 0, { type: "podSync", inboundSeq: 0, shared: SHARED });
    hub.coordinator.receive("t2", 1, events[0]!.event);
    expect(hub.coordinator.state?.groups[1]?.received).toBe(1);
    table.connected = true;
    table.link.game({ inboundSeq: 0, shared: SHARED, outbox: events });
    table.link.onWelcome();
    expect(hub.coordinator.state?.groups[1]?.received).toBe(2);
    expect(hub.coordinator.state?.shared.villainDamage).toBe(7);
    expect(table.link.unacked).toBe(0);
  });

  it("does not answer the same ack again: a gap no re-send can fill is reported stuck, not looped on", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t3"]) hub.connect(id);
    // t2 reloaded with only event 2 of its log (event 1 is gone): the coordinator has nothing of t2.
    const table = hub.table("t2");
    table.connected = true;
    table.link.game({ inboundSeq: 0, shared: SHARED, outbox: [{ seq: 2, event: damaged("t2", 1) }] });
    table.link.onWelcome();
    const sends = hub.sent.length;
    expect(hub.coordinator.state?.groups[1]?.received).toBe(0);
    // The hole is reported after the wait, and nothing more is sent meanwhile.
    expect(hub.stuck).toEqual([]);
    for (const run of hub.timers.splice(0)) run();
    expect(hub.stuck).toEqual([true]);
    expect(table.link.stuck).toBe(true);
    expect(hub.sent.length).toBe(sends);
    // The same ack again changes nothing (it used to re-send and be refused forever).
    hub.coordinator.receive("t2", 2, damaged("t2", 1));
    expect(hub.sent.length).toBeLessThanOrEqual(sends + 3);
  });

  it("syncs from what the engine really applied, so an inbound event it never accepted is sent again", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    // A host whose engine does not apply anything it is forwarded (busy, refused): its own count stays 0.
    const forwarded: number[] = [];
    const lazy = new PodLink({
      table: "t3",
      send: (m) => {
        if (m.ch === "pod" && m.kind === "event") hub.coordinator.receive("t3", m.seq, m.event);
        return true;
      },
      apply: (seq) => forwarded.push(seq),
    });
    lazy.game({ inboundSeq: 0, shared: SHARED });
    lazy.onWelcome();
    hub.emit("t2", damaged("t2", 3));
    // The coordinator's answer to t3 went to t3's own link, not this one: deliver it by hand, then sync again.
    const answer = hub.coordinator.state?.groups[2]?.inbound[0];
    lazy.onMessage({
      v: 1,
      ch: "pod",
      kind: "inbound",
      table: "t3",
      seq: answer!.sequence,
      event: answer!.event,
    } as ServerMessage);
    expect(forwarded).toEqual([1]);
    lazy.onWelcome();
    // The sync said 0 applied, so the coordinator re-sends it, and it is forwarded again.
    const resent = hub.sent
      .filter((m) => m.ch === "pod" && m.kind === "inbound" && m.table === "t3" && m.seq === 1)
      .at(-1)!;
    lazy.onMessage(resent as unknown as ServerMessage);
    expect(forwarded).toEqual([1, 1]);
    expect(lazy.applied).toBe(0);
  });

  it("reports a wait for the coordinator that does not clear, and clears it when the coordinator answers", async () => {
    const hub = await Hub.make();
    hub.organizerUp = false;
    hub.connect("t2");
    hub.emit("t2", damaged("t2", 1));
    expect(hub.timers.length).toBeGreaterThan(0);
    for (const run of hub.timers.splice(0)) run();
    expect(hub.stuck).toEqual([true]);
    // The organizer returns: the sync is answered and the event confirmed.
    hub.organizerUp = true;
    hub.connect("t2");
    expect(hub.table("t2").link.stuck).toBe(false);
    expect(hub.stuck).toEqual([true, false]);
  });

  it("is stuck while the engine waits for a sharedAck that never comes, and not once it has it", async () => {
    const hub = await Hub.make();
    for (const id of ["t1", "t2", "t3"]) hub.connect(id);
    const link = hub.table("t2").link;
    link.outbound([], link.applied, true);
    for (const run of hub.timers.splice(0)) run();
    expect(link.stuck).toBe(true);
    link.outbound([], link.applied, false);
    expect(link.stuck).toBe(false);
  });
});
