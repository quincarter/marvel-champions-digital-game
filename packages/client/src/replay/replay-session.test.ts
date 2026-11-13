import { describe, expect, test, vi } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage, type StoredGame } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { CHECKSUM_EVERY, decodeReplay, encodeReplay, parseReplay, replayFileNameOf } from "./replay-file.js";
import { ReplaySession, type ReplayLog } from "./replay-session.js";

vi.setConfig({ testTimeout: 30_000 });

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};
/** Four seats ending every turn: a game long enough for several checksums. */
const LONG_CONFIG: SessionConfig = {
  scenarioId: "ultron",
  difficulty: "standard",
  players: [
    { starterDeckId: "core-captain-marvel-leadership" },
    { starterDeckId: "core-iron-man-aggression" },
    { starterDeckId: "core-black-panther-protection" },
    { starterDeckId: "core-spider-man-justice" },
  ],
  seed: 1138,
};
const HERE = { appVersion: "1.0.0", contentVersion: "pool-a", build: "abc1234" };

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

/** A real stored game, played by always taking the first legal option. */
async function playedGame(commands: number, config: SessionConfig = CONFIG): Promise<StoredGame> {
  const storage = new MemoryGameStorage();
  const core = new EngineSessionCore({ storage });
  const started = await core.start(config);
  let toAct = started.snapshot.legal?.playerId ?? null;
  for (let i = 0; i < commands && toAct; i++) {
    const dispatched = core.dispatch(anyLegalCommand(core.legalActions(toAct)));
    if (!dispatched.ok) throw new Error(dispatched.error.message);
    toAct = dispatched.snapshot.legal?.playerId ?? null;
    if (dispatched.snapshot.state.outcome) break;
  }
  await core.flushed();
  const [meta] = await storage.list();
  const stored = meta ? await storage.load(meta.id) : null;
  if (!stored) throw new Error("the game did not save");
  return stored;
}

const logOf = (stored: StoredGame): ReplayLog => ({
  config: stored.meta.config,
  initialState: stored.initialState,
  commands: stored.commands,
  createdAt: stored.meta.createdAt,
  outcome: stored.meta.outcome,
  round: stored.meta.round,
});

describe("ReplaySession", () => {
  test("a log opens to every position, and a file made from it opens the same, with no divergence", async () => {
    const stored = await playedGame(25, LONG_CONFIG);
    const session = ReplaySession.open({ kind: "log", log: logOf(stored) }, HERE);
    expect(session.info.length).toBe(stored.commands.length);
    expect(session.info.failure).toBeNull();
    expect(session.info.divergedAt).toBeNull();
    expect(session.info.otherBuild).toBe(false);

    const file = session.toFile(Date.UTC(2026, 10, 13));
    expect(file.checksums).toHaveLength(Math.floor(stored.commands.length / CHECKSUM_EVERY) + 1);
    const reopened = ReplaySession.open({ kind: "file", file }, HERE);
    expect(reopened.info.divergedAt).toBeNull();
    for (const n of [0, 1, 7, stored.commands.length]) {
      expect(reopened.snapshotAt(n, false).state).toEqual(session.snapshotAt(n, false).state);
    }
  });

  test("a seek carries the history up to there and no events; a step carries that command's events", async () => {
    const stored = await playedGame(12);
    const session = ReplaySession.open({ kind: "log", log: logOf(stored) }, HERE);
    const seek = session.snapshotAt(5, false);
    expect(seek.version).toBe(5);
    expect(seek.events).toEqual([]);
    expect(seek.legal).toBeNull();
    const step = session.snapshotAt(5, true);
    expect(step.history).toBeUndefined();
    expect(seek.history?.slice(-step.events.length)).toEqual(step.events);
    expect(session.snapshotAt(999, false).version).toBe(stored.commands.length);
  });

  test("a file whose game plays out differently here says where it first differs", async () => {
    const stored = await playedGame(25, LONG_CONFIG);
    const file = ReplaySession.open({ kind: "log", log: logOf(stored) }, HERE).toFile(0);
    expect(file.commands.length).toBeGreaterThanOrEqual(CHECKSUM_EVERY);
    const tampered = { ...file, checksums: file.checksums.map((sum, k) => (k >= 1 ? `x${sum}` : sum)) };
    const session = ReplaySession.open({ kind: "file", file: tampered }, { ...HERE, contentVersion: "pool-b" });
    expect(session.info.divergedAt).toBe(CHECKSUM_EVERY);
    expect(session.info.otherBuild).toBe(true);
  });

  test("a log whose commands stop applying opens up to the first one that doesn't", async () => {
    const stored = await playedGame(12);
    const broken: Command = { type: "endTurn", playerId: "nobody" as never };
    const commands = [...stored.commands.slice(0, 4), broken, ...stored.commands.slice(4)];
    const session = ReplaySession.open({ kind: "log", log: { ...logOf(stored), commands } }, HERE);
    expect(session.info.length).toBe(4);
    expect(session.info.total).toBe(commands.length);
    expect(session.info.failure?.commandIndex).toBe(4);
  });
});

describe("replay file", () => {
  test("round-trips through its packed text", async () => {
    const stored = await playedGame(10);
    const file = ReplaySession.open({ kind: "log", log: logOf(stored) }, HERE).toFile(5);
    const bytes = await encodeReplay(file);
    expect(new TextDecoder().decode(bytes.subarray(0, 10))).toBe("MCREPLAY1\n");
    const parsed = await decodeReplay(bytes);
    expect(parsed).toEqual({ ok: true, file: JSON.parse(JSON.stringify(file)) });
  });

  test("reads plain JSON too, and refuses what is not a replay", async () => {
    expect(await decodeReplay(new TextEncoder().encode("{}"))).toEqual({ ok: false, error: "notReplay" });
    expect(await decodeReplay(new TextEncoder().encode("not json"))).toEqual({ ok: false, error: "notReplay" });
    expect(parseReplay({ format: "mc-replay", version: 99 })).toEqual({ ok: false, error: "newerFormat" });
    expect(parseReplay({ format: "mc-replay", version: 1 })).toEqual({ ok: false, error: "damaged" });
  });

  test("names the file for its scenario and day", () => {
    expect(replayFileNameOf({ config: CONFIG, exportedAt: Date.UTC(2026, 10, 13, 12) })).toBe(
      "rhino-2026-11-13.mcreplay",
    );
  });
});
