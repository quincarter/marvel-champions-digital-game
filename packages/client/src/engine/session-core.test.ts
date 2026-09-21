/**
 * Save compatibility across the Phase 7 wave 1 client wiring
 * (`content/pool.ts`): does a game started before the pool grew from Core
 * alone to Core-plus-wave-1 still resume, or does it get correctly retired?
 *
 * There's no real pre-wave-1 save file to load — the wiring landed in one
 * change, so "before" and "after" are the same build. What's testable is the
 * thing that actually matters: a `SessionConfig` shaped exactly like every
 * pre-wave-1 save already on disk (a Core `scenarioId`, Core `starterDeckId`
 * seats, no `villainVersions`) still sets up and replays byte-for-byte under
 * `POOL_DEPS`/`buildScenario` — because `buildScenario` routes a Core
 * scenario id straight to `coreScenario`, which pins the villain/main-scheme/
 * encounter-set lookups to `CORE_CARDS` regardless of the wider pool it's
 * handed (`packages/cards/src/core/setup.ts`), so a Core game's own instances
 * and RNG draws are unaffected by wave 1 cards merely existing in the pool.
 *
 * `SAVE_SCHEMA`'s existing `incompatible` path (bumped when the multi-villain
 * state shape landed, PLAN.md Phase 7) is what retires anything that
 * genuinely can't replay — this file confirms the wave 1 *client* wiring
 * didn't accidentally widen that net to catch ordinary Core saves too.
 */
import { describe, expect, test } from "vitest";
import { CORE_STARTER_DECKS } from "@mc/content";
import type { Command, LegalActions, PlayerId } from "@mc/engine";
import { MemoryGameStorage, type SaveMeta } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

/** Any one legal command for whoever must act right now — a pending choice's first option, or ending the turn. */
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

const CORE_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

const WAVE1_CONFIG: SessionConfig = {
  scenarioId: "risky-business",
  difficulty: "standard",
  players: [{ starterDeckId: "cap-leadership" }],
  seed: 7,
};

describe("EngineSessionCore save compatibility", () => {
  test("a Core-shaped save (pre-wave-1 config) resumes cleanly under the wave 1 pool, byte-for-byte", async () => {
    const storage = new MemoryGameStorage();
    const first = new EngineSessionCore({ storage });
    const started = await first.start(CORE_CONFIG);
    // A real command, so there's something in the log besides setup — whatever's actually legal (setup may leave a pending choice, e.g. a mulligan).
    const toAct = started.snapshot.legal!.playerId;
    const dispatched = first.dispatch(anyLegalCommand(first.legalActions(toAct), toAct));
    expect(dispatched.ok).toBe(true);
    const beforeReload = dispatched.ok ? dispatched.snapshot.state : null;

    // "Refresh the page": a fresh session core over the same storage.
    const saveMeta = await storage.latestActive();
    expect(saveMeta).not.toBeNull();
    const second = new EngineSessionCore({ storage });
    const resumed = await second.resume((saveMeta as SaveMeta).id);

    expect(resumed.snapshot.state).toEqual(beforeReload);
  });

  test("a wave 1 scenario's own save also resumes cleanly (same mechanism, not just a Core special case)", async () => {
    const storage = new MemoryGameStorage();
    const first = new EngineSessionCore({ storage });
    const started = await first.start(WAVE1_CONFIG);
    const toAct = started.snapshot.legal!.playerId;
    const dispatched = first.dispatch(anyLegalCommand(first.legalActions(toAct), toAct));
    expect(dispatched.ok).toBe(true);
    const beforeReload = dispatched.ok ? dispatched.snapshot.state : null;

    const saveMeta = await storage.latestActive();
    const second = new EngineSessionCore({ storage });
    const resumed = await second.resume((saveMeta as SaveMeta).id);

    expect(resumed.snapshot.state).toEqual(beforeReload);
  });
});

/**
 * `CorePlayer.deckId` (docs/phase4-screen-gaps.md §2 S4): an optional field added to the
 * custom-deck seat shape for save attribution. It has to be additive in every sense that matters
 * to a save on disk: a config saved before this field existed still loads and replays, and its
 * presence or value can never change what the engine does with an otherwise-identical seat.
 */
describe("EngineSessionCore and CorePlayer.deckId", () => {
  const spiderMan = CORE_STARTER_DECKS.find((d) => d.id === "core-spider-man-justice")!;
  const spiderManDeckList = spiderMan.cards.flatMap(({ cardId, quantity }) =>
    Array.from({ length: quantity }, () => cardId),
  );

  const CUSTOM_SEAT_CONFIG_OLD_SHAPE: SessionConfig = {
    scenarioId: "rhino",
    difficulty: "standard",
    // The pre-S4 shape: no `deckId` at all, exactly what every custom-deck seat saved before this
    // change looks like on disk.
    players: [{ identityCardId: spiderMan.identityCardId, deck: spiderManDeckList, aspects: spiderMan.aspects }],
    seed: 2026,
  };

  test("an old-shape custom-deck seat (no deckId at all) still starts, saves and resumes cleanly", async () => {
    const storage = new MemoryGameStorage();
    const first = new EngineSessionCore({ storage });
    const started = await first.start(CUSTOM_SEAT_CONFIG_OLD_SHAPE);
    const toAct = started.snapshot.legal!.playerId;
    const dispatched = first.dispatch(anyLegalCommand(first.legalActions(toAct), toAct));
    expect(dispatched.ok).toBe(true);
    const beforeReload = dispatched.ok ? dispatched.snapshot.state : null;

    const saveMeta = await storage.latestActive();
    expect(saveMeta).not.toBeNull();
    const second = new EngineSessionCore({ storage });
    const resumed = await second.resume((saveMeta as SaveMeta).id);

    expect(resumed.snapshot.state).toEqual(beforeReload);
  });

  test("the engine's state and events are byte-identical whether the seat carries a deckId or not", async () => {
    const withoutId = await new EngineSessionCore().start(CUSTOM_SEAT_CONFIG_OLD_SHAPE);
    const withId = await new EngineSessionCore().start({
      ...CUSTOM_SEAT_CONFIG_OLD_SHAPE,
      players: [
        { ...CUSTOM_SEAT_CONFIG_OLD_SHAPE.players[0], deckId: "local-deck-42" } as SessionConfig["players"][number],
      ],
    });

    expect(withId.snapshot.state).toEqual(withoutId.snapshot.state);
    expect(withId.snapshot.events).toEqual(withoutId.snapshot.events);
  });
});
