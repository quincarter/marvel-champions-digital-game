/**
 * Shadowland's log on the Dossier (MC65 p. 20): the recorded cards, each OVERPOWERING flag and the checked-off villains
 * are shown; the working fields never are. Uses the dev fixture (`seedShadowlandRun`, which plays scenario 1 for real), so
 * the gated pack needs no un-gating. The generic rows it adds (`recordedCards`, `remainingHp`) are also checked on boxes
 * that already had those fields (Galaxy's Most Wanted expert, MojoMania).
 */
import { campaignDefinitionOf } from "@mc/cards";
import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { campaignDossierOverview } from "../view/campaign-dossier-model.js";
import { CampaignService } from "./campaign-service.js";
import { seedGmwRun, seedMojoRun, seedShadowlandRun } from "./dev-fixtures.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));
const NAMES = new Map(POOL_CARDS.map((card) => [card.id as string, card.name]));
const name = (id: string) => NAMES.get(id) ?? id;

function service() {
  let clock = 1_000;
  return new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: POOL },
    engineDeps: POOL_DEPS,
    now: () => (clock += 1),
    newId: () => "dossier-run",
  });
}

describe("Shadowland on the Dossier", () => {
  const DEF = campaignDefinitionOf("shadowland")!;

  test("scenario 1 played for real: legal recorded cards, the flags, the named removed villains", async () => {
    const record = await seedShadowlandRun(service());
    expect(record.position.nextNodeId).not.toBe("shadows-in-the-night");
    expect(record.history?.length ?? 0).toBeGreaterThan(0);
    const overview = campaignDossierOverview(record as never, DEF, (id) => `hero ${id}`, name as never);
    for (const seat of overview.seats) {
      const recorded = seat.rows.find((row) => row.label === "Recorded cards");
      expect(recorded?.empty).toBe(false);
      // A support or upgrade with a printed cost of 2 or less: never Creeping Corruption (cost "-").
      expect(recorded?.value).not.toContain("Creeping Corruption");
      expect(seat.rows.find((row) => row.label === "OVERPOWERING in #1")).toBeDefined();
    }
    for (const seatLog of record.seats) {
      const ids = (seatLog.fields.recordedCards as unknown as { cardIds: string[] }).cardIds;
      expect(ids).toHaveLength(1);
      const card = POOL[ids[0]!] as { type: string; cost?: unknown };
      expect(["support", "upgrade"]).toContain(card.type);
      expect(typeof card.cost === "number" && card.cost <= 2).toBe(true);
    }
    const removed = record.shared.removedVillains as unknown as { cardIds: string[] };
    // A Daredevil seat checks Daredevil off at setup (p. 9), then scenario 1's own villain at its victory.
    expect(removed.cardIds).toContain("65013a");
    expect(removed.cardIds.length).toBeGreaterThanOrEqual(2);
    const world = overview.world.find((row) => row.id === "removedVillains");
    expect(world?.bigValue).toBe(String(removed.cardIds.length));
    expect(world?.when).toContain("Daredevil");
    const all = JSON.stringify(overview);
    for (const working of ["identityName", "candidates", "unrecordable", "Dark Protege villain of this scenario"])
      expect(all, working).not.toContain(working);
    expect(overview.world.map((row) => row.id)).not.toContain("villain");
  });

  test("an expert campaign shows the remaining hit points", async () => {
    const record = await seedShadowlandRun(service(), "afterIssue1", { expertCampaign: true });
    const overview = campaignDossierOverview(record as never, DEF, (id) => id);
    expect(overview.seats[0]!.rows.find((row) => row.label === "Remaining hit points")?.value).toMatch(/^\d+$/);
  });
});

describe("the generic seat rows on boxes that already had the fields", () => {
  /** A label that fits the seat panel (its widest existing label is about this long) and a value that is a plain number or names. */
  const fits = (row: { label: string; value: string }) => row.label.length <= 24 && row.value.length <= 60;

  test("Galaxy's Most Wanted, expert: remaining hit points read as a number", async () => {
    const record = await seedGmwRun(service(), "expertAfterIssue1");
    const overview = campaignDossierOverview(record as never, campaignDefinitionOf("gmw")!, (id) => id, name as never);
    for (const seat of overview.seats) {
      const hp = seat.rows.find((row) => row.label === "Remaining hit points");
      expect(hp).toBeDefined();
      expect(hp!.value).toMatch(/^\d+$/);
      expect(seat.rows.every(fits)).toBe(true);
    }
  });

  test("MojoMania: recorded cards read as card names", async () => {
    const record = await seedMojoRun(service(), "afterIssue1");
    const overview = campaignDossierOverview(record as never, campaignDefinitionOf("mojo")!, (id) => id, name as never);
    for (const seat of overview.seats) {
      const recorded = seat.rows.find((row) => row.label === "Recorded cards");
      expect(recorded).toBeDefined();
      expect(recorded!.value).not.toMatch(/^\d{5}/);
      expect(seat.rows.every(fits)).toBe(true);
    }
  });
});
