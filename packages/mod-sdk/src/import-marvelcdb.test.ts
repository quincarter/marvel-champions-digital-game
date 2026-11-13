import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatImportReport, importMarvelCdbPack } from "./import-marvelcdb.js";
import { assemblePack, buildPack, loadPackSource, PackBuildError } from "./build.js";
import { isUnscriptedAbilityIssue, readPackInput, splitIssues, validatePack } from "./validate.js";

const FIXTURE = fileURLToPath(new URL("./fixtures/marvelcdb-pack", import.meta.url));

const dirs: string[] = [];
const tmp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "mc-import-"));
  dirs.push(dir);
  return dir;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const readJson = (path: string): any => JSON.parse(readFileSync(path, "utf8"));

describe("importMarvelCdbPack on the fixture", () => {
  let out = "";
  let report: Awaited<ReturnType<typeof importMarvelCdbPack>>;
  beforeAll(async () => {
    out = tmp();
    report = await importMarvelCdbPack(FIXTURE, { packId: "ember-warden", outDir: out });
  });

  it("converts every card and reports no normalizer failure or defect", () => {
    expect(report.normalizerFailures).toEqual([]);
    expect(report.normalized).toBe(true);
    expect(report.cards).toBe(5);
    expect(report.copies).toBe(5);
    expect(report.validationIssues).toEqual([]);
  });

  it("renumbers the codes in order and keeps a double-sided card's faces together", () => {
    expect(report.sourceToFinal).toEqual({
      ember_test_01a: "x.ember-warden.01a",
      ember_test_01b: "x.ember-warden.01b",
      ember_test_02: "x.ember-warden.02",
      ember_test_03a: "x.ember-warden.03a",
      ember_test_03b: "x.ember-warden.03b",
      ember_test_04: "x.ember-warden.04",
      ember_test_05: "x.ember-warden.05",
    });
    const files = readdirSync(join(out, "cards")).filter((name) => name.endsWith(".json"));
    expect(files).toEqual([
      "x.ember-warden.01a.json",
      "x.ember-warden.02.json",
      "x.ember-warden.03a.json",
      "x.ember-warden.04.json",
      "x.ember-warden.05.json",
    ]);
  });

  it("rewrites every reference: obligation, nemesis set, aspect, ability ids, collector numbers", () => {
    const hero = readJson(join(out, "cards", "x.ember-warden.01a.json"));
    expect(hero.setCode).toBe("ember-warden");
    expect(hero.collectorNumber).toBe("1A/1B");
    expect(hero.obligationCardId).toBe("x.ember-warden.04");
    expect(hero.nemesisEncounterSetId).toBe("ember-warden-nemesis");
    expect(hero.hero.abilities[0].id).toBe("x.ember-warden.01a.cinder-guard");
    const ally = readJson(join(out, "cards", "x.ember-warden.02.json"));
    expect(ally.aspect).toBe("hero:x.ember-warden.01a");
    expect(ally.collectorNumber).toBe("2");
    const minion = readJson(join(out, "cards", "x.ember-warden.05.json"));
    expect(minion.encounterSetIds).toEqual(["ember-warden-nemesis"]);
    const all = readdirSync(join(out, "cards"))
      .filter((n) => n.endsWith(".json"))
      .map((n) => readFileSync(join(out, "cards", n), "utf8"))
      .join("\n");
    expect(all).not.toMatch(/ember_test/);
    expect(all).not.toMatch(/bundles\/cards/);
  });

  it("curates the permanent no-cost flip upgrade as a dash cost and says so", () => {
    expect(report.autoCurations.map((a) => a.finalCode)).toEqual(["x.ember-warden.03a"]);
    const shield = readJson(join(out, "cards", "x.ember-warden.03a.json"));
    expect(shield.specialCost).toBe("dash");
    expect(shield.otherFaceId ?? shield.flipSide).toBeDefined();
  });

  it("maps pictures per language and alternate art", () => {
    expect(report.languages).toEqual({ base: "en", available: ["en", "es"] });
    expect(existsSync(join(out, "cards", "es", "x.ember-warden.01a.webp"))).toBe(true);
    expect(existsSync(join(out, "cards", "en", "x.ember-warden.05.webp"))).toBe(true);
    expect(report.missingImages).toContain("es/ember_test_05");
    expect(report.altArt).toEqual({
      en: {
        "01088": "alt-art/en/01088.webp",
        "x.ember-warden.01b": "alt-art/en/x.ember-warden.01b.webp",
      },
    });
    const pack = readJson(join(out, "pack.json"));
    expect(pack.languages).toEqual({ base: "en", available: ["en", "es"] });
    expect(pack.translators).toEqual({ es: "Test Translator" });
    expect(pack.templateCredit).toBe("Test Template");
    expect(pack.permission).toMatchObject({
      status: "pending",
      by: "Test Author",
      date: "2026-01-02",
      scope: "inclusion",
    });
    expect(pack.version).toBe("1.2.0");
    expect(pack.kind).toBe("hero");
  });

  it("writes credits, permission and an abilities stub listing every ability with its text", () => {
    expect(readFileSync(join(out, "CREDITS.md"), "utf8")).toMatch(/Translation and layout \(es\): Test Translator/);
    expect(readFileSync(join(out, "PERMISSION.md"), "utf8")).toMatch(/Date: 2026-01-02/);
    const stub = readFileSync(join(out, "abilities", "index.ts"), "utf8");
    for (const id of report.unscriptedAbilities) expect(stub).toContain(id);
    expect(stub).toContain("x.ember-warden.01a.cinder-guard");
    expect(stub).toContain("Cinder Guard");
    expect(report.unscriptedAbilities.length).toBeGreaterThan(5);
  });

  it("writes an EncounterSet record for each set it plans, the nemesis set marked as its hero's", async () => {
    const source = await loadPackSource(out);
    const sets = source.encounterSets ?? [];
    const nemesis = sets.find((set) => set.id === "ember-warden-nemesis");
    expect(nemesis?.nemesisOfIdentityId).toBe("x.ember-warden.01a");
    expect(sets.every((set) => set.id.startsWith("ember-warden-"))).toBe(true);
    expect(assemblePack(source).manifest.contents.encounterSets).toBe("data/encounter-sets.json");
  });

  it("reports unscripted abilities apart from defects, and nothing else is wrong", () => {
    expect(report.unscriptedIssues.length).toBe(report.unscriptedAbilities.length);
    expect(report.unscriptedIssues.every((i) => i.category === "unscripted-ability")).toBe(true);
    expect(report.notes).toContain("open: Check the flip side's text against the art.");
  });

  it("writes a folder buildPack loads: its only failures are the unscripted abilities, and the pictures ship", async () => {
    const source = await loadPackSource(out);
    expect(source.assets.has("cards/es/x.ember-warden.01a.webp")).toBe(true);
    expect(source.assets.has("alt-art/en/01088.webp")).toBe(true);
    expect(source.cards.map((c) => c.id)).toContain("x.ember-warden.03a");
    const pack = assemblePack(source);
    expect(pack.manifest.files.map((f) => f.path)).toContain("cards/en/x.ember-warden.05.webp");
    const { defects, unscripted } = splitIssues(validatePack(readPackInput(pack.manifest, pack.files)));
    expect(defects).toEqual([]);
    expect(unscripted).toHaveLength(report.unscriptedAbilities.length);
    const error = await buildPack(out, tmp()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PackBuildError);
    expect((error as PackBuildError).issues.every(isUnscriptedAbilityIssue)).toBe(true);
  });

  it("leaves an existing abilities/index.ts alone on a second import", async () => {
    const again = await importMarvelCdbPack(FIXTURE, { packId: "ember-warden", outDir: out });
    expect(again.notes).toContain("abilities/index.ts already exists and was left alone");
  });
});

describe("importMarvelCdbPack: options and failures", () => {
  it("is a dry run without an outDir", async () => {
    const report = await importMarvelCdbPack(FIXTURE, { packId: "ember-warden" });
    expect(report.outDir).toBeUndefined();
    expect(report.validationIssues).toEqual([]);
  });

  it("defaults the pack id to mod.json's id in kebab case", async () => {
    const report = await importMarvelCdbPack(FIXTURE);
    expect(report.packId).toBe("ember-test");
    expect(Object.values(report.sourceToFinal)[0]).toBe("x.ember-test.01a");
  });

  it("reports the normalizer's rejections instead of throwing, and writes nothing", async () => {
    const out = tmp();
    const report = await importMarvelCdbPack(FIXTURE, {
      packId: "ember-warden",
      outDir: out,
      noAutoCuration: true,
    });
    expect(report.normalized).toBe(false);
    expect(report.normalizerFailures.join("\n")).toMatch(/ember_test_03a/);
    expect(readdirSync(out)).toEqual([]);
    expect(formatImportReport(report)).toMatch(/normalizer FAILED/);
  });

  it("takes hand curation by final code, and a stale entry is a normalizer failure", async () => {
    const stale = await importMarvelCdbPack(FIXTURE, {
      packId: "ember-warden",
      curation: {
        corrections: [{ code: "x.ember-warden.03a", reason: "r", evidence: "e", specialCost: "dash" }],
        scriptingNotes: { "x.ember-warden.02.ember-hound": "no such ability" },
      },
    });
    expect(stale.normalized).toBe(false);
    expect(stale.normalizerFailures.join("\n")).toMatch(/scripting note/);
    const ok = await importMarvelCdbPack(FIXTURE, {
      packId: "ember-warden",
      curation: {
        corrections: [{ code: "x.ember-warden.03a", reason: "r", evidence: "e", specialCost: "dash" }],
      },
    });
    expect(ok.normalized).toBe(true);
    expect(ok.autoCurations).toEqual([]);
  });

  it("rejects an unusable pack id", async () => {
    await expect(importMarvelCdbPack(FIXTURE, { packId: "Bad Id" })).rejects.toThrow(/legal pack id/);
  });
});

/**
 * By hand: `MC_IMPORT_REAL_DIR=<folder holding the pack folders> pnpm --filter @mc/mod-sdk exec vitest run
 * import-marvelcdb`. Prints one report per pack folder. Skipped without the variable: the real packs are not ours to
 * check in.
 */
const REAL = process.env.MC_IMPORT_REAL_DIR;
describe.skipIf(!REAL)("importMarvelCdbPack on real folders (by hand)", () => {
  const folders = REAL ? readdirSync(REAL).filter((n) => existsSync(join(REAL, n, "mod.json"))) : [];
  it.each(folders)("%s", async (name) => {
    const out = process.env.MC_IMPORT_REAL_OUT ? join(process.env.MC_IMPORT_REAL_OUT, name) : undefined;
    const report = await importMarvelCdbPack(join(REAL as string, name), out ? { outDir: out } : {});
    console.log(formatImportReport(report));
  });
});
