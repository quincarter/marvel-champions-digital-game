import { describe, expect, test } from "vitest";
import type { SyncFailure } from "./sync-api.js";
import { loadSyncCode, saveSyncCode, type SyncCredentials } from "./sync-credentials.js";
import { FakeLocal, FakeServer, FakeState } from "./sync-fakes.js";
import type { Timers } from "./sync-scheduler.js";
import { SyncService, type SyncServiceApi } from "./sync-service.js";

const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23";
const OTHER = "23456789ABCDEFGHJKMNPQRST";
const KEY = "K".repeat(22);

class MapStorage {
  readonly map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

/** The space API over one `FakeServer`: a space exists once created. */
function serviceApi(
  server: FakeServer,
  opts: { fail?: SyncFailure | null } = {},
): SyncServiceApi & { deleted: number } {
  const info = () => ({
    cursor: server.cursor,
    bytes: 0,
    maxBytes: 1,
    records: server.records.size,
    createdAt: server.epoch,
    epoch: server.epoch,
  });
  const api = {
    deleted: 0,
    createSpace: async (_creds: SyncCredentials) => {
      if (opts.fail) return { ok: false as const, failure: opts.fail };
      const created = !server.exists;
      server.exists = true;
      return { ok: true as const, created, info: info() };
    },
    spaceInfo: async (_creds: SyncCredentials) =>
      server.exists
        ? { ok: true as const, info: info() }
        : { ok: false as const, failure: { kind: "not-found" } as SyncFailure },
    deleteSpace: async (_creds: SyncCredentials) => {
      api.deleted++;
      server.exists = false;
      server.records.clear();
      return { ok: true as const };
    },
  };
  return api;
}

function make(
  server = new FakeServer(),
  over: { api?: SyncServiceApi; code?: string; onTable?: () => boolean; timers?: Timers } = {},
) {
  const storage = new MapStorage();
  if (over.code) saveSyncCode(storage, over.code);
  const local = new FakeLocal();
  const state = new FakeState();
  const api = over.api ?? serviceApi(server);
  const service = new SyncService({
    storage,
    local,
    state,
    api,
    engineApi: server.api,
    onSaveDataChanged: () => () => {},
    newCode: () => CODE,
    ...(over.onTable ? { onTable: over.onTable } : {}),
    ...(over.timers ? { timers: over.timers } : {}),
  });
  return { service, storage, local, state, server, api };
}

const settle = async () => {
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 0));
};

describe("setUp", () => {
  test("creates the space, saves the code and syncs this device's saves", async () => {
    const d = make();
    d.local.setDeck("a", "Deck A", 5);
    const set = await d.service.setUp();
    expect(set).toEqual({ ok: true, recoveryCode: CODE });
    expect(d.service.isOn()).toBe(true);
    expect(loadSyncCode(d.storage)).toBe(CODE);
    await settle();
    expect(d.server.liveCount()).toBe(1);
    expect(d.service.status.get().state).toBe("synced");
  });

  test("saves nothing when the space can't be created", async () => {
    const server = new FakeServer();
    const d = make(server, { api: serviceApi(server, { fail: { kind: "unavailable" } }) });
    const set = await d.service.setUp();
    expect(set).toEqual({ ok: false, failure: { kind: "unavailable" } });
    expect(d.service.isOn()).toBe(false);
    expect(loadSyncCode(d.storage)).toBeNull();
    expect(d.service.status.get().state).toBe("off");
  });

  test("when already on, answers with the saved code and creates nothing", async () => {
    const d = make(new FakeServer(), { code: OTHER });
    expect(await d.service.setUp()).toEqual({ ok: true, recoveryCode: OTHER });
  });

  test("refuses when this browser can't keep the code", async () => {
    const server = new FakeServer();
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {},
    };
    const service = new SyncService({
      storage,
      local: new FakeLocal(),
      state: new FakeState(),
      api: serviceApi(server),
      engineApi: server.api,
      onSaveDataChanged: () => () => {},
      newCode: () => CODE,
    });
    expect(await service.setUp()).toEqual({ ok: false, failure: { kind: "storage" } });
    expect(service.isOn()).toBe(false);
  });
});

describe("join", () => {
  test("a typed code (any case, grouped) joins an existing space and pulls its records", async () => {
    const server = new FakeServer();
    const a = make(server);
    a.local.setDeck("a", "Deck A", 5);
    await a.service.setUp();
    await settle();
    const b = make(server);
    expect(await b.service.join("abcde-fghjk-mnpqr-stuvw-xyz23")).toEqual({ ok: true });
    await settle();
    expect(b.local.values.get("db:mc-decks:decks:a")).toEqual({
      id: "a",
      name: "Deck A",
      updatedAt: new Date(5).toISOString(),
    });
    expect(loadSyncCode(b.storage)).toBe(CODE);
  });

  test("a code no space belongs to is wrong-code and creates nothing", async () => {
    const d = make();
    expect(await d.service.join(OTHER)).toEqual({ ok: false, failure: { kind: "wrong-code" } });
    expect(d.server.exists).toBe(false);
    expect(d.service.isOn()).toBe(false);
  });

  test("a malformed code is invalid-code", async () => {
    const d = make();
    expect(await d.service.join("ABC")).toEqual({ ok: false, failure: { kind: "invalid-code" } });
  });
});

describe("linkDevice and joinFromLink", () => {
  test("link sends the stored code; the other device joins with it", async () => {
    const server = new FakeServer();
    const a = make(server);
    await a.service.setUp();
    const sent: string[] = [];
    const linker = new SyncService({
      storage: a.storage,
      local: a.local,
      state: a.state,
      api: a.api,
      engineApi: server.api,
      onSaveDataChanged: () => () => {},
      sendLink: async (code) => {
        sent.push(code);
        return {
          ok: true,
          link: { room: "ABCDEFGH", key: KEY },
          typed: { room: "JKMNPQRS", digits: "12345678" },
          expiresAt: 99,
        };
      },
    });
    expect(await linker.linkDevice()).toEqual({
      ok: true,
      link: { room: "ABCDEFGH", key: KEY },
      expiresAt: 99,
      typedText: "JKMN-PQRS 1234-5678",
    });
    expect(sent).toEqual([CODE]);

    const b = new SyncService({
      storage: new MapStorage(),
      local: new FakeLocal(),
      state: new FakeState(),
      api: a.api,
      engineApi: server.api,
      onSaveDataChanged: () => () => {},
      receiveLink: async () => ({ ok: true, recoveryCode: CODE }),
    });
    expect(await b.joinFromLink({ room: "ABCDEFGH", key: KEY })).toEqual({ ok: true });
    expect(b.isOn()).toBe(true);
  });

  test("a failed room is reported as a link failure and joins nothing", async () => {
    const d = new SyncService({
      storage: new MapStorage(),
      local: new FakeLocal(),
      state: new FakeState(),
      onSaveDataChanged: () => () => {},
      receiveLink: async () => ({ ok: false, failure: { kind: "not-found" } }),
    });
    expect(await d.joinFromLink({ room: "ABCDEFGH", key: KEY })).toEqual({
      ok: false,
      failure: { kind: "link", failure: { kind: "not-found" } },
    });
    expect(d.isOn()).toBe(false);
  });

  test("join takes a typed link code, else a recovery code", async () => {
    const server = new FakeServer();
    const a = make(server);
    await a.service.setUp();
    const b = new SyncService({
      storage: new MapStorage(),
      local: new FakeLocal(),
      state: new FakeState(),
      api: a.api,
      engineApi: server.api,
      onSaveDataChanged: () => () => {},
      receiveLinkCode: async (typed) =>
        typed.room === "ABCDEFGH" && typed.digits === "12345678"
          ? { ok: true, recoveryCode: CODE }
          : { ok: false, failure: { kind: "not-found" } },
    });
    expect(await b.joinWithInput("ABCD-EFGH 1234-5678")).toEqual({ ok: true });
    expect(b.isOn()).toBe(true);
    const c = make(server);
    expect(await c.service.joinWithInput(CODE)).toEqual({ ok: true });
  });

  test("linking while off is refused", async () => {
    const d = make();
    expect(await d.service.linkDevice()).toEqual({ ok: false, failure: { kind: "not-on" } });
  });
});

describe("unlink and deleteCloudData", () => {
  test("unlink forgets the code and sync state and keeps local saves and the cloud copy", async () => {
    const d = make();
    d.local.setDeck("a", "Deck A", 5);
    await d.service.setUp();
    await settle();
    await d.service.unlink();
    expect(d.service.isOn()).toBe(false);
    expect(loadSyncCode(d.storage)).toBeNull();
    expect(d.state.map.size).toBe(0);
    expect(d.service.status.get().state).toBe("off");
    expect(d.local.values.size).toBe(1);
    expect(d.server.liveCount()).toBe(1);
  });

  test("delete removes the cloud copy, then unlinks", async () => {
    const d = make();
    d.local.setDeck("a", "Deck A", 5);
    await d.service.setUp();
    await settle();
    expect(await d.service.deleteCloudData()).toEqual({ ok: true });
    expect((d.api as unknown as { deleted: number }).deleted).toBe(1);
    expect(d.service.isOn()).toBe(false);
    expect(d.server.exists).toBe(false);
    expect(d.local.values.size).toBe(1);
  });

  test("a failed delete changes nothing", async () => {
    const server = new FakeServer();
    const api = serviceApi(server);
    const failing: SyncServiceApi = {
      ...api,
      deleteSpace: async () => ({ ok: false, failure: { kind: "unavailable" } }),
    };
    const d = make(server, { api: failing });
    await d.service.setUp();
    expect(await d.service.deleteCloudData()).toEqual({ ok: false, failure: { kind: "unavailable" } });
    expect(d.service.isOn()).toBe(true);
  });
});

describe("conflicts", () => {
  async function conflictSetup(campaignId?: string, bOver: Parameters<typeof make>[1] = {}) {
    const server = new FakeServer();
    const game = (tag: string) => ({ tag, ...(campaignId ? { campaignId } : {}) });
    const a = make(server);
    await a.local.setGame("g1", 3, game("a"));
    await a.service.setUp();
    await settle();
    const b = make(server, bOver);
    await b.service.join(CODE);
    await settle();
    await a.local.setGame("g1", 5, game("a"));
    await b.local.setGame("g1", 6, game("b"));
    return { server, a, b };
  }

  test("a diverged game queues a prompt, and the answer settles it", async () => {
    const { a, b } = await conflictSetup();
    await a.service.syncNow();
    const seen: string[] = [];
    b.service.onConflict((pending) => {
      seen.push(pending.conflict.gameId);
      pending.answer("keep-remote");
    });
    await b.service.syncNow();
    expect(seen).toEqual(["g1"]);
    expect(b.local.gameCommands("g1")).toEqual(a.local.gameCommands("g1"));
    expect(b.service.pendingConflicts()).toEqual([]);
  });

  test("with no listener the question waits, and a late listener gets it", async () => {
    const { a, b } = await conflictSetup();
    await a.service.syncNow();
    const run = b.service.syncNow();
    await settle();
    expect(b.service.pendingConflicts()).toHaveLength(1);
    const seen: string[] = [];
    b.service.onConflict((pending) => {
      seen.push(pending.conflict.gameId);
      pending.answer("keep-local");
    });
    await run;
    expect(seen).toEqual(["g1"]);
  });

  test("keep-both on a campaign game is refused", async () => {
    const { a, b } = await conflictSetup("c");
    await a.service.syncNow();
    const run = b.service.syncNow();
    await settle();
    const [pending] = b.service.pendingConflicts();
    expect(pending!.conflict.campaign).toBe(true);
    pending!.answer("keep-both");
    expect(b.service.pendingConflicts()).toHaveLength(1);
    pending!.answer("keep-local");
    await run;
    expect(b.service.pendingConflicts()).toHaveLength(0);
  });

  test("with a game on the table the question is put off at once: the run ends, nothing is asked or written", async () => {
    let table = true;
    const { a, b } = await conflictSetup(undefined, { onTable: () => table });
    await a.service.syncNow();
    const asked: string[] = [];
    b.service.onConflict((pending) => asked.push(pending.conflict.gameId));
    const before = b.local.gameCommands("g1");
    const run = await b.service.syncNow();
    expect(run?.ok).toBe(true);
    expect(asked).toEqual([]);
    expect(b.local.gameCommands("g1")).toEqual(before);
    expect(b.service.takeHeldConflicts()).toBe(true);
    expect(b.service.takeHeldConflicts()).toBe(false);
    // Off the table, the next sync asks.
    table = false;
    const again = b.service.syncNow();
    await settle();
    expect(asked).toEqual(["g1"]);
    b.service.pendingConflicts()[0]!.answer("keep-local");
    await again;
  });

  test("Continue does not time out while a question about that game is waiting", async () => {
    const quick: Timers = {
      set: (fn, ms) => setTimeout(fn, ms >= 4000 ? 20 : ms),
      clear: (h) => clearTimeout(h as never),
    };
    const { a, b } = await conflictSetup(undefined, { timers: quick });
    await a.service.syncNow();
    let done: string | null = null;
    const resume = b.service.syncBeforeResume("g1").then((r) => (done = r));
    await settle();
    expect(b.service.pendingConflicts()).toHaveLength(1);
    expect(done).toBeNull();
    b.service.pendingConflicts()[0]!.answer("keep-remote");
    await resume;
    expect(done).toBe("synced");
    expect(b.local.gameCommands("g1")).toEqual(a.local.gameCommands("g1"));
  });

  test("unlinking while a question is open answers it and finishes", async () => {
    const { a, b } = await conflictSetup();
    await a.service.syncNow();
    const run = b.service.syncNow();
    await settle();
    expect(b.service.pendingConflicts()).toHaveLength(1);
    await b.service.unlink();
    await run;
    expect(b.service.pendingConflicts()).toHaveLength(0);
    expect(b.service.isOn()).toBe(false);
  });
});

describe("app start and resume", () => {
  test("start with a saved code syncs; with none it stays off", async () => {
    const server = new FakeServer();
    const on = make(server, { code: CODE });
    on.local.setDeck("a", "Deck A", 5);
    server.exists = true;
    await on.service.start();
    await settle();
    expect(on.service.status.get().state).toBe("synced");
    expect(server.liveCount()).toBe(1);

    const off = make();
    await off.service.start();
    expect(off.service.status.get().state).toBe("off");
  });

  test("syncBeforeResume reports off when not linked, and announces checking while linked", async () => {
    const off = make();
    expect(await off.service.syncBeforeResume("g")).toBe("off");

    const server = new FakeServer();
    const on = make(server, { code: CODE });
    server.exists = true;
    await on.service.start();
    await settle();
    const events: boolean[] = [];
    on.service.onResumeChecking((checking) => events.push(checking));
    expect(await on.service.syncBeforeResume("g")).toBe("synced");
    expect(events).toEqual([true, false]);
  });

  test("applied remote changes notify listeners", async () => {
    const server = new FakeServer();
    const a = make(server);
    a.local.setDeck("a", "Deck A", 5);
    await a.service.setUp();
    await settle();
    const b = make(server);
    let applied = 0;
    b.service.onApplied(() => applied++);
    await b.service.join(CODE);
    await settle();
    expect(applied).toBeGreaterThan(0);
  });
});
