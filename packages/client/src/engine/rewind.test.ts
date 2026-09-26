/**
 * "Back out"'s rewind mechanism (`session-core.ts`'s `rewindTo`): the state after rewinding to a given command
 * count must be exactly the state the game was in right after that many commands landed the first time, and a
 * reload afterwards (`resume`) must show the rewound state, not the undone commands.
 */
import { describe, expect, test } from "vitest";
import type { Command, LegalActions, PlayerId } from "@mc/engine";
import { MemoryGameStorage, type SaveMeta } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CORE_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

/** Any one legal command for whoever must act right now — same helper shape as `session-core.test.ts`'s own. */
function anyLegalCommand(legal: LegalActions, playerId: PlayerId): Command {
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
  if (legal.kind !== "turn") throw new Error(`nothing legal for ${playerId} (${legal.kind})`);
  const action = legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0];
  if (!action) throw new Error("no legal actions at all");
  return action.example;
}

describe("EngineSessionCore.rewindTo", () => {
  test("the state after rewinding deep-equals the state right after the first N commands originally landed", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(CORE_CONFIG);

    // Play three real commands, remembering the state right after the second.
    let snapshot = started.snapshot;
    let afterTwo: typeof snapshot | null = null;
    for (let i = 0; i < 3; i++) {
      const toAct = snapshot.legal!.playerId;
      const dispatched = core.dispatch(anyLegalCommand(core.legalActions(toAct), toAct));
      expect(dispatched.ok).toBe(true);
      if (!dispatched.ok) throw new Error("unreachable");
      snapshot = dispatched.snapshot;
      if (i === 1) afterTwo = snapshot;
    }
    expect(afterTwo).not.toBeNull();
    expect(snapshot.version).toBe(3);

    const rewound = await core.rewindTo(2);
    expect(rewound.version).toBe(2);
    expect(rewound.state).toEqual(afterTwo!.state);
    expect(rewound.record).toEqual(afterTwo!.record);
  });

  test("rewinding to 0 restores the state right after setup", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(CORE_CONFIG);
    const toAct = started.snapshot.legal!.playerId;
    const dispatched = core.dispatch(anyLegalCommand(core.legalActions(toAct), toAct));
    expect(dispatched.ok).toBe(true);

    const rewound = await core.rewindTo(0);
    expect(rewound.version).toBe(0);
    expect(rewound.state).toEqual(started.snapshot.state);
  });

  test("a reload after a rewind shows the rewound state, not the undone commands", async () => {
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    const started = await core.start(CORE_CONFIG);

    let snapshot = started.snapshot;
    let afterOne: typeof snapshot | null = null;
    for (let i = 0; i < 3; i++) {
      const toAct = snapshot.legal!.playerId;
      const dispatched = core.dispatch(anyLegalCommand(core.legalActions(toAct), toAct));
      expect(dispatched.ok).toBe(true);
      if (!dispatched.ok) throw new Error("unreachable");
      snapshot = dispatched.snapshot;
      if (i === 0) afterOne = snapshot;
    }

    const rewound = await core.rewindTo(1);
    expect(rewound.version).toBe(1);

    // "Refresh the page": a fresh session core over the same storage.
    const saveMeta = await storage.latestActive();
    expect(saveMeta).not.toBeNull();
    expect((saveMeta as SaveMeta).commandCount).toBe(1);
    const reloaded = new EngineSessionCore({ storage });
    const resumed = await reloaded.resume((saveMeta as SaveMeta).id);

    expect(resumed.snapshot.version).toBe(1);
    expect(resumed.snapshot.state).toEqual(afterOne!.state);
  });
});
