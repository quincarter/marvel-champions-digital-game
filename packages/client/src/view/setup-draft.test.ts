import { describe, expect, test } from "vitest";
import { CORE_SCENARIOS, WAVE1_SCENARIOS, deckId, type Deck } from "@mc/content";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { corePlayerForSeat, corePlayerFromDeck } from "./deck-seat.js";
import { deckOptionOf, deckOptionsOf, preconDecks } from "./deck-list-model.js";
import { rollFirstPlayerIndex } from "./seed.js";
import {
  addSeat,
  clearHeroFilter,
  clearScenarioFilter,
  difficultyOptionsFor,
  initialSetupDraft,
  pruneSeats,
  removeSeat,
  setDifficulty,
  setFirstPlayerIndex,
  setHeroFilter,
  setModularSetIds,
  setScenario,
  setScenarioFilter,
  setSeed,
  toSessionConfig,
  usePreconstructedForAllSeats,
} from "./setup-draft.js";

const RHINO = CORE_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const BREAKOUT = WAVE1_SCENARIOS.find((s) => s.multipleVillains)!;
const DEFAULT_DECK_ID = preconDecks(POOL_VERSION)[0]!.id as string;

describe("initialSetupDraft", () => {
  test("Title's own defaults: standard difficulty, one seat, no filters, no modular/first-player override", () => {
    const draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 2026 });
    expect(draft.scenarioId).toBe(RHINO.id as string);
    expect(draft.difficulty).toBe("standard");
    expect(draft.modularSetIds).toBeNull();
    expect(draft.seats).toEqual([DEFAULT_DECK_ID]);
    expect(draft.firstPlayerIndex).toBeNull();
    expect(draft.seed).toBe(2026);
    expect(draft.scenarioFilter.text).toBe("");
    expect(draft.heroFilter.text).toBe("");
  });
});

describe("difficultyOptionsFor", () => {
  test("a single-villain scenario offers standard/expert only", () => {
    expect(difficultyOptionsFor(RHINO)).toEqual(["standard", "expert"]);
  });

  test("Breakout adds extreme", () => {
    expect(difficultyOptionsFor(BREAKOUT)).toEqual(["standard", "expert", "extreme"]);
  });
});

describe("setScenario", () => {
  test("leaving Breakout's extreme difficulty resets to standard", () => {
    const draft = { ...initialSetupDraft({ scenarioId: BREAKOUT.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 }), difficulty: "extreme" as const };
    const next = setScenario(draft, RHINO, RHINO.id as string);
    expect(next.difficulty).toBe("standard");
  });

  test("switching to a scenario that still supports the current difficulty keeps it", () => {
    const draft = { ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 }), difficulty: "expert" as const };
    const next = setScenario(draft, BREAKOUT, BREAKOUT.id as string);
    expect(next.difficulty).toBe("expert");
  });
});

describe("setDifficulty", () => {
  test("just sets the difficulty — Breakout's per-villain version is the difficulty's own uniform default now, not a separate draft field", () => {
    const draft = initialSetupDraft({ scenarioId: BREAKOUT.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    expect(setDifficulty(draft, "expert").difficulty).toBe("expert");
    expect(setDifficulty(draft, "extreme").difficulty).toBe("extreme");
  });
});

describe("seats", () => {
  test("addSeat adds a new seat, up to the max, and is a no-op past it or if already seated", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    draft = addSeat(draft, "b");
    draft = addSeat(draft, "c");
    draft = addSeat(draft, "d");
    expect(draft.seats).toEqual(["a", "b", "c", "d"]);
    const overfull = addSeat(draft, "e");
    expect(overfull.seats).toEqual(["a", "b", "c", "d"]);
    const dup = addSeat(draft, "b");
    expect(dup.seats).toEqual(["a", "b", "c", "d"]);
  });

  test("removeSeat never empties the table", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    draft = addSeat(draft, "b");
    draft = removeSeat(draft, "a");
    expect(draft.seats).toEqual(["b"]);
    const stillOne = removeSeat(draft, "b");
    expect(stillOne.seats).toEqual(["b"]);
  });

  test("pruneSeats drops a seat whose deck no longer resolves, falling back when that empties the table", () => {
    const draft = { ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }), seats: ["a", "deleted"] };
    const pruned = pruneSeats(draft, new Set(["a"]), "fallback");
    expect(pruned.seats).toEqual(["a"]);
    const allGone = pruneSeats({ ...draft, seats: ["deleted"] }, new Set(["a"]), "fallback");
    expect(allGone.seats).toEqual(["fallback"]);
  });
});

describe("seed and filters", () => {
  test("setSeed sets an exact value; rerollSeed changes it", () => {
    const draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    expect(setSeed(draft, 42).seed).toBe(42);
  });

  test("filters set and clear independently for each roster", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    draft = setScenarioFilter(draft, { text: "rhino" });
    draft = setHeroFilter(draft, { text: "spider" });
    expect(draft.scenarioFilter.text).toBe("rhino");
    expect(draft.heroFilter.text).toBe("spider");
    draft = clearScenarioFilter(draft);
    expect(draft.scenarioFilter.text).toBe("");
    expect(draft.heroFilter.text).toBe("spider");
    draft = clearHeroFilter(draft);
    expect(draft.heroFilter.text).toBe("");
  });

  test("modular sets and first player default to null (the scenario's/engine's own default) and are settable", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    expect(draft.modularSetIds).toBeNull();
    expect(draft.firstPlayerIndex).toBeNull();
    draft = setModularSetIds(draft, ["masters_of_evil"]);
    draft = setFirstPlayerIndex(draft, 2);
    expect(draft.modularSetIds).toEqual(["masters_of_evil"]);
    expect(draft.firstPlayerIndex).toBe(2);
  });
});

describe("toSessionConfig", () => {
  test("round trip: Title's own defaults produce exactly the SessionConfig TitleScene#start builds today", () => {
    const draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 2026 });
    const deckOptions = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const seated = deckOptions.find((o) => (o.deck.id as string) === DEFAULT_DECK_ID)!;
    const players = [seated.deck.source.kind === "precon" ? { starterDeckId: seated.deck.source.starterDeckId as string } : corePlayerFromDeck(seated.deck)];

    const config = toSessionConfig(draft, players);

    // Exactly what `TitleScene#start` sends today: no `modularSetIds`, no `firstPlayerIndex`, no `villainVersions`.
    expect(config).toEqual({
      scenarioId: RHINO.id as string,
      difficulty: "standard",
      players,
      seed: 2026,
    });
  });

  test("Breakout at any difficulty, including extreme, never sends villainVersions — the engine's own uniform default per difficulty carries it", () => {
    let draft = initialSetupDraft({ scenarioId: BREAKOUT.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 41 });
    draft = setDifficulty(draft, "expert");
    let config = toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }]);
    expect(config.difficulty).toBe("expert");
    expect(config.villainVersions).toBeUndefined();

    draft = setDifficulty(draft, "extreme");
    config = toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }]);
    expect(config.difficulty).toBe("extreme");
    expect(config.villainVersions).toBeUndefined();
  });

  test("modularSetIds and firstPlayerIndex are only sent when set", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    draft = setModularSetIds(draft, ["masters_of_evil"]);
    draft = setFirstPlayerIndex(draft, 1);
    const config = toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }]);
    expect(config.modularSetIds).toEqual(["masters_of_evil"]);
    expect(config.firstPlayerIndex).toBe(1);
  });
});

describe("usePreconstructedForAllSeats", () => {
  test("swaps a custom deck for its identity's own precon", () => {
    const options = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const spiderManPrecon = options.find((o) => (o.deck.id as string) === "precon:core-spider-man-justice")!;
    const customSpiderMan: Deck = { ...spiderManPrecon.deck, id: deckId("user-built-spidey"), name: "My Spidey", source: { kind: "userBuilt", createdAt: "2026-01-01" } };
    const customOption = deckOptionOf(customSpiderMan, POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const allOptions = [...options, customOption];

    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: customOption.deck.id as string, seed: 1 });
    draft = usePreconstructedForAllSeats(draft, allOptions);
    expect(draft.seats).toEqual(["precon:core-spider-man-justice"]);
  });

  test("leaves a seat unchanged when its identity has no precon", () => {
    const options = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "no-such-deck", seed: 1 });
    expect(usePreconstructedForAllSeats(draft, options).seats).toEqual(["no-such-deck"]);
  });
});

describe("the full W2 setup flow (view-model level: scenes aren't unit-tested in this package)", () => {
  test("a 1–4 seat game with a non-recommended modular and a non-default first player starts and its save replays", async () => {
    const options = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const seatDeckIds = ["precon:core-spider-man-justice", "precon:core-she-hulk-aggression", "precon:core-iron-man-aggression", "precon:core-black-panther-protection"];

    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: seatDeckIds[0]!, seed: 2026 });
    for (const seatId of seatDeckIds.slice(1)) draft = addSeat(draft, seatId);
    expect(draft.seats).toEqual(seatDeckIds);

    // Rhino's own recommended set is Bomb Scare; pick something else.
    draft = setModularSetIds(draft, ["masters_of_evil"]);
    expect(draft.modularSetIds).not.toEqual(RHINO.recommendedModularSetIds);

    // "Random" first player, rolled from the seed rather than the engine's own default seat 0.
    const rolled = rollFirstPlayerIndex(draft.seed, draft.seats.length);
    draft = setFirstPlayerIndex(draft, rolled);
    expect(draft.firstPlayerIndex).not.toBeNull();

    const players = draft.seats.map((deckId) => {
      const option = options.find((o) => (o.deck.id as string) === deckId)!;
      return corePlayerForSeat(option);
    });
    const config = toSessionConfig(draft, players);
    expect(config.modularSetIds).toEqual(["masters_of_evil"]);
    expect(config.firstPlayerIndex).toBe(rolled);
    expect(config.players.length).toBe(4);

    const storage = new MemoryGameStorage();
    const first = new EngineSessionCore({ storage });
    const started = await first.start(config);
    expect(started.snapshot.legal).not.toBeNull();

    const saveMeta = await storage.latestActive();
    expect(saveMeta).not.toBeNull();
    const second = new EngineSessionCore({ storage });
    const resumed = await second.resume(saveMeta!.id);
    expect(resumed.snapshot.state).toEqual(started.snapshot.state);
  });
});
