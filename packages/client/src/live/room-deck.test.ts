import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WAVE2_STARTER_DECKS, deckFromStarterDeck, type Deck, type PackManifest } from "@mc/content";
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
import {
  RoomDeckWorker,
  type CheckWorkerLike,
  type RoomDeckRequest,
  type RoomDeckResponse,
} from "./room-deck-check-client.js";

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

  it("keeps the deck's own line order, duplicates unmerged, and its attribution id", () => {
    const deck = baseDeck();
    const first = deck.cards[0]!;
    const doubled: Deck = { ...deck, cards: [first, ...deck.cards.slice(1), first] };
    const room = roomDeckOf(doubled, "H", [])!;
    expect(room.cards.map((c) => c.cardId)).toEqual(doubled.cards.map((c) => c.cardId as string));
    const asPlayer = playerOfRoomDeck(room);
    expect("deck" in asPlayer && asPlayer.deck).toEqual(
      doubled.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId as string)),
    );
    // A precon carries its starter deck id; a saved deck its own id. The seat keeps it as deckId.
    expect(room.deckId).toBe((deck.source as { starterDeckId: string }).starterDeckId);
    const mine = roomDeckOf({ ...deck, source: { kind: "imported" } as never, id: "mine" as never }, "H", []);
    expect(mine!.deckId).toBe("mine");
    expect("deckId" in asPlayer && asPlayer.deckId).toBe(room.deckId);
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
    // Allowed by id but at another version than the one installed: not allowed.
    const stale = [{ id: sample.id, version: "0.0.1-older" }];
    expect(checkRoomDecks(input([deck], { allowed: stale, loaded: [sample] }))[0]).toMatchObject({
      code: "mod-not-allowed",
    });
  });
});

describe("the table-wide rules at Start", () => {
  const starterRoomDeck = (identity: string): RoomDeck => {
    const starter = WAVE2_STARTER_DECKS.find((d) => (d.identityCardId as string) === identity)!;
    return {
      name: starter.name,
      hero: identity,
      heroName: identity,
      aspects: starter.aspects as string[],
      cards: starter.cards.map((c) => ({ cardId: c.cardId as string, quantity: c.quantity })),
      mods: [],
    };
  };

  it("refuses a later seat whose hero matches an earlier one (Unique Icon), naming the hero, and keeps the first", () => {
    const verdicts = checkRoomDecks(input([base(), base()]));
    expect(verdicts[0]).toEqual({ seat: "s1", ok: true });
    expect(verdicts[1]).toMatchObject({ seat: "s2", ok: false, code: "illegal" });
    expect((verdicts[1] as { reason: string }).reason).toMatch(/is already at the table/);
  });

  it("lets two different heroes sit together", () => {
    const other = preconDecks(POOL_VERSION).find((d) => d.identityCardId !== baseDeck().identityCardId)!;
    expect(checkRoomDecks(input([base(), roomDeckOf(other, "Other", [])!])).map((v) => v.ok)).toEqual([true, true]);
  });

  it("judges a deck for this table: Team-Up stands in for a card that matches another seat's hero (RRG p. 50)", () => {
    const quicksilver = starterRoomDeck("14001a");
    // Order and Chaos (Team-Up: Quicksilver and Scarlet Witch) stays; the Scarlet Witch ally is replaced by a filler.
    const filler = POOL_CARDS.find(
      (c) => "aspect" in c && c.aspect === "basic" && !c.unique && !quicksilver.cards.some((l) => l.cardId === c.id),
    )!;
    const replaced: RoomDeck = {
      ...quicksilver,
      cards: [...quicksilver.cards.filter((l) => l.cardId !== "14002"), { cardId: filler.id as string, quantity: 1 }],
    };
    const witch = starterRoomDeck("15001a");
    expect(checkRoomDecks(input([witch, replaced]))[1]).toEqual({ seat: "s2", ok: true });
    // Without Scarlet Witch at the table the replacement is not allowed.
    expect(checkRoomDecks(input([replaced]))[0]).toMatchObject({ ok: false, code: "illegal" });
  });
});

describe("the deck worker", () => {
  const fakeWorker = (answer: (m: RoomDeckRequest) => RoomDeckResponse | null) => {
    const sent: RoomDeckRequest[] = [];
    let ended = 0;
    const worker: CheckWorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (message) => {
        sent.push(message);
        const reply = answer(message);
        if (reply) queueMicrotask(() => worker.onmessage?.({ data: reply }));
      },
      terminate: () => {
        ended++;
      },
    };
    return { worker, sent, ended: () => ended };
  };
  const echo = (m: RoomDeckRequest): RoomDeckResponse | null =>
    m.op === "deck"
      ? { id: m.id, op: "deck", deck: base() }
      : m.op === "check"
        ? { id: m.id, op: "check", verdicts: [{ seat: "s1", ok: true }] }
        : null;

  it("sends each pack once, builds decks and judges them in the worker, and ends after a quiet spell", async () => {
    vi.useFakeTimers();
    try {
      const w = fakeWorker(echo);
      const client = new RoomDeckWorker(() => w.worker, 1000);
      expect(await client.deck(baseDeck(), "H", [sample])).toEqual({ ok: true, deck: base() });
      await client.check({ seats: [], allowed: [] }, [sample], [sample]);
      expect(w.sent.filter((m) => m.op === "packs")).toHaveLength(1);
      vi.advanceTimersByTime(1500);
      expect(w.ended()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers a failure, never a pass, with no worker, a worker error, or a null answer", async () => {
    expect(await new RoomDeckWorker(() => null).deck(baseDeck(), "H", [])).toEqual({ ok: false, reason: "failed" });
    expect(await new RoomDeckWorker(() => null).check({ seats: [], allowed: [] }, [], [])).toBeNull();
    const nulls = fakeWorker((m) => (m.op === "check" ? { id: m.id, op: "check", verdicts: null } : null));
    expect(await new RoomDeckWorker(() => nulls.worker).check({ seats: [], allowed: [] }, [], [])).toBeNull();
    const broken = fakeWorker(() => null);
    const client = new RoomDeckWorker(() => broken.worker);
    const pending = client.check({ seats: [], allowed: [] }, [], []);
    broken.worker.onerror?.({});
    expect(await pending).toBeNull();
  });

  it("says too-large when the worker finds the list over the cap", async () => {
    const w = fakeWorker((m) => (m.op === "deck" ? { id: m.id, op: "deck", deck: null } : null));
    expect(await new RoomDeckWorker(() => w.worker).deck(baseDeck(), "H", [])).toEqual({
      ok: false,
      reason: "too-large",
    });
  });
});
