import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  cardKeywordNames,
  everyGlossaryEntry,
  rulesGlossaryOf,
  rulesGlossaryPoolOf,
  villainPhaseOrder,
} from "./rules-reference.js";

describe("rulesGlossaryOf", () => {
  test("always includes the three table-state entries `@mc/content` doesn't carry", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const entries = rulesGlossaryOf(store.state.game!, POOL_DEPS);
    const ids = entries.map((entry) => entry.id);
    expect(ids).toContain("exhausted");
    expect(ids).toContain("ready");
    expect(ids).toContain("facedownBoostCard");
  });

  test("search narrows to a case- and accent-insensitive substring match on the name or definition", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const state = store.state.game!;
    // "sideways" only appears in the "exhausted" entry's own definition — "ready"'s
    // definition mentions "exhausted" too, so a query on that word would match both.
    const exhaustedOnly = rulesGlossaryOf(state, POOL_DEPS, "SiDeWaYs");
    expect(exhaustedOnly.map((e) => e.id)).toEqual(["exhausted"]);

    const none = rulesGlossaryOf(state, POOL_DEPS, "zzz-not-a-rules-term");
    expect(none).toEqual([]);
  });

  test("every returned entry carries a non-empty RRG/ruling citation", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    for (const entry of rulesGlossaryOf(store.state.game!, POOL_DEPS)) {
      expect(entry.citeLabel.length).toBeGreaterThan(0);
    }
  });

  test("quickstrike carries its flagged RRG-vs-ruling conflict, unaltered", () => {
    const quickstrike = everyGlossaryEntry().find((entry) => entry.id === "quickstrike");
    expect(quickstrike?.conflict).toBeDefined();
  });

  test("every entry's cardRefs, when non-empty, point at real cards in the table's own cardPool", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const state = store.state.game!;
    for (const entry of rulesGlossaryOf(state, POOL_DEPS)) {
      for (const ref of entry.cardRefs) {
        expect(state.cardPool[ref.cardId]).toBeDefined();
        expect(ref.instanceId).toBeDefined();
        expect(ref.name.length).toBeGreaterThan(0);
      }
    }
  });

  test("the three table-state entries never carry a card association", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const entries = rulesGlossaryOf(store.state.game!, POOL_DEPS);
    for (const id of ["exhausted", "ready", "facedownBoostCard"]) {
      expect(entries.find((e) => e.id === id)?.cardRefs).toEqual([]);
    }
  });

  // A query matching only an associated card's own name (not the term or definition) is exercised
  // below, against `rulesGlossaryPoolOf` — the two functions share `filterByQuery`, and a fresh
  // Rhino/Spider-Man table's stage-1 villain and unmodified hero face print no keywords at all yet,
  // so there is nothing with a `cardRefs` entry to search by name until the game has actually moved.
});

describe("cardKeywordNames", () => {
  test("finds a printed keyword on an ordinary encounter card", () => {
    const hydraMercenary = POOL_CARDS.find((card) => card.name === "Hydra Mercenary");
    expect(hydraMercenary).toBeDefined();
    expect(cardKeywordNames(hydraMercenary!).has("guard")).toBe(true);
  });

  test("a card with no keywords field, or an empty one, has no names", () => {
    const resource = POOL_CARDS.find((card) => card.type === "resource");
    expect(resource).toBeDefined();
    expect(cardKeywordNames(resource!).size).toBe(0);
  });
});

describe("rulesGlossaryPoolOf", () => {
  test("associates a printed keyword with every pool card that carries it, by cardId (no instanceId)", () => {
    const guard = rulesGlossaryPoolOf(POOL_CARDS).find((entry) => entry.id === "guard");
    expect(guard).toBeDefined();
    expect(guard!.cardRefs.some((ref) => ref.name === "Hydra Mercenary")).toBe(true);
    for (const ref of guard!.cardRefs) expect(ref.instanceId).toBeUndefined();
  });

  test("every entry appears exactly once, keyword and status ids alike, sorted by display name", () => {
    const entries = rulesGlossaryPoolOf(POOL_CARDS);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(entries.map((e) => e.id)).toContain("tough");
    const sorted = [...entries].sort((a, b) => a.displayName.localeCompare(b.displayName));
    expect(entries).toEqual(sorted);
  });

  test("the three status entries carry no cards — a status is never printed", () => {
    const entries = rulesGlossaryPoolOf(POOL_CARDS);
    for (const id of ["stunned", "confused", "tough"]) {
      expect(entries.find((e) => e.id === id)?.cardRefs).toEqual([]);
    }
  });

  test("search matches a card name too, not just the term or definition", () => {
    const byCardName = rulesGlossaryPoolOf(POOL_CARDS, "Hydra Mercenary");
    expect(byCardName.map((e) => e.id)).toContain("guard");
  });
});

describe("villainPhaseOrder", () => {
  test("lists all six steps, in order, numbered 1 through 6", () => {
    const steps = villainPhaseOrder();
    expect(steps.map((step) => step.id)).toEqual([
      "placeThreat",
      "enemyActivations",
      "dealEncounterCards",
      "revealEncounterCards",
      "passFirstPlayer",
      "endOfRound",
    ]);
    steps.forEach((step, index) => expect(step.label.startsWith(`${index + 1}.`)).toBe(true));
  });

  test("marks no step current without a state", () => {
    expect(villainPhaseOrder().every((step) => !step.current)).toBe(true);
  });

  test("marks no step current when the game is in the player phase", () => {
    const state = { step: { phase: "player", kind: "turn" } } as unknown as GameState;
    expect(villainPhaseOrder(state).every((step) => !step.current)).toBe(true);
  });

  test("marks exactly the matching step current when the game is in the villain phase", () => {
    const state = { step: { phase: "villain", kind: "dealEncounterCards" } } as unknown as GameState;
    const steps = villainPhaseOrder(state);
    expect(steps.filter((step) => step.current).map((step) => step.id)).toEqual(["dealEncounterCards"]);
  });

  test("steps 1/2 point at the main scheme/villain, 3/4 at the encounter card back, and 5/6 at no art", () => {
    const steps = villainPhaseOrder();
    expect(steps.find((s) => s.id === "placeThreat")?.art).toBe("mainScheme");
    expect(steps.find((s) => s.id === "enemyActivations")?.art).toBe("villain");
    expect(steps.find((s) => s.id === "dealEncounterCards")?.art).toBe("encounterBack");
    expect(steps.find((s) => s.id === "revealEncounterCards")?.art).toBe("encounterBack");
    expect(steps.find((s) => s.id === "passFirstPlayer")?.art).toBeNull();
    expect(steps.find((s) => s.id === "endOfRound")?.art).toBeNull();
  });
});
