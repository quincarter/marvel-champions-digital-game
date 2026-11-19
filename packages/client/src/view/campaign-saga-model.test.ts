import { describe, expect, test } from "vitest";
import { CAMPAIGN_LOG_SCHEMA, type CampaignDefinition } from "@mc/engine";
import { campaignDefinitionOf, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { CampaignSummary } from "../engine/campaign-storage.js";
import { DEFAULT_UNLOCK_PREFS, progressOf, Unlocks } from "../progression/unlocks.js";
import { campaignSagaRows, defaultFeaturedVolume, doneVolumeCount, openVolumeCount } from "./campaign-saga-model.js";

const trorsSummary = (overrides: Partial<CampaignSummary> = {}): CampaignSummary => ({
  id: "c1",
  campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId,
  recordSchema: 1,
  schema: CAMPAIGN_LOG_SCHEMA,
  definitionVersion: TRORS_CAMPAIGN_DEFINITION.version,
  name: "The Rise of Red Skull",
  box: "MC10",
  status: "active",
  modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
  position: {
    nextNodeId: "taskmaster",
    resolved: { crossbones: "completed", "absorbing-man": "completed" },
    progress: {},
  },
  seats: [
    { seatNumber: 1, identityCardId: "04001a" },
    { seatNumber: 2, identityCardId: "04031a" },
  ],
  createdAt: 1,
  updatedAt: 5,
  ...overrides,
});

const lookup = (id: string): CampaignDefinition | undefined =>
  id === (TRORS_CAMPAIGN_DEFINITION.campaignId as string) ? TRORS_CAMPAIGN_DEFINITION : undefined;
const nameOf = (id: string): string => ({ "04001a": "Hawkeye", "04031a": "Spider-Woman" })[id] ?? id;

describe("campaignSagaRows", () => {
  test("volume 1 is always open; the rest are sealed with no runs at all", () => {
    const rows = campaignSagaRows([], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows).toHaveLength(11);
    expect(rows[0]).toMatchObject({ status: "fresh", unlocked: true, hasDefinition: true, lockReason: null });
    for (const row of rows.slice(1)) {
      expect(row.status).toBe("sealed");
      expect(row.unlocked).toBe(false);
    }
    // Vol. 2 isn't unlocked yet either way, so the generic "Sealed" chip covers it — no need to say more.
    expect(rows[1]!.lockReason).toBeNull();
  });

  test("an active run reads live, with issue number and pips from the real graph", () => {
    const rows = campaignSagaRows([trorsSummary()], { definitionOf: lookup, identityNameOf: nameOf });
    const vol1 = rows[0]!;
    expect(vol1.status).toBe("live");
    expect(vol1.runId).toBe("c1");
    expect(vol1.issueNumber).toBe(3);
    expect(vol1.totalIssues).toBe(5);
    expect(vol1.pips).toEqual(["done", "done", "current", "empty", "empty"]);
    expect(vol1.rosterNames).toEqual(["Hawkeye", "Spider-Woman"]);
  });

  test("a won-on-standard run opens volume 2 — but it stays sealed for lack of a definition", () => {
    const won = trorsSummary({ id: "c2", status: "won", position: { nextNodeId: null, resolved: {}, progress: {} } });
    const rows = campaignSagaRows([won], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows[0]).toMatchObject({ status: "done", runId: "c2", wonStandard: true, wonExpert: false });
    expect(rows[0]!.pips).toEqual(["done", "done", "done", "done", "done"]);
    // Vol. 2's unlock rule is satisfied, but honesty about content wins: still "not in this build yet".
    expect(rows[1]).toMatchObject({ status: "sealed", unlocked: true, lockReason: "Not in this build yet" });
    expect(doneVolumeCount(rows)).toBe(1);
  });

  test("against the real @mc/cards registry, winning Vol. 1 on Standard opens Vol. 2 (gmw) as fresh, not sealed", () => {
    const won = trorsSummary({ id: "c2", status: "won", position: { nextNodeId: null, resolved: {}, progress: {} } });
    const rows = campaignSagaRows([won], { definitionOf: campaignDefinitionOf, identityNameOf: nameOf });
    expect(rows[1]!.volume.campaignId).toBe("gmw");
    expect(rows[1]).toMatchObject({ status: "fresh", unlocked: true, hasDefinition: true, lockReason: null });
  });

  test("a won-on-expert run does not itself open the next volume — only Standard does", () => {
    const won = trorsSummary({
      id: "c3",
      status: "won",
      modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } },
      position: { nextNodeId: null, resolved: {}, progress: {} },
    });
    const rows = campaignSagaRows([won], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows[0]).toMatchObject({ wonStandard: false, wonExpert: true });
    expect(rows[1]!.unlocked).toBe(false);
    expect(rows[1]!.lockReason).toBeNull();
  });

  test("an incompatible active run is not resumable", () => {
    const stale = trorsSummary({ definitionVersion: "stale" });
    const rows = campaignSagaRows([stale], { definitionOf: lookup, identityNameOf: nameOf });
    expect(rows[0]!.status).toBe("live");
    expect(rows[0]!.canResume).toBe(false);
    expect(rows[0]!.incompatibleReason).toMatch(/version/);
  });

  test("defaultFeaturedVolume prefers a live run, then a fresh one, then Vol. 1", () => {
    expect(defaultFeaturedVolume(campaignSagaRows([], { definitionOf: lookup, identityNameOf: nameOf }))).toBe(1);
    expect(
      defaultFeaturedVolume(campaignSagaRows([trorsSummary()], { definitionOf: lookup, identityNameOf: nameOf })),
    ).toBe(1);
  });

  test("openVolumeCount is 1 with nothing played, in a build with only MC10", () => {
    const rows = campaignSagaRows([], { definitionOf: lookup, identityNameOf: nameOf });
    expect(openVolumeCount(rows)).toBe(1);
    expect(doneVolumeCount(rows)).toBe(0);
  });
});

describe("campaignSagaRows with progression", () => {
  const gmwLookup = (id: string): CampaignDefinition | undefined => campaignDefinitionOf(id);

  test("a volume whose wave is still locked stays sealed, with that wave's reason", () => {
    const reason = "Beat Rhino to unlock The Rise of Red Skull";
    const rows = campaignSagaRows([], {
      definitionOf: lookup,
      identityNameOf: nameOf,
      waveLockOf: (id) => (id === "trors" ? reason : null),
    });
    expect(rows[0]).toMatchObject({ status: "sealed", unlocked: false, lockReason: reason });
  });

  test("unlock everything opens every volume this build can play, in any order", () => {
    const rows = campaignSagaRows([], {
      definitionOf: gmwLookup,
      identityNameOf: nameOf,
      waveLockOf: () => "locked",
      openedByHandOf: () => true,
    });
    expect(rows[0]).toMatchObject({ status: "fresh", unlocked: true });
    expect(rows[1]).toMatchObject({ status: "fresh", unlocked: true });
    expect(rows[2]).toMatchObject({ status: "fresh", unlocked: true });
    expect(rows[3]).toMatchObject({ status: "fresh", unlocked: true });
    expect(rows[4]).toMatchObject({ status: "fresh", unlocked: true });
    expect(rows[5]).toMatchObject({ status: "fresh", hasDefinition: true, unlocked: true });
    expect(rows[6]).toMatchObject({ status: "fresh", hasDefinition: true, unlocked: true });
    expect(rows[7]).toMatchObject({ status: "fresh", hasDefinition: true, unlocked: true });
    expect(rows[8]).toMatchObject({ status: "fresh", hasDefinition: true, unlocked: true });
  });
});

describe("campaignSagaRows with a campaign opened by hand", () => {
  test("opens that volume alone, out of the Standard-win order", () => {
    const rows = campaignSagaRows([], {
      definitionOf: (id) => campaignDefinitionOf(id),
      identityNameOf: nameOf,
      waveLockOf: () => "locked",
      openedByHandOf: (id) => id === "gmw",
    });
    expect(rows[0]).toMatchObject({ status: "sealed", unlocked: false });
    expect(rows[1]).toMatchObject({ status: "fresh", unlocked: true });
  });
});

// Issue #869: a finished Rise of Red Skull left Galaxy's Most Wanted sealed. The shelf is wired to the unlock path the
// way `scenes/campaign/saga.ts` wires it: progress from the stored runs, then `Unlocks.campaignLock` per volume.
describe("campaignSagaRows wired to the unlock path (issue #869)", () => {
  const wonTrors = (overrides: Partial<CampaignSummary> = {}): CampaignSummary =>
    trorsSummary({
      id: "won",
      status: "won",
      position: { nextNodeId: null, resolved: {}, progress: {} },
      ...overrides,
    });
  const rhinoWin = { status: "won", config: { scenarioId: "rhino", difficulty: "standard" } };
  const shelf = (runs: readonly CampaignSummary[]) => {
    const unlocked = new Unlocks({ progress: progressOf([rhinoWin], runs), prefs: DEFAULT_UNLOCK_PREFS });
    return campaignSagaRows(runs, {
      definitionOf: campaignDefinitionOf,
      identityNameOf: nameOf,
      waveLockOf: (campaignId) => unlocked.campaignLock(campaignId, "en"),
      openedByHandOf: (campaignId) => unlocked.campaignManual(campaignId),
    });
  };

  test("a Rise of Red Skull run won on Standard opens Galaxy's Most Wanted", () => {
    const rows = shelf([wonTrors()]);
    expect(rows[0]).toMatchObject({ status: "done", wonStandard: true, wonStandardAdjustedOnly: false });
    expect(rows[1]).toMatchObject({ status: "fresh", unlocked: true, previousWonAdjustedOnly: false });
  });

  test("an adjusted win completes the volume but opens nothing, and both volumes say why", () => {
    const rows = shelf([wonTrors({ adjusted: true })]);
    expect(rows[0]).toMatchObject({
      status: "done",
      wonStandard: true,
      wonStandardAdjustedOnly: true,
      adjustedWinKeepsNextSealed: true,
    });
    expect(rows[1]).toMatchObject({ status: "sealed", unlocked: false, previousWonAdjustedOnly: true });
    // Nothing further down blames the adjusted run: Vol. 3 is sealed by Vol. 2, not by Vol. 1.
    expect(rows[2]).toMatchObject({ status: "sealed", previousWonAdjustedOnly: false });
  });

  test("the shelf's own order follows the same rule even when the wave is open by other means", () => {
    const rows = campaignSagaRows([wonTrors({ adjusted: true })], {
      definitionOf: campaignDefinitionOf,
      identityNameOf: nameOf,
    });
    expect(rows[1]).toMatchObject({ status: "sealed", unlocked: false, previousWonAdjustedOnly: true });
  });

  test("one run won by the rules opens the next volume, whatever other runs were adjusted", () => {
    const rows = shelf([wonTrors({ id: "a", adjusted: true }), wonTrors({ id: "b", updatedAt: 9 })]);
    expect(rows[0]).toMatchObject({ wonStandardAdjustedOnly: false });
    expect(rows[1]).toMatchObject({ status: "fresh", unlocked: true, previousWonAdjustedOnly: false });
  });

  test("an adjusted Standard win and an Expert win by the rules open the next volume, as the wave does", () => {
    const expert = { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true as const } };
    const rows = shelf([wonTrors({ id: "a", adjusted: true }), wonTrors({ id: "b", modes: expert })]);
    expect(rows[0]).toMatchObject({ wonStandardAdjustedOnly: false, adjustedWinKeepsNextSealed: false });
    expect(rows[1]).toMatchObject({ status: "fresh", unlocked: true });
  });

  test("an adjusted Expert-only win gets the ADJUSTED stamp but no note about the next volume", () => {
    const expert = { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true as const } };
    const rows = shelf([wonTrors({ adjusted: true, modes: expert })]);
    expect(rows[0]).toMatchObject({
      status: "done",
      wonAdjustedOnly: true,
      wonStandardAdjustedOnly: false,
      adjustedWinKeepsNextSealed: false,
    });
    expect(rows[1]).toMatchObject({ status: "sealed", previousWonAdjustedOnly: false });
  });

  test("a volume with one clean win has no ADJUSTED stamp", () => {
    const rows = shelf([wonTrors({ id: "a", adjusted: true }), wonTrors({ id: "b", updatedAt: 9 })]);
    expect(rows[0]).toMatchObject({ wonAdjustedOnly: false });
  });

  test("Settings ▸ Unlocks still opens a volume sealed behind an adjusted win", () => {
    const runs = [wonTrors({ adjusted: true })];
    const progress = progressOf([rhinoWin], runs);
    const unlocked = new Unlocks({ progress, prefs: { ...DEFAULT_UNLOCK_PREFS, campaignIds: ["gmw"] } });
    const rows = campaignSagaRows(runs, {
      definitionOf: campaignDefinitionOf,
      identityNameOf: nameOf,
      waveLockOf: (campaignId) => unlocked.campaignLock(campaignId, "en"),
      openedByHandOf: (campaignId) => unlocked.campaignManual(campaignId),
    });
    expect(rows[1]).toMatchObject({ status: "fresh", unlocked: true, previousWonAdjustedOnly: false });
    // Vol. 1 is still adjusted, but the card doesn't claim Vol. 2 is sealed by it.
    expect(rows[0]).toMatchObject({ wonStandardAdjustedOnly: true, adjustedWinKeepsNextSealed: false });
  });
});
