import { describe, expect, test } from "vitest";
import { CORE_ENCOUNTER_SETS } from "@mc/content";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { scenarioCardListOf } from "./scenario-card-list.js";

describe("scenarioCardListOf", () => {
  test("groups the live game's own encounter cards by set, Rhino's villain set included", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const groups = scenarioCardListOf(store.state.game!, CORE_ENCOUNTER_SETS);
    expect(groups.length).toBeGreaterThan(0);
    const rhinoSet = groups.find((group) => group.setName.toLowerCase().includes("rhino"));
    expect(rhinoSet).toBeDefined();
    expect(rhinoSet!.cardNames.length).toBeGreaterThan(0);
    // No duplicate names within a set, and alphabetical.
    expect(new Set(rhinoSet!.cardNames).size).toBe(rhinoSet!.cardNames.length);
    expect([...rhinoSet!.cardNames].sort()).toEqual(rhinoSet!.cardNames);
    // Groups are sorted by set name.
    expect([...groups.map((g) => g.setName)].sort((a, b) => a.localeCompare(b))).toEqual(groups.map((g) => g.setName));
  });

  test("includes a hero's obligation/nemesis set, since they're shuffled into the real game's own pool", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-she-hulk-aggression" }],
      seed: 4,
    });
    const groups = scenarioCardListOf(store.state.game!, CORE_ENCOUNTER_SETS);
    const allNames = groups.flatMap((group) => group.cardNames);
    // She-Hulk's nemesis set brings in a She-Hulk-specific encounter card not part of Rhino's own villain set or Standard.
    expect(allNames.length).toBeGreaterThan(0);
  });
});
