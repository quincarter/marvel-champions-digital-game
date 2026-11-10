import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
import { buildPack } from "@mc/mod-sdk/build";
import {
  POOL_HERO_SHELF_PACKS,
  POOL_STARTER_DECKS,
  POOL_VERSION,
  currentDeps,
  currentHeroShelfPacks,
  currentPool,
  currentPoolKey,
  currentStarterDecks,
  packNameOf,
} from "../content/pool.js";
import { resetPackArt } from "../art/pack-art.js";
import { loadActivePacks } from "../packs/active-packs.js";
import { setLoadedPacks } from "../packs/pack-registry.js";
import { IdbPackStore } from "../packs/pack-store.js";
import { DEFAULT_UNLOCK_PREFS, NO_PROGRESS, Unlocks } from "../progression/unlocks.js";
import { canExportToMarvelCdb, customBadgeOf, deckUsesCustomCards } from "./custom-content.js";
import { preconDecks } from "./deck-list-model.js";
import { basePreconDecks, preconRosterOf, rosterDeckOptions } from "./campaign-roster-model.js";
import { cycleShelvesOf } from "./roster-shelves.js";
import { seatableDeckOptionsOf } from "./seatable-decks.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../../content-packs/sample-hero", import.meta.url));
const DECK_ID = "sample-hero-justice";

let outDir = "";
let manifest: PackManifest;
const files = new Map<string, Uint8Array>();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-client-custom-pool-"));
  await buildPack(SAMPLE_DIR, outDir);
  manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (path !== "pack.json" && !path.endsWith(".zip")) files.set(path, new Uint8Array(readFileSync(full)));
  }
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => {
  setLoadedPacks([]);
  resetPackArt();
});

async function installSample(): Promise<void> {
  const store = new IdbPackStore({ factory: new IDBFactory() });
  await store.install(manifest, files);
  await loadActivePacks(store);
}

describe("the pickers and the deck builder read the installed packs", () => {
  it("is exactly the base game with no pack loaded", () => {
    expect(currentStarterDecks()).toBe(POOL_STARTER_DECKS);
    expect(currentHeroShelfPacks()).toBe(POOL_HERO_SHELF_PACKS);
    expect(currentPoolKey()).toBe(POOL_VERSION);
    expect(preconDecks().length).toBe(POOL_STARTER_DECKS.length);
  });

  it("adds a loaded pack's precons, cards and shelf", async () => {
    await installSample();
    expect(currentStarterDecks().length).toBe(POOL_STARTER_DECKS.length + 1);
    expect(preconDecks().some((deck) => (deck.id as string) === `precon:${DECK_ID}`)).toBe(true);
    expect(currentPoolKey()).toBe(`${POOL_VERSION}+sample-hero@1.0.0`);
    expect(packNameOf("sample-hero")).toBe("Sample Sentinel");
    const shelf = currentHeroShelfPacks().find((pack) => pack.code === "sample-hero");
    expect(shelf).toMatchObject({ cycleName: "Custom packs" });
    expect(shelf!.cycleOrder).toBeGreaterThan(Math.max(...POOL_HERO_SHELF_PACKS.map((pack) => pack.cycleOrder)));
    // Removing the pack puts the base game back, and a later install is not served the old precons.
    setLoadedPacks([]);
    expect(currentStarterDecks()).toBe(POOL_STARTER_DECKS);
    expect(preconDecks().length).toBe(POOL_STARTER_DECKS.length);
  });

  it("seats a pack hero: a legal option on the Custom packs shelf, never locked", async () => {
    await installSample();
    const options = seatableDeckOptionsOf([], currentPool(), POOL_VERSION, currentDeps());
    const option = options.find((one) => (one.deck.id as string) === `precon:${DECK_ID}`);
    expect(option).toBeDefined();
    expect(option!.legal).toBe(true);
    expect(option!.seatable).toBe(true);
    const shelves = cycleShelvesOf(
      [{ item: option!, packCode: "sample-hero", searchHaystacks: [], passesChips: true }],
      currentHeroShelfPacks(),
      "",
    );
    expect(shelves.map((shelf) => shelf.title)).toEqual(["Custom packs"]);
    expect(shelves[0]!.items).toHaveLength(1);
    const unlocks = new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS });
    expect(unlocks.deckLock(option!.deck)).toBeNull();
  });

  it("marks custom decks and keeps them off MarvelCDB export", async () => {
    await installSample();
    const custom = preconDecks().find((deck) => (deck.id as string) === `precon:${DECK_ID}`)!;
    const base = preconDecks()[0]!;
    expect(deckUsesCustomCards(custom)).toBe(true);
    expect(customBadgeOf(custom)).toBe("CUSTOM");
    expect(canExportToMarvelCdb(custom)).toBe(false);
    expect(deckUsesCustomCards(base)).toBe(false);
    expect(customBadgeOf(base)).toBeNull();
    expect(canExportToMarvelCdb(base)).toBe(true);
    // A base-hero deck holding one custom card is custom too.
    const mixed = { ...base, cards: [...base.cards, { cardId: custom.cards[0]!.cardId, quantity: 1 }] };
    expect(canExportToMarvelCdb(mixed)).toBe(false);
  });

  it("keeps pack heroes out of campaign rosters", async () => {
    await installSample();
    expect(preconDecks().some((deck) => deckUsesCustomCards(deck))).toBe(true);
    expect(basePreconDecks(POOL_VERSION).some((deck) => deckUsesCustomCards(deck))).toBe(false);
    expect(basePreconDecks(POOL_VERSION).length).toBe(POOL_STARTER_DECKS.length);
    const custom = preconDecks().find((deck) => deckUsesCustomCards(deck))!;
    expect(preconRosterOf([custom.identityCardId], POOL_VERSION)[0]).toBeNull();
    const saved = {
      ...custom,
      id: "saved-custom" as typeof custom.id,
      source: { kind: "userBuilt" },
    } as unknown as typeof custom;
    const options = rosterDeckOptions([null], 1, [saved], POOL_VERSION);
    expect(options.some((option) => deckUsesCustomCards(option.deck))).toBe(false);
  });
});
