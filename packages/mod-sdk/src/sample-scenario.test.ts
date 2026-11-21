import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS, customScenarioProblems, playableScenario } from "@mc/cards";
import { playToOutcome } from "@mc/cards/testing";
import { CORE_SCENARIOS, PLAYABLE_CARDS, type PackManifest } from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { buildPack } from "./build.js";
import { gameDepsWithPacks, packModularSetChoices, packScenarioRecords, scenarioWithPacks } from "./game.js";
import { smokeTestPack } from "./smoke.js";
import { readPackInput, validatePack, type PackInput } from "./validate.js";

/**
 * The sample scenario pack (content-packs/sample-scenario) and the sample hero pack's nemesis set record: build the
 * pack, validate the built output, then play its scenario with a base precon and its modular set at a base scenario
 * to an outcome, on the real engine with the pack's cards and abilities read back from the built JSON.
 */
const SAMPLE_DIR = fileURLToPath(new URL("../../../content-packs/sample-scenario", import.meta.url));
const HERO_DIR = fileURLToPath(new URL("../../../content-packs/sample-hero", import.meta.url));
const PACK = "x.sample-scenario.";
const SCENARIO = "sample-scenario-clockwork";
const GEARS = "sample-scenario-gears";
const PRECON = "core-spider-man-justice";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

async function builtPack(srcDir: string, outDir: string): Promise<PackInput> {
  await buildPack(srcDir, outDir);
  const manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
  return readPackInput(manifest, files);
}

const dirs: string[] = [];
let pack: PackInput;
let hero: PackInput;
beforeAll(async () => {
  dirs.push(mkdtempSync(join(tmpdir(), "mc-sample-scenario-")), mkdtempSync(join(tmpdir(), "mc-sample-hero-")));
  pack = await builtPack(SAMPLE_DIR, dirs[0]!);
  hero = await builtPack(HERO_DIR, dirs[1]!);
});
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("sample-scenario pack", () => {
  it("validates as built, with its sets and scenario in the manifest's contents", () => {
    expect(validatePack(pack)).toEqual([]);
    expect(pack.manifest.contents.encounterSets).toBe("data/encounter-sets.json");
    expect(pack.manifest.contents.scenarios).toBe("data/scenarios.json");
    expect(pack.encounterSets?.map((set) => String(set.id)).sort()).toEqual(["sample-scenario-clockwork", GEARS]);
    expect(packScenarioRecords([pack]).map((s) => String(s.id))).toEqual([SCENARIO]);
  });

  it("has a two-stage villain and main scheme, minions, a side scheme, a treachery, an attachment and a modular set", () => {
    const types = pack.cards.map((card) => card.type);
    for (const type of ["villain", "main_scheme", "minion", "side_scheme", "treachery", "attachment"])
      expect(types).toContain(type);
    const villain = pack.cards.find((card) => card.type === "villain");
    if (villain?.type !== "villain") throw new Error("no villain");
    expect(villain.sides[0]?.stages.map((stage) => stage.stageNumber)).toEqual([1, 2]);
    const scheme = pack.cards.find((card) => card.type === "main_scheme");
    if (scheme?.type !== "main_scheme") throw new Error("no main scheme");
    expect(scheme.stages.map((stage) => stage.stageNumber)).toEqual([1, 2]);
    const gears = pack.cards.filter(
      (card) => "encounterSetIds" in card && card.encounterSetIds.includes(GEARS as never),
    );
    expect(gears.map((card) => card.type).sort()).toEqual(["minion", "side_scheme"]);
  });

  it("offers its Gears set at the Core Rhino, but not the scenario's own set or a hero's nemesis set", () => {
    const rhino = CORE_SCENARIOS.find((s) => s.id === "rhino")!;
    const choices = packModularSetChoices(rhino, [pack, hero]).map((set) => String(set.id));
    expect(choices).toContain(GEARS);
    expect(choices).not.toContain(SCENARIO);
    expect(choices).not.toContain("sample-hero-nemesis");
  });

  const run = (scenario: string, modularSetIds: readonly string[] | undefined, seed: number) => {
    const deps = gameDepsWithPacks(PLAYABLE_DEPS, [pack]);
    const config = scenarioWithPacks(
      scenario,
      {
        players: [{ starterDeckId: PRECON }],
        seed,
        difficulty: "standard",
        ...(modularSetIds ? { modularSetIds } : {}),
      },
      [pack],
    );
    const created = createGame(config, deps);
    if (!created.ok) throw new Error(created.error.message);
    const result = playToOutcome(created.state, deps, { maxCommands: 4000 });
    const replayed = replay(result.session.log, deps);
    if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
    const revealed = replayed.events.flatMap((e) => (e.type === "encounterCardRevealed" ? [String(e.cardId)] : []));
    return { result, state: result.session.state, replayed, revealed };
  };

  const revealedPackCards = new Set<string>();
  afterAll(() => {
    // Over the games, the pack's own cards came off the encounter deck, so their scripts really ran.
    expect(revealedPackCards.size, [...revealedPackCards].join(", ")).toBeGreaterThan(0);
  });

  for (const seed of [1, 2, 3]) {
    it(`the Clockmaker scenario with its recommended Gears set, seed ${seed}: plays to an outcome and replays`, () => {
      const { result, state, replayed, revealed } = run(SCENARIO, undefined, seed);
      expect(result.outcome, `no outcome after ${result.commands} commands, round ${result.rounds}`).not.toBeNull();
      expect(state.pendingChoice).toBeNull();
      expect(replayed.state).toEqual(state);
      for (const code of revealed) if (code.startsWith(PACK)) revealedPackCards.add(code);
    });

    it(`the Gears set at the Core Rhino in place of Bomb Scare, seed ${seed}: plays to an outcome and replays`, () => {
      const { result, state, replayed, revealed } = run("rhino", [GEARS], seed);
      expect(result.outcome, `no outcome after ${result.commands} commands, round ${result.rounds}`).not.toBeNull();
      expect(state.pendingChoice).toBeNull();
      expect(replayed.state).toEqual(state);
      for (const code of revealed) if (code.startsWith(PACK)) revealedPackCards.add(code);
    });
  }

  it("deals the pack's modular set cards into the Rhino game and none of Bomb Scare's", () => {
    const config = scenarioWithPacks(
      "rhino",
      { players: [{ starterDeckId: PRECON }], seed: 1, modularSetIds: [GEARS] },
      [pack],
    );
    const deck = (config.encounterDeck ?? []).map(String);
    expect(deck).toContain(`${PACK}08`);
    expect(deck.filter((id) => id === `${PACK}09`)).toHaveLength(2);
    expect(deck).not.toContain("01109");
  });

  it("lets Standard II or III and Expert II stand in for the pack scenario's own Standard and Expert sets (#786)", () => {
    const setCards = (setId: string): string[] =>
      PLAYABLE_CARDS.filter(
        (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
      ).map((card) => String(card.id));
    const deckOf = (difficultySets: { standard?: string; expert?: string }, difficulty: "standard" | "expert") =>
      (
        scenarioWithPacks(
          SCENARIO,
          { players: [{ starterDeckId: PRECON }], seed: 1, difficulty, difficultySets } as never,
          [pack],
        ).encounterDeck ?? []
      ).map(String);
    const standardIii = deckOf({ standard: "standard_iii" }, "standard");
    expect(setCards("standard_iii").every((id) => standardIii.includes(id))).toBe(true);
    expect(standardIii.some((id) => setCards("standard").includes(id))).toBe(false);
    const expertIi = deckOf({ standard: "standard_ii", expert: "expert_ii" }, "expert");
    expect(setCards("standard_ii").every((id) => expertIi.includes(id))).toBe(true);
    expect(setCards("expert_ii").every((id) => expertIi.includes(id))).toBe(true);
    expect(expertIi.some((id) => [...setCards("standard"), ...setCards("expert")].includes(id))).toBe(false);
    expect(() => deckOf({ standard: "expert_ii" }, "standard")).toThrow(/not in the standard classification/);
  });

  it("plays the pack scenario in skirmish mode against one villain version, and refuses a version it lacks (#786)", () => {
    const at = (villainVersion: string) =>
      scenarioWithPacks(
        SCENARIO,
        { players: [{ starterDeckId: PRECON }], seed: 1, modes: { skirmish: { villainVersion } } },
        [pack],
      );
    const config = at("2");
    expect(config.villainStartStageIndex).toBe(1);
    expect(config.villainLastStageIndex).toBe(1);
    expect(() => at("3")).toThrow(/villain version 3 is not one of 1, 2/);
  });

  it("mixes a base and a pack modular set when the scenario takes two, and counts the pack's toward the count", () => {
    expect(() =>
      scenarioWithPacks(
        "rhino",
        { players: [{ starterDeckId: PRECON }], seed: 1, modularSetIds: [GEARS, "bomb_scare"] },
        [pack],
      ),
    ).toThrow(/uses 1 modular set/);
  });

  it("smoke-tests a scenario pack with mc-pack test's helper: its scenario and its modular set both play", () => {
    const result = smokeTestPack(pack, { games: 3 });
    expect(result.games.filter((game) => !game.ok).map((game) => game.error)).toEqual([]);
    expect(result.games.filter((game) => game.scenario === SCENARIO && !game.campaign)).toHaveLength(6); // standard and expert
    expect(result.games.filter((game) => game.scenario === SCENARIO && game.difficulty === "expert")).toHaveLength(3);
    expect(result.games.filter((game) => game.modularSet === GEARS)).toHaveLength(3);
    expect(result.ok).toBe(true);
  });
});

describe("sample-hero pack's nemesis set record", () => {
  it("validates as built and marks the set as the hero's nemesis set", () => {
    expect(validatePack(hero)).toEqual([]);
    const set = hero.encounterSets?.find((candidate) => String(candidate.id) === "sample-hero-nemesis");
    expect(set?.name).toBe("Sample Sentinel Nemesis");
    expect(String(set?.nemesisOfIdentityId)).toBe("x.sample-hero.01a");
  });
});

describe("validatePack: encounter sets and scenarios", () => {
  /** The built pack with its parsed data changed; file hashes are not redone, so tests read only the issues they want. */
  const changed = (
    change: (copy: { cards: any[]; encounterSets: any[]; scenarios: any[]; campaigns?: any }) => void,
  ) => {
    const copy = {
      cards: structuredClone(pack.cards) as any[],
      encounterSets: structuredClone(pack.encounterSets ?? []) as any[],
      scenarios: structuredClone(pack.scenarios ?? []) as any[],
    };
    change(copy);
    return { ...pack, ...copy } as unknown as PackInput;
  };
  const issues = (input: PackInput): string =>
    validatePack(input)
      .filter((issue) => !/sha256|size is|listed in pack.json|not listed|totalBytes/.test(issue.message))
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");

  it("rejects a set id outside the pack's id, and one listed twice", () => {
    expect(issues(changed((c) => (c.encounterSets[0].id = "other-set")))).toMatch(
      /encounter set id must start with "sample-scenario-"/,
    );
    expect(issues(changed((c) => c.encounterSets.push({ ...c.encounterSets[0] })))).toMatch(/used by two sets/);
  });

  it("rejects a card whose encounter set has no record", () => {
    expect(
      issues(
        changed((c) => (c.cards.find((card) => card.id === `${PACK}03`).encounterSetIds = ["sample-scenario-nope"])),
      ),
    ).toMatch(/cards\/x.sample-scenario.03: encounter set "sample-scenario-nope" has no record/);
  });

  it("rejects a hero's nemesis set that has no record or does not name its hero", () => {
    const heroBare = { ...hero, encounterSets: [] } as unknown as PackInput;
    expect(
      validatePack(heroBare)
        .map((i) => i.message)
        .join("\n"),
    ).toMatch(/nemesis set "sample-hero-nemesis" has no record/);
    const unmarked = {
      ...hero,
      encounterSets: [{ ...hero.encounterSets![0], nemesisOfIdentityId: undefined }],
    } as unknown as PackInput;
    expect(
      validatePack(unmarked)
        .map((i) => i.message)
        .join("\n"),
    ).toMatch(/needs nemesisOfIdentityId/);
  });

  it("rejects set features a pack set cannot carry yet", () => {
    expect(issues(changed((c) => (c.encounterSets[0].extraModular = true)))).toMatch(/"extraModular" is not available/);
  });

  it("rejects a scenario id outside the pack's id, a bad packCode and a field a pack scenario cannot use", () => {
    expect(issues(changed((c) => (c.scenarios[0].id = "clockmaker")))).toMatch(
      /scenario id must start with "sample-scenario-"/,
    );
    expect(issues(changed((c) => (c.scenarios[0].packCode = "core")))).toMatch(/packCode must be the pack's id/);
    expect(
      issues(changed((c) => (c.scenarios[0].modularSetPool = { setIds: ["bomb_scare"], restricted: false }))),
    ).toMatch(/field "modularSetPool" is not available to a pack scenario/);
  });

  it("rejects a scenario that names a villain, main scheme or set that nobody has", () => {
    expect(issues(changed((c) => (c.scenarios[0].villainCardId = "x.sample-scenario.99")))).toMatch(
      /villain x.sample-scenario.99 is in neither/,
    );
    expect(issues(changed((c) => (c.scenarios[0].villainCardId = `${PACK}03`)))).toMatch(/is not a villain card/);
    expect(issues(changed((c) => (c.scenarios[0].mainSchemeCardId = `${PACK}01`)))).toMatch(
      /is not a main scheme card/,
    );
    expect(issues(changed((c) => (c.scenarios[0].encounterSetIds = ["sample-scenario-nope"])))).toMatch(
      /encounterSetIds: "sample-scenario-nope" is in neither the pack nor the base game/,
    );
    expect(issues(changed((c) => (c.scenarios[0].recommendedModularSetIds = ["no_such_modular"])))).toMatch(
      /recommendedModularSetIds: "no_such_modular" is in neither/,
    );
  });

  it("accepts a base modular set as a recommendation, and rejects a stage the villain lacks", () => {
    expect(issues(changed((c) => (c.scenarios[0].recommendedModularSetIds = ["bomb_scare"])))).toBe("");
    expect(issues(changed((c) => (c.scenarios[0].villainStages = { standard: [1, 3], expert: [2, 3] })))).toMatch(
      /the villain has no stage 3/,
    );
  });

  it("rejects a recommended modular set that is the scenario's own or a hero's nemesis set", () => {
    expect(issues(changed((c) => (c.scenarios[0].recommendedModularSetIds = [SCENARIO])))).toMatch(/already part of/);
  });

  it("checks that campaigns are a list (their own checks are in campaigns.test.ts)", () => {
    expect(issues({ ...pack, campaigns: {} } as unknown as PackInput)).toMatch(
      /data\/campaigns.json: must be a list of campaigns/,
    );
  });
});

describe("scenarioWithPacks: refusals and options", () => {
  const seat = { players: [{ starterDeckId: PRECON }], seed: 1 } as const;
  it("refuses a pack set at a scenario with a modular set pool, and a pack scenario option it does not offer", () => {
    expect(() => scenarioWithPacks("thunderbolts", { ...seat, modularSetIds: [GEARS] }, [pack])).toThrow(
      /modular set pool or a side/,
    );
    expect(() => scenarioWithPacks(SCENARIO, { ...seat, extraModularSetIds: ["longshot"] }, [pack])).toThrow(
      /not offered at a pack scenario/,
    );
  });
  it("checks a house modular set (#761) as a counted pick: not twice, not also counted, not a pack's own scenario's set", () => {
    const house = (ids: string[], modularSetIds?: string[]) => ({
      ...seat,
      houseModularSetIds: ids,
      ...(modularSetIds ? { modularSetIds } : {}),
    });
    const deck = (ids: string[]) => scenarioWithPacks("rhino", house(ids), [pack]).encounterDeck!.map(String);
    expect(deck([GEARS])).toContain(`${PACK}08`);
    expect(() => scenarioWithPacks("rhino", house([GEARS, GEARS]), [pack])).toThrow(/added twice/);
    expect(() => scenarioWithPacks("rhino", house([GEARS], [GEARS]), [pack])).toThrow(/already in the game/);
    expect(() => scenarioWithPacks("thunderbolts", house([GEARS]), [pack])).toThrow(/modular set pool or a side/);
    // At the pack's own scenario every house set is checked the same way.
    expect(() => scenarioWithPacks(SCENARIO, house(["bomb_scare", "bomb_scare"]), [pack])).toThrow(/added twice/);
    expect(() => scenarioWithPacks(SCENARIO, house(["standard_ii"]), [pack])).toThrow(/Standard or Expert/);
    expect(() => scenarioWithPacks(SCENARIO, house([SCENARIO]), [pack])).toThrow(/already/);
    expect(scenarioWithPacks(SCENARIO, house(["bomb_scare"]), [pack]).encounterDeck!.map(String)).toContain("01109");
  });

  it("refuses another scenario's set and a set that is not a pack set at a pack scenario", () => {
    expect(() => scenarioWithPacks("rhino", { ...seat, modularSetIds: [SCENARIO] }, [pack])).toThrow(
      /belongs to another scenario|already part of/,
    );
    expect(() => scenarioWithPacks(SCENARIO, { ...seat, modularSetIds: ["rhino"] }, [pack])).toThrow(
      /belongs to another scenario/,
    );
  });
  it("is the base game's own setup when no pack is given", () => {
    expect(scenarioWithPacks("rhino", seat, [])).toEqual(playableScenario("rhino", seat));
  });
  it("never lets a pack scenario or set take a base id, or two packs share one", () => {
    const set = { ...pack.encounterSets![0]!, id: "bomb_scare" } as never;
    expect(() => scenarioWithPacks("rhino", seat, [{ ...pack, encounterSets: [set] }])).toThrow(/base-game id/);
    const scenario = { ...pack.scenarios![0]!, id: "rhino" } as never;
    expect(() => scenarioWithPacks("rhino", seat, [{ ...pack, scenarios: [scenario] }])).toThrow(/base-game id/);
    expect(() => scenarioWithPacks("rhino", seat, [pack, { ...pack, cards: [] }])).toThrow(/used by two packs/);
  });
  it("deals a base set's separate deck at a pack scenario (Infinity Gauntlet's stones, MC21 p. 16)", () => {
    const config = scenarioWithPacks(SCENARIO, { ...seat, modularSetIds: ["infinity_gauntlet"] }, [pack]);
    expect(config.scenarioDecks?.length).toBeGreaterThan(0);
    expect(scenarioWithPacks(SCENARIO, seat, [pack]).scenarioDecks).toBeUndefined();
  });
  it("starts expert mode at stage II and ends there, with the Expert set in the deck", () => {
    const config = scenarioWithPacks(SCENARIO, { ...seat, difficulty: "expert" }, [pack]);
    expect(config.villainStartStageIndex).toBe(1);
    expect(config.villainLastStageIndex).toBe(1);
    expect(config.difficulty).toBe("expert");
    const expertCards = new Set(
      PLAYABLE_CARDS.filter(
        (card) => "encounterSetIds" in card && card.encounterSetIds.includes("expert" as never),
      ).map((card) => String(card.id)),
    );
    expect((config.encounterDeck ?? []).some((id) => expertCards.has(String(id)))).toBe(true);
    const standard = scenarioWithPacks(SCENARIO, seat, [pack]);
    expect([standard.villainStartStageIndex, standard.villainLastStageIndex]).toEqual([0, 1]);
    expect(standard.difficulty).toBeUndefined();
  });
  it("carries a heroic level, and refuses skirmish where the villain deck has one version (expert's [2, 2])", () => {
    expect(scenarioWithPacks(SCENARIO, { ...seat, modes: { heroic: 2 } }, [pack]).heroicLevel).toBe(2);
    expect(() =>
      scenarioWithPacks(SCENARIO, { ...seat, modes: { expert: true, skirmish: { villainVersion: "2" } } as never }, [
        pack,
      ]),
    ).toThrow(/no skirmish mode/);
  });
  it("does not offer a scenario's own Standard or Expert set as a modular pick", () => {
    const rhino = { ...CORE_SCENARIOS.find((s) => s.id === "rhino")!, standardEncounterSetIds: [GEARS] } as never;
    expect(packModularSetChoices(rhino, [pack]).map((set) => String(set.id))).not.toContain(GEARS);
  });
  it("answers a sentence, not a TypeError, for a scenario with no villain stages or an empty Standard set", () => {
    const content = { cards: pack.cards, encounterSets: pack.encounterSets!, scenarios: [] };
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const missing = customScenarioProblems({ ...record, villainStages: undefined } as never, content);
    expect(missing.join("\n")).toMatch(/villainStages.standard must be \[first stage, last stage\]/);
    const backwards = customScenarioProblems(
      { ...record, villainStages: { standard: [2, 1], expert: [2, 2] } } as never,
      content,
    );
    expect(backwards.join("\n")).toMatch(/villainStages.standard/);
    const noStandard = customScenarioProblems({ ...record, standardEncounterSetIds: [] } as never, content);
    expect(noStandard.join("\n")).toMatch(/standardEncounterSetIds is empty/);
  });
  it("sets aside a scenario's own cards from its deck, and refuses ones it cannot", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const content = { cards: pack.cards, encounterSets: pack.encounterSets!, scenarios: [] };
    const withAside = (ids: string[]) => ({ ...record, setAsideCardIds: ids }) as never;
    const seat = { players: [{ starterDeckId: PRECON }], seed: 1 } as const;
    const aside = `${PACK}07`; // the pack's attachment, in the scenario's own set
    expect(customScenarioProblems(withAside([aside]), content)).toEqual([]);
    expect(customScenarioProblems(withAside([`${PACK}99`]), content).join(" ")).toMatch(/in neither the pack/);
    expect(customScenarioProblems(withAside([`${PACK}08`]), content).join(" ")).toMatch(/not a card of the scenario/);
    expect(customScenarioProblems(withAside([`${PACK}01`]), content).join(" ")).toMatch(/a villain/);
    expect(customScenarioProblems(withAside([aside, aside]), content).join(" ")).toMatch(/listed twice/);
    const base = scenarioWithPacks(SCENARIO, seat, [pack]);
    expect(base.setAside).toBeUndefined();
    const changed = { ...pack, scenarios: [{ ...record, setAsideCardIds: [aside] }] } as unknown as PackInput;
    const config = scenarioWithPacks(SCENARIO, seat, [changed]);
    expect(config.setAside).toEqual([aside]);
    expect((config.encounterDeck ?? []).map(String)).not.toContain(aside);
    const without = (base.encounterDeck ?? []).map(String).filter((id) => id !== aside);
    expect((config.encounterDeck ?? []).map(String)).toEqual(without);
    const created = createGame(config, gameDepsWithPacks(PLAYABLE_DEPS, [changed]));
    expect(created.ok).toBe(true);
  });
  it("sets aside modular sets for a pack scenario with setAsideModularSetCount: the seat's picks or seeded ones", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const content = { cards: pack.cards, encounterSets: pack.encounterSets!, scenarios: [] };
    const withCount = { ...record, setAsideModularSetCount: 1 };
    expect(customScenarioProblems(withCount as never, content)).toEqual([]);
    const changed = { ...pack, scenarios: [withCount] } as unknown as PackInput;
    const seat = { players: [{ starterDeckId: PRECON }], seed: 1 } as const;
    const picked = scenarioWithPacks(SCENARIO, { ...seat, setAsideModularSetIds: ["masters_of_evil"] }, [changed]);
    expect(picked.setAsideModularSets?.map((set) => set.encounterSetId)).toEqual(["masters_of_evil"]);
    expect(picked.setAsideModularSets?.[0]?.cardIds.length).toBeGreaterThan(0);
    const asideIds = new Set((picked.setAsideModularSets?.[0]?.cardIds ?? []).map(String));
    expect((picked.encounterDeck ?? []).map(String).some((id) => asideIds.has(id))).toBe(false);
    expect(createGame(picked, gameDepsWithPacks(PLAYABLE_DEPS, [changed])).ok).toBe(true);
    const seeded = scenarioWithPacks(SCENARIO, seat, [changed]);
    expect(seeded.setAsideModularSets).toHaveLength(1);
    expect(scenarioWithPacks(SCENARIO, seat, [changed]).setAsideModularSets).toEqual(seeded.setAsideModularSets);
    expect(() =>
      scenarioWithPacks(SCENARIO, { ...seat, setAsideModularSetIds: ["masters_of_evil", "bomb_scare"] }, [changed]),
    ).toThrow(/expected 1 set-aside modular sets/);
    expect(() =>
      scenarioWithPacks(SCENARIO, { ...seat, modularSetIds: [GEARS], setAsideModularSetIds: [GEARS] }, [changed]),
    ).toThrow(/both shuffled in and set aside/);
    expect(() => scenarioWithPacks(SCENARIO, { ...seat, setAsideModularSetIds: ["masters_of_evil"] }, [pack])).toThrow(
      /not offered at a pack scenario/,
    );
  });
  it("sets aside the authors' recommendedSetAsideModularSetIds when the seat picks none (#943)", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const content = { cards: pack.cards, encounterSets: pack.encounterSets!, scenarios: [] };
    const withDefault = {
      ...record,
      setAsideModularSetCount: 1,
      recommendedSetAsideModularSetIds: ["masters_of_evil"],
    };
    expect(customScenarioProblems(withDefault as never, content)).toEqual([]);
    const changed = { ...pack, scenarios: [withDefault] } as unknown as PackInput;
    const seat = { players: [{ starterDeckId: PRECON }], seed: 1 } as const;
    for (const seed of [1, 2, 3]) {
      const config = scenarioWithPacks(SCENARIO, { ...seat, seed }, [changed]);
      expect(config.setAsideModularSets?.map((set) => set.encounterSetId)).toEqual(["masters_of_evil"]);
    }
    // The seat's own pick still wins; a recommended set the table shuffles in falls back to a seeded pick.
    const picked = scenarioWithPacks(SCENARIO, { ...seat, setAsideModularSetIds: ["bomb_scare"] }, [changed]);
    expect(picked.setAsideModularSets?.map((set) => set.encounterSetId)).toEqual(["bomb_scare"]);
    const clash = scenarioWithPacks(SCENARIO, { ...seat, modularSetIds: ["masters_of_evil"] }, [changed]);
    expect(clash.setAsideModularSets?.map((set) => set.encounterSetId)).not.toEqual(["masters_of_evil"]);
    // A house-rule set is shuffled in too, so it is never the one set aside (Codex review).
    for (const seed of [1, 2, 3]) {
      const house = scenarioWithPacks(SCENARIO, { ...seat, seed, houseModularSetIds: ["masters_of_evil"] }, [changed]);
      expect(house.setAsideModularSets?.map((set) => set.encounterSetId)).not.toContain("masters_of_evil");
    }
    const bad = (extra: Record<string, unknown>) =>
      customScenarioProblems({ ...withDefault, ...extra } as never, content);
    expect(bad({ recommendedSetAsideModularSetIds: ["masters_of_evil", "bomb_scare"] })).toContain(
      "recommendedSetAsideModularSetIds: lists 2 sets, but 1 are set aside",
    );
    expect(bad({ recommendedSetAsideModularSetIds: [GEARS] })).toContain(
      `recommendedSetAsideModularSetIds: "${GEARS}" is also shuffled in`,
    );
    expect(bad({ recommendedSetAsideModularSetIds: ["standard"] }).length).toBeGreaterThan(0);
  });
  it("sets aside only what a modular pick could be: never the scenario's own, Standard or an empty set", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const EMPTY = "sample-scenario-empty";
    const changed = {
      ...pack,
      encounterSets: [...pack.encounterSets!, { id: EMPTY, name: "Empty", packCodes: ["sample-scenario"] }],
      scenarios: [{ ...record, setAsideModularSetCount: 1 }],
    } as unknown as PackInput;
    const seat = { players: [{ starterDeckId: PRECON }], seed: 1 } as const;
    const aside = (id: string) => () =>
      scenarioWithPacks(SCENARIO, { ...seat, setAsideModularSetIds: [id] }, [changed]);
    expect(aside(EMPTY)).toThrow(/cannot be set aside \(.*has no cards\)/);
    expect(aside(SCENARIO)).toThrow(/cannot be set aside/);
    expect(aside("standard")).toThrow(/cannot be set aside/);
    // Seeded picks draw from the same sets: across many seeds, never one of those.
    const forbidden = new Set([EMPTY, SCENARIO, "standard", "expert"]);
    for (let seed = 1; seed <= 40; seed += 1) {
      const config = scenarioWithPacks(SCENARIO, { ...seat, seed }, [changed]);
      for (const set of config.setAsideModularSets ?? []) expect(forbidden.has(String(set.encounterSetId))).toBe(false);
    }
  });
  it("sets aside a Standard set card only while the Standard set is in the game (#786)", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const content = { cards: pack.cards, encounterSets: pack.encounterSets!, scenarios: [] };
    const aside = String(
      PLAYABLE_CARDS.find(
        (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes("standard"),
      )!.id,
    );
    expect(customScenarioProblems({ ...record, setAsideCardIds: [aside] } as never, content)).toEqual([]);
    const changed = { ...pack, scenarios: [{ ...record, setAsideCardIds: [aside] }] } as unknown as PackInput;
    const seat = { players: [{ starterDeckId: PRECON }], seed: 1 } as const;
    const plain = scenarioWithPacks(SCENARIO, seat, [changed]);
    expect(plain.setAside?.every((id) => String(id) === aside)).toBe(true);
    expect(plain.setAside?.length).toBeGreaterThan(0);
    expect((plain.encounterDeck ?? []).map(String)).not.toContain(aside);
    const replaced = scenarioWithPacks(SCENARIO, { ...seat, difficultySets: { standard: "standard_iii" } as never }, [
      changed,
    ]);
    expect(replaced.setAside).toBeUndefined();
  });
  it("needs the villain to have every stage between a mode's first and last, as skirmish offers each (#786)", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const problemsAt = (standard: [number, number], cards = pack.cards) =>
      customScenarioProblems({ ...record, villainStages: { standard, expert: [2, 2] } } as never, {
        cards,
        encounterSets: pack.encounterSets!,
        scenarios: [],
      }).join(" ");
    // A villain printed with stages I and III: both ends exist, the middle one does not.
    const skipping = pack.cards.map((card) =>
      card.type === "villain"
        ? {
            ...card,
            sides: card.sides.map((side) => ({
              ...side,
              stages: side.stages.map((stage) => (stage.stageNumber === 2 ? { ...stage, stageNumber: 3 } : stage)),
            })),
          }
        : card,
    ) as typeof pack.cards;
    expect(problemsAt([1, 3], skipping)).toMatch(/the villain has no stage 2/);
    expect(problemsAt([1, 3], skipping)).not.toMatch(/stage 3/);
    // A pack-controlled range answers at once, however wide, and an unsafe number is no stage range at all.
    const started = Date.now();
    expect(problemsAt([1, 1_000_000_000])).toMatch(/the villain has no stage 1000000000/);
    expect(problemsAt([1, Number.MAX_SAFE_INTEGER + 2])).toMatch(/villainStages.standard must be/);
    expect(Date.now() - started).toBeLessThan(1000);
  });
  it("refuses the Standard or Expert set among a pack scenario's own sets, where a replacement would deal both", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const content = { cards: pack.cards, encounterSets: pack.encounterSets!, scenarios: [] };
    const own = record.encounterSetIds as string[];
    for (const set of ["standard", "expert"])
      expect(customScenarioProblems({ ...record, encounterSetIds: [...own, set] } as never, content).join(" ")).toMatch(
        new RegExp(`"${set}" is a ${set} set; list it in ${set}EncounterSetIds`),
      );
  });
  it("checks the recommended modular sets against the scenario's modular count", () => {
    const record = pack.scenarios![0] as never as Record<string, unknown>;
    const content = { cards: pack.cards, encounterSets: pack.encounterSets!, scenarios: [] };
    const two = customScenarioProblems(
      { ...record, modularSetCount: 1, recommendedModularSetIds: [GEARS, "bomb_scare"] } as never,
      content,
    );
    expect(two.join("\n")).toMatch(/recommendedModularSetIds: .*uses 1 modular set/);
  });
});

describe("validatePack: base ids, base sets and required packs", () => {
  const changed = (change: (copy: { cards: any[]; encounterSets: any[]; scenarios: any[] }) => void) => {
    const copy = {
      cards: structuredClone(pack.cards) as any[],
      encounterSets: structuredClone(pack.encounterSets ?? []) as any[],
      scenarios: structuredClone(pack.scenarios ?? []) as any[],
    };
    change(copy);
    return { ...pack, ...copy } as unknown as PackInput;
  };
  const text = (input: PackInput, options = {}): string =>
    validatePack(input, options)
      .filter((issue) => !/sha256|size is|listed in pack.json|not listed|totalBytes/.test(issue.message))
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");

  it("rejects a set or scenario id that is a base-game id", () => {
    expect(text(changed((c) => (c.encounterSets[0].id = "bomb_scare")))).toMatch(/base-game set id/);
    expect(text(changed((c) => (c.scenarios[0].id = "rhino")))).toMatch(/base-game scenario id/);
  });

  it("rejects a pack card that joins a base-game set", () => {
    expect(
      text(changed((c) => (c.cards.find((card) => card.id === `${PACK}03`).encounterSetIds = ["bomb_scare"]))),
    ).toMatch(/may not join a base-game set/);
  });

  it("requires a Standard or Expert classification on a pack set used as one", () => {
    expect(text(changed((c) => (c.scenarios[0].standardEncounterSetIds = [GEARS])))).toMatch(
      /needs classification "standard"/,
    );
    expect(text(changed((c) => (c.scenarios[0].expertEncounterSetIds = [GEARS])))).toMatch(
      /needs classification "expert"/,
    );
  });

  it("lets a scenario recommend a required pack's set when that pack's content is given", () => {
    const other = {
      ...structuredClone(pack.cards.find((card) => card.id === `${PACK}09`)),
      id: "x.other-pack.01",
    } as any;
    other.encounterSetIds = ["other-pack-set"];
    const set = { id: "other-pack-set", name: "Other", packCodes: ["other-pack"] };
    const input = changed((c) => (c.scenarios[0].recommendedModularSetIds = ["other-pack-set"]));
    expect(text(input)).toMatch(/"other-pack-set" is in neither the pack nor the base game/);
    expect(text(input, { requiredPackContent: { cards: [other], encounterSets: [set] } })).toBe("");
  });
});
