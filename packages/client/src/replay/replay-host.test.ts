import { describe, expect, test, vi } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { EngineUpdate, SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { ReplayCore, ReplayOpenError } from "./replay-core.js";
import { LocalReplayBackend, OPEN_DEADLINE_MS, ReplayHost, WorkerReplayBackend } from "./replay-host.js";
import { decodeReplay } from "./replay-file.js";

vi.setConfig({ testTimeout: 30_000 });

const CONFIG: SessionConfig = {
  scenarioId: "ultron",
  difficulty: "standard",
  players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "core-iron-man-aggression" }],
  seed: 77,
};
const HERE = { appVersion: "1.0.0", contentVersion: "pool-a" };

function anyLegalCommand(legal: LegalActions): Command {
  if (legal.kind === "choice") {
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: legal.choice.options.slice(0, legal.choice.minSelections).map((option) => option.optionId),
    };
  }
  if (legal.kind !== "turn") throw new Error(`nothing legal (${legal.kind})`);
  const action = legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0];
  if (!action) throw new Error("no legal actions");
  return action.example;
}

/** A saved game of 15 commands, and the storage it lives in. */
async function savedGame(): Promise<{ readonly storage: MemoryGameStorage; readonly gameId: string }> {
  const storage = new MemoryGameStorage();
  const core = new EngineSessionCore({ storage });
  const started = await core.start(CONFIG);
  let toAct = started.snapshot.legal?.playerId ?? null;
  for (let i = 0; i < 15 && toAct; i++) {
    const dispatched = core.dispatch(anyLegalCommand(core.legalActions(toAct)));
    if (!dispatched.ok) throw new Error(dispatched.error.message);
    toAct = dispatched.snapshot.legal?.playerId ?? null;
  }
  await core.flushed();
  const [meta] = await storage.list();
  if (!meta) throw new Error("not saved");
  return { storage, gameId: meta.id };
}

async function openedHost(): Promise<ReplayHost> {
  const { storage, gameId } = await savedGame();
  const host = new ReplayHost(new LocalReplayBackend(new ReplayCore(HERE, storage)));
  await host.open({ kind: "stored", gameId });
  return host;
}

describe("ReplayHost", () => {
  test("publishes each position to a store, newest version last, whichever way it moves", async () => {
    const host = await openedHost();
    const store = new SessionStore(host);
    await store.resume("replay");
    expect(store.state.status).toBe("playing");
    expect(store.state.legal).toBeNull();

    await host.seek(10);
    expect(host.position).toBe(10);
    expect(store.state.lastEvents).toEqual([]);
    expect(store.state.resumedHistory.length).toBeGreaterThan(0);

    await host.stepBack();
    expect(host.position).toBe(9);
    expect(await host.step()).toBe(true);
    expect(host.position).toBe(10);
    expect(store.state.lastEvents.length).toBeGreaterThan(0);
    expect(store.state.resumedHistory).toEqual([]);
  });

  test("coalesces a burst of seeks into the newest target", async () => {
    const host = await openedHost();
    const seen: number[] = [];
    host.subscribe((update: EngineUpdate) => seen.push(update.version));
    const positions: number[] = [];
    host.onPosition(({ position }) => positions.push(position));
    await Promise.all([host.seek(3), host.seek(6), host.seek(9), host.seek(12)]);
    expect(host.position).toBe(12);
    // The first seek starts at once; the three behind it collapse into the last.
    expect(positions.slice(1)).toEqual([3, 12]);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  test("two quick steps play two commands, each once, and two quick steps back go back two", async () => {
    const host = await openedHost();
    await host.seek(5);
    const played: number[] = [];
    host.onPosition(({ position }) => played.push(position));
    played.length = 0;
    await Promise.all([host.step(), host.step()]);
    expect(played).toEqual([6, 7]);
    await Promise.all([host.stepBack(), host.stepBack()]);
    expect(host.position).toBe(5);
  });

  test("a failed move drops the ones behind it, and the next step counts from where the replay is", async () => {
    const { storage, gameId } = await savedGame();
    const core = new ReplayCore(HERE, storage);
    let failNext = false;
    const host = new ReplayHost({
      open: (source) => core.open(source),
      snapshot: async (n, played) => {
        if (failNext) {
          failNext = false;
          throw new Error("worker hiccup");
        }
        return core.snapshot(n, played);
      },
      exportFile: () => core.exportFile(),
      exportLog: async () => core.exportLog(),
      dispose: () => {},
    });
    await host.open({ kind: "stored", gameId });
    await host.seek(5);
    failNext = true;
    const both = Promise.all([host.step(), host.step()]);
    await expect(both).rejects.toThrow("worker hiccup");
    expect(host.position).toBe(5);
    expect(await host.step()).toBe(true);
    expect(host.position).toBe(6);
  });

  test("a move in flight when the replay closes settles quietly", async () => {
    const host = await openedHost();
    const moving = host.seek(10);
    host.dispose();
    await expect(moving).resolves.toBeUndefined();
  });

  test("stops at either end and refuses every command", async () => {
    const host = await openedHost();
    expect(await host.stepBack()).toBe(false);
    await host.seek(999);
    expect(host.position).toBe(host.info?.length);
    expect(await host.step()).toBe(false);
    const refused = await host.dispatch({ type: "endTurn", playerId: "p1" as never });
    expect(refused.ok).toBe(false);
    await expect(host.start(CONFIG)).rejects.toThrow();
  });

  test("exports the game's log as text", async () => {
    const host = await openedHost();
    const { text, name } = await host.exportLog();
    expect(name.endsWith("-log.txt")).toBe(true);
    expect(text.startsWith("Marvel Champions: ")).toBe(true);
    expect(text.split("\n").length).toBeGreaterThan(10);
  });

  test("a file's own pack data is never run, and a pack it names must be installed here", async () => {
    const host = await openedHost();
    const { bytes } = await host.exportFile();
    const parsed = await decodeReplay(bytes);
    if (!parsed.ok) throw new Error(parsed.error);
    const hostile = {
      ...parsed.file,
      config: { ...parsed.file.config, packs: [{ id: "evil", version: "1", decks: [{ quantity: 1e9 }] }] },
    };
    const open = (file: unknown, packs?: never[]) =>
      new ReplayHost(new LocalReplayBackend(new ReplayCore(HERE, null))).open({
        kind: "file",
        bytes: new TextEncoder().encode(JSON.stringify(file)),
        ...(packs ? { packs } : {}),
      });
    const info = await open(hostile);
    expect(info.config.packs).toBeUndefined();
    await expect(open({ ...parsed.file, packs: [{ id: "gwenpool", version: "0.2.2" }] }, [])).rejects.toMatchObject({
      code: "missingPacks",
    });
  });

  test("a file's starting state is set up afresh, and an implausible setup is refused", async () => {
    const host = await openedHost();
    const { bytes } = await host.exportFile();
    const parsed = await decodeReplay(bytes);
    if (!parsed.ok) throw new Error(parsed.error);
    const reopen = (file: unknown) =>
      new ReplayHost(new LocalReplayBackend(new ReplayCore(HERE, null))).open({
        kind: "file",
        bytes: new TextEncoder().encode(JSON.stringify(file)),
      });
    // A tampered baseline is never run: the game starts from its own setup, and the first checksum matches.
    const tampered = await reopen({ ...parsed.file, initialState: { ...parsed.file.initialState, round: 999 } });
    expect(tampered.divergedAt).toBeNull();
    expect(tampered.length).toBe(host.info?.length);
    await expect(
      reopen({ ...parsed.file, config: { ...parsed.file.config, modes: { heroic: 1e9 } } }),
    ).rejects.toMatchObject({ code: "damaged" });
  });

  test("a worker that takes too long is stopped and the replay fails", async () => {
    vi.useFakeTimers();
    try {
      let terminated = false;
      const silent = {
        addEventListener: () => {},
        postMessage: () => {},
        terminate: () => void (terminated = true),
      } as unknown as Worker;
      const backend = new WorkerReplayBackend(() => silent);
      const opening = backend.open({ kind: "file", bytes: new Uint8Array() });
      const settled = expect(opening).rejects.toMatchObject({ code: "damaged" });
      await vi.advanceTimersByTimeAsync(OPEN_DEADLINE_MS + 1);
      await settled;
      expect(terminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a saved game that is gone can't be opened", async () => {
    const host = new ReplayHost(new LocalReplayBackend(new ReplayCore(HERE, new MemoryGameStorage())));
    await expect(host.open({ kind: "stored", gameId: "nope" })).rejects.toBeInstanceOf(ReplayOpenError);
  });

  test("exports a file that opens to the same game", async () => {
    const host = await openedHost();
    const { bytes, name } = await host.exportFile();
    expect(name.endsWith(".mcreplay")).toBe(true);
    const again = new ReplayHost(new LocalReplayBackend(new ReplayCore(HERE, null)));
    const info = await again.open({ kind: "file", bytes });
    expect(info.length).toBe(host.info?.length);
    expect(info.divergedAt).toBeNull();
  });
});
