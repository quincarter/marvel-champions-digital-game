import { describe, expect, test, vi } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { t } from "../i18n/translate.js";
import { EngineSessionCore } from "../engine/session-core.js";
import type { EngineUpdate, SessionConfig } from "../engine/host.js";
import { LIVE_HEADER_FORMAT, LIVE_HEADER_VERSION } from "./live-publisher.js";
import { actingPlayer } from "../engine/acting-player.js";
import { SeatEngineHost, refusalMessage } from "./seat-host.js";
import { SeatFollower, type SeatFeedPort } from "./seat-follower.js";

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

/** What a room host would hold: the header, and a way to play the next command on the authoritative engine. */
async function hostedGame() {
  const core = new EngineSessionCore();
  const started = await core.start(CONFIG);
  const { cardPool: _pool, ...initialState } = core.save().initialState;
  const header = {
    format: LIVE_HEADER_FORMAT,
    version: LIVE_HEADER_VERSION,
    writer: HERE,
    config: started.snapshot.config,
    createdAt: 1,
    initialState,
  };
  const commands: Command[] = [];
  let toAct = started.snapshot.legal?.playerId ?? null;
  const next = (): Command => {
    if (!toAct) throw new Error("the game is over");
    const command = anyLegalCommand(core.legalActions(toAct));
    const dispatched = core.dispatch(command);
    if (!dispatched.ok) throw new Error(dispatched.error.message);
    commands.push(command);
    toAct = dispatched.snapshot.legal?.playerId ?? null;
    return command;
  };
  return { header, commands, next, core };
}

/** A fake room worker end: what the seat sends over the feed is recorded, what the room says is delivered. */
class FakeFeed implements SeatFeedPort {
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  sent: unknown[] = [];
  closed = false;
  postMessage(message: unknown): void {
    this.sent.push(message);
  }
  start(): void {}
  close(): void {
    this.closed = true;
  }
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
const logOf = (header: unknown, commands: readonly Command[], epoch?: number) => ({
  ch: "game",
  kind: "log",
  table: "t1",
  header,
  commands,
  checksums: {},
  ...(epoch === undefined ? {} : { epoch }),
});
const appended = (from: number, commands: readonly Command[]) => ({
  ch: "game",
  kind: "commands",
  table: "t1",
  from,
  commands,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function seatAt(count: number, options: { leaveSeats?: () => void; pidGeneration?: number } = {}) {
  const game = await hostedGame();
  for (let i = 0; i < count; i++) game.next();
  const feed = new FakeFeed();
  const timers: { run: () => void; ms: number; cleared: boolean }[] = [];
  const follower = new SeatFollower({ feed, packs: [] });
  const host = new SeatEngineHost(follower, {
    pidGeneration: 0,
    ...options,
    setTimer: (run, ms) => {
      const timer = { run, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as { cleared: boolean }).cleared = true;
    },
  });
  const updates: EngineUpdate[] = [];
  host.subscribe((update) => updates.push(update));
  const joining = host.join();
  feed.say(welcome);
  feed.say(logOf(game.header, game.commands, 1));
  const first = await joining;
  return { game, feed, follower, host, updates, first, timers };
}

describe("SeatEngineHost", () => {
  test("follows the room's log: the first update is the table after its commands, and each new command is an update", async () => {
    const { game, feed, host, updates, first } = await seatAt(3);
    expect(first.version).toBe(3);
    expect(first.history?.length).toBeGreaterThan(0);
    expect(first.trail).toHaveLength(3);
    // No hero is held yet: the board is read-only whoever is to act.
    expect(first.legal).toBeNull();
    const command = game.next();
    feed.say(appended(3, [command]));
    await flush();
    expect(updates.map((u) => u.version)).toEqual([4]);
    expect(updates[0]!.events.length).toBeGreaterThan(0);
    // Someone else's move: the store adds it to its trail.
    expect(updates[0]!.remote).toEqual(command);
    expect(host.status.hostConnected).toBe(true);
  });

  test("legal actions are filled only for a hero this device holds", async () => {
    const { feed, host, updates, first } = await seatAt(2);
    const acting = actingPlayer(first.state);
    expect(acting).not.toBeNull();
    const other = first.state.players.map((p) => p.playerId).find((id) => id !== acting)!;

    await host.setPlayers([other]);
    expect(updates.at(-1)!.legal).toBeNull();
    expect((await host.legalActions(acting!)).kind).toBe("notYourTurn");

    await host.setPlayers([acting!]);
    const mine = updates.at(-1)!;
    expect(mine.version).toBe(first.version);
    expect(mine.legal?.playerId).toBe(acting);
    expect(mine.legal?.actions.kind).not.toBe("gameOver");
    expect((await host.legalActions(acting!)).kind).not.toBe("notYourTurn");
    expect(feed.sent).toEqual([]);
  });

  test("dispatch sends a proposal built on the log length and resolves when the host's echo arrives", async () => {
    const { game, feed, host, updates, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));

    const result = host.dispatch(command);
    // The stamp is the identity of the table it was built on: the host's own state at the same count has the same one.
    expect(feed.sent).toEqual([{ kind: "propose", command, base: 2, pid: 1, stamp: game.core.liveChecksum() }]);
    // Nothing is applied before the echo.
    expect(updates.at(-1)!.version).toBe(2);

    // The authoritative engine applied the same command; the room says so, then streams it back.
    game.core.dispatch(command);
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 2, pid: 1 });
    feed.say(appended(2, [command]));
    const done = await result;
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.update.version).toBe(3);
      expect(done.update.remote).toBeUndefined();
    }
    expect(updates.at(-1)!.version).toBe(3);
  });

  test("a delayed acceptance of an old seat host's proposal does not accept the new host's proposal", async () => {
    // The first host's first proposal is pid 1 on generation 0; a restarted host counts from 1 again, in generation 1.
    const old = await seatAt(2, { pidGeneration: 0 });
    const oldActing = actingPlayer(old.first.state)!;
    await old.host.setPlayers([oldActing]);
    void old.host.dispatch(anyLegalCommand(await old.host.legalActions(oldActing)));
    expect(old.feed.sent.map((m) => (m as { pid: number }).pid)).toEqual([1]);

    const { game, feed, host, first, timers } = await seatAt(2, { pidGeneration: 1 });
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    expect((feed.sent[0] as { pid: number }).pid).not.toBe(1);

    // The old acceptance arrives late on the new feed, then the same command lands from another seat.
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 2, pid: 1 });
    game.core.dispatch(command);
    feed.say(appended(2, [command]));
    timers.at(-1)!.run();
    expect((await result).ok).toBe(false);
  });

  test("an acceptance naming my pid but another base is not about my proposal", async () => {
    const { game, feed, host, first, timers } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 7, pid: 1 });
    game.core.dispatch(command);
    feed.say(appended(2, [command]));
    timers.at(-1)!.run();
    expect((await result).ok).toBe(false);
  });

  test("a proposal the host refuses resolves not-ok with a readable error", async () => {
    const { feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));

    const result = host.dispatch(command);
    feed.say({ ch: "game", kind: "proposal-refused", table: "t1", reason: "not-your-turn", base: 2, pid: 1 });
    const done = await result;
    expect(done.ok).toBe(false);
    if (!done.ok) {
      expect(done.error.message).toBe(refusalMessage("not-your-turn"));
      expect(done.error.code).toBe("not_active_player");
      expect(done.error.command).toEqual(command);
    }
  });

  test("the room's own refusal of a proposal fails it at once, not after the wait", async () => {
    const { feed, host, first, timers } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    feed.say({ ch: "room", kind: "refused", reason: "not-seated", pid: 1 });
    const done = await result;
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.message).toBe(refusalMessage("not-seated"));
    expect(timers.at(-1)!.cleared).toBe(true);
  });

  test("a room refusal with no proposal outstanding (chat, a seat request) is not a refused move", async () => {
    const { feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    feed.say({ ch: "room", kind: "refused", reason: "rate-limited" });
    await flush();
    expect(host.status.over).toBe(false);
  });

  test("a refused chat line or seat request does not fail the proposal in flight, and its echo still lands", async () => {
    const { game, feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    let settled = false;
    const result = host.dispatch(command).then((r) => ((settled = true), r));
    // Refusals of other operations carry no proposal id (or one that is not mine): they are not about this move.
    feed.say({ ch: "room", kind: "refused", reason: "rate-limited" });
    feed.say({ ch: "room", kind: "refused", reason: "not-allowed", rid: 4 });
    feed.say({ ch: "room", kind: "refused", reason: "rate-limited", pid: 99 });
    await flush();
    expect(settled).toBe(false);
    game.core.dispatch(command);
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 2, pid: 1 });
    feed.say(appended(2, [command]));
    expect((await result).ok).toBe(true);
  });

  test("two identical proposals built on the same log length: only the one the host accepted resolves ok, the other gets its refusal", async () => {
    const { game, feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const one = host.dispatch(command);
    const two = host.dispatch(command);
    expect(feed.sent.map((m) => (m as { pid: number }).pid)).toEqual([1, 2]);
    // The host took the second and refused the first; the identical command in the log is not the first's.
    game.core.dispatch(command);
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 2, pid: 2 });
    feed.say(appended(2, [command]));
    expect((await two).ok).toBe(true);
    feed.say({ ch: "game", kind: "proposal-refused", table: "t1", reason: "stale", base: 2, pid: 1 });
    const loser = await one;
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect(loser.error.message).toBe(refusalMessage("stale"));
  });

  test("an identical command another device got into the log is not my acceptance: I wait for my own refusal", async () => {
    const { game, feed, host, updates, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    let settled = false;
    const mine = host.dispatch(command).then((r) => ((settled = true), r));
    game.core.dispatch(command);
    // Accepted for someone else: no `proposal-accepted` for me.
    feed.say(appended(2, [command]));
    await flush();
    expect(settled).toBe(false);
    expect(updates.at(-1)!.version).toBe(3);
    // Someone else's move: the store adds it to its trail.
    expect(updates.at(-1)!.remote).toEqual(command);
    feed.say({ ch: "game", kind: "proposal-refused", table: "t1", reason: "stale", base: 2, pid: 1 });
    expect((await mine).ok).toBe(false);
  });

  test("an acceptance that comes after the log's echo settles the proposal at once", async () => {
    const { game, feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    game.core.dispatch(command);
    feed.say(appended(2, [command]));
    await flush();
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 2, pid: 1 });
    const done = await result;
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.update.version).toBe(3);
  });

  test("results replayed by the room after a reconnect resolve the pending proposal, and ones for unknown pids or repeats change nothing", async () => {
    const { game, feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    // The reconnect catch-up carries the move; the room then replays its ledger of results for the seat.
    game.core.dispatch(command);
    feed.say(appended(2, [command]));
    await flush();
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 1, pid: 99 });
    feed.say({ ch: "game", kind: "proposal-refused", table: "t1", reason: "stale", base: 2, pid: 98 });
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 2, pid: 1 });
    const done = await result;
    expect(done.ok).toBe(true);
    feed.say({ ch: "game", kind: "proposal-accepted", table: "t1", base: 2, pid: 1 });
    await flush();
  });

  test("a lost acceptance and a lost refusal: another device's identical command is not mine, the wait ends as unanswered", async () => {
    const { game, feed, host, first, timers } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    const timer = timers.at(-1)!;
    game.core.dispatch(command);
    feed.say(appended(2, [command]));
    await flush();
    timer.run();
    const done = await result;
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.message).toBe(t("seat.msg.noAnswer"));
  });

  test("an append that lands before the room refuses my stale proposal still lets that refusal (by pid) fail it", async () => {
    const { game, feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    game.core.dispatch(command);
    feed.say(appended(2, [command]));
    await flush();
    feed.say({ ch: "room", kind: "refused", reason: "not-seated", pid: 1 });
    const done = await result;
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.message).toBe(refusalMessage("not-seated"));
  });

  test("with no echo and no acceptance the wait still ends as unanswered", async () => {
    const { host, first, timers } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const result = host.dispatch(command);
    timers.at(-1)!.run();
    expect((await result).ok).toBe(false);
  });

  test("a host refusal names its proposal: the other proposal on the same log length stays pending", async () => {
    const { feed, host, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    let secondSettled = false;
    const one = host.dispatch(command);
    void host.dispatch(command).then(() => (secondSettled = true));
    feed.say({ ch: "game", kind: "proposal-refused", table: "t1", reason: "stale", base: 2, pid: 1 });
    expect((await one).ok).toBe(false);
    await flush();
    expect(secondSettled).toBe(false);
  });

  test("Concede from a seat leaves the seats and proposes nothing: the game goes on", async () => {
    const leaveSeats = vi.fn();
    const { feed, host, first } = await seatAt(2, { leaveSeats });
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const done = await host.dispatch({ type: "concede", playerId: acting } as Command);
    expect(done.ok).toBe(true);
    expect(leaveSeats).toHaveBeenCalledTimes(1);
    expect(feed.sent).toEqual([]);
  });

  test("a proposal nobody answers is given up after the timeout", async () => {
    const { host, first, timers } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));

    const result = host.dispatch(command);
    const timer = timers.at(-1)!;
    expect(timer.ms).toBe(15_000);
    timer.run();
    const done = await result;
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.message).toMatch(/did not answer/);
    expect(timer.cleared).toBe(true);
  });

  test("someone else's command at the position a proposal was built on settles it as stale", async () => {
    const { game, feed, host, updates, first } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const mine = anyLegalCommand(await host.legalActions(acting));

    const result = host.dispatch(mine);
    // The host's own device played another command first (a different one at the same position).
    const theirs: Command = { type: "endTurn", playerId: acting } as Command;
    const applied = game.core.dispatch(theirs);
    expect(applied.ok).toBe(true);
    feed.say(appended(2, [theirs]));
    // A different command is stale at once; one identical to mine waits for the host's refusal of my proposal.
    if (JSON.stringify(mine) === JSON.stringify(theirs)) {
      feed.say({ ch: "game", kind: "proposal-refused", table: "t1", reason: "stale", base: 2, pid: 1 });
    }
    const done = await result;
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.message).toBe(refusalMessage("stale"));
    expect(updates.at(-1)!.version).toBe(3);
    expect(updates.at(-1)!.remote).toEqual(theirs);
  });

  describe("reconnect while a proposal is out", () => {
    async function proposed() {
      const ctx = await seatAt(2);
      const acting = actingPlayer(ctx.first.state)!;
      await ctx.host.setPlayers([acting]);
      const command = anyLegalCommand(await ctx.host.legalActions(acting));
      const result = ctx.host.dispatch(command);
      // The host applied it while this guest was away.
      ctx.game.core.dispatch(command);
      ctx.game.commands.push(command);
      return { ...ctx, command, result };
    }
    const ledger = (feed: FakeFeed, epoch?: number) =>
      feed.say({
        ch: "game",
        kind: "proposal-accepted",
        table: "t1",
        base: 2,
        pid: 1,
        ...(epoch === undefined ? {} : { epoch }),
      });

    test("the ledger's acceptance before the reconnect log settles the proposal ok when both name the same epoch", async () => {
      const { feed, game, result } = await proposed();
      ledger(feed, 1);
      feed.say(logOf(game.header, game.commands, 1));
      const done = await result;
      expect(done.ok).toBe(true);
      if (done.ok) expect(done.update.version).toBe(3);
    });

    test("an older room names no epoch: an acceptance proves nothing across a reconnect, so the proposal waits for its timeout", async () => {
      const { feed, game, result, timers } = await proposed();
      ledger(feed);
      feed.say(logOf(game.header, game.commands));
      await flush();
      timers.at(-1)!.run();
      const done = await result;
      expect(done.ok).toBe(false);
    });

    test("an acceptance already delivered, then a rewind and the identical command played again, does not settle ok after the reconnect", async () => {
      const { feed, game, result } = await proposed();
      // The acceptance reached this guest (epoch 1), which dropped before the echo. The host rewound to the base (epoch 2)
      // and played the byte-identical command; this guest never saw the first one or the rewind.
      ledger(feed, 1);
      feed.say(logOf(game.header, game.commands, 2));
      const done = await result;
      expect(done.ok).toBe(false);
      if (!done.ok) expect(done.error.message).toBe(t("seat.msg.changed"));
    });

    test("a reconnect log that arrives in several frames settles an accepted proposal ok, not as a cut", async () => {
      for (const acceptFirst of [true, false]) {
        const { feed, game, result } = await proposed();
        const parts = (): void => {
          // The first part holds one command (below the proposal's base of 2); the rest continue it up to the total.
          feed.say({ ...logOf(game.header, game.commands.slice(0, 1), 1), total: game.commands.length });
          feed.say(appended(1, [game.commands[1]!]));
          feed.say(appended(2, game.commands.slice(2)));
        };
        if (acceptFirst) ledger(feed, 1);
        parts();
        if (!acceptFirst) ledger(feed, 1);
        const done = await result;
        expect(done.ok).toBe(true);
        if (done.ok) expect(done.update.version).toBe(3);
      }
    });

    test("a reset in another epoch fails a proposal still waiting for its acceptance", async () => {
      const { feed, game, result } = await proposed();
      feed.say(logOf(game.header, game.commands, 2));
      const done = await result;
      expect(done.ok).toBe(false);
    });

    test("the ledger's acceptance after the reconnect log settles the proposal ok", async () => {
      const { feed, game, host, result } = await proposed();
      feed.say(logOf(game.header, game.commands));
      await flush();
      ledger(feed);
      const done = await result;
      expect(done.ok).toBe(true);
      expect(host).toBeDefined();
    });

    /** The host rewound to the base and played a different command there while this guest was away. */
    async function replaced() {
      const ctx = await seatAt(2);
      const acting = actingPlayer(ctx.first.state)!;
      await ctx.host.setPlayers([acting]);
      const legal = await ctx.host.legalActions(acting);
      // Mine is a move other than ending the turn; the replacement at the same base is the end of the turn.
      const other = legal.kind === "turn" ? legal.legal.find((l) => l.action.kind !== "endTurn") : undefined;
      if (!other) throw new Error("this position has no move besides ending the turn");
      const command = other.example;
      const theirs: Command = { type: "endTurn", playerId: acting } as Command;
      const result = ctx.host.dispatch(command);
      expect(ctx.game.core.dispatch(theirs).ok).toBe(true);
      ctx.game.commands.push(theirs);
      return { ...ctx, result };
    }

    test("an acceptance before a reset holding a different command at the base does not settle the removed move ok", async () => {
      const { feed, game, result } = await replaced();
      ledger(feed);
      feed.say(logOf(game.header, game.commands));
      const done = await result;
      expect(done.ok).toBe(false);
      if (!done.ok) expect(done.error.message).toBe(refusalMessage("stale"));
    });

    test("a delayed acceptance after a reset that replaced the command at the base does not settle ok", async () => {
      const { feed, game, host, result } = await replaced();
      feed.say(logOf(game.header, game.commands));
      await flush();
      ledger(feed);
      const done = await result;
      expect(done.ok).toBe(false);
      expect(host).toBeDefined();
    });

    test("an acceptance held across a rewind to the base does not credit an identical command played there afterwards", async () => {
      const { feed, game, result } = await proposed();
      // The host applied mine and the echo arrives: it waits for the acceptance, which is held back with the dropped socket.
      feed.say(appended(2, [game.commands[2]!]));
      await flush();
      // The host rewinds to the base (the guest sees a reset of length 2), then plays the byte-identical command again.
      feed.say(logOf(game.header, game.commands.slice(0, 2)));
      await flush();
      ledger(feed);
      feed.say(appended(2, [game.commands[2]!]));
      const done = await result;
      expect(done.ok).toBe(false);
    });

    test("a reset that rewinds below the proposal's base fails it", async () => {
      const { feed, game, result } = await proposed();
      feed.say(logOf(game.header, game.commands.slice(0, 1)));
      const done = await result;
      expect(done.ok).toBe(false);
    });
  });

  test("a rewind from the host cuts the table back, and is taken although its version is lower", async () => {
    const { feed, host, updates, first } = await seatAt(4);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const waiting = host.dispatch(command);

    feed.say({ ch: "game", kind: "rewind", table: "t1", to: 2 });
    const done = await waiting;
    expect(done.ok).toBe(false);
    const cut = updates.at(-1)!;
    expect(cut.version).toBe(2);
    expect(cut.rewound).toBe(true);
    expect(cut.trail).toHaveLength(2);
    expect(cut.history?.length).toBeGreaterThan(0);
    expect(cut.events).toEqual([]);
  });

  test("the end of the game closes the table to proposals", async () => {
    const { feed, host, first, game } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const waiting = host.dispatch(command);

    feed.say({ ch: "game", kind: "end", table: "t1", outcome: { result: "defeat" } });
    await flush();
    expect(host.status.over).toBe(true);
    expect((await waiting).ok).toBe(false);
    expect((await host.dispatch(game.next())).ok).toBe(false);
    // Only the move made before the end went out; nothing is sent once the game is over.
    expect(feed.sent).toHaveLength(1);
  });

  test("this device never keeps the room's game: saves and rewinds are refused, storage is empty", async () => {
    const { host } = await seatAt(1);
    await expect(host.rewindTo(0)).rejects.toThrow();
    await expect(host.save()).rejects.toThrow();
    await expect(host.start(CONFIG)).rejects.toThrow();
    expect(await host.latestSave()).toBeNull();
    expect(await host.activeSaves()).toEqual([]);
    expect(await host.listSaves()).toEqual([]);
    expect(await host.backfillSummaries()).toBe(0);
  });

  test("a reconnect that reads the log again is an update the store takes; an unanswered proposal keeps waiting for its timeout", async () => {
    const { game, feed, host, updates, first, timers } = await seatAt(2);
    const acting = actingPlayer(first.state)!;
    await host.setPlayers([acting]);
    const command = anyLegalCommand(await host.legalActions(acting));
    const waiting = host.dispatch(command);
    game.next();
    feed.say(logOf(game.header, game.commands));
    await flush();
    timers.at(-1)!.run();
    expect((await waiting).ok).toBe(false);
    expect(updates.at(-1)!.version).toBe(3);
    expect(updates.at(-1)!.rewound).toBe(true);
  });
});
