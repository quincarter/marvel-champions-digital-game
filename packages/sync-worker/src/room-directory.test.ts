import { describe, expect, it } from "vitest";
import { handleRequest, type HandlerDeps } from "./handler.js";
import { cleanLiveInput, RoomDirectoryLogic, type LiveRoomInput } from "./room-directory.js";
import { LIVE_DIRECTORY_MAX, LIVE_ENTRY_TTL_MS, LIVE_LIST_MAX } from "./room-protocol.js";
import { makeEnv, MemoryStorage } from "./test-support.js";

const input = (code: string, over: Partial<LiveRoomInput> = {}): LiveRoomInput => ({
  code,
  host: "Hosty",
  mode: "strict",
  seatsTaken: 1,
  seatsTotal: 2,
  started: false,
  ...over,
});
const codeOf = (i: number) => String(100000 + i);

describe("RoomDirectoryLogic", () => {
  it("an upsert is one row and sets the alarm once; a second upsert adds only the row", async () => {
    const storage = new MemoryStorage();
    const dir = new RoomDirectoryLogic(storage);
    await dir.upsert(input("AAAAAA"), 1_000);
    expect(storage.rowsWritten).toBe(1);
    expect(storage.alarmsSet).toBe(1);
    expect(storage.alarm).toBe(1_000 + LIVE_ENTRY_TTL_MS);
    await dir.upsert(input("AAAAAA", { seatsTaken: 2 }), 2_000);
    expect(storage.rowsWritten).toBe(2);
    expect(storage.alarmsSet).toBe(1);
    expect(await dir.list(2_000)).toEqual([{ ...input("AAAAAA", { seatsTaken: 2 }), updatedAt: 2_000 }]);
  });

  it("lists newest first, at most LIVE_LIST_MAX, and caps what it holds", async () => {
    const storage = new MemoryStorage();
    const dir = new RoomDirectoryLogic(storage);
    for (let i = 0; i < LIVE_DIRECTORY_MAX + 5; i++) await dir.upsert(input(codeOf(i)), 1_000 + i);
    const list = await dir.list(5_000);
    expect(list).toHaveLength(LIVE_LIST_MAX);
    expect(list[0]!.code).toBe(codeOf(LIVE_DIRECTORY_MAX + 4));
    expect(list.map((e) => e.updatedAt)).toEqual([...list.map((e) => e.updatedAt)].sort((a, b) => b - a));
    expect(Object.keys(storage.map.get("entries") as object)).toHaveLength(LIVE_DIRECTORY_MAX);
  });

  it("hides an entry older than the TTL on read, without writing", async () => {
    const storage = new MemoryStorage();
    const dir = new RoomDirectoryLogic(storage);
    await dir.upsert(input("AAAAAA"), 1_000);
    const rows = storage.rowsWritten;
    expect(await dir.list(1_000 + LIVE_ENTRY_TTL_MS - 1)).toHaveLength(1);
    expect(await dir.list(1_000 + LIVE_ENTRY_TTL_MS)).toEqual([]);
    expect(storage.rowsWritten).toBe(rows);
  });

  it("remove deletes one entry (one row) and writes nothing for an unknown code", async () => {
    const storage = new MemoryStorage();
    const dir = new RoomDirectoryLogic(storage);
    await dir.upsert(input("AAAAAA"), 1_000);
    await dir.upsert(input("BBBBBB"), 1_100);
    const rows = storage.rowsWritten;
    await dir.remove("NOPE00");
    expect(storage.rowsWritten).toBe(rows);
    await dir.remove("AAAAAA");
    expect(storage.rowsWritten).toBe(rows + 1);
    expect((await dir.list(2_000)).map((e) => e.code)).toEqual(["BBBBBB"]);
  });

  it("the alarm drops expired entries, moves out for the rest, and clears everything when none is left", async () => {
    const storage = new MemoryStorage();
    const dir = new RoomDirectoryLogic(storage);
    await dir.upsert(input("AAAAAA"), 1_000);
    await dir.upsert(input("BBBBBB"), 5_000);
    await dir.expire(1_000 + LIVE_ENTRY_TTL_MS);
    expect((await dir.list(1_000 + LIVE_ENTRY_TTL_MS)).map((e) => e.code)).toEqual(["BBBBBB"]);
    expect(storage.alarm).toBe(5_000 + LIVE_ENTRY_TTL_MS);
    await dir.expire(5_000 + LIVE_ENTRY_TTL_MS);
    expect(storage.map.size).toBe(0);
  });

  it("cleans an input: clips and tidies names, rejects a bad shape", () => {
    expect(cleanLiveInput({ ...input("AAAAAA"), host: "  Ann \n Lee  ", scenario: "x".repeat(200) })).toMatchObject({
      host: "Ann Lee",
      scenario: "x".repeat(60),
    });
    expect(cleanLiveInput({ ...input("AAAAAA"), host: "   " })).toBeNull();
    expect(cleanLiveInput({ ...input("AAAAAA"), mode: "x" })).toBeNull();
    expect(cleanLiveInput({ ...input("AAAAAA"), seatsTaken: -1 })).toBeNull();
    expect(cleanLiveInput({ ...input("SHORT") })).toBeNull();
    expect(cleanLiveInput(null)).toBeNull();
  });
});

describe("GET /rooms/live", () => {
  const ORIGIN = "https://marvel-champions-digital-game.netlify.app";
  const deps: HandlerDeps = {
    now: () => Date.now(),
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    fetch: async () => Response.json({ success: true }),
  };
  const get = (env: ReturnType<typeof makeEnv>, headers: Record<string, string> = {}) =>
    handleRequest(new Request("https://sync.test/rooms/live", { headers }), env, deps);
  const publish = (env: ReturnType<typeof makeEnv>, entry: LiveRoomInput) =>
    env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName("live")).fetch(
      new Request("https://directory/upsert", { method: "POST", body: JSON.stringify(entry) }),
    );

  it("is empty by default and lists what rooms published, with CORS", async () => {
    const env = makeEnv();
    const empty = await get(env, { Origin: ORIGIN });
    expect(empty.status).toBe(200);
    expect(empty.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(await empty.json()).toEqual({ rooms: [] });
    expect((await publish(env, input("AAAAAA"))).status).toBe(204);
    const body = (await (await get(env)).json()) as { rooms: { code: string }[] };
    expect(body.rooms.map((r) => r.code)).toEqual(["AAAAAA"]);
  });

  it("rejects a bad publish, answers a preflight, refuses other methods, and honours the kill switch", async () => {
    const env = makeEnv();
    const bad = await env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName("live")).fetch(
      new Request("https://directory/upsert", { method: "POST", body: "{}" }),
    );
    expect(bad.status).toBe(400);
    const pre = await handleRequest(
      new Request("https://sync.test/rooms/live", { method: "OPTIONS", headers: { Origin: ORIGIN } }),
      env,
      deps,
    );
    expect(pre.status).toBe(204);
    const post = await handleRequest(new Request("https://sync.test/rooms/live", { method: "POST" }), env, deps);
    expect(post.status).toBe(404);
    expect((await get(makeEnv({ ROOMS_ENABLED: "false" }))).status).toBe(503);
  });

  it("answers an empty list when the Worker has no directory binding", async () => {
    const env = makeEnv();
    (env as { ROOM_DIRECTORY?: unknown }).ROOM_DIRECTORY = undefined;
    expect(await (await get(env)).json()).toEqual({ rooms: [] });
  });
});

describe("GET /rooms/live edge cache", () => {
  const ORIGIN = "https://marvel-champions-digital-game.netlify.app";
  function setup() {
    const store = new Map<string, string>();
    const cache = {
      match: async (req: Request) => (store.has(req.url) ? new Response(store.get(req.url)!) : undefined),
      put: async (req: Request, res: Response) => void store.set(req.url, await res.text()),
    };
    const deps: HandlerDeps = {
      now: () => Date.now(),
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      fetch: async () => Response.json({ success: true }),
      cache,
    };
    const env = makeEnv();
    const get = (origin?: string) =>
      handleRequest(
        new Request("https://sync.test/rooms/live", { headers: origin ? { Origin: origin } : {} }),
        env,
        deps,
      );
    return { env, get, store };
  }
  const publish = (env: ReturnType<typeof makeEnv>, entry: LiveRoomInput) =>
    env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName("live")).fetch(
      new Request("https://directory/upsert", { method: "POST", body: JSON.stringify(entry) }),
    );

  it("serves repeat reads from the cache without asking the directory, and adds CORS per answer", async () => {
    const { env, get, store } = setup();
    await publish(env, input("AAAAAA"));
    const first = await get(ORIGIN);
    expect(first.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(store.size).toBe(1);
    // A room published after the read is not seen until the cache entry expires.
    await publish(env, input("BBBBBB"));
    const second = await get();
    expect(second.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(((await second.json()) as { rooms: unknown[] }).rooms).toHaveLength(1);
    store.clear();
    expect(((await (await get()).json()) as { rooms: unknown[] }).rooms).toHaveLength(2);
  });
});
