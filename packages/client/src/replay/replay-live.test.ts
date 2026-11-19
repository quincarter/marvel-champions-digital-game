import { describe, expect, test, vi } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { LIVE_HEADER_FORMAT, LIVE_HEADER_VERSION } from "../live/live-publisher.js";
import { INITIAL_LIVE_STATE, type LiveWatchEvent } from "../live/watch-events.js";
import { ReplayCore, ReplayOpenError, type ReplayOpened } from "./replay-core.js";
import { LocalReplayBackend, ReplayHost } from "./replay-host.js";
import { CHECKSUM_EVERY, replayChecksum } from "./replay-file.js";

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

  test("refuses a header it cannot read", async () => {
    const core = new ReplayCore(HERE, null);
    await expect(
      core.open({ kind: "live", header: { format: "nope" }, commands: [], checksums: {}, outcome: null }),
    ).rejects.toMatchObject({ code: "damaged" } satisfies Partial<ReplayOpenError>);
  });
});

describe("a live replay in the host", () => {
  async function liveHost(upTo: number) {
    const game = await hostedGame(25);
    const core = new ReplayCore(HERE, null);
    let opened: ReplayOpened | null = null;
    const backend = new LocalReplayBackend(core, async () => {
      opened = await openLive(core, game, upTo);
      return opened;
    });
    const host = new ReplayHost(backend);
    await host.watch("A".repeat(12), "http://sync", []);
    const push = (event: LiveWatchEvent) => backend.emitLive(event);
    const grow = (from: number, to: number) => {
      const info = core.liveAppend(game.commands.slice(from, to), game.checksums);
      push({ type: "info", info, change: "append", added: to - from });
      return info;
    };
    return { host, game, core, push, grow };
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
    expect(host.live).toEqual({ hostConnected: true, watchers: 3, over: false });
    push({ type: "info", info: core.liveEnd({ result: "defeat" } as never), change: "end", added: 0 });
    expect(host.live?.over).toBe(true);
    push({ type: "presence", hostConnected: false, watchers: 3 });
    expect(host.live).toEqual({ hostConnected: false, watchers: 3, over: true });
    push({ type: "closed", reason: "ended" });
    expect(host.live?.over).toBe(true);
    expect(seen).toEqual([false, true, true, false, false]);
  });
});
