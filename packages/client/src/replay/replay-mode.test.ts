import { describe, expect, test, vi } from "vitest";
import type { EngineHost } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { emptyLog } from "../view/log-lines.js";

// The real app session builds a worker-backed host; this stands in for it with plain fields.
const session = vi.hoisted(() => ({
  host: null as unknown as EngineHost,
  store: null as unknown as SessionStore,
  gameLog: null as unknown,
  villainReview: null as unknown,
}));
vi.mock("../session.js", () => ({
  appSession: () => session,
  swapSessionHost: (host: EngineHost, store: SessionStore) => {
    const previous = { host: session.host, store: session.store };
    session.host = host;
    session.store = store;
    return previous;
  },
}));

// The fake replay's state is a stub: the store takes it as the table without sealing or reading whose turn it is.
vi.mock("../view/hidden-reverse.js", () => ({ sealForTable: (state: unknown) => state }));
vi.mock("../engine/acting-player.js", () => ({ actingPlayer: () => null }));

const { activeReplay, enterReplay, leaveReplay } = await import("./replay-mode.js");
const { ReplayHost } = await import("./replay-host.js");

/** A replay host whose backend answers the opening position and counts disposals. */
function fakeReplay(): { readonly host: InstanceType<typeof ReplayHost>; readonly disposed: () => number } {
  let disposed = 0;
  const host = new ReplayHost({
    open: async () => ({
      cardPool: {},
      info: {
        length: 3,
        total: 3,
        moments: [],
        divergedAt: null,
        failure: null,
        otherBuild: false,
        writer: { appVersion: "1", contentVersion: "a" },
        config: { scenarioId: "rhino", difficulty: "standard", players: [], seed: 1 },
        createdAt: 0,
        outcome: null,
        round: 1,
      },
    }),
    snapshot: async (n) =>
      ({
        version: n,
        state: { outcome: null, firstPlayerId: "p1", players: [] },
        events: [],
        legal: null,
        record: {},
      }) as never,
    exportFile: async () => ({ bytes: new Uint8Array(), name: "x" }),
    exportLog: async () => ({ text: "", name: "x" }),
    dispose: () => void (disposed += 1),
  });
  return { host, disposed: () => disposed };
}

describe("replay mode", () => {
  test("puts the replay on the session and the game's own host, store, log and review back after", async () => {
    const liveHost = { subscribe: () => () => {} } as unknown as EngineHost;
    const liveStore = new SessionStore(liveHost);
    const liveLog = emptyLog();
    const review = { round: 2 };
    Object.assign(session, { host: liveHost, store: liveStore, gameLog: liveLog, villainReview: review });
    const liveState = liveStore.state;

    const { host, disposed } = fakeReplay();
    await host.open({ kind: "file", bytes: new Uint8Array() });
    const replayStore = await enterReplay(host);
    expect(activeReplay()).toBe(host);
    expect(session.host).toBe(host);
    expect(session.store).toBe(replayStore);
    expect(replayStore.state.status).toBe("playing");
    session.gameLog = emptyLog();
    session.villainReview = null;

    leaveReplay();
    expect(activeReplay()).toBeNull();
    expect(session.host).toBe(liveHost);
    expect(session.store).toBe(liveStore);
    expect(liveStore.state).toBe(liveState);
    expect(session.gameLog).toBe(liveLog);
    expect(session.villainReview).toBe(review);
    expect(disposed()).toBe(1);
    leaveReplay();
    expect(disposed()).toBe(1);
  });

  test("a second replay replaces the first, and leaving puts the game's own back", async () => {
    const liveHost = { subscribe: () => () => {} } as unknown as EngineHost;
    const liveStore = new SessionStore(liveHost);
    Object.assign(session, { host: liveHost, store: liveStore });
    const first = fakeReplay();
    const second = fakeReplay();
    await first.host.open({ kind: "file", bytes: new Uint8Array() });
    await second.host.open({ kind: "file", bytes: new Uint8Array() });
    await enterReplay(first.host);
    await enterReplay(second.host);
    expect(first.disposed()).toBe(1);
    expect(activeReplay()).toBe(second.host);
    leaveReplay();
    expect(session.host).toBe(liveHost);
    expect(session.store).toBe(liveStore);
  });
});
