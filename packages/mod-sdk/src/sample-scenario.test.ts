import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYABLE_DEPS } from "@mc/cards";
import { playToOutcome } from "@mc/cards/testing";
import { CORE_SCENARIOS, type PackManifest } from "@mc/content";
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
    if (path !== "pack.json" && !path.endsWith(".zip")) files.set(path, new Uint8Array(readFileSync(full)));
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
    expect(result.games.filter((game) => game.scenario === SCENARIO)).toHaveLength(3);
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

  it("carries campaigns through untouched and only checks they are a list", async () => {
    const withCampaigns = { ...pack, campaigns: [{ anything: true }] } as unknown as PackInput;
    expect(issues(withCampaigns)).toBe("");
    expect(issues({ ...pack, campaigns: {} } as unknown as PackInput)).toMatch(
      /data\/campaigns.json: must be a list of campaigns/,
    );
  });
});

describe("scenarioWithPacks: refusals", () => {
  const seat = { players: [{ starterDeckId: PRECON }], seed: 1 } as const;
  it("refuses a pack set at a scenario with a modular set pool, and a pack scenario option it does not offer", () => {
    expect(() => scenarioWithPacks("thunderbolts", { ...seat, modularSetIds: [GEARS] }, [pack])).toThrow();
    expect(() => scenarioWithPacks(SCENARIO, { ...seat, extraModularSetIds: ["longshot"] }, [pack])).toThrow(
      /not offered at a pack scenario/,
    );
  });
  it("refuses another scenario's set and a set that is not a pack set at a pack scenario", () => {
    expect(() => scenarioWithPacks("rhino", { ...seat, modularSetIds: [SCENARIO] }, [pack])).toThrow(
      /already part of|belongs to another scenario/,
    );
    expect(() => scenarioWithPacks(SCENARIO, { ...seat, modularSetIds: ["rhino"] }, [pack])).toThrow();
  });
  it("is the base game's own setup when no pack is given", () => {
    const base = scenarioWithPacks("rhino", seat, []);
    expect((base.encounterDeck ?? []).length).toBeGreaterThan(0);
  });
});
