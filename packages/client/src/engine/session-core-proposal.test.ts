import { describe, expect, test } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore, MOVED_REFUSAL } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
  seed: 2026,
  watchable: true,
  room: "room00000001",
  roomPlayMode: "host",
};

function anyLegalCommand(legal: LegalActions): Command {
  if (legal.kind === "choice") {
    const option = legal.choice.options[0]!;
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: [option.optionId],
    };
  }
  if (legal.kind !== "turn") throw new Error("nothing legal");
  return (legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0]!).example;
}

async function started(config: SessionConfig = CONFIG) {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const first = await core.start(config);
  const acting = first.snapshot.legal!.playerId as string;
  const other = acting === "p1" ? "p2" : "p1";
  return { core, acting, other, command: anyLegalCommand(core.legalActions(first.snapshot.legal!.playerId)) };
}

describe("a seat holder's proposal reaching the engine", () => {
  test("is applied exactly as a host command: same log, one more command", async () => {
    const { core, acting, command } = await started();
    const before = core.liveGame()!.game.commands.length;
    const result = core.dispatchProposal(command, before, core.liveChecksum(), [acting]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.snapshot.version).toBe(before + 1);
    expect(core.liveGame()!.game.commands.at(-1)).toEqual(command);
  });

  test("is refused stale on an old base, and changes nothing", async () => {
    const { core, acting, command } = await started();
    expect(core.dispatchProposal(command, 3, core.liveChecksum(), [acting])).toEqual({ ok: false, reason: "stale" });
    expect(core.liveGame()!.game.commands).toHaveLength(0);
  });

  test("is refused not-your-turn when the table waits on someone else's hero", async () => {
    const { core, other, command } = await started();
    expect(core.dispatchProposal(command, 0, core.liveChecksum(), [other])).toEqual({
      ok: false,
      reason: "not-your-turn",
    });
    expect(core.dispatchProposal(command, 0, core.liveChecksum(), [])).toEqual({ ok: false, reason: "not-your-turn" });
    expect(core.liveGame()!.game.commands).toHaveLength(0);
  });

  test("is refused illegal when the engine rejects it, and the game is untouched", async () => {
    const { core, acting } = await started();
    const bad = { type: "playCard", playerId: acting, cardInstanceId: "nope", payment: [], attachToInstanceId: null };
    expect(core.dispatchProposal(bad, 0, core.liveChecksum(), [acting])).toEqual({ ok: false, reason: "illegal" });
    expect(core.liveGame()!.game.commands).toHaveLength(0);
  });

  test("never lets a seat adjust the table: illegal in Host control, strict in a Strict room", async () => {
    for (const [mode, reason] of [
      ["host", "illegal"],
      ["strict", "strict"],
    ] as const) {
      const { core, acting } = await started({ ...CONFIG, roomPlayMode: mode });
      const adjust = { type: "adjust", playerId: acting, adjustment: { kind: "draw", playerId: acting, count: 1 } };
      expect(core.dispatchProposal(adjust, 0, core.liveChecksum(), [acting])).toEqual({ ok: false, reason });
      expect(core.liveGame()!.game.commands).toHaveLength(0);
    }
  });

  test("takes nothing at a table that belongs to no room", async () => {
    const { core, acting, command } = await started({ ...CONFIG, room: undefined } as unknown as SessionConfig);
    expect(core.dispatchProposal(command, 0, core.liveChecksum(), [acting]).ok).toBe(false);
    expect(core.liveGame()!.game.commands).toHaveLength(0);
  });
});

describe("a proposal and a rewind", () => {
  test("built on the table before a rewind and a different move to the same count is stale", async () => {
    const { core, acting } = await started();
    const first = core.legalActions(acting as never);
    const legal = first.kind === "choice" ? first.choice.options : [];
    // Two different answers to the opening question give two different tables at command count 1.
    expect(first.kind).toBe("choice");
    expect(legal.length).toBeGreaterThanOrEqual(2);
    if (first.kind !== "choice") return;
    const answer = (index: number): Command => ({
      type: "resolveChoice",
      playerId: first.choice.playerId,
      choiceId: first.choice.choiceId,
      selectedOptionIds: [legal[index]!.optionId],
    });
    expect(core.dispatch(answer(0)).ok).toBe(true);
    const staleStamp = core.liveChecksum();
    await core.rewindTo(0);
    const second = core.dispatch(answer(1));
    expect(second.ok).toBe(true);
    expect(core.liveChecksum()).not.toBe(staleStamp);
    const toAct = second.ok ? second.snapshot.legal!.playerId : acting;
    const next = anyLegalCommand(core.legalActions(toAct as never));
    const actor = next.playerId as string;
    expect(core.dispatchProposal(next, 1, staleStamp, [actor])).toEqual({ ok: false, reason: "stale" });
    expect(core.dispatchProposal(next, 1, core.liveChecksum(), [actor]).ok).toBe(true);
  });

  test("a rewind worked out for an older table is refused and cuts nothing", async () => {
    const { core, acting, command } = await started();
    expect(core.dispatchProposal(command, 0, core.liveChecksum(), [acting]).ok).toBe(true);
    await expect(core.rewindTo(0, { fromVersion: 0 })).rejects.toThrow(MOVED_REFUSAL);
    expect(core.liveGame()!.game.commands).toHaveLength(1);
    await expect(core.rewindTo(0, { fromVersion: 1 })).resolves.toBeDefined();
    expect(core.liveGame()!.game.commands).toHaveLength(0);
  });
});
