import { describe, expect, test, vi } from "vitest";
import type { Command } from "@mc/engine";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { RoomPlayRecord } from "../engine/room-play.js";
import { EngineSessionCore } from "../engine/session-core.js";
import type { SessionConfig } from "../engine/host.js";
import { LIVE_HEADER_FORMAT, LIVE_HEADER_VERSION } from "./live-publisher.js";
import { GameMirror } from "./room-game-mirror.js";
import { SeatFollower, type SeatFeedPort } from "./seat-follower.js";
import type { SeatEvent } from "./seat-protocol.js";

vi.setConfig({ testTimeout: 30_000 });

const CONFIG: SessionConfig = {
  scenarioId: "ultron",
  difficulty: "standard",
  players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "core-iron-man-aggression" }],
  seed: 77,
};

const RECORD: RoomPlayRecord = {
  role: "guest",
  roomId: "R".repeat(12),
  gameKey: `${"R".repeat(12)}:1`,
  mode: "standard",
  mySeats: ["p2"] as never,
  friends: ["Host"],
  tookOver: [],
  chatSent: 3,
  strict: false,
  cheats: false,
};

class FakeFeed implements SeatFeedPort {
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  postMessage(): void {}
  start(): void {}
  close(): void {}
  say(message: object): void {
    this.onmessage?.({ data: { kind: "server", message: { v: 1, ...message } } });
  }
}

const welcome = {
  ch: "room",
  kind: "welcome",
  you: { id: "me", role: "watcher" },
  caps: ["watch", "play"],
  participants: [{ id: "me", role: "watcher" }],
  tables: [{ id: "t1", hostConnected: true, commands: 0, ended: false, hasHeader: true }],
};

/** A room game whose host ended it at once: the first player concedes. */
async function endedGame(withAdjust = false) {
  const core = new EngineSessionCore();
  const started = await core.start(CONFIG);
  const { cardPool: _pool, ...initialState } = core.save().initialState;
  const header = {
    format: LIVE_HEADER_FORMAT,
    version: LIVE_HEADER_VERSION,
    writer: { appVersion: "1.0.0", contentVersion: "pool-a" },
    config: started.snapshot.config,
    createdAt: 1,
    initialState,
  };
  const commands: Command[] = [];
  if (withAdjust) {
    // Answer the opening choices (the mulligans), then adjust: an adjustment waits for no pending choice.
    let legal = started.snapshot.legal;
    while (legal?.actions.kind === "choice") {
      const choice = legal.actions.choice;
      const answer: Command = {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      };
      const dispatched = core.dispatch(answer);
      if (!dispatched.ok) throw new Error(dispatched.error.message);
      commands.push(answer);
      legal = dispatched.snapshot.legal;
    }
    const playerId = started.snapshot.legal!.playerId;
    commands.push({ type: "adjust", playerId, adjustment: { kind: "draw", playerId, count: 1 } });
  }
  commands.push({ type: "concede", playerId: started.snapshot.legal!.playerId });
  return { header, commands };
}

async function seat(
  deliver: "all" | "none",
  headerAdjusted = false,
  withAdjust = false,
  ended = true,
  storage = new MemoryGameStorage(),
) {
  const game = await endedGame(withAdjust);
  if (headerAdjusted) (game.header as { adjusted?: true }).adjusted = true;
  const feed = new FakeFeed();
  let ids = 0;
  let clock = 0;
  const follower = new SeatFollower({
    feed,
    packs: [],
    finishDeps: { storage, now: () => 500 + clock++, newId: () => `guest-${++ids}` },
  });
  const events: SeatEvent[] = [];
  follower.onEvent((event) => events.push(event));
  const opening = follower.open();
  feed.say(welcome);
  feed.say({
    ch: "game",
    kind: "log",
    table: "t1",
    header: game.header,
    commands: deliver === "all" ? game.commands : [],
    checksums: {},
  });
  await opening;
  // The room's end frame: a guest's row is only written once the authoritative end has arrived.
  if (deliver === "all" && ended) feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
  return { game, storage, follower, feed, events };
}

describe("a guest's finished row (#909)", () => {
  test("a guest finishing writes one row with the record, the outcome's status and the full log", async () => {
    const { game, storage, follower } = await seat("all");
    await expect(follower.finish(RECORD)).resolves.toBe(true);
    const rows = await storage.list();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.id).toBe("guest-1");
    expect(row.roomPlay).toEqual(RECORD);
    expect(row.status).not.toBe("active");
    expect(row.commandCount).toBe(game.commands.length);
    const stored = (await storage.load(row.id))!;
    expect(stored.commands).toEqual(game.commands);
    expect(row.config.players).toHaveLength(2);
  });

  test("a second finish for the same game, even from a repeat report, writes nothing", async () => {
    const { storage, follower } = await seat("all");
    await expect(follower.finish(RECORD)).resolves.toBe(true);
    await expect(follower.finish({ ...RECORD, chatSent: 9 })).resolves.toBe(false);
    expect(await storage.list()).toHaveLength(1);
    // A later game of the same room is another row.
    await expect(follower.finish({ ...RECORD, gameKey: `${RECORD.roomId}:2` })).resolves.toBe(true);
    expect(await storage.list()).toHaveLength(2);
  });

  test("a host record and a game still running here write nothing", async () => {
    const { storage, follower } = await seat("all");
    await expect(follower.finish({ ...RECORD, role: "host" })).resolves.toBe(false);
    expect(await storage.list()).toHaveLength(0);
    const running = await seat("none");
    await expect(running.follower.finish(RECORD)).resolves.toBe(false);
    expect(await running.storage.list()).toHaveLength(0);
  });

  test("a record that arrives before the last command is written when it lands", async () => {
    const { game, storage, follower, feed } = await seat("none");
    await expect(follower.finish(RECORD)).resolves.toBe(false);
    feed.say({ ch: "game", kind: "commands", table: "t1", from: 0, commands: game.commands, checksums: {} });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await storage.list()).toHaveLength(0);
    feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
    await vi.waitFor(async () => expect(await storage.list()).toHaveLength(1));
  });

  describe("the authoritative end commits the row, and a reopen invalidates it", () => {
    test("a finish request before the end frame waits; the end's adjusted flag lands in the row", async () => {
      const { storage, follower, feed } = await seat("all", false, false, false);
      await expect(follower.finish(RECORD)).resolves.toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await storage.list()).toHaveLength(0);
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: null, adjusted: true });
      await vi.waitFor(async () => expect(await storage.list()).toHaveLength(1));
      expect((await storage.list())[0]!.adjusted).toBe(true);
    });

    test("the end frame before the finish request: the request writes at once", async () => {
      const { storage, follower, feed } = await seat("all", false, false, false);
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: null, adjusted: true });
      await expect(follower.finish(RECORD)).resolves.toBe(true);
      expect((await storage.list())[0]!.adjusted).toBe(true);
    });

    test("win, rewind of the same game, then an adjusted not-won finish: one row, adjusted", async () => {
      const { game, storage, follower, feed } = await seat("all");
      await expect(follower.finish(RECORD)).resolves.toBe(true);
      const first = (await storage.list())[0]!;
      expect(first.adjusted).toBeUndefined();
      // The host undoes the end (a same-count rewind reopens the table): the row no longer stands.
      feed.say({ ch: "game", kind: "rewind", table: "t1", to: game.commands.length });
      await vi.waitFor(async () => expect((await storage.list())[0]!.status).toBe("abandoned"));
      // The host finishes it again, adjusted, as a loss.
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
      await vi.waitFor(async () => expect((await storage.list())[0]!.adjusted).toBe(true));
      const rows = await storage.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(first.id);
      // The fixture game ends by a concession, which the engine stores as "abandoned" (neither won nor lost).
      expect(rows[0]!.status).not.toBe("won");
      expect(rows[0]!.roomPlay).toEqual(RECORD);
    });

    test("a rewind to an earlier count, new commands and a new end replace the row with the new log", async () => {
      const { game, storage, follower, feed } = await seat("all");
      await follower.finish(RECORD);
      feed.say({ ch: "game", kind: "rewind", table: "t1", to: game.commands.length - 1 });
      await vi.waitFor(async () => expect((await storage.list())[0]!.status).toBe("abandoned"));
      feed.say({
        ch: "game",
        kind: "commands",
        table: "t1",
        from: game.commands.length - 1,
        commands: game.commands.slice(-1),
        checksums: {},
      });
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await vi.waitFor(async () => expect((await storage.list())[0]!.updatedAt).toBeGreaterThan(0));
      await vi.waitFor(async () =>
        expect((await storage.load((await storage.list())[0]!.id))!.commands).toHaveLength(game.commands.length),
      );
      expect(await storage.list()).toHaveLength(1);
    });

    test("a reopened game's row, once won, is set aside as abandoned and its stamp moves", async () => {
      const { game, storage, follower, feed } = await seat("all");
      await follower.finish(RECORD);
      const row = (await storage.list())[0]!;
      // The fixture ends by a concession (stored as abandoned): make it a stored win to see the flip.
      await storage.setStatus(row.id, "won", 1);
      feed.say({ ch: "game", kind: "rewind", table: "t1", to: game.commands.length });
      await vi.waitFor(async () => expect((await storage.list())[0]!.status).toBe("abandoned"));
      const aside = (await storage.list())[0]!;
      expect(aside.updatedAt).toBeGreaterThan(1);
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await vi.waitFor(async () => expect((await storage.list())[0]!.updatedAt).toBeGreaterThan(aside.updatedAt));
      const rows = await storage.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.createdAt).toBe(row.createdAt);
    });

    test("a reopen while the write is still in flight leaves one row", async () => {
      const game = await endedGame();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      class SlowStorage extends MemoryGameStorage {
        override async createFinished(...args: Parameters<MemoryGameStorage["createFinished"]>): Promise<void> {
          await gate;
          return super.createFinished(...args);
        }
      }
      const storage = new SlowStorage();
      const feed = new FakeFeed();
      let ids = 0;
      const follower = new SeatFollower({
        feed,
        packs: [],
        finishDeps: { storage, now: () => 500, newId: () => `guest-${++ids}` },
      });
      const opening = follower.open();
      feed.say(welcome);
      feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: game.commands, checksums: {} });
      await opening;
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      const first = follower.finish(RECORD);
      await new Promise((resolve) => setTimeout(resolve, 20));
      // Reopened and ended again while the first write waits.
      feed.say({ ch: "game", kind: "rewind", table: "t1", to: game.commands.length });
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
      await new Promise((resolve) => setTimeout(resolve, 20));
      release();
      await first;
      await vi.waitFor(async () => expect((await storage.list())[0]?.adjusted).toBe(true));
      expect(await storage.list()).toHaveLength(1);
    });

    test("a reconnect log of the ended game, then its end, leaves the row alone", async () => {
      const { game, storage, follower, feed, events } = await seat("all");
      await follower.finish(RECORD);
      const before = (await storage.list())[0]!;
      feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: game.commands, checksums: {} });
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(await storage.list()).toEqual([before]);
      expect(events.some((event) => event.type === "saved")).toBe(false);
    });

    test("a multi-part reconnect log of the ended game, then its end, keeps the saved win", async () => {
      const { game, storage, follower, feed, events } = await seat("all", false, true);
      await follower.finish(RECORD);
      const row = (await storage.list())[0]!;
      await storage.setStatus(row.id, "won", 1);
      const total = game.commands.length;
      expect(total).toBeGreaterThan(2);
      const cut = Math.floor(total / 2);
      // The first part carries `total`; nothing is judged until the rest has come.
      feed.say({
        ch: "game",
        kind: "log",
        table: "t1",
        header: game.header,
        commands: game.commands.slice(0, cut),
        total,
        checksums: {},
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect((await storage.list())[0]!.status).toBe("won");
      feed.say({
        ch: "game",
        kind: "commands",
        table: "t1",
        from: cut,
        commands: game.commands.slice(cut),
        checksums: {},
      });
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect((await storage.list())[0]!.status).toBe("won");
      expect(events.some((event) => event.type === "saved")).toBe(false);
    });

    test("a reconnect to an already reopened table with the identical log and a welcome that says running: the win stops counting", async () => {
      const { game, storage, follower, feed, events } = await seat("all");
      await follower.finish(RECORD);
      const row = (await storage.list())[0]!;
      await storage.setStatus(row.id, "won", 1);
      // The seat was away while the host reopened the game with a same-count rewind: the welcome says it is running,
      // the log is byte for byte the ended one and no end frame follows.
      feed.say({
        ...welcome,
        tables: [{ id: "t1", hostConnected: true, commands: game.commands.length, ended: false, hasHeader: true }],
      });
      feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: game.commands, checksums: {} });
      await vi.waitFor(async () => expect((await storage.list())[0]!.status).toBe("abandoned"));
      expect(events.some((event) => event.type === "saved")).toBe(true);
    });

    test("a final write that fails is retried with a backoff and lands once, with no further room message", async () => {
      const game = await endedGame();
      let failures = 1;
      class FlakyStorage extends MemoryGameStorage {
        override async createFinished(...args: Parameters<MemoryGameStorage["createFinished"]>): Promise<void> {
          if (failures-- > 0) throw new Error("disk full");
          return super.createFinished(...args);
        }
      }
      const storage = new FlakyStorage();
      const feed = new FakeFeed();
      const timers: { run: () => void; ms: number; live: boolean }[] = [];
      let ids = 0;
      const follower = new SeatFollower({
        feed,
        packs: [],
        finishDeps: { storage, now: () => 500, newId: () => `guest-${++ids}` },
        setTimer: (run, ms) => {
          const timer = { run, ms, live: true };
          timers.push(timer);
          return timer;
        },
        clearTimer: (handle) => {
          (handle as { live: boolean }).live = false;
        },
      });
      const events: SeatEvent[] = [];
      follower.onEvent((event) => events.push(event));
      const opening = follower.open();
      feed.say(welcome);
      feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: game.commands, checksums: {} });
      await opening;
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await expect(follower.finish(RECORD)).resolves.toBe(false);
      expect(await storage.list()).toEqual([]);
      // Storage recovered; nothing else comes from the room, only the timer.
      const retry = timers.filter((t) => t.live).at(-1)!;
      retry.run();
      await vi.waitFor(async () => expect(await storage.list()).toHaveLength(1));
      await vi.waitFor(() => expect(events.some((event) => event.type === "saved")).toBe(true));
      expect(await storage.list()).toHaveLength(1);
    });

    test("an invalidation whose write fails is retried with the backoff, with no further room message", async () => {
      const game = await endedGame();
      // The rewind's own update retries once at once; the second failure is left to the backoff timer.
      let failures = 2;
      class FlakyStatus extends MemoryGameStorage {
        override async setStatus(...args: Parameters<MemoryGameStorage["setStatus"]>): Promise<void> {
          if (args[1] === "abandoned" && failures-- > 0) throw new Error("quota");
          return super.setStatus(...args);
        }
      }
      const storage = new FlakyStatus();
      const feed = new FakeFeed();
      const timers: { run: () => void; live: boolean }[] = [];
      let ids = 0;
      const follower = new SeatFollower({
        feed,
        packs: [],
        finishDeps: { storage, now: () => 500, newId: () => `guest-${++ids}` },
        setTimer: (run) => {
          const timer = { run, live: true };
          timers.push(timer);
          return timer;
        },
        clearTimer: (handle) => {
          (handle as { live: boolean }).live = false;
        },
      });
      const events: SeatEvent[] = [];
      follower.onEvent((event) => events.push(event));
      const opening = follower.open();
      feed.say(welcome);
      feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: game.commands, checksums: {} });
      await opening;
      timers.length = 0;
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await follower.finish(RECORD);
      const row = (await storage.list())[0]!;
      await storage.setStatus(row.id, "won", 1);
      feed.say({ ch: "game", kind: "rewind", table: "t1", to: game.commands.length });
      await vi.waitFor(() => expect(timers.some((t) => t.live)).toBe(true));
      expect((await storage.list())[0]!.status).toBe("won");
      // Storage recovered; the room says nothing more, only the timer.
      timers
        .filter((t) => t.live)
        .at(-1)!
        .run();
      await vi.waitFor(async () => expect((await storage.list())[0]!.status).toBe("abandoned"));
      expect(events.some((event) => event.type === "saved")).toBe(true);
    });

    test("a row written by the end after the finish call answered is announced with a saved event", async () => {
      const { storage, follower, feed, events } = await seat("all", false, false, false);
      await expect(follower.finish(RECORD)).resolves.toBe(false);
      expect(events.some((event) => event.type === "saved")).toBe(false);
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await vi.waitFor(() => expect(events.some((event) => event.type === "saved")).toBe(true));
      // The row is already stored when the event is out.
      expect(await storage.list()).toHaveLength(1);
    });

    describe("a reconnect log of the same length but other moves is a reopened game", () => {
      /** The same game with the last command (a concession by the first player) made by the second player. */
      const divergent = (commands: readonly Command[]): Command[] => [
        ...commands.slice(0, -1),
        { type: "concede", playerId: "p2" } as Command,
      ];

      test("with no end after it, the old row is set aside and not credited", async () => {
        const { game, storage, follower, feed } = await seat("all");
        await follower.finish(RECORD);
        const row = (await storage.list())[0]!;
        await storage.setStatus(row.id, "won", 1);
        const other = divergent(game.commands);
        expect(other).toHaveLength(game.commands.length);
        feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: other, checksums: {} });
        await vi.waitFor(async () => expect((await storage.list())[0]!.status).toBe("abandoned"));
      });

      test("with a later end, the row is replaced by the new log", async () => {
        const { game, storage, follower, feed } = await seat("all");
        await follower.finish(RECORD);
        const other = divergent(game.commands);
        feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: other, checksums: {} });
        feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
        await vi.waitFor(async () => {
          const rows = await storage.list();
          expect(rows).toHaveLength(1);
          expect((await storage.load(rows[0]!.id))!.commands).toEqual(other);
        });
      });
    });

    test("a fresh follower re-finishing with the same count and status but another summary replaces the row", async () => {
      const first = await seat("all");
      await first.follower.finish(RECORD);
      const row = (await first.storage.list())[0]!;
      const stored = (await first.storage.load(row.id))!;
      const summary = row.summary as unknown as { feats?: unknown };
      // The row as an older or different run left it: same status, count and adjusted flag, other feats.
      await first.storage.replaceFinished(
        { ...row, summary: { ...summary, feats: { tampered: 1 } } as never },
        stored.initialState,
        stored.commands,
      );
      const second = await seat("all", false, false, true, first.storage);
      await expect(second.follower.finish(RECORD)).resolves.toBe(true);
      const rows = await first.storage.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.summary).toEqual(row.summary);
      // The same result again is a repeat.
      const third = await seat("all", false, false, true, first.storage);
      await expect(third.follower.finish(RECORD)).resolves.toBe(false);
    });

    describe("a fresh follower joining the admission reconciles the stored result", () => {
      /** A new follower (the guest reloaded) opening the same admission over `commands`, the table ended or not. */
      async function rejoin(
        storage: MemoryGameStorage,
        game: Awaited<ReturnType<typeof endedGame>>,
        commands: readonly Command[],
        tableEnded: boolean,
      ) {
        const feed = new FakeFeed();
        const events: SeatEvent[] = [];
        const follower = new SeatFollower({
          feed,
          packs: [],
          gameKey: RECORD.gameKey,
          finishDeps: { storage, now: () => 900, newId: () => "fresh" },
        });
        follower.onEvent((event) => events.push(event));
        const opening = follower.open();
        feed.say({
          ...welcome,
          tables: [{ id: "t1", hostConnected: true, commands: commands.length, ended: tableEnded, hasHeader: true }],
        });
        feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands, checksums: {} });
        await opening;
        return { feed, follower, events };
      }

      test("a saved win, then an active log of the same admission with no end: the row stops counting", async () => {
        const first = await seat("all");
        await first.follower.finish(RECORD);
        const row = (await first.storage.list())[0]!;
        await first.storage.setStatus(row.id, "won", 1);
        first.follower.dispose();
        // The host undid the end: the same admission is running again over the same log.
        const second = await rejoin(first.storage, first.game, first.game.commands, false);
        await vi.waitFor(async () => expect((await first.storage.list())[0]!.status).toBe("abandoned"));
        expect(second.events.some((event) => event.type === "saved")).toBe(true);
        expect(await first.storage.list()).toHaveLength(1);
        // The next end replaces it (the stored record is enough, no finish call needed).
        second.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
        await vi.waitFor(async () => expect((await first.storage.list())[0]!.adjusted).toBe(true));
        expect(await first.storage.list()).toHaveLength(1);
      });

      test("a different log of the same admission sets the row aside", async () => {
        const first = await seat("all");
        await first.follower.finish(RECORD);
        const row = (await first.storage.list())[0]!;
        await first.storage.setStatus(row.id, "won", 1);
        first.follower.dispose();
        await rejoin(first.storage, first.game, first.game.commands.slice(0, -1), false);
        await vi.waitFor(async () => expect((await first.storage.list())[0]!.status).toBe("abandoned"));
      });

      test.each([
        ["a same-count rewind", 0, true],
        ["a rewind to an earlier move", 1, false],
      ])(
        "a saved win, a fresh follower joins the identical ended game, then %s: the row is set aside",
        async (_n, back, replaced) => {
          const first = await seat("all");
          await first.follower.finish(RECORD);
          const row = (await first.storage.list())[0]!;
          await first.storage.setStatus(row.id, "won", 1);
          first.follower.dispose();
          const second = await rejoin(first.storage, first.game, first.game.commands, true);
          second.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
          await new Promise((resolve) => setTimeout(resolve, 30));
          expect((await first.storage.list())[0]!.status).toBe("won");
          second.feed.say({ ch: "game", kind: "rewind", table: "t1", to: first.game.commands.length - back });
          await vi.waitFor(async () => expect((await first.storage.list())[0]!.status).toBe("abandoned"));
          expect(second.events.some((event) => event.type === "saved")).toBe(true);
          if (!replaced) return;
          // The next end of the same-count game replaces the row.
          second.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
          await vi.waitFor(async () => expect((await first.storage.list())[0]!.adjusted).toBe(true));
          expect(await first.storage.list()).toHaveLength(1);
        },
      );

      test("a reopen while the stored row is still being looked up invalidates the kept win", async () => {
        const first = await seat("all");
        await first.follower.finish(RECORD);
        const row = (await first.storage.list())[0]!;
        await first.storage.setStatus(row.id, "won", 1);
        first.follower.dispose();
        // The stored game's load is held open until the host has reopened the game.
        let release!: () => void;
        const held = new Promise<void>((resolve) => (release = resolve));
        const realLoad = first.storage.load.bind(first.storage);
        first.storage.load = async (id) => {
          await held;
          return realLoad(id);
        };
        const second = await rejoin(first.storage, first.game, first.game.commands, true);
        // The lookup is now parked on the held load.
        await new Promise((resolve) => setTimeout(resolve, 20));
        second.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
        second.feed.say({ ch: "game", kind: "rewind", table: "t1", to: first.game.commands.length });
        release();
        await vi.waitFor(async () => expect((await first.storage.list())[0]!.status).toBe("abandoned"));
        expect(second.events.some((event) => event.type === "saved")).toBe(true);
        second.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
        await vi.waitFor(async () => expect((await first.storage.list())[0]!.adjusted).toBe(true));
        expect(await first.storage.list()).toHaveLength(1);
      });

      test("the game ends while the join lookup is pending: the old win is replaced by the new result", async () => {
        const first = await seat("all");
        await first.follower.finish(RECORD);
        const row = (await first.storage.list())[0]!;
        await first.storage.setStatus(row.id, "won", 1);
        first.follower.dispose();
        let release!: () => void;
        const held = new Promise<void>((resolve) => (release = resolve));
        const realLoad = first.storage.load.bind(first.storage);
        first.storage.load = async (id) => {
          await held;
          return realLoad(id);
        };
        // The table is running when this follower joins; the final end arrives while the lookup is parked.
        const second = await rejoin(first.storage, first.game, first.game.commands, false);
        await new Promise((resolve) => setTimeout(resolve, 20));
        second.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
        release();
        // No further room traffic: the finish write follows the reconciliation by itself.
        const saved = () => second.events.filter((event) => event.type === "saved").length;
        // One saved for setting the old win aside, one for the new result replacing it.
        await vi.waitFor(() => expect(saved()).toBe(2));
        const rows = await first.storage.list();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.updatedAt).toBeGreaterThan(1);
      });

      test("the identical ended log leaves the row untouched", async () => {
        const first = await seat("all");
        await first.follower.finish(RECORD);
        const row = (await first.storage.list())[0]!;
        await first.storage.setStatus(row.id, "won", 1);
        first.follower.dispose();
        const second = await rejoin(first.storage, first.game, first.game.commands, true);
        second.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
        await new Promise((resolve) => setTimeout(resolve, 30));
        const rows = await first.storage.list();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.status).toBe("won");
        expect(rows[0]!.updatedAt).toBe(1);
        expect(second.events.some((event) => event.type === "saved")).toBe(false);
      });
    });

    test("a repeat end of the same result changes nothing", async () => {
      const { storage, follower, feed } = await seat("all");
      await follower.finish(RECORD);
      const before = (await storage.list())[0]!;
      feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await storage.list()).toEqual([before]);
    });
  });

  describe("adjusted games are marked adjusted", () => {
    const adjustedOf = async (s: Awaited<ReturnType<typeof seat>>, record = RECORD) => {
      await s.follower.finish(record);
      const rows = await s.storage.list();
      expect(rows).toHaveLength(1);
      return rows[0]!.adjusted;
    };

    test("a plain game is not", async () => {
      expect(await adjustedOf(await seat("all"))).toBeUndefined();
    });

    test("via the header", async () => {
      expect(await adjustedOf(await seat("all", true))).toBe(true);
    });

    test("via a rewind action", async () => {
      const s = await seat("all");
      s.feed.say({ ch: "game", kind: "rewind", table: "t1", to: s.game.commands.length, adjusted: true });
      s.feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
      expect(await adjustedOf(s)).toBe(true);
    });

    test("via the end action", async () => {
      const s = await seat("all");
      s.feed.say({ ch: "game", kind: "end", table: "t1", outcome: null, adjusted: true });
      expect(await adjustedOf(s)).toBe(true);
    });

    test("via an adjust command in the log", async () => {
      expect(await adjustedOf(await seat("all", false, true))).toBe(true);
    });

    test("via Cheats on the record", async () => {
      expect(await adjustedOf(await seat("all"), { ...RECORD, cheats: true })).toBe(true);
    });
  });

  test("a follower with no storage writes nothing", async () => {
    const game = await endedGame();
    const feed = new FakeFeed();
    const follower = new SeatFollower({ feed, packs: [] });
    const opening = follower.open();
    feed.say(welcome);
    feed.say({ ch: "game", kind: "log", table: "t1", header: game.header, commands: game.commands, checksums: {} });
    await opening;
    await expect(follower.finish(RECORD)).resolves.toBe(false);
  });
});

describe("a rematch on the same seat feed, and a seat attached late (#909)", () => {
  const KEY_A = `${RECORD.roomId}:main:gid-a`;
  const KEY_B = `${RECORD.roomId}:main:gid-b`;
  const recordA: RoomPlayRecord = { ...RECORD, gameKey: KEY_A, gid: "gid-a" };
  const recordB: RoomPlayRecord = { ...RECORD, gameKey: KEY_B, gid: "gid-b" };

  /** Game B: game A's setup, started again later (a new admission at the same table). */
  async function rematchOf() {
    const game = await endedGame();
    return { header: { ...game.header, createdAt: 2 }, commands: game.commands };
  }

  test("B's log is a new admission: A's row stands, adjusted, and B gets its own unadjusted row", async () => {
    const { storage, follower, feed, events } = await seat("all", true);
    await expect(follower.finish(recordA)).resolves.toBe(true);
    const rowA = (await storage.list())[0]!;
    expect(rowA.adjusted).toBe(true);
    const setStatus = vi.spyOn(storage, "setStatus");
    const b = await rematchOf();
    feed.say({ ch: "game", kind: "log", table: "t1", header: b.header, commands: b.commands, checksums: {} });
    feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
    await expect(follower.finish(recordB)).resolves.toBe(true);
    const rows = await storage.list();
    expect(rows).toHaveLength(2);
    const a = rows.find((row) => row.roomPlay?.gameKey === KEY_A)!;
    expect(a.status).toBe(rowA.status);
    expect(a.adjusted).toBe(true);
    const own = rows.find((row) => row.roomPlay?.gameKey === KEY_B)!;
    expect(own.id).not.toBe(a.id);
    expect(own.adjusted).toBeUndefined();
    // Nothing set A's row aside.
    expect(setStatus).not.toHaveBeenCalled();
    expect(events.filter((event) => event.type === "saved")).toHaveLength(0);
  });

  test("A's finish that arrives after B's log writes A's game, not B's", async () => {
    const { storage, follower, feed, game } = await seat("all", true);
    const b = await rematchOf();
    feed.say({ ch: "room", kind: "table", table: { ...welcome.tables[0], gid: "gid-b" } });
    feed.say({ ch: "game", kind: "log", table: "t1", header: b.header, commands: [], checksums: {} });
    await expect(follower.finish(recordA)).resolves.toBe(true);
    const rows = await storage.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.roomPlay?.gameKey).toBe(KEY_A);
    expect(rows[0]!.adjusted).toBe(true);
    expect(rows[0]!.commandCount).toBe(game.commands.length);
    // B then finishes on its own, unadjusted.
    feed.say({ ch: "game", kind: "commands", table: "t1", from: 0, commands: b.commands, checksums: {} });
    feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
    await expect(follower.finish(recordB)).resolves.toBe(true);
    const own = (await storage.list()).find((row) => row.roomPlay?.gameKey === KEY_B)!;
    expect(own.adjusted).toBeUndefined();
  });

  test("A's write still pending when B arrives lands as A's game", async () => {
    const storage = new MemoryGameStorage();
    let fail = true;
    const createFinished = storage.createFinished.bind(storage);
    storage.createFinished = (...args: Parameters<typeof createFinished>) =>
      fail ? Promise.reject(new Error("disk full")) : createFinished(...args);
    const { follower, feed, game } = await seat("all", true, false, true, storage);
    await expect(follower.finish(recordA)).resolves.toBe(false);
    const b = await rematchOf();
    feed.say({ ch: "game", kind: "log", table: "t1", header: b.header, commands: [], checksums: {} });
    fail = false;
    feed.say({ ch: "game", kind: "commands", table: "t1", from: 0, commands: b.commands.slice(0, 1), checksums: {} });
    await vi.waitFor(async () => expect(await storage.list()).toHaveLength(1));
    const row = (await storage.list())[0]!;
    expect(row.roomPlay?.gameKey).toBe(KEY_A);
    expect(row.adjusted).toBe(true);
    expect(row.commandCount).toBe(game.commands.length);
  });

  test("the same game's log again with its setup rebuilt (a resumed host) is a reopen, not a rematch", async () => {
    const { storage, follower, feed, game } = await seat("all");
    await expect(follower.finish(recordA)).resolves.toBe(true);
    // The host reloaded: the header keeps its creation time but its config was rebuilt from the save.
    const header = { ...game.header, config: { ...(game.header.config as object), extra: 1 } };
    feed.say({ ch: "game", kind: "log", table: "t1", header, commands: game.commands.slice(0, -1), checksums: {} });
    await vi.waitFor(async () => expect((await storage.list())[0]!.status).toBe("abandoned"));
    feed.say({
      ch: "game",
      kind: "commands",
      table: "t1",
      from: game.commands.length - 1,
      commands: game.commands.slice(-1),
      checksums: {},
    });
    feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
    await vi.waitFor(async () => expect((await storage.list())[0]!.adjusted).toBe(true));
    expect(await storage.list()).toHaveLength(1);
  });

  test("with no admission ids, A's late finish never binds to B, and B is written once", async () => {
    const plainA: RoomPlayRecord = { ...RECORD, gameKey: KEY_A };
    const plainB: RoomPlayRecord = { ...RECORD, gameKey: KEY_B };
    const { storage, follower, feed, game } = await seat("all", true);
    const b = await rematchOf();
    feed.say({ ch: "game", kind: "log", table: "t1", header: b.header, commands: [], checksums: {} });
    await expect(follower.finish(plainA)).resolves.toBe(true);
    feed.say({ ch: "game", kind: "commands", table: "t1", from: 0, commands: b.commands, checksums: {} });
    feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
    await expect(follower.finish(plainB)).resolves.toBe(true);
    const rows = await storage.list();
    expect(rows).toHaveLength(2);
    const a = rows.find((row) => row.roomPlay?.gameKey === KEY_A)!;
    expect(a.adjusted).toBe(true);
    expect(a.commandCount).toBe(game.commands.length);
    expect(rows.find((row) => row.roomPlay?.gameKey === KEY_B)!.adjusted).toBeUndefined();
  });

  test("a seat attached from the mirror after a flagged rewind and end writes an adjusted row", async () => {
    const game = await endedGame();
    const mirror = new GameMirror("t1");
    const n = game.commands.length;
    mirror.apply({
      v: 1,
      ch: "game",
      kind: "log",
      table: "t1",
      header: game.header,
      commands: game.commands,
      checksums: {},
    });
    mirror.apply({ v: 1, ch: "game", kind: "rewind", table: "t1", to: n, adjusted: true });
    mirror.apply({ v: 1, ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" }, adjusted: true });
    const snapshot = mirror.snapshot();
    expect(snapshot.map((message) => (message as { adjusted?: true }).adjusted)).toEqual([true, true]);
    const storage = new MemoryGameStorage();
    const feed = new FakeFeed();
    const follower = new SeatFollower({ feed, packs: [], finishDeps: { storage, now: () => 1, newId: () => "g" } });
    const opening = follower.open();
    feed.say(welcome);
    for (const message of snapshot) feed.say(message);
    await opening;
    await expect(follower.finish(RECORD)).resolves.toBe(true);
    expect((await storage.list())[0]!.adjusted).toBe(true);
  });

  test("a log that carries the room's adjusted flag latches it", async () => {
    const game = await endedGame();
    const storage = new MemoryGameStorage();
    const feed = new FakeFeed();
    const follower = new SeatFollower({ feed, packs: [], finishDeps: { storage, now: () => 1, newId: () => "g" } });
    const opening = follower.open();
    feed.say(welcome);
    feed.say({
      ch: "game",
      kind: "log",
      table: "t1",
      header: game.header,
      commands: game.commands,
      checksums: {},
      adjusted: true,
    });
    await opening;
    feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
    await expect(follower.finish(RECORD)).resolves.toBe(true);
    expect((await storage.list())[0]!.adjusted).toBe(true);
  });
});
