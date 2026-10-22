import { describe, expect, test } from "vitest";
import { scenarioDetailLines, scenarioDetailOf, shelfSubtitleOf, lockCaptionOf } from "./scenario-detail.js";
import type { AnyCard, Scenario } from "@mc/content";
import { randomVillainLabel } from "./random-villain.js";
import { requiredCardLabel } from "./modular-sets.js";
import { SHADOWLAND_SCENARIOS } from "@mc/content";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";

const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const breakout = POOL_SCENARIOS.find((s) => (s.id as string) === "breakout")!;

describe("scenarioDetailOf", () => {
  test("a single-villain scenario (Rhino)", () => {
    const detail = scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.scenarioName).toBe(rhino.name);
    expect(detail.villainName.length).toBeGreaterThan(0);
    expect(detail.otherVillainNames).toEqual([]);
    expect(detail.mainSchemeName.length).toBeGreaterThan(0);
    expect(detail.stages.length).toBeGreaterThan(0);
    expect(detail.modularSetCount).toBe(1);
    expect(detail.recommendedModularSetNames).toContain("Bomb Scare");
    expect(detail.villainStagesStandard).toEqual([1, 2]);
    expect(detail.villainStagesExpert).toEqual([2, 3]);
  });

  test("starting acceleration is the main scheme's printed value, not the villain stage count", () => {
    const darkBeast = POOL_SCENARIOS.find((s) => (s.id as string) === "dark-beast")!;
    const detail = scenarioDetailOf(darkBeast, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const scheme = CARDS_BY_ID.get(darkBeast.mainSchemeCardId as string)!;
    if (scheme.type !== "main_scheme") throw new Error("not a main scheme");
    expect(detail.startingAcceleration).toEqual(scheme.stages[0]!.acceleration);
    expect(detail.startingAcceleration).toEqual({ base: 0, perPlayer: 1 });
  });

  test("stage HP is the printed ScalingValue, unscaled", () => {
    const detail = scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    for (const stage of detail.stages) {
      expect(typeof stage.hp.base).toBe("number");
      expect(typeof stage.hp.perPlayer).toBe("number");
    }
  });

  test("a multi-villain scenario (Breakout) names the other villains", () => {
    const detail = scenarioDetailOf(breakout, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.otherVillainNames.length).toBe(3);
    expect(detail.otherVillainNames).not.toContain(detail.villainName);
    // Four names don't fit a shelf card: the scenario's own name stands for them.
    expect(detail.displayName).toBe("Breakout");
  });

  test("The Sinister Six is shown under the scenario's name, not Doctor Octopus's", () => {
    const six = POOL_SCENARIOS.find((s) => (s.id as string) === "sinister-six")!;
    const detail = scenarioDetailOf(six, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.villainName).toBe("Doctor Octopus");
    expect(detail.displayName).toBe("The Sinister Six");
  });

  test("a two-villain scenario (Tower Defense) is shown under both names", () => {
    const towerDefense = POOL_SCENARIOS.find((s) => (s.id as string) === "tower-defense")!;
    const detail = scenarioDetailOf(towerDefense, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.displayName).toBe("Proxima Midnight / Corvus Glaive");
  });

  test("a single-villain scenario is shown under the villain's own name", () => {
    expect(scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS).displayName).toBe("Rhino");
  });

  test("Breakout uses no modular sets", () => {
    const detail = scenarioDetailOf(breakout, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.modularSetCount).toBe(0);
    expect(detail.recommendedModularSetNames).toEqual([]);
  });
});

describe("scenarioDetailLines", () => {
  test("one line per stage, plus the fixed summary lines", () => {
    const detail = scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const lines = scenarioDetailLines(detail);
    expect(lines.length).toBe(5 + detail.stages.length);
    expect(lines[0]).toContain(detail.villainName);
  });

  test("a multi-villain scenario mentions how many more villains join it", () => {
    const detail = scenarioDetailOf(breakout, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const lines = scenarioDetailLines(detail);
    expect(lines[0]).toContain("3 more");
  });
});

describe("shelfSubtitleOf", () => {
  const detail = (id: string) =>
    scenarioDetailOf(
      POOL_SCENARIOS.find((s) => (s.id as string) === id)!,
      CARDS_BY_ID,
      POOL_ENCOUNTER_SETS,
    );

  test("a three-stage villain reads as a range, with its modular set", () => {
    expect(shelfSubtitleOf(detail("rhino"))).toBe("Stages I–III · Bomb Scare");
  });

  test("a one-stage villain reads 'Stage I', never 'Stages I–I'", () => {
    expect(shelfSubtitleOf(detail("brotherhood-of-badoon"))).toBe("Drang · Stages I–III · Band of Badoon");
    expect(shelfSubtitleOf(detail("escape-the-museum"))).toBe("Collector · Stage I · Menagerie Medley");
  });

  test("a scenario whose name is not its villain's is titled by the scenario, with the villain leading the subtitle", () => {
    const mansion = detail("mansion-attack");
    expect(mansion.tileTitle).toBe("Mansion Attack");
    expect(shelfSubtitleOf(mansion)).toBe("Avalanche · Stage I · Mystique");
    expect(detail("project-wideawake").tileTitle).toBe("Project Wideawake");
    expect(shelfSubtitleOf(detail("project-wideawake"))).toMatch(/^Sentinel · Stage/);
    // The two Museum scenarios share their villain, so only the scenario's name tells the tiles apart.
    expect(detail("infiltrate-the-museum").tileTitle).toBe("Infiltrate the Museum");
    expect(shelfSubtitleOf(detail("infiltrate-the-museum"))).toBe("Collector · Stages I–III · Menagerie Medley");
    expect(detail("escape-the-museum").tileTitle).toBe("Escape the Museum");
  });

  test("the scenario's own name or several villains keep their titles (Rhino, Kang, Breakout, Sinister Six, Tower Defense)", () => {
    expect(detail("rhino").tileTitle).toBe(detail("rhino").villainName);
    expect(detail("kang").titledByScenario).toBe(false);
    expect(detail("breakout").tileTitle).toBe("Breakout");
    expect(detail("sinister-six").tileTitle).toBe("The Sinister Six");
    expect(detail("tower-defense").tileTitle).toBe("Proxima Midnight / Corvus Glaive");
    for (const id of ["rhino", "kang", "breakout", "sinister-six", "tower-defense"])
      expect(shelfSubtitleOf(detail(id))).toMatch(/^Stages? I/);
  });

  test("in the real pool, the two Museum scenarios, the two Marauders scenarios (Morlock Siege, On the Run) and Apocalypse with En Sabah Nur are the only villain names shared", () => {
    const names = POOL_SCENARIOS.map((s) => detail(s.id as string).villainName);
    // Fear No Evil's five underling scenarios all open on their default villain's card, which a table replaces at setup.
    const shared = POOL_SCENARIOS.filter(
      (s, i) => !s.villainOptions && names.indexOf(names[i]!) !== names.lastIndexOf(names[i]!),
    );
    expect(shared.map((s) => s.id as string).sort()).toEqual([
      "apocalypse",
      "en-sabah-nur",
      "escape-the-museum",
      "infiltrate-the-museum",
      "morlock-siege",
      "on-the-run",
    ]);
  });
});

describe("a scenario whose villain is a setup choice (Fear No Evil)", () => {
  const detail = (id: string) =>
    scenarioDetailOf(
      POOL_SCENARIOS.find((s) => (s.id as string) === id)!,
      CARDS_BY_ID,
      POOL_ENCOUNTER_SETS,
    );

  test("names the five villains, not the default one, and keeps the default's set out of the fixed sets", () => {
    const d = detail("art-museum-heist");
    expect(d.villainChoices).toEqual(["Hammerhead", "Bullseye", "Electro", "Purple Man", "Typhoid Mary"]);
    expect(shelfSubtitleOf(d)).toMatch(/^Choice of 5 villains · Stages I–II/);
    expect(scenarioDetailLines(d)[0]).toContain("your pick of Hammerhead, Bullseye");
    expect(d.fixedEncounterSetNames).not.toContain("Hammerhead");
  });

  test("Kingpin's villain is fixed", () => {
    expect(detail("kingpin").villainChoices).toEqual([]);
  });
});

describe("a scenario that opens against a random villain", () => {
  const detail = (id: string) =>
    scenarioDetailOf(
      POOL_SCENARIOS.find((s) => (s.id as string) === id)!,
      CARDS_BY_ID,
      POOL_ENCOUNTER_SETS,
    );

  test.each(["morlock-siege", "on-the-run"])("%s names the villains' set, not the placeholder card", (id) => {
    const d = detail(id);
    expect(d.villainIsRandom).toBe(true);
    expect(d.villainName).toBe("The Marauders");
    expect(d.displayName).toBe("The Marauders");
    expect(d.tileTitle).toBe(d.scenarioName);
    expect(shelfSubtitleOf(d)).toBe("The Marauders · random");
    expect(scenarioDetailLines(d).join("\n")).not.toContain("Arclight");
    expect(scenarioDetailLines(d).join("\n")).not.toContain("Stage ");
  });

  test("a fixed villain is not marked random", () => {
    expect(detail("rhino").villainIsRandom).toBe(false);
  });
});

describe("lockCaptionOf", () => {
  test("shortens a campaign gate and a scenario gate, keeping the points way in", () => {
    expect(lockCaptionOf("Complete the Age of Apocalypse campaign to unlock Agents of S.H.I.E.L.D.", 100)).toBe(
      "Finish Age of Apocalypse · or 100 pts",
    );
    expect(lockCaptionOf("Complete The Rise of Red Skull campaign to unlock The Galaxy's Most Wanted", 50)).toBe(
      "Finish Rise of Red Skull · or 50 pts",
    );
    expect(lockCaptionOf("Beat Rhino to unlock The Rise of Red Skull", 30)).toBe("Beat Rhino · or 30 pts");
  });
});

describe("a villain drawn at random reads as random everywhere", () => {
  const bySetup = POOL_SCENARIOS.filter((s) => s.startingVillain === "bySetup" || s.randomVillainName !== undefined);

  test("God of Lies names the Avatar family, so the setup card and the shelf row never name Loki the Rascal", () => {
    const godOfLies = POOL_SCENARIOS.find((s) => (s.id as string) === "god-of-lies")!;
    const detail = scenarioDetailOf(godOfLies, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.villainIsRandom).toBe(true);
    expect(detail.villainName).toBe("Avatar of Loki");
    expect(detail.displayName).toBe("Avatar of Loki");
    expect(shelfSubtitleOf(detail)).toBe("Avatar of Loki · random");
    expect(scenarioDetailLines(detail)[0]).toBe("Villain: Avatar of Loki");
    expect(requiredCardLabel(detail.displayName, 8)).toBe("Required by Avatar of Loki · 8 cards");
  });

  test("the Marauders read the same way", () => {
    const marauders = POOL_SCENARIOS.find((s) => (s.id as string) === "morlock-siege")!;
    const detail = scenarioDetailOf(marauders, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.villainName).toBe("The Marauders");
    expect(shelfSubtitleOf(detail)).toBe("The Marauders · random");
  });

  test("every random-villain scenario in the pool has a label and no fixed card name", () => {
    expect(bySetup.length).toBeGreaterThan(1);
    for (const scenario of bySetup) {
      const label = randomVillainLabel(scenario, CARDS_BY_ID);
      expect(label, scenario.id as string).toBeTruthy();
      const detail = scenarioDetailOf(scenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
      expect(detail.villainIsRandom).toBe(true);
      expect(detail.displayName).toBe(label);
    }
  });
});

describe("leader wording", () => {
  test("a leader scenario's detail says Leader; Rhino keeps Villain", () => {
    const villain = CARDS_BY_ID.get(rhino.villainCardId as string)!;
    const leader = { ...villain, id: "fixture-iron-man", printedType: "leader" } as unknown as AnyCard;
    const cards = new Map<string, AnyCard>([...CARDS_BY_ID, ["fixture-iron-man", leader]]);
    const scenario = { ...rhino, villainCardId: "fixture-iron-man" } as unknown as Scenario;
    const detail = scenarioDetailOf(scenario, cards, POOL_ENCOUNTER_SETS);
    expect(detail.foeWord).toBe("Leader");
    expect(scenarioDetailLines(detail)[0]).toMatch(/^Leader: /);
    const plain = scenarioDetailOf(rhino, CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(plain.foeWord).toBe("Villain");
    expect(scenarioDetailLines(plain)[0]).toMatch(/^Villain: /);
  });
});

describe("Shadowland's card-keyed villain choice", () => {
  const shadowland = (id: string) =>
    scenarioDetailOf(
      SHADOWLAND_SCENARIOS.find((s) => s.id === id)!,
      CARDS_BY_ID,
      POOL_ENCOUNTER_SETS,
    );

  const villainNamesOf = (id: string): string[] =>
    SHADOWLAND_SCENARIOS.find((s) => s.id === id)!.villainOptions!.options.map(
      (o) => CARDS_BY_ID.get(o.villainCardId as string)!.name,
    );

  test("Shadows in the Night lists the pool once, never the drawn villain's name", () => {
    const d = shadowland("shadows-in-the-night");
    expect(d.villainChoices).toEqual([]);
    expect(d.villainPool).toMatchObject({ count: 6, setAside: false });
    expect(d.villainIsRandom).toBe(true);
    const text = scenarioDetailLines(d).join(" | ");
    expect(text).toMatch(/1 random .* villain of 6/);
    for (const name of villainNamesOf("shadows-in-the-night")) expect(text).not.toContain(name);
    expect(shelfSubtitleOf(d)).toMatch(/random$/);
  });

  test("Shadow Labyrinth names its own villain and says the drawn one is set aside", () => {
    const d = shadowland("shadow-labyrinth");
    expect(d.villainPool).toMatchObject({ count: 6, setAside: true });
    expect(d.villainIsRandom).toBe(false);
    const first = scenarioDetailLines(d)[0]!;
    expect(first).toMatch(/set aside/);
    for (const name of villainNamesOf("shadow-labyrinth")) expect(first).not.toContain(name);
  });
});
