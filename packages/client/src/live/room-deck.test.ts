import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deckFromStarterDeck, type Deck, type PackManifest } from "@mc/content";
import { MAX_SEAT_DECK_BYTES, type RoomDeck } from "@mc/sync-worker/room-protocol";
// Node only, and only here: the client itself never imports the SDK's build.
import { buildPack } from "@mc/mod-sdk/build";
import { POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import { loadActivePacks } from "../packs/active-packs.js";
import { loadedPacks, setLoadedPacks } from "../packs/pack-registry.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { IdbPackStore } from "../packs/pack-store.js";
import { preconDecks } from "../view/deck-list-model.js";
import { checkRoomDecks, playerOfRoomDeck, roomDeckOf } from "./room-deck.js";
import { checkRoomDecksInWorker, type CheckWorkerLike } from "./room-deck-check-client.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../../content-packs/sample-hero", import.meta.url));

let outDir = "";
let sample: PackRuntime;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-room-deck-"));
  await buildPack(SAMPLE_DIR, outDir);
  const manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  const files = new Map<string, Uint8Array>();
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip")) {
      files.set(path, new Uint8Array(readFileSync(full)));
    }
  }
  const store = new IdbPackStore({ factory: new IDBFactory() });
  await store.install(manifest, files);
  await loadActivePacks(store);
  sample = loadedPacks()[0]!;
  setLoadedPacks([]);
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

/** A legal base-game deck: the first precon. */
const baseDeck = (): Deck => preconDecks(POOL_VERSION)[0]!;
const base = (): RoomDeck => roomDeckOf(baseDeck(), "Hero", [])!;
const modDeck = (): RoomDeck => {
  const starter = sample.decks[0]!;
  return roomDeckOf(deckFromStarterDeck(starter, POOL_VERSION), "Sample", [sample])!;
};
const input = (
  decks: (RoomDeck | null)[],
  over: { allowed?: { id: string; version: string }[]; loaded?: PackRuntime[] } = {},
) => ({
  seats: decks.map((deck, i) => ({ seat: `s${i + 1}`, deck })),
  allowed: over.allowed ?? [],
  loaded: over.loaded ?? [],
  basePool: POOL_CARDS,
});

describe("a deck as the room carries it", () => {
  it("is a plain list of the deck's own cards, with no mods for a base-game deck", () => {
    const deck = baseDeck();
    const room = roomDeckOf(deck, "Spider-Man", [sample])!;
    expect(room).toMatchObject({ name: deck.name, hero: deck.identityCardId, heroName: "Spider-Man", mods: [] });
    expect(room.cards.reduce((n, c) => n + c.quantity, 0)).toBe(deck.cards.reduce((n, c) => n + c.quantity, 0));
    expect(new TextEncoder().encode(JSON.stringify(room)).length).toBeLessThan(MAX_SEAT_DECK_BYTES);
  });

  it("names the custom packs a deck's hero or cards come from, by id and version", () => {
    expect(modDeck().mods).toEqual([{ id: sample.id, version: sample.version }]);
  });

  it("becomes the same seat a saved deck does", () => {
    const deck = baseDeck();
    const player = playerOfRoomDeck(roomDeckOf(deck, "H", [])!);
    expect(player).toMatchObject({ identityCardId: deck.identityCardId, aspects: deck.aspects, deckName: deck.name });
    expect("deck" in player && player.deck).toHaveLength(deck.cards.reduce((n, c) => n + c.quantity, 0));
  });

  it("is refused (null) when the list is over the room's size cap", () => {
    const deck = baseDeck();
    const cards = Array.from({ length: 120 }, (_, k) => ({ cardId: `x${"y".repeat(60)}${k}` as never, quantity: 1 }));
    const used = [deck.identityCardId, ...cards.map((c) => c.cardId)];
    // Many packs, each claiming one of the cards: the mod refs push a long list over 16 KiB.
    const packs = Array.from({ length: 64 }, (_, k) => ({
      id: `${"p".repeat(60)}${k}`,
      version: "v".repeat(30),
      cards: [{ id: used[k] }],
    })) as unknown as PackRuntime[];
    expect(roomDeckOf({ ...deck, cards }, "H", [])).not.toBeNull();
    expect(roomDeckOf({ ...deck, cards }, "H", packs)).toBeNull();
  });
});

describe("the host's judgment of every seat's deck", () => {
  it("passes a legal base-game deck", () => {
    expect(checkRoomDecks(input([base()]))).toEqual([{ seat: "s1", ok: true }]);
  });

  it("routes each failure to its own seat, with the engine's own words, and lets the legal seats through", () => {
    const short: RoomDeck = { ...base(), cards: base().cards.slice(0, 3) };
    const verdicts = checkRoomDecks(input([base(), short, null]));
    expect(verdicts[0]).toEqual({ seat: "s1", ok: true });
    expect(verdicts[1]).toMatchObject({ seat: "s2", ok: false, code: "illegal" });
    expect((verdicts[1] as { reason: string }).reason.length).toBeGreaterThan(10);
    expect(verdicts[2]).toMatchObject({ seat: "s3", ok: false, code: "no-deck" });
  });

  it("refuses a card the host's pool does not know, naming it", () => {
    const odd: RoomDeck = { ...base(), cards: [...base().cards, { cardId: "zz-nope", quantity: 1 }] };
    expect(checkRoomDecks(input([odd]))[0]).toMatchObject({ ok: false, code: "unknown-card" });
    expect((checkRoomDecks(input([odd]))[0] as { reason: string }).reason).toContain("zz-nope");
  });

  it("does not trust a deck that claims to be from no mod while using a mod's cards", () => {
    const sneaky: RoomDeck = { ...modDeck(), mods: [] };
    const verdict = checkRoomDecks(
      input([sneaky], { allowed: [{ id: sample.id, version: sample.version }], loaded: [sample] }),
    )[0];
    // With the pack allowed and loaded its cards are known, so the claim is moot: judged by legality alone.
    expect(verdict).toMatchObject({ seat: "s1" });
    const notAllowed = checkRoomDecks(input([sneaky], { loaded: [sample] }))[0];
    expect(notAllowed).toMatchObject({ ok: false, code: "unknown-card" });
  });

  it("passes a mod deck when the pack is allowed and installed at the same version", () => {
    const verdict = checkRoomDecks(
      input([modDeck()], { allowed: [{ id: sample.id, version: sample.version }], loaded: [sample] }),
    )[0];
    expect(verdict).toEqual({ seat: "s1", ok: true });
  });

  it("tells a mod the host lacks from a mod at another version from a mod it did not allow", () => {
    const deck = modDeck();
    const allowed = [{ id: sample.id, version: sample.version }];
    expect(checkRoomDecks(input([deck], { allowed }))[0]).toMatchObject({ ok: false, code: "mod-missing" });
    const older: RoomDeck = { ...deck, mods: [{ id: sample.id, version: "0.0.1-older" }] };
    const mismatch = checkRoomDecks(input([older], { allowed, loaded: [sample] }))[0];
    expect(mismatch).toMatchObject({ ok: false, code: "mod-version" });
    expect((mismatch as { reason: string }).reason).toContain("0.0.1-older");
    expect((mismatch as { reason: string }).reason).toContain(sample.version);
    expect(checkRoomDecks(input([deck], { loaded: [sample] }))[0]).toMatchObject({
      ok: false,
      code: "mod-not-allowed",
    });
  });
});

describe("the check in a worker", () => {
  const fakeWorker = (reply: (id: number) => unknown): { worker: CheckWorkerLike; ended: () => boolean } => {
    let ended = false;
    const worker: CheckWorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (message) => queueMicrotask(() => worker.onmessage?.({ data: reply(message.id) as never })),
      terminate: () => {
        ended = true;
      },
    };
    return { worker, ended: () => ended };
  };

  it("resolves the worker's verdicts and ends the worker", async () => {
    const { worker, ended } = fakeWorker((id) => ({ id, verdicts: [{ seat: "s1", ok: true }] }));
    expect(await checkRoomDecksInWorker({ seats: [], allowed: [], loaded: [] }, () => worker)).toEqual([
      { seat: "s1", ok: true },
    ]);
    expect(ended()).toBe(true);
  });

  it("answers null, never a pass, when there is no worker or it fails", async () => {
    expect(await checkRoomDecksInWorker({ seats: [], allowed: [], loaded: [] }, () => null)).toBeNull();
    const { worker } = fakeWorker((id) => ({ id, verdicts: null }));
    expect(await checkRoomDecksInWorker({ seats: [], allowed: [], loaded: [] }, () => worker)).toBeNull();
    const broken: CheckWorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: () => queueMicrotask(() => broken.onerror?.({})),
      terminate: () => undefined,
    };
    expect(await checkRoomDecksInWorker({ seats: [], allowed: [], loaded: [] }, () => broken)).toBeNull();
  });
});
