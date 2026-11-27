import { describe, expect, test } from "vitest";
import { CAMPAIGN_LOG_SCHEMA, type CampaignDefinition } from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { CampaignSummary } from "../engine/campaign-storage.js";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { campaignSagaRows } from "./campaign-saga-model.js";
import { altsOf, ctaOf, featuredCopyOf, gridChipOf } from "./campaign-saga-copy.js";

const summary = (overrides: Partial<CampaignSummary> = {}): CampaignSummary => ({
  id: "c1",
  campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId,
  recordSchema: 1,
  schema: CAMPAIGN_LOG_SCHEMA,
  definitionVersion: TRORS_CAMPAIGN_DEFINITION.version,
  name: "The Rise of Red Skull",
  box: "MC10",
  status: "active",
  modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
  position: { nextNodeId: "taskmaster", resolved: { crossbones: "completed" }, progress: {} },
  seats: [{ seatNumber: 1, identityCardId: "04001a" }],
  createdAt: 1,
  updatedAt: 5,
  ...overrides,
});

const lookup = (id: string): CampaignDefinition | undefined =>
  id === (TRORS_CAMPAIGN_DEFINITION.campaignId as string) ? TRORS_CAMPAIGN_DEFINITION : undefined;
const rowsOf = (summaries: readonly CampaignSummary[]) =>
  campaignSagaRows(summaries, { definitionOf: lookup, identityNameOf: () => "Hawkeye" });

describe("the Saga's words", () => {
  test("a live volume says its issue, offers Continue, Dossier and Start over", () => {
    const row = rowsOf([summary()])[0]!;
    expect(gridChipOf(row)).toBe("Issue 3 of 5");
    expect(featuredCopyOf(row)).toMatchObject({ status: "In progress", right: "Issue 3 of 5", hasPips: true });
    expect(ctaOf(row, 0)).toMatchObject({ label: "Continue ▸", enabled: true, action: "continue" });
    expect(altsOf(row, false).map((alt) => alt.label)).toEqual(["Dossier", "Start over"]);
    expect(altsOf(row, true)[1]!.label).toBe("Tap again to confirm");
  });

  test("a fresh volume offers Start vol. 1, and no second row", () => {
    const row = rowsOf([])[0]!;
    expect(ctaOf(row, 0).label).toBe("Start vol. 1 ▸");
    expect(altsOf(row, false)).toEqual([]);
    expect(featuredCopyOf(row)).toMatchObject({ status: "Open", right: "Not started", foot: "" });
  });

  test("a sealed volume this build can play offers to unlock for its cost; one it cannot stays locked", () => {
    const sealed = rowsOf([]).find((row) => row.status === "sealed")!;
    expect(ctaOf({ ...sealed, hasDefinition: true }, 12)).toMatchObject({ label: "Unlock · 12 pts", action: "unlock" });
    expect(ctaOf({ ...sealed, hasDefinition: false }, 0)).toMatchObject({ label: "Locked", enabled: false });
  });

  test("a volume won on Standard offers a new run and an Expert run", () => {
    const row = rowsOf([summary({ status: "won", position: { nextNodeId: null, resolved: {}, progress: {} } })])[0]!;
    expect(row.status).toBe("done");
    expect(altsOf(row, false).map((alt) => alt.action)).toEqual(["newRun", "expertRun"]);
    expect(gridChipOf(row)).toBe("✓ Complete");
  });

  test("reads in Spanish where the language is Spanish", () => {
    useSpanish();
    try {
      const row = rowsOf([summary()])[0]!;
      expect(gridChipOf(row)).toBe("Número 3 de 5");
      expect(ctaOf(row, 0).label).toBe("Continuar ▸");
      expect(altsOf(row, false).map((alt) => alt.label)).toEqual(["Expediente", "Empezar de nuevo"]);
    } finally {
      useEnglish();
    }
  });
});
