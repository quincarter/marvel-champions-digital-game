/**
 * Issue #791: a game the players stepped outside the rules in (an Undo past a reveal, or a Manual adjust) is marked
 * `SaveMeta.adjusted`, keeps the mark through later rewinds and a reload, and every result reader leaves it out.
 */
import { describe, expect, test } from "vitest";
import type { Command, LegalActions, PlayerId } from "@mc/engine";
import { isAdjustedSave, MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CORE_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

function anyLegalCommand(legal: LegalActions): Command {
  if (legal.kind === "choice") {
    const option = legal.choice.options[0];
    if (!option) throw new Error("pending choice has no options");
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: [option.optionId],
    };
  }
  if (legal.kind !== "turn") throw new Error(`nothing legal (${legal.kind})`);
  const action = legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0];
  if (!action) throw new Error("no legal actions at all");
  return action.example;
}

async function playedGame(commands: number) {
  const storage = new MemoryGameStorage();
  const core = new EngineSessionCore({ storage });
  let { snapshot } = await core.start(CORE_CONFIG);
  for (let i = 0; i < commands; i++) {
    const toAct: PlayerId = snapshot.legal!.playerId;
    const dispatched = core.dispatch(anyLegalCommand(core.legalActions(toAct)));
    if (!dispatched.ok) throw new Error(dispatched.error.message);
    snapshot = dispatched.snapshot;
  }
  const [meta] = await storage.list();
  return { storage, core, gameId: meta!.id };
}

describe("an adjusted game (issue #791)", () => {
  test("a game played by the rules carries no mark", async () => {
    const { storage, core, gameId } = await playedGame(2);
    const rewound = await core.rewindTo(1);
    expect(rewound.adjusted).toBeUndefined();
    const stored = await storage.load(gameId);
    expect(stored!.meta.adjusted).toBeUndefined();
    expect(isAdjustedSave(stored!.meta)).toBe(false);
  });

  test("an Undo past a reveal marks it, in the snapshot and the save", async () => {
    const { storage, core, gameId } = await playedGame(2);
    const rewound = await core.rewindTo(1, { adjusted: true });
    expect(rewound.adjusted).toBe(true);
    const stored = await storage.load(gameId);
    expect(stored!.meta.adjusted).toBe(true);
    expect(isAdjustedSave(stored!.meta)).toBe(true);
  });

  test("the mark stays through a later plain rewind, more commands and a reload", async () => {
    const { storage, core, gameId } = await playedGame(3);
    await core.rewindTo(2, { adjusted: true });
    const rewound = await core.rewindTo(1);
    expect(rewound.adjusted).toBe(true);
    const dispatched = core.dispatch(anyLegalCommand(core.legalActions(rewound.legal!.playerId)));
    if (!dispatched.ok) throw new Error(dispatched.error.message);
    expect(dispatched.snapshot.adjusted).toBe(true);
    expect((await storage.load(gameId))!.meta.adjusted).toBe(true);
    const reloaded = new EngineSessionCore({ storage });
    const resumed = await reloaded.resume(gameId);
    expect(resumed.snapshot.adjusted).toBe(true);
  });
});
