import { LIVE_LIST_MAX, type LiveRoomEntry } from "@mc/sync-worker/room-protocol";
import { describe, expect, it, vi } from "vitest";
import { fetchLiveRooms, liveRoomsFromBody, pollLiveRooms, type LiveRoomsPollDeps } from "./live-rooms.js";

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

describe("liveRoomsFromBody", () => {
  it("keeps valid entries, drops bad ones, and caps the list", () => {
    expect(
      liveRoomsFromBody({ rooms: [entry("AAAAAA"), { code: 1 }, null, entry("BBBBBB")] }).map((e) => e.code),
    ).toEqual(["AAAAAA", "BBBBBB"]);
    const many = Array.from({ length: LIVE_LIST_MAX + 10 }, (_, i) => entry(`A${String(10000 + i)}`));
    expect(liveRoomsFromBody({ rooms: many })).toHaveLength(LIVE_LIST_MAX);
    expect(liveRoomsFromBody(null)).toEqual([]);
    expect(liveRoomsFromBody({ rooms: "x" })).toEqual([]);
  });
});

describe("fetchLiveRooms", () => {
  it("asks /rooms/live and reads the rooms", async () => {
    const fetchFn = vi.fn(async () => Response.json({ rooms: [entry("AAAAAA")] }));
    expect((await fetchLiveRooms("https://sync.test", fetchFn)).map((e) => e.code)).toEqual(["AAAAAA"]);
    expect(fetchFn).toHaveBeenCalledWith("https://sync.test/rooms/live", expect.anything());
  });

  it("is quietly empty with no service, a failed fetch, an error status or a bad body", async () => {
    expect(await fetchLiveRooms(null, vi.fn())).toEqual([]);
    expect(
      await fetchLiveRooms("https://sync.test", async () => {
        throw new Error("offline");
      }),
    ).toEqual([]);
    expect(await fetchLiveRooms("https://sync.test", async () => new Response(null, { status: 503 }))).toEqual([]);
    expect(await fetchLiveRooms("https://sync.test", async () => new Response("not json"))).toEqual([]);
  });
});

describe("pollLiveRooms", () => {
  function harness(answers: LiveRoomEntry[][]) {
    const timers: { run: () => void; ms: number; cleared: boolean }[] = [];
    let call = 0;
    const deps: LiveRoomsPollDeps = {
      fetchRooms: async () => answers[Math.min(call++, answers.length - 1)]!,
      setTimer: (run, ms) => {
        const timer = { run, ms, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimer: (handle) => void ((handle as { cleared: boolean }).cleared = true),
    };
    return { deps, timers };
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("fetches at once, then again after each interval, until stopped", async () => {
    const { deps, timers } = harness([[entry("AAAAAA")], [entry("BBBBBB")]]);
    const seen: string[][] = [];
    const stop = pollLiveRooms((rooms) => seen.push(rooms.map((r) => r.code)), deps, 20_000);
    await flush();
    expect(seen).toEqual([["AAAAAA"]]);
    expect(timers.map((t) => t.ms)).toEqual([20_000]);
    timers[0]!.run();
    await flush();
    expect(seen).toEqual([["AAAAAA"], ["BBBBBB"]]);
    stop.stop();
    expect(timers[1]!.cleared).toBe(true);
  });

  it("drops an answer that lands after stop", async () => {
    const { deps, timers } = harness([[entry("AAAAAA")]]);
    const seen: unknown[] = [];
    const stop = pollLiveRooms((rooms) => seen.push(rooms), deps);
    stop.stop();
    await flush();
    expect(seen).toEqual([]);
    expect(timers).toEqual([]);
  });

  it("waits while the page is hidden and fetches at once when it is visible again", async () => {
    const { deps, timers } = harness([[entry("AAAAAA")], [entry("BBBBBB")]]);
    let hidden = true;
    const seen: string[][] = [];
    const poll = pollLiveRooms(
      (rooms) => seen.push(rooms.map((r) => r.code)),
      { ...deps, hidden: () => hidden },
      20_000,
    );
    await flush();
    expect(seen).toEqual([]);
    expect(timers).toHaveLength(1);
    timers[0]!.run();
    await flush();
    expect(seen).toEqual([]);
    poll.refresh();
    await flush();
    expect(seen).toEqual([]);
    hidden = false;
    poll.refresh();
    await flush();
    expect(seen).toEqual([["AAAAAA"]]);
    poll.stop();
  });
});
