/**
 * One contract, two storages — the same shape as `game-storage.test.ts` and `deck-storage.test.ts`, so
 * `MemoryCampaignStorage` (Vitest, and the in-app default) is proven to behave exactly like `IdbCampaignStorage`.
 *
 * Built against MC10's real `TRORS_CAMPAIGN_DEFINITION`/`TRORS_CAMPAIGN`, not a hand-rolled fixture: the first
 * real `CampaignLog` this repo can produce, so the round trip proves a record shape that actually exists.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { cardId, TRORS_CAMPAIGN, TRORS_STARTER_DECKS } from "@mc/content";
import { createCampaignLog, type CampaignCardFace, type CampaignLog, type CampaignSeatSetup } from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import {
  CAMPAIGN_STORAGE_SCHEMA,
  MemoryCampaignStorage,
  type CampaignRecord,
  type CampaignStorage,
} from "./campaign-storage.js";
import { IdbCampaignStorage } from "./idb-campaign-storage.js";

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = TRORS_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no trors starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = [
  seatFor("hawkeye-leadership", 1),
  seatFor("spider-woman-aggression-justice", 2),
];

let nextLogId = 0;

const freshLog = (): CampaignLog =>
  createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
    id: `campaign-storage-test-${nextLogId++}`,
    seats: SEATS,
    modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
    poolVersion: "storage-test",
    seed: 1234,
  });

const record = (overrides: Partial<CampaignRecord> = {}): CampaignRecord => ({
  ...freshLog(),
  recordSchema: CAMPAIGN_STORAGE_SCHEMA,
  name: TRORS_CAMPAIGN.name,
  box: TRORS_CAMPAIGN.boxCode,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe.each<[string, () => CampaignStorage]>([
  ["memory", () => new MemoryCampaignStorage()],
  ["IndexedDB", () => new IdbCampaignStorage(new IDBFactory())],
])("%s campaign storage", (_name, make) => {
  test("a created campaign round-trips exactly", async () => {
    const storage = make();
    const stored = record({ id: "c1" });
    await storage.create(stored);
    expect(await storage.load("c1")).toEqual(stored);
  });

  test("creating over an existing id is refused, not silently overwritten", async () => {
    const storage = make();
    await storage.create(record({ id: "c1" }));
    await expect(storage.create(record({ id: "c1", name: "Different" }))).rejects.toThrow();
    expect((await storage.load("c1"))?.name).toBe(TRORS_CAMPAIGN.name);
  });

  test("put overwrites the whole record atomically", async () => {
    const storage = make();
    const original = record({ id: "c1" });
    await storage.create(original);
    const advanced: CampaignRecord = { ...original, updatedAt: 5, status: "won" };
    await storage.put(advanced);
    expect(await storage.load("c1")).toEqual(advanced);
  });

  test("an unknown campaign loads as null", async () => {
    expect(await make().load("nope")).toBeNull();
  });

  test("list projects every record to a summary, most recently played first", async () => {
    const storage = make();
    await storage.create(record({ id: "old", updatedAt: 1 }));
    await storage.create(record({ id: "new", updatedAt: 9 }));

    const rows = await storage.list();
    expect(rows.map((row) => row.id)).toEqual(["new", "old"]);
    const row = rows.find((candidate) => candidate.id === "new");
    expect(row).toMatchObject({
      campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId,
      name: TRORS_CAMPAIGN.name,
      box: TRORS_CAMPAIGN.boxCode,
      status: "active",
    });
    // Listing metadata only: no seat deck, no history, no shared/hidden fields — the same instinct `SaveMeta`
    // keeps `game-storage.ts`'s summary row free of a save's ~68 KB baseline.
    expect(row).not.toHaveProperty("history");
    expect(row).not.toHaveProperty("hidden");
    expect(row?.seats).toEqual([
      { seatNumber: 1, identityCardId: SEATS[0]?.identityCardId },
      { seatNumber: 2, identityCardId: SEATS[1]?.identityCardId },
    ]);
  });

  test("setStatus changes only the status, leaving the rest of the record untouched", async () => {
    const storage = make();
    await storage.create(record({ id: "c1" }));
    await storage.setStatus("c1", "abandoned");
    const loaded = await storage.load("c1");
    expect(loaded?.status).toBe("abandoned");
    expect(loaded?.name).toBe(TRORS_CAMPAIGN.name);
  });

  test("what comes back is a copy: mutating it doesn't change the stored campaign", async () => {
    const storage = make();
    const stored = record({ id: "c1" });
    await storage.create(stored);
    const loaded = await storage.load("c1");
    (loaded!.removedFromCampaign as CampaignCardFace[]).push({ cardId: cardId("99999") });
    expect((await storage.load("c1"))?.removedFromCampaign).toEqual([]);
  });
});
