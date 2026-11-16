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
import type { SaveMeta } from "../engine/game-storage.js";
import { CORE_CARDS } from "@mc/content";
import { GAME_LABEL_NAMES, PAST_GAME_NAMES, pastGameNamesForPacks } from "./game-label-names.js";
import { continueLabelOf } from "./continue-label.js";
import { gameRowsOf } from "./games-list-model.js";
import { pastGameRowsOf } from "./past-games-model.js";

// #758: a finished game played with a pack's hero and scenario names them on its cover, loaded now or not.
const PACKS = ["sample-hero", "sample-scenario"] as const;
const HERO = "x.sample-hero.01a";
const VILLAIN = "x.sample-scenario.01";
const SCENARIO = "sample-scenario-clockwork";

const built = new Map<string, { manifest: PackManifest; files: Map<string, Uint8Array> }>();
const dirs: string[] = [];
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  for (const id of PACKS) {
    const out = mkdtempSync(join(tmpdir(), `mc-past-games-${id}-`));
    dirs.push(out);
    await buildPack(fileURLToPath(new URL(`../../../../content-packs/${id}`, import.meta.url)), out);
    const files = new Map<string, Uint8Array>();
    for (const full of walk(out)) {
      const path = relative(out, full).split(sep).join("/");
      if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
        files.set(path, new Uint8Array(readFileSync(full)));
    }
    built.set(id, { manifest: JSON.parse(readFileSync(join(out, "pack.json"), "utf8")) as PackManifest, files });
  }
});
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
beforeEach(() => setLoadedPacks([]));

const gameWith = (packs: unknown): SaveMeta =>
  ({
    id: "g1",
    schema: 4,
    config: {
      scenarioId: SCENARIO,
      difficulty: "standard",
      players: [{ identityCardId: HERO, deck: [] }],
      seed: 1,
      ...(packs ? { packs } : {}),
    },
    createdAt: 1,
    updatedAt: 2,
    status: "won",
    round: 5,
    commandCount: 90,
    outcome: { result: "win", reason: "villainDefeated" },
    campaignId: null,
    campaignNodeId: null,
  }) as never;

describe("Past games covers for a game with pack content", () => {
  it("points the cover at the pack's villain and hero, from the packs the game carries", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    for (const id of PACKS) await store.install(built.get(id)!.manifest, built.get(id)!.files);
    await loadActivePacks(store);
    const embedded = [...loadedPacks()];
    expect(embedded.length).toBe(2);
    // Uninstalled since: nothing is loaded, the game's own copy still names its cards.
    setLoadedPacks([]);
    const [row] = pastGameRowsOf([gameWith(embedded)], PAST_GAME_NAMES);
    expect(row?.villainCardId).toBe(VILLAIN);
    expect(row?.villainName).toBe("The Clockmaker");
    expect(row?.seats).toMatchObject([{ identityCardId: HERO, name: "Sample Sentinel" }]);
    expect(row?.title).toContain("Sample Sentinel");
  });

  it("names a pack precon's hero for a game seated from the precon", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    for (const id of PACKS) await store.install(built.get(id)!.manifest, built.get(id)!.files);
    await loadActivePacks(store);
    const embedded = [...loadedPacks()];
    const deck = embedded.flatMap((pack) => pack.decks)[0]!;
    setLoadedPacks([]);
    const save = gameWith(embedded);
    (save.config as unknown as { players: unknown[] }).players = [{ starterDeckId: deck.id }];
    const [row] = pastGameRowsOf([save], PAST_GAME_NAMES);
    expect(row?.seats).toMatchObject([{ identityCardId: deck.identityCardId, name: "Sample Sentinel" }]);
  });

  it("names a game's cards without throwing when its pack shadows a base card", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    for (const id of PACKS) await store.install(built.get(id)!.manifest, built.get(id)!.files);
    await loadActivePacks(store);
    const embedded = [...loadedPacks()];
    setLoadedPacks([]);
    const base = CORE_CARDS.find((card) => card.type === "hero_identity")!;
    // A pack that carries a base card's id: the merged pool would throw, a lookup in the pack's own cards does not.
    const shadowing = [
      ...embedded,
      { ...embedded[0]!, cards: [{ ...base, name: "Shadow" }] },
    ] as unknown as typeof embedded;
    const names = pastGameNamesForPacks(shadowing);
    expect(() => names.identityName(base.id as string)).not.toThrow();
    expect(names.identityName(HERO)).toBe("Sample Sentinel");
  });

  it("falls back to the card id, and no villain, for a game that carries no copy of its pack", () => {
    const [row] = pastGameRowsOf([gameWith(undefined)], PAST_GAME_NAMES);
    expect(row?.villainCardId).toBeNull();
    expect(row?.villainName).toBeNull();
    expect(row?.seats[0]).toMatchObject({ identityCardId: HERO, name: HERO });
  });
});

// An in-progress game names its hero and precon from its own packs (Continue row and games list), loaded now or not.
describe("in-progress game names for a game with pack content", () => {
  it("names a pack precon and a pack identity after the pack is uninstalled", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    for (const id of PACKS) await store.install(built.get(id)!.manifest, built.get(id)!.files);
    await loadActivePacks(store);
    const embedded = [...loadedPacks()];
    const deck = embedded.flatMap((pack) => pack.decks)[0]!;
    setLoadedPacks([]);

    const precon = gameWith(embedded);
    (precon.config as unknown as { players: unknown[] }).players = [{ starterDeckId: deck.id }];
    expect(continueLabelOf(precon, GAME_LABEL_NAMES)).not.toContain(deck.id as string);
    expect(gameRowsOf([precon], GAME_LABEL_NAMES, 10)[0]?.title).toContain("Sample Sentinel");

    const custom = gameWith(embedded);
    expect(continueLabelOf(custom, GAME_LABEL_NAMES)).toContain("Sample Sentinel");
    expect(continueLabelOf(custom, GAME_LABEL_NAMES)).toContain("The Clockmaker");
    expect(gameRowsOf([custom], GAME_LABEL_NAMES, 10)[0]?.title).toContain("Sample Sentinel");
  });
});
