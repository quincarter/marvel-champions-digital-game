import { beforeEach, describe, expect, it, vi } from "vitest";

const posted: { kind: string; step?: string; scenario?: string; plan?: unknown }[] = [];
let listener: ((state: unknown) => void) | null = null;

vi.mock("./live-watch.js", () => ({
  postRoomCommand: (message: { kind: string }) => {
    posted.push(message);
    return true;
  },
  setRoomDecksListener: () => {},
  setChatPopoutListener: () => {},
  setRoomStateListener: (l: (state: unknown) => void) => {
    listener = l;
  },
}));

const store = new Map<string, string>();

describe("host activity from the client", () => {
  beforeEach(() => {
    posted.length = 0;
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });

  const hostState = (connection: string, extra: object = {}) => ({
    role: "host",
    connection,
    problem: null,
    code: null,
    seats: [],
    participants: [],
    ...extra,
  });

  it("skips a repeat, resends the last step after a reconnect, and forgets it on leaving", async () => {
    const room = await import("./room.js");
    listener!(hostState("connected"));
    room.reportHostActivity("table", "Rhino");
    room.reportHostActivity("table", "Rhino");
    expect(posted.filter((m) => m.kind === "room-activity")).toHaveLength(1);
    listener!(hostState("reconnecting"));
    listener!(hostState("connected"));
    expect(posted.filter((m) => m.kind === "room-activity")).toEqual([
      { kind: "room-activity", step: "table", scenario: "Rhino" },
      { kind: "room-activity", step: "table", scenario: "Rhino" },
    ]);
    // Leaving the room forgets it: the same step in a new room is sent.
    listener!({ ...hostState("idle"), role: "none" });
    listener!(hostState("connected"));
    room.reportHostActivity("table", "Rhino");
    expect(posted.filter((m) => m.kind === "room-activity")).toHaveLength(3);
  });

  it("publishes the table plan once, sends it again after a reconnect, sends a clear, and forgets it on leaving", async () => {
    const room = await import("./room.js");
    const plan = { scenarioId: "rhino", modularSetIds: ["bomb_scare"], difficulty: "standard" as const };
    const plans = () => posted.filter((m) => m.kind === "room-table-plan");
    listener!(hostState("connected"));
    room.reportTablePlan(plan);
    room.reportTablePlan({ ...plan });
    expect(plans()).toEqual([{ kind: "room-table-plan", plan }]);
    listener!(hostState("reconnecting"));
    listener!(hostState("connected"));
    expect(plans()).toHaveLength(2);
    room.reportTablePlan(null);
    expect(plans().at(-1)).toEqual({ kind: "room-table-plan", plan: null });
    // A cleared plan is not sent again after a reconnect.
    listener!(hostState("reconnecting"));
    listener!(hostState("connected"));
    expect(plans()).toHaveLength(3);
    // A guest never publishes one.
    listener!({ ...hostState("connected"), role: "guest" });
    room.reportTablePlan(plan);
    expect(plans()).toHaveLength(3);
  });

  it("sends the kept draft again in a rematch's lobby, after the room cleared the plan at game start", async () => {
    vi.useFakeTimers();
    try {
      const room = await import("./room.js");
      const { keepRoomDraft, clearRoomTable } = await import("../view/room-table-setup.js");
      const { initialSetupDraft } = await import("../view/setup-draft.js");
      const plans = () => posted.filter((m) => m.kind === "room-table-plan");
      listener!(hostState("connected"));
      keepRoomDraft(initialSetupDraft({ scenarioId: "rhino", seatDeckId: null, scenarioPicked: true, seed: 1 }));
      expect(plans()).toHaveLength(1);
      const sent = plans()[0]!.plan as object;
      listener!(hostState("connected", { tablePlan: sent }));
      // The game starts: the room clears the plan. Nothing is sent while the game runs.
      listener!(hostState("connected", { tablePlan: null }));
      expect(plans()).toHaveLength(1);
      // Back in the lobby with the draft kept and no plan showing: sent again, once.
      room.resyncTablePlan();
      room.resyncTablePlan();
      expect(plans()).toHaveLength(2);
      expect(plans()[1]!.plan).toEqual(sent);
      // A plan the room refused as over the limit is tried again once its limit has refilled.
      listener!(hostState("connected", { tablePlan: null, refusal: { reason: "rate-limited", seq: 1 } }));
      expect(plans()).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(plans()).toHaveLength(3);
      clearRoomTable();
    } finally {
      vi.useRealTimers();
    }
  });

  it("forgets a guest's room that ended as closed", async () => {
    await import("./room.js");
    const { rememberRoom, recentRooms } = await import("./recent-rooms.js");
    rememberRoom("ABCDEF", "guest");
    listener!({ ...hostState("ended"), role: "guest", problem: "closed-host", code: "ABCDEF" });
    expect(recentRooms().map((r) => r.code)).toEqual([]);
  });
});
