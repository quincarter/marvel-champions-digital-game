import { describe, expect, test, vi } from "vitest";
import { applyCommands, type Command, type LegalActions, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { EngineSessionCore, rebuildBaseline } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { ReplayCursor } from "./replay-cursor.js";

// Every test here replays whole 100-200 command games and asserts on state and call counts, never on time.
// Under a loaded machine those replays pass vitest's 5 s default, so the file sets its own ceiling.
vi.setConfig({ testTimeout: 30_000 });

const CORE_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

const ULTRON_CONFIG: SessionConfig = {
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

/** Any one legal command for whoever must act right now — a pending choice's minimum answer, or the first legal action. */
function anyLegalCommand(legal: LegalActions, playerId: PlayerId): Command {
  if (legal.kind === "choice") {
    const picked = legal.choice.options.slice(0, legal.choice.minSelections);
    if (picked.length < legal.choice.minSelections) throw new Error("pending choice has too few options for its own minimum");
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: picked.map((option) => option.optionId),
    };
  }
  if (legal.kind !== "turn") throw new Error(`nothing legal for ${playerId} (${legal.kind})`);
  const action = legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0];
  if (!action) throw new Error("no legal actions at all");
  return action.example;
}

/** Plays a real game forward by always taking its first legal option, capturing the full `GameState` after every command. */
async function playGreedily(
  core: EngineSessionCore,
  storage: MemoryGameStorage,
  config: SessionConfig,
  maxCommands: number,
): Promise<{ readonly states: readonly ReturnType<typeof structuredClone>[]; readonly gameId: string }> {
  const started = await core.start(config);
  const states: unknown[] = [];
  let toAct = started.snapshot.legal?.playerId ?? null;
  for (let i = 0; i < maxCommands && toAct; i++) {
    const command = anyLegalCommand(core.legalActions(toAct), toAct);
    const dispatched = core.dispatch(command);
    if (!dispatched.ok) throw new Error(`command ${i} rejected: ${dispatched.error.message}`);
    states.push(dispatched.snapshot.state);
    toAct = dispatched.snapshot.legal?.playerId ?? null;
    if (dispatched.snapshot.state.outcome) break;
  }
  await core.flushed();
  // `latestSave` only offers a still-`active` game; a short scripted game can
  // legitimately end (win or lose) inside `maxCommands`, so this reads the
  // one game this test's own storage instance ever created, whatever its
  // final status.
  const [meta] = await storage.list();
  if (!meta) throw new Error("game did not save");
  return { states: states as never, gameId: meta.id };
}

describe("ReplayCursor", () => {
  test("at(0) is the setup baseline and at(length) is the final state", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    const { gameId } = await playGreedily(core, storage, CORE_CONFIG, 12);
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("no stored game");

    const cursor = ReplayCursor.fromStoredGame(stored.meta.config, stored.initialState, stored.commands);
    const baseline = rebuildBaseline(stored.meta.config, stored.initialState);

    expect(cursor.length).toBe(stored.commands.length);
    expect(cursor.at(0).state).toEqual(baseline.initialState);

    const groundTruth = applyCommands(baseline.initialState, stored.commands, POOL_DEPS);
    expect(groundTruth.ok).toBe(true);
    if (groundTruth.ok) expect(cursor.at(cursor.length).state).toEqual(groundTruth.state);
  });

  test("cursor.at(N) matches what the live game's own state was after N commands, for every N", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    const { states: liveStates, gameId } = await playGreedily(core, storage, CORE_CONFIG, 15);
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("no stored game");

    const cursor = ReplayCursor.fromStoredGame(stored.meta.config, stored.initialState, stored.commands);

    for (let n = 1; n <= liveStates.length; n++) {
      const { cardPool: _cardPool, ...withoutPool } = cursor.at(n).state;
      expect(withoutPool).toEqual(liveStates[n - 1]);
    }
  });

  test("stepping forward and back through the whole log lands on the same states either way", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    const { gameId } = await playGreedily(core, storage, CORE_CONFIG, 15);
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("no stored game");
    const cursor = ReplayCursor.fromStoredGame(stored.meta.config, stored.initialState, stored.commands);

    const forward: unknown[] = [];
    cursor.toStart();
    forward.push(cursor.current().state);
    for (let i = 0; i < cursor.length; i++) forward.push(cursor.stepForward().state);

    const backward: unknown[] = [];
    cursor.toEnd();
    backward.push(cursor.current().state);
    for (let i = 0; i < cursor.length; i++) backward.push(cursor.stepBack().state);
    backward.reverse();

    expect(forward).toEqual(backward);

    // Over-stepping past either end clamps rather than throwing or wrapping.
    cursor.toEnd();
    expect(cursor.stepForward().commandIndex).toBe(cursor.length);
    cursor.toStart();
    expect(cursor.stepBack().commandIndex).toBe(0);
  });

  test("jumping to an arbitrary index and back is exact (no drift from checkpoint reuse)", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    const { gameId } = await playGreedily(core, storage, CORE_CONFIG, 15);
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("no stored game");
    const cursor = ReplayCursor.fromStoredGame(stored.meta.config, stored.initialState, stored.commands);

    const mid = Math.floor(cursor.length / 2);
    const first = cursor.jumpTo(mid).state;
    cursor.toEnd();
    cursor.toStart();
    const second = cursor.jumpTo(mid).state;
    expect(second).toEqual(first);
  });

  test("moments mark round and phase boundaries, using log-lines' own 'Round N begins' wording", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    // A 4-player game, not the solo Rhino config: a command lands *inside*
    // the villain phase (rather than sailing through it and straight into
    // the next round's player phase in one command) once there's more than
    // one seat's minion activations and defend decisions to pause on, which
    // is what gives this test an actual command index where a jump would
    // show "still in the villain phase" rather than only its end result.
    const { gameId } = await playGreedily(core, storage, ULTRON_CONFIG, 40);
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("no stored game");
    const cursor = ReplayCursor.fromStoredGame(stored.meta.config, stored.initialState, stored.commands);

    const moments = cursor.moments;
    expect(moments[0]).toMatchObject({ commandIndex: 0, kind: "start" });

    const round2 = moments.find((m) => m.label === "Round 2 begins");
    expect(round2).toBeDefined();
    expect(cursor.at(round2!.commandIndex).state.round).toBe(2);

    const villainPhase = moments.find((m) => m.kind === "villainPhase" && m.round === 1);
    expect(villainPhase).toBeDefined();
    expect(cursor.at(villainPhase!.commandIndex).state.step.phase).toBe("villain");

    const playerPhase = moments.find((m) => m.kind === "playerPhase" && m.round === 2);
    expect(playerPhase).toBeDefined();
    expect(cursor.at(playerPhase!.commandIndex).state.step.phase).toBe("player");

    // Moments are strictly ordered by the command index they belong to.
    for (let i = 1; i < moments.length; i++) expect(moments[i]!.commandIndex).toBeGreaterThanOrEqual(moments[i - 1]!.commandIndex);
  });

  test("never touches the live session: its state and log are identical, by reference where applicable, before and after any cursor movement", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    await playGreedily(core, storage, CORE_CONFIG, 10);

    const savedBefore = core.save();

    const cursor = ReplayCursor.fromLog(savedBefore.initialState, savedBefore.commands);
    // Move it around as hard as a real jump-list/scrubber would.
    cursor.toEnd();
    cursor.toStart();
    for (let i = 0; i < cursor.length; i++) cursor.stepForward();
    for (let i = 0; i < cursor.length; i++) cursor.stepBack();
    cursor.jumpTo(Math.floor(cursor.length / 2));
    void cursor.moments;
    void cursor.current();

    const savedAfter = core.save();
    // Same reference: the live session's log object was never reassigned or mutated.
    expect(savedAfter.initialState).toBe(savedBefore.initialState);
    expect(savedAfter.commands).toBe(savedBefore.commands);
    expect(savedAfter).toEqual(savedBefore);

    // The live session still works normally afterward — the cursor didn't leave it in a bad state.
    // (A short greedy game can end within `playGreedily`'s own command cap, so "gameOver" is a valid answer too.)
    const toAct = core.legalActions(savedAfter.initialState.players[0]!.playerId);
    expect(["turn", "choice", "notYourTurn", "gameOver"]).toContain(toAct.kind);
  });

  test("stepping one command at a time through a long game's whole log stays close to linear, not quadratic", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    // The Core e2e suite's own smart-driven 4-player Ultron game runs 214
    // commands (`packages/cards/src/e2e.test.ts`); this test's own greedy
    // "always take the first legal option" driver isn't trying to survive,
    // so it reaches a loss sooner, but still exercises a real multi-round,
    // multi-player game several checkpoint intervals long.
    const { gameId } = await playGreedily(core, storage, ULTRON_CONFIG, 160);
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("no stored game");
    const cursor = ReplayCursor.fromStoredGame(stored.meta.config, stored.initialState, stored.commands);
    expect(cursor.length).toBeGreaterThan(50);

    // Construction itself does one full forward pass (it has to, for `moments`) — that cost isn't what's being bounded here.
    cursor.applyCount = 0;

    cursor.toEnd();
    for (let i = 0; i < cursor.length; i++) cursor.stepBack();
    for (let i = 0; i < cursor.length; i++) cursor.stepForward();

    // A naive "always re-replay from 0" cursor would cost on the order of
    // length² ≈ 20,000+ engine calls for this walk; checkpointing (and
    // caching every index passed through on the way to one, not only the
    // destination) keeps a full one-at-a-time walk of the log within a small
    // constant multiple of its length.
    expect(cursor.applyCount).toBeLessThan(cursor.length * 4);
  });
});
