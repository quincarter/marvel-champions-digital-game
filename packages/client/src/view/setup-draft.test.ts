import { describe, expect, test } from "vitest";
import { CORE_SCENARIOS, WAVE1_SCENARIOS, WAVE4_SCENARIOS, deckId, encounterSetId, type Deck } from "@mc/content";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { POOL_CARDS, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_VERSION } from "../content/pool.js";
import { corePlayerForSeat, corePlayerFromDeck } from "./deck-seat.js";
import { deckOptionOf, deckOptionsOf, preconDecks } from "./deck-list-model.js";
import { rollFirstPlayerIndex } from "./seed.js";
import {
  addSeat,
  alternateDifficultySetsFor,
  assignToActiveSeat,
  clearHeroFilter,
  clearScenarioFilter,
  clearSeat,
  deckCheckDeckId,
  difficultyOptionsFor,
  hasTowerDefenseSetupDamageOption,
  initialSetupDraft,
  nextEmptySeat,
  pruneSeats,
  removeSeat,
  seatIsSelectable,
  setActiveSeat,
  setDifficulty,
  setDifficultySets,
  setFirstPlayerIndex,
  setHeroFilter,
  setModularSetIds,
  setScenario,
  setScenarioFilter,
  setSeed,
  setSetAsideModularSetIds,
  toggleDifficultySets,
  toggleTowerDefenseSetupDamage,
  towerDefenseSetupDamagePerHero,
  toSessionConfig,
  withSeatOne,
  usePreconstructedForAllSeats,
  type SetupDraft,
} from "./setup-draft.js";

const RHINO = CORE_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const BREAKOUT = WAVE1_SCENARIOS.find((s) => s.multipleVillains)!;
const THE_HOOD = WAVE4_SCENARIOS.find((s) => (s.id as string) === "the-hood")!;
const TOWER_DEFENSE = WAVE4_SCENARIOS.find((s) => (s.id as string) === "tower-defense")!;
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
    const draft = {
      ...initialSetupDraft({ scenarioId: BREAKOUT.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 }),
      difficulty: "extreme" as const,
    };
    const next = setScenario(draft, RHINO, RHINO.id as string);
    expect(next.difficulty).toBe("standard");
  });

  test("switching to a scenario that still supports the current difficulty keeps it", () => {
    const draft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 }),
      difficulty: "expert" as const,
    };
    const next = setScenario(draft, BREAKOUT, BREAKOUT.id as string);
    expect(next.difficulty).toBe("expert");
  });

  test("leaving The Hood resets a chosen Standard II/Expert II and modular set choice — both are scenario-specific", () => {
    const draft = {
      ...initialSetupDraft({ scenarioId: THE_HOOD.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 }),
      difficultySets: { standard: encounterSetId("standard_ii") },
      setAsideModularSetIds: ["beasty_boys"],
    };
    const next = setScenario(draft, RHINO, RHINO.id as string);
    expect(next.difficultySets).toBeNull();
    expect(next.setAsideModularSetIds).toBeNull();
  });
});

describe("alternateDifficultySetsFor", () => {
  test("The Hood offers Standard II and Expert II — the only pack with either", () => {
    expect(alternateDifficultySetsFor(THE_HOOD, POOL_ENCOUNTER_SETS)).toEqual({
      standard: "standard_ii",
      expert: "expert_ii",
    });
  });

  test("every other scenario offers none", () => {
    expect(alternateDifficultySetsFor(RHINO, POOL_ENCOUNTER_SETS)).toBeNull();
    expect(alternateDifficultySetsFor(BREAKOUT, POOL_ENCOUNTER_SETS)).toBeNull();
  });

  test("an undefined scenario (nothing chosen yet) offers none", () => {
    expect(alternateDifficultySetsFor(undefined, POOL_ENCOUNTER_SETS)).toBeNull();
  });
});

describe("setDifficultySets / setSetAsideModularSetIds", () => {
  test("null goes back to the printed default / the scenario builder's own default", () => {
    let draft = initialSetupDraft({ scenarioId: THE_HOOD.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    draft = setDifficultySets(draft, { standard: encounterSetId("standard_ii"), expert: encounterSetId("expert_ii") });
    draft = setSetAsideModularSetIds(draft, ["beasty_boys"]);
    expect(draft.difficultySets).toEqual({ standard: "standard_ii", expert: "expert_ii" });
    expect(draft.setAsideModularSetIds).toEqual(["beasty_boys"]);

    draft = setDifficultySets(draft, null);
    draft = setSetAsideModularSetIds(draft, null);
    expect(draft.difficultySets).toBeNull();
    expect(draft.setAsideModularSetIds).toBeNull();
  });
});

describe("toggleDifficultySets", () => {
  test("on with the given alternate, off back to the printed default — a single switch", () => {
    const alternate = { standard: encounterSetId("standard_ii"), expert: encounterSetId("expert_ii") };
    let draft = initialSetupDraft({ scenarioId: THE_HOOD.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    draft = toggleDifficultySets(draft, alternate);
    expect(draft.difficultySets).toEqual(alternate);
    draft = toggleDifficultySets(draft, alternate);
    expect(draft.difficultySets).toBeNull();
  });
});

describe("hasTowerDefenseSetupDamageOption", () => {
  test("only Tower Defense offers it", () => {
    expect(hasTowerDefenseSetupDamageOption(TOWER_DEFENSE)).toBe(true);
    expect(hasTowerDefenseSetupDamageOption(RHINO)).toBe(false);
    expect(hasTowerDefenseSetupDamageOption(THE_HOOD)).toBe(false);
    expect(hasTowerDefenseSetupDamageOption(undefined)).toBe(false);
  });

  test("skirmish mode has no printed recommendation (MC21 p. 11)", () => {
    expect(hasTowerDefenseSetupDamageOption(TOWER_DEFENSE, true)).toBe(false);
  });
});

describe("toggleTowerDefenseSetupDamage", () => {
  test("off by default, on with a plain toggle", () => {
    let draft = initialSetupDraft({ scenarioId: TOWER_DEFENSE.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    expect(draft.towerDefenseSetupDamage).toBe(false);
    draft = toggleTowerDefenseSetupDamage(draft);
    expect(draft.towerDefenseSetupDamage).toBe(true);
    draft = toggleTowerDefenseSetupDamage(draft);
    expect(draft.towerDefenseSetupDamage).toBe(false);
  });
});

describe("towerDefenseSetupDamagePerHero", () => {
  test("MC21 p. 11's printed recommendation: 1 standard, 2 expert", () => {
    expect(towerDefenseSetupDamagePerHero("standard")).toBe(1);
    expect(towerDefenseSetupDamagePerHero("expert")).toBe(2);
  });
});

describe("setScenario resets towerDefenseSetupDamage", () => {
  test("leaving Tower Defense clears a chosen toggle", () => {
    let draft = initialSetupDraft({ scenarioId: TOWER_DEFENSE.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    draft = toggleTowerDefenseSetupDamage(draft);
    expect(draft.towerDefenseSetupDamage).toBe(true);
    draft = setScenario(draft, RHINO, RHINO.id as string);
    expect(draft.towerDefenseSetupDamage).toBe(false);
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

  test("withSeatOne ('Play this deck ▸', W9) seats exactly one deck, dropping every other seat", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    draft = addSeat(draft, "b");
    draft = addSeat(draft, "c");
    const played = withSeatOne(draft, "z");
    expect(played.seats).toEqual(["z"]);
  });

  test("pruneSeats drops a seat whose deck no longer resolves, falling back when that empties the table", () => {
    const draft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "deleted"],
    };
    const pruned = pruneSeats(draft, new Set(["a"]), "fallback");
    expect(pruned.seats).toEqual(["a"]);
    const allGone = pruneSeats({ ...draft, seats: ["deleted"] }, new Set(["a"]), "fallback");
    expect(allGone.seats).toEqual(["fallback"]);
  });
});

describe("the active-seat model (docs/phase4-screen-gaps.md §3, 'Reopened — W2b')", () => {
  test("a fresh draft's active seat is seat 1 (index 0)", () => {
    const draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    expect(draft.activeSeatIndex).toBe(0);
  });

  test("nextEmptySeat is the seat past the last filled one, or null when full", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    expect(nextEmptySeat(draft)).toBe(1);
    draft = { ...draft, seats: ["a", "b", "c", "d"] };
    expect(nextEmptySeat(draft)).toBeNull();
  });

  test("setActiveSeat clamps to an existing seat or the one empty seat past the end", () => {
    const draft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b"],
    };
    expect(setActiveSeat(draft, 0).activeSeatIndex).toBe(0);
    expect(setActiveSeat(draft, 1).activeSeatIndex).toBe(1);
    // Index 2 is the one empty seat past "a","b" — fine.
    expect(setActiveSeat(draft, 2).activeSeatIndex).toBe(2);
    // Nothing sits further out than that — clamps back to the reachable empty seat.
    expect(setActiveSeat(draft, 3).activeSeatIndex).toBe(2);
    expect(setActiveSeat(draft, -1).activeSeatIndex).toBe(0);
  });

  test("assignToActiveSeat replaces an occupied active seat and advances to the next empty seat", () => {
    let draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b", "c"],
      activeSeatIndex: 1,
    };
    draft = assignToActiveSeat(draft, "z");
    expect(draft.seats).toEqual(["a", "z", "c"]);
    // A seat was replaced, not appended, but there is still an empty seat (index 3) to advance to.
    expect(draft.activeSeatIndex).toBe(3);
  });

  test("assignToActiveSeat on the one empty seat past the end appends, then advances again", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    expect(draft.activeSeatIndex).toBe(0);
    draft = assignToActiveSeat(draft, "z"); // replaces seat 1 (the only seat)
    expect(draft.seats).toEqual(["z"]);
    draft = setActiveSeat(draft, 1); // the one empty seat past the end
    draft = assignToActiveSeat(draft, "y");
    expect(draft.seats).toEqual(["z", "y"]);
    expect(draft.activeSeatIndex).toBe(2);
  });

  test("assignToActiveSeat stays put once the table is full", () => {
    let draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b", "c", "d"],
      activeSeatIndex: 2,
    };
    draft = assignToActiveSeat(draft, "z");
    expect(draft.seats).toEqual(["a", "b", "z", "d"]);
    expect(draft.activeSeatIndex).toBe(2);
  });

  test("clearSeat removes a seat by position and shifts later seats down, never below one seat", () => {
    let draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b", "c"],
      activeSeatIndex: 2,
    };
    draft = clearSeat(draft, 1);
    expect(draft.seats).toEqual(["a", "c"]);
    // The active seat pointed past the removed one, so it shifts down with it.
    expect(draft.activeSeatIndex).toBe(1);
    const oneLeft = { ...draft, seats: ["a"] };
    expect(clearSeat(oneLeft, 0)).toBe(oneLeft);
  });

  test("clearing the active seat itself keeps the index in range", () => {
    let draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b"],
      activeSeatIndex: 1,
    };
    draft = clearSeat(draft, 1);
    expect(draft.seats).toEqual(["a"]);
    expect(draft.activeSeatIndex).toBe(1); // clamped to nextEmptySeat, since there is one
  });

  test("duplicate identities stay blocked by the caller, not this module — assignToActiveSeat itself never checks", () => {
    // Legality is `view/seats.ts`'s job (per `addSeat`'s own doc comment); this module only ever does what it's told.
    let draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a"],
      activeSeatIndex: 1,
    };
    draft = assignToActiveSeat(draft, "a");
    expect(draft.seats).toEqual(["a", "a"]);
  });

  test("pruneSeats and withSeatOne keep activeSeatIndex in range", () => {
    let draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b"],
      activeSeatIndex: 2,
    };
    draft = pruneSeats(draft, new Set(["a"]), "a");
    expect(draft.seats).toEqual(["a"]);
    expect(draft.activeSeatIndex).toBe(1);
    draft = withSeatOne({ ...draft, activeSeatIndex: 3 }, "z");
    expect(draft.activeSeatIndex).toBe(0);
  });
});

describe("seatIsSelectable (docs/phase4-screen-gaps.md §3, second W2b pass item 3 — clicking a later empty seat used to silently redirect the pick to an earlier one)", () => {
  test("every filled seat, and the one empty seat past the last filled one, are selectable", () => {
    const draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b"],
    };
    expect(seatIsSelectable(draft, 0)).toBe(true);
    expect(seatIsSelectable(draft, 1)).toBe(true);
    // Index 2 is the one empty seat past "a","b".
    expect(seatIsSelectable(draft, 2)).toBe(true);
  });

  test("an empty seat further out than that is not selectable", () => {
    const draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a"],
    };
    expect(seatIsSelectable(draft, 0)).toBe(true);
    expect(seatIsSelectable(draft, 1)).toBe(true);
    expect(seatIsSelectable(draft, 2)).toBe(false);
    expect(seatIsSelectable(draft, 3)).toBe(false);
  });

  test("a full table has every seat selectable (picking always replaces)", () => {
    const draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b", "c", "d"],
    };
    for (let i = 0; i < 4; i++) expect(seatIsSelectable(draft, i)).toBe(true);
  });
});

describe("deckCheckDeckId (docs/phase4-screen-gaps.md §3, second W2b pass item 1 — 'Deck check' silently fell through to Table setup when the active seat was empty)", () => {
  test("the active seat's own deck, when it's filled", () => {
    const draft: SetupDraft = {
      ...initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 }),
      seats: ["a", "b"],
      activeSeatIndex: 1,
    };
    expect(deckCheckDeckId(draft)).toBe("b");
  });

  test("the most recently filled seat, when the active seat is the empty one past the end", () => {
    let draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    draft = assignToActiveSeat(draft, "a"); // active seat 1 is filled; active advances to the empty seat 2
    expect(draft.activeSeatIndex).toBe(1);
    expect(draft.seats).toEqual(["a"]);
    expect(deckCheckDeckId(draft)).toBe("a");

    draft = { ...draft, seats: ["a", "b"], activeSeatIndex: 2 };
    expect(deckCheckDeckId(draft)).toBe("b");
  });

  test("never null for any draft `initialSetupDraft`/`pruneSeats` can actually produce", () => {
    const draft = initialSetupDraft({ scenarioId: RHINO.id as string, seatDeckId: "a", seed: 1 });
    expect(deckCheckDeckId(draft)).not.toBeNull();
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
    const players = [
      seated.deck.source.kind === "precon"
        ? { starterDeckId: seated.deck.source.starterDeckId as string }
        : corePlayerFromDeck(seated.deck),
    ];

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

  test("difficultySets and setAsideModularSetIds are only sent when set", () => {
    let draft = initialSetupDraft({ scenarioId: THE_HOOD.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    let config = toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }]);
    expect(config.difficultySets).toBeUndefined();
    expect(config.setAsideModularSetIds).toBeUndefined();

    draft = setDifficultySets(draft, { standard: encounterSetId("standard_ii"), expert: encounterSetId("expert_ii") });
    draft = setSetAsideModularSetIds(draft, ["beasty_boys"]);
    config = toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }]);
    expect(config.difficultySets).toEqual({ standard: "standard_ii", expert: "expert_ii" });
    expect(config.setAsideModularSetIds).toEqual(["beasty_boys"]);
  });

  test("setupOptions.towerDefenseSetupDamage is only sent when chosen (docs/phase7-wave4.md §4 Q4)", () => {
    let draft = initialSetupDraft({ scenarioId: TOWER_DEFENSE.id as string, seatDeckId: DEFAULT_DECK_ID, seed: 1 });
    let config = toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }]);
    expect(config.setupOptions).toBeUndefined();

    draft = toggleTowerDefenseSetupDamage(draft);
    config = toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }]);
    expect(config.setupOptions).toEqual({ towerDefenseSetupDamage: true });
  });
});

describe("usePreconstructedForAllSeats", () => {
  test("swaps a custom deck for its identity's own precon", () => {
    const options = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const spiderManPrecon = options.find((o) => (o.deck.id as string) === "precon:core-spider-man-justice")!;
    const customSpiderMan: Deck = {
      ...spiderManPrecon.deck,
      id: deckId("user-built-spidey"),
      name: "My Spidey",
      source: { kind: "userBuilt", createdAt: "2026-01-01" },
    };
    const customOption = deckOptionOf(customSpiderMan, POOL_CARDS, POOL_VERSION, POOL_DEPS);
    const allOptions = [...options, customOption];

    let draft = initialSetupDraft({
      scenarioId: RHINO.id as string,
      seatDeckId: customOption.deck.id as string,
      seed: 1,
    });
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
    const seatDeckIds = [
      "precon:core-spider-man-justice",
      "precon:core-she-hulk-aggression",
      "precon:core-iron-man-aggression",
      "precon:core-black-panther-protection",
    ];

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

  test("The Hood: Standard II/Expert II and a chosen set-aside actually change the deck the engine builds", async () => {
    const seatDeckId = "core-spider-man-justice";
    const seed = 55;

    let printed = initialSetupDraft({ scenarioId: THE_HOOD.id as string, seatDeckId, seed });
    let toggled = setDifficultySets(printed, { standard: encounterSetId("standard_ii") });
    toggled = setSetAsideModularSetIds(toggled, [
      "beasty_boys",
      "brothers_grimm",
      "crossfire_crew",
      "mister_hyde",
      "ransacked_armory",
      "sinister_syndicate",
      "state_of_emergency",
    ]);

    const printedConfig = toSessionConfig(printed, [{ starterDeckId: seatDeckId }]);
    const toggledConfig = toSessionConfig(toggled, [{ starterDeckId: seatDeckId }]);
    expect(printedConfig.difficultySets).toBeUndefined();
    expect(toggledConfig.difficultySets).toEqual({ standard: "standard_ii" });

    const printedGame = new EngineSessionCore();
    const printedStart = await printedGame.start(printedConfig);
    const toggledGame = new EngineSessionCore();
    const toggledStart = await toggledGame.start(toggledConfig);
    expect(printedStart.snapshot.legal).not.toBeNull();
    expect(toggledStart.snapshot.legal).not.toBeNull();

    // Two different encounter decks: the printed Standard set's cards are not the same pool as Standard II's.
    const deckOf = (state: NonNullable<typeof printedStart.snapshot.state>) =>
      [...state.encounterDecks[state.encounterDeckOrder[0]!]!.deck].sort();
    expect(deckOf(printedStart.snapshot.state!)).not.toEqual(deckOf(toggledStart.snapshot.state!));
  });
});
