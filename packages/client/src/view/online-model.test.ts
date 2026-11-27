import type { LiveRoomEntry } from "@mc/sync-worker/room-protocol";
import { describe, expect, it } from "vitest";
import {
  liveRowKey,
  liveRowsOf,
  onlineLayout,
  rowsThatFit,
  LIVE_HEADING_HEIGHT,
  LIVE_ROW_HEIGHT,
} from "./online-model.js";

describe("onlineLayout", () => {
  it("splits on desktop and tablet landscape, live on the left and controls on the right", () => {
    for (const [w, h] of [
      [1440, 980],
      [1024, 768],
    ] as const) {
      const layout = onlineLayout(w, h, 60, 24);
      expect(layout.mode).toBe("split");
      expect(layout.live!.x + layout.live!.width).toBeLessThan(layout.controls.x);
      expect(layout.controls.x + layout.controls.width).toBeLessThanOrEqual(w);
      expect(layout.rows).toBeGreaterThan(3);
    }
  });

  it("stacks on phones and portrait tablets, live under the controls and inside the screen", () => {
    for (const [w, h] of [
      [375, 667],
      [412, 924],
      [768, 1024],
    ] as const) {
      const layout = onlineLayout(w, h, 52, 16);
      expect(layout.mode).toBe("stacked");
      if (layout.live) {
        expect(layout.live.y).toBeGreaterThanOrEqual(layout.controls.y + layout.controls.height);
        expect(layout.live.y + layout.live.height).toBeLessThanOrEqual(h);
      }
    }
    expect(onlineLayout(412, 924, 52, 16).live).not.toBeNull();
  });

  it("drops the panel when not even one row fits", () => {
    expect(onlineLayout(375, 440, 52, 16).live).toBeNull();
  });
});

describe("rows", () => {
  it("counts the rows under the heading", () => {
    expect(rowsThatFit(LIVE_HEADING_HEIGHT + LIVE_ROW_HEIGHT)).toBe(1);
    expect(rowsThatFit(LIVE_HEADING_HEIGHT + LIVE_ROW_HEIGHT - 1)).toBe(0);
  });

  it("makes a rejoin row per recent room, hosted or joined", () => {
    const rows = liveRowsOf([
      { code: "ABC234", role: "host", at: 5 },
      { code: "XYZ789", role: "guest", at: 4 },
    ]);
    expect(rows.map((r) => [r.title, r.kind, r.action, r.target])).toEqual([
      ["ABC234", "hosted", "rejoin", "ABC234"],
      ["XYZ789", "joined", "rejoin", "XYZ789"],
    ]);
  });
});

const entry = (code: string, over: Partial<LiveRoomEntry> = {}): LiveRoomEntry => ({
  code,
  host: "Ann",
  mode: "strict",
  seatsTaken: 1,
  seatsTotal: 2,
  started: false,
  updatedAt: 5,
  ...over,
});

describe("public rooms in the rows", () => {
  it("puts recent rooms first, then public rooms in the order given", () => {
    const rows = liveRowsOf([{ code: "ABC234", role: "guest", at: 4 }], [entry("LIVE22"), entry("LIVE33")]);
    expect(rows.map((r) => [r.target, r.kind])).toEqual([
      ["ABC234", "joined"],
      ["LIVE22", "live"],
      ["LIVE33", "live"],
    ]);
  });

  it("leaves out a public room that is already a recent room, and repeated codes", () => {
    const rows = liveRowsOf(
      [{ code: "ABC234", role: "guest", at: 4 }],
      [entry("ABC234"), entry("LIVE22"), entry("LIVE22")],
    );
    expect(rows.map((r) => r.target)).toEqual(["ABC234", "LIVE22"]);
  });

  it("carries the room's details, and asks to Join an open room but Watch a started or full one", () => {
    const [open, started, full] = liveRowsOf(
      [],
      [entry("OPEN22", { scenario: "Rhino" }), entry("PLAY22", { started: true }), entry("FULL22", { seatsTaken: 2 })],
    );
    expect(open).toMatchObject({ action: "join", host: "Ann", scenario: "Rhino", players: 1, seatsTotal: 2, at: null });
    expect(started!.action).toBe("watch");
    expect(started!.started).toBe(true);
    expect(full!.action).toBe("watch");
  });

  it("with no public rooms (offline or a failed fetch) is just the recent rooms", () => {
    expect(liveRowsOf([{ code: "ABC234", role: "guest", at: 4 }], []).map((r) => r.target)).toEqual(["ABC234"]);
    expect(liveRowsOf([{ code: "ABC234", role: "guest", at: 4 }]).map((r) => r.target)).toEqual(["ABC234"]);
  });
});

describe("live row keys", () => {
  it("follow the room and its action, not its position", () => {
    const before = liveRowsOf([{ code: "ABC234", role: "guest", at: 4 }], [entry("LIVE22"), entry("LIVE33")]);
    const after = liveRowsOf([{ code: "ABC234", role: "guest", at: 4 }], [entry("LIVE11"), entry("LIVE33")]);
    expect(before.map(liveRowKey)).toEqual(["live:ABC234:rejoin", "live:LIVE22:join", "live:LIVE33:join"]);
    // LIVE33 keeps its key when a room is inserted ahead of it or removed; no key is ever another room's.
    expect(after.map(liveRowKey)).toContain("live:LIVE33:join");
    expect(new Set(after.map(liveRowKey)).size).toBe(after.length);
    expect(after.map(liveRowKey)).not.toContain("live:LIVE22:join");
  });
});
