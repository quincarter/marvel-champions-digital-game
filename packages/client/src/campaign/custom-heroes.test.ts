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
import type { PackManifest } from "@mc/content";
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

  it("copies a removed pack from another run when a deck edit takes one of its cards", async () => {
    await installSample();
    const service = campaignService();
    const deck = customPrecon();
    const runA = await service.start({
      campaignId: "trors",
      seats: [{ identityCardId: deck.identityCardId, deck }],
      poolVersion: POOL_VERSION,
      seed: 3,
    });
    setLoadedPacks([]);
    forgetRunPacks();
    const base = preconDecks(POOL_VERSION).find((d) => !deckUsesCustomCards(d))!;
    const runB = await service.start({
      campaignId: "trors",
      seats: [{ identityCardId: base.identityCardId, deck: base }],
      poolVersion: POOL_VERSION,
      seed: 4,
    });
    expect(runB.heroPacks).toBeUndefined();
    // Opening run A remembers its copy, so the campaign deck editor offers that pack's cards to run B too.
    await service.load(runA.id);
    const card = deck.cards.find((entry) => entry.cardId !== deck.identityCardId)!;
    expect(campaignCardsById().has(card.cardId as string)).toBe(true);
    const edited = await service.setSeatDeck(runB, 1, {
      ...base,
      cards: [...base.cards, { cardId: card.cardId, quantity: 1 }],
    });
    expect(edited.heroPacks?.map((pack) => pack.id)).toEqual(["sample-hero"]);
    const composed = await service.compose(edited);
    if (composed.kind !== "done") throw new Error("issue 1 asks nothing");
    const config = withLoadedPacks(service.launchConfig(composed.record));
    expect(config.packs?.map((pack) => pack.id)).toEqual(["sample-hero"]);
  });
});
