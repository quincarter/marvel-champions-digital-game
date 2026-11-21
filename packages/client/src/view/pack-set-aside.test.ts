import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
import { buildPack } from "@mc/mod-sdk/build";
import { loadActivePacks } from "../packs/active-packs.js";
import { loadedPacks, setLoadedPacks } from "../packs/pack-registry.js";
import { IdbPackStore } from "../packs/pack-store.js";
import { buildScenarioWithLoadedPacks, currentScenarios } from "../content/pool.js";
import { effectivePackSetAside, packSetAsideCandidates } from "./pack-set-aside.js";
import { applySetupOption, setupOptionRowsOf } from "./setup-options.js";
import { initialSetupDraft, setModularSetIds, toSessionConfig, type SetupDraft } from "./setup-draft.js";

// #943: a pack scenario that sets a modular set aside (The Rose's mini-boss set) offers the choice and its authors'
// default, where it used to draw one at random with no picker.
const SCENARIO = "sample-scenario-clockwork";
const RECOMMENDED = "masters_of_evil";

let outDir = "";
let manifest: PackManifest;
const files = new Map<string, Uint8Array>();
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-pack-set-aside-"));
  await buildPack(fileURLToPath(new URL("../../../../content-packs/sample-scenario", import.meta.url)), outDir);
  manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => setLoadedPacks([]));

/** The sample scenario, changed to set one modular set aside (with or without a recommendation). */
async function loadWithSetAside(recommended?: readonly string[]): Promise<void> {
  const store = new IdbPackStore({ factory: new IDBFactory() });
  await store.install(manifest, files);
  await loadActivePacks(store);
  setLoadedPacks(
    loadedPacks().map((pack) => ({
      ...pack,
      scenarios: (pack.scenarios ?? []).map((scenario) => ({
        ...scenario,
        setAsideModularSetCount: 1,
        ...(recommended ? { recommendedSetAsideModularSetIds: recommended } : {}),
      })),
    })) as never,
  );
}

const scenario = () => currentScenarios().find((one) => (one.id as string) === SCENARIO)!;
const draft = (): SetupDraft => initialSetupDraft({ scenarioId: SCENARIO, seatDeckId: null, seed: 7 });
const PLAYERS = [{ starterDeckId: "core-spider-man-justice" }] as never;
const NAMES = new Map<string, string>();
const setAsideRow = (d: SetupDraft) => setupOptionRowsOf(d, NAMES).find((row) => row.id === "setAside:0");

describe("a pack scenario's set-aside modular set (#943)", () => {
  it("defaults to the authors' recommendation, and the game sets it aside", async () => {
    await loadWithSetAside([RECOMMENDED]);
    const d = draft();
    expect(effectivePackSetAside(d, scenario(), 1)).toEqual([RECOMMENDED]);
    const row = setAsideRow(d)!;
    expect(row.meta).toBe("Recommended");
    expect(row.control.kind === "stepper" && row.control.valueLabel).toBe("Masters of Evil");
    const config = toSessionConfig(d, PLAYERS, scenario());
    expect(config.setAsideModularSetIds).toEqual([RECOMMENDED]);
    // With no pick sent, the builder reads the recommendation itself.
    const built = buildScenarioWithLoadedPacks(SCENARIO, { players: PLAYERS, seed: 7 } as never);
    expect(built.setAsideModularSets?.map((set) => set.encounterSetId)).toEqual([RECOMMENDED]);
  });

  it("steps through the modular picker's candidates, never one shuffled in", async () => {
    await loadWithSetAside([RECOMMENDED]);
    const d = draft();
    const candidates = packSetAsideCandidates(d, scenario());
    expect(candidates[0]).toBe(RECOMMENDED);
    expect(candidates.length).toBeGreaterThan(5);
    expect(candidates).not.toContain("sample-scenario-gears");
    const next = applySetupOption(d, "setAside:0:next");
    expect(next.setAsideModularSetIds).toEqual([candidates[1]]);
    expect(setAsideRow(next)!.meta).toBe("Your pick");
    expect(applySetupOption(next, "setAside:0:prev").setAsideModularSetIds).toEqual([RECOMMENDED]);
    // Picking the set-aside set to shuffle in drops the set-aside pick back to the recommendation.
    const clash = setModularSetIds(next, [candidates[1]!]);
    expect(effectivePackSetAside(clash, scenario(), 1)).toEqual([RECOMMENDED]);
  });

  it("offers every modular set when the scenario shuffles in none (Codex review)", async () => {
    await loadWithSetAside([RECOMMENDED]);
    setLoadedPacks(
      loadedPacks().map((pack) => ({
        ...pack,
        scenarios: (pack.scenarios ?? []).map((one) => ({ ...one, modularSetCount: 0, recommendedModularSetIds: [] })),
      })) as never,
    );
    expect(packSetAsideCandidates(draft(), scenario()).length).toBeGreaterThan(5);
  });

  it("reads Random without a recommendation, and offers nothing at a scenario that sets none aside", async () => {
    await loadWithSetAside();
    expect(setAsideRow(draft())!.control.kind === "stepper" && setAsideRow(draft())!.control).toMatchObject({
      valueLabel: "Random",
    });
    expect(toSessionConfig(draft(), PLAYERS, scenario()).setAsideModularSetIds).toBeUndefined();
    // From Random, the first step lands on the first candidate (or back on the last).
    const candidates = packSetAsideCandidates(draft(), scenario());
    expect(applySetupOption(draft(), "setAside:0:next").setAsideModularSetIds).toEqual([candidates[0]]);
    expect(applySetupOption(draft(), "setAside:0:prev").setAsideModularSetIds).toEqual([candidates.at(-1)]);
    setLoadedPacks([]);
    expect(setAsideRow(draft())).toBeUndefined();
  });
});
