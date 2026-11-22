import { describe, expect, test, vi } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { LIVE_HEADER_FORMAT, LIVE_HEADER_VERSION } from "../live/live-publisher.js";
import { INITIAL_LIVE_STATE, type LiveWatchEvent } from "../live/watch-events.js";
import { ReplayCore, ReplayOpenError, type ReplayOpened } from "./replay-core.js";
import { LocalReplayBackend, ReplayHost } from "./replay-host.js";
import { CHECKSUM_EVERY, decodeReplay, replayChecksum } from "./replay-file.js";

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

/** What a host would stream for a real game: its header, commands and the checksums it took by command count. */
async function hostedGame(count: number) {
  const storage = new MemoryGameStorage();
  const core = new EngineSessionCore({ storage });
  const started = await core.start(CONFIG);
  const commands: Command[] = [];
  const checksums: Record<string, string> = { "0": replayChecksum(started.snapshot.state) };
  let toAct = started.snapshot.legal?.playerId ?? null;
  for (let i = 0; i < count && toAct; i++) {
    const command = anyLegalCommand(core.legalActions(toAct));
    const dispatched = core.dispatch(command);
    if (!dispatched.ok) throw new Error(dispatched.error.message);
    commands.push(command);
    if (commands.length % CHECKSUM_EVERY === 0) {
      checksums[String(commands.length)] = replayChecksum(dispatched.snapshot.state);
    }
    toAct = dispatched.snapshot.legal?.playerId ?? null;
  }
  await core.flushed();
  const [meta] = await storage.list();
  const stored = meta ? await storage.load(meta.id) : null;
  if (!stored) throw new Error("the game did not save");
  const header = {
    format: LIVE_HEADER_FORMAT,
    version: LIVE_HEADER_VERSION,
    writer: HERE,
    config: stored.meta.config,
    createdAt: stored.meta.createdAt,
    initialState: stored.initialState,
  };
  return { header, commands, checksums };
}

const openLive = (core: ReplayCore, game: Awaited<ReturnType<typeof hostedGame>>, upTo: number) =>
  core.open({
    kind: "live",
    header: game.header,
    commands: game.commands.slice(0, upTo),
    checksums: game.checksums,
    outcome: null,
  });

describe("a live replay source", () => {
  test("opens on the log so far, then follows appended commands", async () => {
    const game = await hostedGame(25);
    const core = new ReplayCore(HERE, null);
    const opened = await openLive(core, game, 5);
    expect(opened.info.length).toBe(5);
    const before = core.snapshot(5, false).state;

    const info = core.liveAppend(game.commands.slice(5, 8));
    expect(info.length).toBe(8);
    expect(info.total).toBe(8);
    expect(info.failure).toBeNull();
    // The new position is a real one: the same table a full replay of the first 8 commands gives.
    const full = new ReplayCore(HERE, null);
    await openLive(full, game, 8);
    expect(replayChecksum(core.snapshot(8, false).state)).toBe(replayChecksum(full.snapshot(8, false).state));
    // The position seen before is untouched.
    expect(replayChecksum(core.snapshot(5, false).state)).toBe(replayChecksum(before));
    // A step to the newest carries that command's events, as a replay step does.
    expect(core.snapshot(8, true).events.length).toBeGreaterThan(0);
  });

  test("checks the host's checksums as commands arrive, and says where it first differs", async () => {
    const game = await hostedGame(25);
    const core = new ReplayCore(HERE, null);
    await openLive(core, game, 5);
    const checksums = { [String(CHECKSUM_EVERY)]: "0:0:0" };
    const info = core.liveAppend(game.commands.slice(5, 12), checksums);
    expect(info.divergedAt).toBe(CHECKSUM_EVERY);

    const fine = new ReplayCore(HERE, null);
    await openLive(fine, game, 5);
    expect(fine.liveAppend(game.commands.slice(5, 25), game.checksums).divergedAt).toBeNull();
  });

  test("a rewind cuts the log, and what comes after replaces it", async () => {
    const game = await hostedGame(25);
    const core = new ReplayCore(HERE, null);
    await openLive(core, game, 15);
    const cut = core.liveRewind(9);
    expect(cut.length).toBe(9);
    expect(cut.moments.every((moment) => moment.commandIndex <= 9)).toBe(true);
    expect(() => core.snapshot(9, false)).not.toThrow();
    expect(core.snapshot(15, false).version).toBe(9);

    const again = core.liveAppend(game.commands.slice(9, 14));
    expect(again.length).toBe(14);
    const full = new ReplayCore(HERE, null);
    await openLive(full, game, 14);
    expect(replayChecksum(core.snapshot(14, false).state)).toBe(replayChecksum(full.snapshot(14, false).state));
  });

  test("a rewind to the end or past it changes nothing", async () => {
    const game = await hostedGame(12);
    const core = new ReplayCore(HERE, null);
    await openLive(core, game, 12);
    expect(core.liveRewind(40).length).toBe(12);
  });

  test("the end sets the outcome, and the replay exports as a file the checksums of which hold", async () => {
    const game = await hostedGame(22);
    const core = new ReplayCore(HERE, null);
    await openLive(core, game, 22);
    const outcome = { result: "victory" } as never;
    expect(core.liveEnd(outcome).outcome).toEqual(outcome);
    const { bytes } = await core.exportFile();
    const reopened = new ReplayCore(HERE, null);
    const opened = await reopened.open({ kind: "file", bytes });
    expect(opened.info.length).toBe(22);
    expect(opened.info.divergedAt).toBeNull();
  });

  test("a command that no longer applies stops the replay there and says so", async () => {
    const game = await hostedGame(10);
    const core = new ReplayCore(HERE, null);
    await openLive(core, game, 8);
    const bogus = { type: "endTurn", playerId: "nobody" } as unknown as Command;
    const info = core.liveAppend([bogus, game.commands[8]!]);
    expect(info.length).toBe(8);
    expect(info.total).toBe(10);
    expect(info.failure?.commandIndex).toBe(8);
  });

  test("a failure clears when the host cuts back to the failed command, and what it plays next applies", async () => {
    const game = await hostedGame(12);
    const core = new ReplayCore(HERE, null);
    await openLive(core, game, 8);
    const bogus = { type: "endTurn", playerId: "nobody" } as unknown as Command;
    expect(core.liveAppend([bogus]).failure?.commandIndex).toBe(8);
    // Stuck: more commands are not applied while the failure stands.
    expect(core.liveAppend([game.commands[8]!]).length).toBe(8);
    const cut = core.liveRewind(8);
    expect(cut.failure).toBeNull();
    expect(core.liveAppend([game.commands[8]!]).length).toBe(9);
  });

  test("appending one command at a time keeps every position right, and stepping to the newest has its events", async () => {
    const game = await hostedGame(30);
    const core = new ReplayCore(HERE, null);
    await openLive(core, game, 0);
    for (let i = 0; i < 30; i++) core.liveAppend([game.commands[i]!], game.checksums);
    const full = new ReplayCore(HERE, null);
    await openLive(full, game, 30);
    for (const n of [0, 7, 20, 29, 30]) {
      expect(replayChecksum(core.snapshot(n, false).state)).toBe(replayChecksum(full.snapshot(n, false).state));
    }
    expect(core.snapshot(30, true).events.length).toBeGreaterThan(0);
    expect(core.liveAppend([]).divergedAt).toBeNull();
  });

  test("never writes the host's watchable setting into an exported file", async () => {
    const game = await hostedGame(5);
    const core = new ReplayCore(HERE, null);
    await core.open({
      kind: "live",
      header: { ...game.header, config: { ...game.header.config, watchable: true } },
      commands: game.commands,
      checksums: game.checksums,
      outcome: null,
    });
    const { bytes } = await core.exportFile();
    const decoded = await decodeReplay(bytes);
    expect(decoded.ok && "watchable" in decoded.file.config).toBe(false);
  });

  test("a room game's header keeps its hidden hands for the watcher, and an exported file drops it (#887)", async () => {
    const game = await hostedGame(5);
    const core = new ReplayCore(HERE, null);
    const opened = await core.open({
      kind: "live",
      header: { ...game.header, config: { ...game.header.config, roomHandsHidden: true } },
      commands: game.commands,
      checksums: game.checksums,
      outcome: null,
    });
    expect(opened.info.config.roomHandsHidden).toBe(true);
    const { bytes } = await core.exportFile();
    const decoded = await decodeReplay(bytes);
    expect(decoded.ok && "roomHandsHidden" in decoded.file.config).toBe(false);
    const plain = new ReplayCore(HERE, null);
    expect((await openLive(plain, game, 5)).info.config.roomHandsHidden).toBeUndefined();
  });

  test("a header from a room with Cheats on opens adjusted on a guest's device", async () => {
    const game = await hostedGame(5);
    const plain = await new ReplayCore(HERE, null).open({
      kind: "live",
      header: game.header,
      commands: game.commands,
      checksums: game.checksums,
      outcome: null,
    });
    expect(plain.info.adjusted).toBe(false);
    const cheats = await new ReplayCore(HERE, null).open({
      kind: "live",
      header: { ...game.header, adjusted: true },
      commands: game.commands,
      checksums: game.checksums,
      outcome: null,
    });
    expect(cheats.info.adjusted).toBe(true);
  });

  test("refuses a header it cannot read", async () => {
    const core = new ReplayCore(HERE, null);
    await expect(
      core.open({ kind: "live", header: { format: "nope" }, commands: [], checksums: {}, outcome: null }),
    ).rejects.toMatchObject({ code: "damaged" } satisfies Partial<ReplayOpenError>);
  });
});

describe("a live replay in the host", () => {
  async function liveHost(upTo: number, own = false) {
    const game = await hostedGame(25);
    const core = new ReplayCore(HERE, null);
    let opened: ReplayOpened | null = null;
    const backend = new LocalReplayBackend(core, async () => {
      opened = await openLive(core, game, upTo);
      return opened;
    });
    const recorded: unknown[] = [];
    const host = new ReplayHost(backend, (entry) => void recorded.push(entry));
    await host.watch("A".repeat(12), "http://sync", [], undefined, own);
    const push = (event: LiveWatchEvent) => backend.emitLive(event);
    const grow = (from: number, to: number) => {
      const info = core.liveAppend(game.commands.slice(from, to), game.checksums);
      push({ type: "info", info, change: "append", added: to - from });
      return info;
    };
    return { host, game, core, push, grow, recorded };
  }

  test("opens at the newest position and follows each new command", async () => {
    const { host, grow } = await liveHost(5);
    expect(host.live).toEqual(INITIAL_LIVE_STATE);
    expect(host.position).toBe(5);
    expect(host.following).toBe(true);
    grow(5, 6);
    await vi.waitFor(() => expect(host.position).toBe(6));
    expect(host.following).toBe(true);
  });

  test("stays put when the viewer has stepped back, and Live jumps to the newest", async () => {
    const { host, grow } = await liveHost(5);
    await host.stepBack();
    expect(host.position).toBe(4);
    expect(host.following).toBe(false);
    grow(5, 7);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(host.position).toBe(4);
    expect(host.info?.length).toBe(7);
    await host.goLive();
    expect(host.position).toBe(7);
    expect(host.following).toBe(true);
  });

  test("a rewind behind the viewer moves them back to the cut", async () => {
    const { host, core, push, grow } = await liveHost(8);
    grow(8, 10);
    await vi.waitFor(() => expect(host.position).toBe(10));
    push({ type: "info", info: core.liveRewind(6), change: "rewind", added: 0 });
    await vi.waitFor(() => expect(host.position).toBe(6));
  });

  test("presence, the end and a closed room update the live state", async () => {
    const { host, core, push } = await liveHost(5);
    const seen: (boolean | undefined)[] = [];
    host.onLiveState((state) => seen.push(state?.hostConnected));
    push({ type: "presence", hostConnected: true, watchers: 3 });
    expect(host.live).toEqual({ hostConnected: true, watchers: 3, over: false, failed: false });
    push({ type: "info", info: core.liveEnd({ result: "defeat" } as never), change: "end", added: 0 });
    expect(host.live?.over).toBe(true);
    push({ type: "presence", hostConnected: false, watchers: 3 });
    expect(host.live).toEqual({ hostConnected: false, watchers: 3, over: true, failed: false });
    push({ type: "closed", reason: "ended" });
    expect(host.live?.over).toBe(true);
    expect(seen).toEqual([false, true, true, false, false]);
  });

  test("any end ends it, even with no outcome, and a rewind un-ends it", async () => {
    const { host, core, push } = await liveHost(8);
    push({ type: "info", info: core.liveEnd(null), change: "end", added: 0 });
    expect(host.live?.over).toBe(true);
    push({ type: "info", info: core.liveRewind(6), change: "rewind", added: 0 });
    expect(host.live?.over).toBe(false);
  });

  test("a failed feed marks the live game over and failed", async () => {
    const { host, push } = await liveHost(5);
    push({ type: "failed" });
    expect(host.live).toMatchObject({ over: true, failed: true });
  });

  describe("the watch history (#909)", () => {
    const WIN = { result: "win", reason: "villainDefeated" } as never;

    test("a game watched to its end while following is noted once", async () => {
      const { core, push, recorded } = await liveHost(5);
      push({ type: "info", info: core.liveEnd(WIN), change: "end", added: 0 });
      expect(recorded).toEqual([
        { roomId: "A".repeat(12), tableId: "main", gid: null, endedAt: expect.any(Number), outcome: "win" },
      ]);
    });

    test("not noted for an adjusted game", async () => {
      const { core, push, recorded } = await liveHost(5);
      push({ type: "info", info: core.liveEnd(WIN, true), change: "end", added: 0 });
      expect(recorded).toEqual([]);
    });

    test("not noted for your own or a seated game", async () => {
      const { core, push, recorded } = await liveHost(5, true);
      push({ type: "info", info: core.liveEnd(WIN), change: "end", added: 0 });
      expect(recorded).toEqual([]);
    });

    test("not noted when the viewer had stepped back, or the end has no outcome", async () => {
      const behind = await liveHost(5);
      await behind.host.stepBack();
      behind.push({ type: "info", info: behind.core.liveEnd(WIN), change: "end", added: 0 });
      expect(behind.recorded).toEqual([]);
      const capped = await liveHost(5);
      capped.push({ type: "info", info: capped.core.liveEnd(null), change: "end", added: 0 });
      expect(capped.recorded).toEqual([]);
    });
  });
});
