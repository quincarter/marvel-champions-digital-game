import "fake-indexeddb/auto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
// Node only, and only here: the client itself never imports the SDK's build.
import { buildPack } from "@mc/mod-sdk/build";
import { loadActivePacks, type PackLoader } from "./active-packs.js";
import { loadPackRuntime } from "./pack-load.js";
import { loadedPacks, setLoadedPacks } from "./pack-registry.js";
import type { PackRuntime } from "./pack-runtime.js";
import { IdbPackStore, type PackStorage } from "./pack-store.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../../content-packs/sample-scenario", import.meta.url));
const A_ID = "sample-scenario";

let outDir = "";
let manifest: PackManifest;
const files = new Map<string, Uint8Array>();
let depManifest: PackManifest;
const depFiles = new Map<string, Uint8Array>();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const readBuilt = (dir: string, into: Map<string, Uint8Array>): void => {
  for (const full of walk(dir)) {
    const path = relative(dir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      into.set(path, new Uint8Array(readFileSync(full)));
  }
};

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-client-req-"));
  await buildPack(SAMPLE_DIR, join(outDir, "a"));
  manifest = JSON.parse(readFileSync(join(outDir, "a", "pack.json"), "utf8")) as PackManifest;
  readBuilt(join(outDir, "a"), files);
  const a = loadPackRuntime(manifest, files);
  if (!a.ok) throw new Error(a.reason);

  // Pack B owns no scenario: its campaign plays pack A's scenario, so it validates only with A's content.
  const srcDir = join(outDir, "b-src");
  mkdirSync(join(srcDir, "campaigns"), { recursive: true });
  for (const name of ["CREDITS.md", "PERMISSION.md"])
    writeFileSync(join(srcDir, name), readFileSync(join(SAMPLE_DIR, name)));
  writeFileSync(
    join(srcDir, "pack.json"),
    JSON.stringify({
      id: "dep-campaign",
      version: "1.0.0",
      kind: "campaign",
      name: "Dependent Campaign",
      authors: ["Test"],
      description: "Plays a scenario of the pack it requires.",
      license: "Fan-made, non-commercial; see CREDITS.md",
      requires: { app: ">=0.1.0", packs: [A_ID] },
    }),
  );
  const crisis = JSON.parse(readFileSync(join(SAMPLE_DIR, "campaigns", "sample-scenario-crisis.json"), "utf8"));
  crisis.id = "dep-campaign-one";
  crisis.definition.campaignId = "dep-campaign-one";
  crisis.definition.graph.nodes = [crisis.definition.graph.nodes[0]];
  crisis.story.issues = [crisis.story.issues[0]];
  crisis.record = { scenarioIds: ["sample-scenario-clockwork"], campaignSetIds: [] };
  writeFileSync(join(srcDir, "campaigns", "dep-campaign-one.json"), JSON.stringify(crisis));
  await buildPack(srcDir, join(outDir, "b"), {
    requiredPackCards: new Set(a.runtime.cards.map((card) => card.id as string)),
    requiredPackContent: {
      cards: a.runtime.cards,
      encounterSets: a.runtime.encounterSets ?? [],
      scenarios: a.runtime.scenarios ?? [],
    },
  });
  depManifest = JSON.parse(readFileSync(join(outDir, "b", "pack.json"), "utf8")) as PackManifest;
  readBuilt(join(outDir, "b"), depFiles);
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => setLoadedPacks([]));

const newStore = () => new IdbPackStore({ factory: new IDBFactory() });
const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("a pack that needs another pack's scenario content", () => {
  it("installs and loads once the pack it requires is loaded", async () => {
    const store = newStore();
    await store.install(manifest, files);
    await store.install(depManifest, depFiles);
    const statuses = await loadActivePacks(store);
    expect(statuses.map((s) => [s.id, s.loaded, s.reason])).toEqual([
      [A_ID, true, undefined],
      ["dep-campaign", true, undefined],
    ]);
    expect(loadedPacks().find((p) => p.id === "dep-campaign")?.campaigns?.length).toBe(1);
  });

  it("is skipped, with a reason, without the pack it requires", async () => {
    const store = newStore();
    await store.install(depManifest, depFiles);
    const [status] = await loadActivePacks(store);
    expect(status).toMatchObject({ loaded: false });
    expect(status?.reason).toMatch(/sample-scenario/);
  });
});

describe("requires.app at load time", () => {
  it("skips an installed pack whose app range excludes this client", async () => {
    const store = newStore();
    await store.install(manifest, files);
    await store.install({ ...manifest, id: "future", requires: { ...manifest.requires, app: ">=99.0.0" } }, files);
    const statuses = await loadActivePacks(store);
    expect(statuses.find((s) => s.id === A_ID)?.loaded).toBe(true);
    const future = statuses.find((s) => s.id === "future");
    expect(future).toMatchObject({ loaded: false });
    expect(future?.reason).toMatch(/Needs app >=99\.0\.0/);
  });
});

describe("scenario and encounter set id collisions", () => {
  const runtimeOf = (id: string, scenarioId: string, setId: string): PackRuntime => ({
    id,
    version: "1.0.0",
    name: id,
    requires: [],
    cards: [],
    abilities: {},
    decks: [],
    scenarios: [{ id: scenarioId } as never],
    encounterSets: [{ id: setId } as never],
  });
  const loader: PackLoader = async (m) =>
    m.id === "p1"
      ? { ok: true, runtime: runtimeOf("p1", "shared-scenario", "own-1") }
      : m.id === "p2"
        ? { ok: true, runtime: runtimeOf("p2", "shared-scenario", "own-2") }
        : { ok: true, runtime: runtimeOf("p3", "own-3", "own-1") };

  const install = async (order: string[]) => {
    const store = newStore();
    for (const id of order) {
      await store.install({ ...manifest, id }, files);
      // installedAt is the order: a pause keeps two installs from sharing a timestamp.
      await pause();
    }
    return loadActivePacks(store, loader);
  };

  it("keeps the pack installed first when two share a scenario id (either order)", async () => {
    const forward = await install(["p1", "p2"]);
    expect(forward.map((s) => s.loaded)).toEqual([true, false]);
    expect(forward[1]?.reason).toBe("Scenario shared-scenario is already used by p1");
    const backward = await install(["p2", "p1"]);
    expect(backward.map((s) => [s.id, s.loaded])).toEqual([
      ["p2", true],
      ["p1", false],
    ]);
    expect(backward[1]?.reason).toBe("Scenario shared-scenario is already used by p2");
  });

  it("skips a pack that reuses an encounter set id", async () => {
    const statuses = await install(["p1", "p3"]);
    expect(statuses.map((s) => s.loaded)).toEqual([true, false]);
    expect(statuses[1]?.reason).toBe("Encounter set own-1 is already used by p1");
  });
});

describe("a pack file that cannot be read", () => {
  it("skips that pack and still loads the next", async () => {
    const real = newStore();
    await real.install(manifest, files);
    await pause();
    await real.install({ ...manifest, id: "readable" }, files);
    // The first pack in install order is the one whose read rejects.
    const store = Object.create(real, {
      fileBlob: {
        value: async (id: string, path: string) => {
          if (id === A_ID) throw new Error("disk gone");
          return real.fileBlob(id, path);
        },
      },
    }) as PackStorage;
    // A stub loader: the second pack's files are only read here, not validated under a made-up id.
    const stub: PackLoader = async (m) => ({
      ok: true,
      runtime: { id: m.id, version: m.version, name: m.name, requires: [], cards: [], abilities: {}, decks: [] },
    });
    const statuses = await loadActivePacks(store, stub);
    expect(statuses.find((s) => s.id === A_ID)).toMatchObject({ loaded: false });
    expect(statuses.find((s) => s.id === A_ID)?.reason).toMatch(/Damaged: .*disk gone/);
    expect(statuses.find((s) => s.id === "readable")).toMatchObject({ loaded: true });
  });
});
