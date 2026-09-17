import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { everyGlossaryEntry, rulesGlossaryOf, villainPhaseOrder } from "./rules-reference.js";

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
});
