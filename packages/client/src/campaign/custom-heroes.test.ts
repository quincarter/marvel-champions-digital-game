/**
 * A custom (Mod Store) hero in a base campaign (#978), end to end with the built sample hero pack: the roster offers
 * the pack's precon, signing copies the pack into the run (`CampaignRecord.heroPacks`), issue 1's game carries it,
 * and after the pack is removed the run still names the hero, edits its deck and launches its next game from its copy.
 */
import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyCard, PackManifest } from "@mc/content";
import { buildPack } from "@mc/mod-sdk/build";
import { POOL_VERSION, currentPool } from "../content/pool.js";
import { campaignCardsById, campaignPool } from "../content/campaign-pool.js";
import { setGamePacks } from "../content/game-deps.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { loadActivePacks } from "../packs/active-packs.js";
import { withLoadedPacks } from "../packs/game-packs.js";
import { loadedPacks, setLoadedPacks } from "../packs/pack-registry.js";
import { IdbPackStore } from "../packs/pack-store.js";
import { campaignService } from "../session.js";
import { deckUsesCustomCards } from "../view/custom-content.js";
import { preconDecks } from "../view/deck-list-model.js";
import { rosterDeckOptions, rosterModelOf } from "../view/campaign-roster-model.js";
import { forgetRunPacks, heroPacksForSeats, runPacksOf } from "./run-packs.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../../content-packs/sample-hero", import.meta.url));
const DECK_ID = "precon:sample-hero-justice";

let outDir = "";
let manifest: PackManifest;
const files = new Map<string, Uint8Array>();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-client-custom-hero-campaign-"));
  await buildPack(SAMPLE_DIR, outDir);
  manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => {
  setLoadedPacks([]);
  setGamePacks(undefined);
  forgetRunPacks();
});

async function installSample(): Promise<void> {
  const store = new IdbPackStore({ factory: new IDBFactory() });
  await store.install(manifest, files);
  await loadActivePacks(store);
}

const customPrecon = () => preconDecks(POOL_VERSION).find((deck) => (deck.id as string) === DECK_ID)!;

describe("custom heroes in campaigns (#978)", () => {
  it("offers an installed pack's hero and its precon in the roster, legal to sign", async () => {
    await installSample();
    const deck = customPrecon();
    expect(deckUsesCustomCards(deck)).toBe(true);
    const options = rosterDeckOptions([null], 1, [], POOL_VERSION);
    const row = options.find((option) => option.deck.id === deck.id);
    expect(row).toBeDefined();
    expect(row?.blocked).toBe(false);
    const model = rosterModelOf([deck], currentPool());
    expect(model.seats[0]!.legal).toBe(true);
    expect(model.canSign).toBe(true);
  });

  it("copies only the packs a roster draws on", async () => {
    await installSample();
    const base = preconDecks(POOL_VERSION).find((deck) => !deckUsesCustomCards(deck))!;
    expect(heroPacksForSeats([{ deck: base }], loadedPacks())).toEqual([]);
    expect(heroPacksForSeats([{ deck: customPrecon() }], loadedPacks()).map((pack) => pack.id)).toEqual([
      "sample-hero",
    ]);
    // A base hero's deck holding one card of the pack carries the pack too.
    const mixed = { ...base, cards: [...base.cards, { cardId: customPrecon().cards[0]!.cardId, quantity: 1 }] };
    expect(heroPacksForSeats([{ deck: mixed }], loadedPacks()).map((pack) => pack.id)).toEqual(["sample-hero"]);
  });

  it("signs a run that carries the hero's pack, and goes on from its copy after the pack is removed", async () => {
    await installSample();
    const deck = customPrecon();
    const service = campaignService();
    const signed = await service.start({
      campaignId: "trors",
      seats: [{ identityCardId: deck.identityCardId, deck }],
      poolVersion: POOL_VERSION,
      seed: 5,
    });
    expect(signed.pack).toBeUndefined();
    expect(signed.heroPacks?.map((pack) => pack.id)).toEqual(["sample-hero"]);
    expect(runPacksOf(signed).map((pack) => pack.id)).toEqual(["sample-hero"]);

    const composed = await service.compose(signed);
    if (composed.kind !== "done") throw new Error("issue 1 asks nothing");
    const config = withLoadedPacks(service.launchConfig(composed.record));
    expect(config.packs?.map((pack) => pack.id)).toEqual(["sample-hero"]);
    const started = await new EngineSessionCore({ storage: new MemoryGameStorage() }).start(config);
    expect(started.snapshot.state.players[0]?.identity.cardId).toBe(deck.identityCardId);

    // Remove the pack: a fresh session loads the run, and the screens and the next game read the run's own copy.
    setLoadedPacks([]);
    forgetRunPacks();
    expect(campaignCardsById().has(deck.identityCardId as string)).toBe(false);
    const loaded = await service.load(signed.id);
    expect(loaded?.heroPacks?.map((pack) => pack.id)).toEqual(["sample-hero"]);
    expect(campaignCardsById().get(deck.identityCardId as string)?.type).toBe("hero_identity");
    expect(rosterModelOf([deck], campaignPool()).seats[0]!.legal).toBe(true);
    const again = withLoadedPacks(service.launchConfig(loaded!));
    expect(again.packs?.map((pack) => pack.id)).toEqual(["sample-hero"]);
    await expect(new EngineSessionCore({ storage: new MemoryGameStorage() }).start(again)).resolves.toBeDefined();
  });

  it("copies a pack in when a base hero's run edits a custom card into its deck", async () => {
    await installSample();
    const base = preconDecks(POOL_VERSION).find((deck) => !deckUsesCustomCards(deck))!;
    const service = campaignService();
    const signed = await service.start({
      campaignId: "trors",
      seats: [{ identityCardId: base.identityCardId, deck: base }],
      poolVersion: POOL_VERSION,
      seed: 9,
    });
    expect(signed.heroPacks).toBeUndefined();
    const custom = customPrecon().cards.find((entry) => entry.cardId !== customPrecon().identityCardId)!;
    const edited = await service.setSeatDeck(signed, 1, {
      ...base,
      cards: [...base.cards, { cardId: custom.cardId, quantity: 1 }],
    });
    expect(edited.heroPacks?.map((pack) => pack.id)).toEqual(["sample-hero"]);
    expect((await service.load(signed.id))?.heroPacks?.map((pack) => pack.id)).toEqual(["sample-hero"]);
  });

  it("reads the run's own copy of an updated pack, and never another run's packs", async () => {
    await installSample();
    const service = campaignService();
    const deck = customPrecon();
    const runA = await service.start({
      campaignId: "trors",
      seats: [{ identityCardId: deck.identityCardId, deck }],
      poolVersion: POOL_VERSION,
      seed: 3,
    });
    const identityId = deck.identityCardId as string;
    const signedName = campaignCardsById().get(identityId)?.name;

    // An update renames the hero and adds a card: run A keeps reading its own copy, without the new card.
    const [installed] = loadedPacks();
    const added = { ...installed!.cards[1]!, id: "x.sample-hero.999" } as AnyCard;
    setLoadedPacks([
      {
        ...installed!,
        version: "9.9.9",
        cards: [
          ...installed!.cards.map((card) => ((card.id as string) === identityId ? { ...card, name: "Renamed" } : card)),
          added,
        ],
      },
    ]);
    forgetRunPacks();
    const loaded = (await service.load(runA.id))!;
    expect(campaignCardsById().get(identityId)?.name).toBe(signedName);
    expect(campaignCardsById().has("x.sample-hero.999")).toBe(false);
    const composed = await service.compose(loaded);
    if (composed.kind !== "done") throw new Error("issue 1 asks nothing");
    expect(withLoadedPacks(service.launchConfig(composed.record)).packs?.map((pack) => pack.version)).toEqual([
      installed!.version,
    ]);

    // With the pack removed, opening a base-heroes run B leaves run A's copy out of the campaign pool.
    setLoadedPacks([]);
    const base = preconDecks(POOL_VERSION).find((d) => !deckUsesCustomCards(d))!;
    await service.start({
      campaignId: "trors",
      seats: [{ identityCardId: base.identityCardId, deck: base }],
      poolVersion: POOL_VERSION,
      seed: 4,
    });
    expect(campaignCardsById().has(identityId)).toBe(false);
  });

  it("copies a pack in for a granted card the player left out of the deck", async () => {
    await installSample();
    const base = preconDecks(POOL_VERSION).find((d) => !deckUsesCustomCards(d))!;
    const service = campaignService();
    const signed = await service.start({
      campaignId: "trors",
      seats: [{ identityCardId: base.identityCardId, deck: base }],
      poolVersion: POOL_VERSION,
      seed: 6,
    });
    const reward = customPrecon().cards.find((entry) => entry.cardId !== customPrecon().identityCardId)!.cardId;
    // A reward granted and left out of the deck (`inclusion: "optional"`, then not included).
    const granted = {
      ...signed,
      seats: signed.seats.map((seat) => ({
        ...seat,
        grants: [...seat.grants, { cardId: reward, permanence: "permanent", inclusion: "optional" }],
      })),
    } as unknown as typeof signed;
    const saved = await service.setSeatDeck(granted, 1, base);
    expect(saved.seats[0]!.deck.cards.some((entry) => entry.cardId === reward)).toBe(false);
    expect(saved.heroPacks?.map((pack) => pack.id)).toEqual(["sample-hero"]);
  });
});
