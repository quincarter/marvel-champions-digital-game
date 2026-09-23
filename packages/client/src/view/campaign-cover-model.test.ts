import { describe, expect, test } from "vitest";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { cardId } from "@mc/content";
import { CAMPAIGN_LOG_SCHEMA, createRng } from "@mc/engine";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import { coverModelOf } from "./campaign-cover-model.js";

const nameOf = (id: string): string => ({ "04001a": "Hawkeye", "04031a": "Spider-Woman" })[id] ?? id;

const record = (overrides: Partial<CampaignRecord> = {}): CampaignRecord => ({
  schema: CAMPAIGN_LOG_SCHEMA,
  recordSchema: 1,
  id: "run-1",
  campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId,
  definitionVersion: TRORS_CAMPAIGN_DEFINITION.version,
  poolVersion: "1",
  modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
  seats: [
    {
      seatNumber: 1,
      identityCardId: cardId("04001a"),
      deck: { identityCardId: cardId("04001a"), aspects: [], cards: [] },
      grants: [],
      fields: {},
    },
    {
      seatNumber: 2,
      identityCardId: cardId("04031a"),
      deck: { identityCardId: cardId("04031a"), aspects: [], cards: [] },
      grants: [],
      fields: {},
    },
  ],
  shared: {},
  hidden: {},
  removedFromCampaign: [],
  position: {
    nextNodeId: "taskmaster",
    resolved: { crossbones: "completed", "absorbing-man": "completed" },
    progress: {},
  },
  seed: 1,
  rng: createRng(1),
  history: [],
  status: "active",
  name: "The Rise of Red Skull",
  box: "MC10",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("coverModelOf", () => {
  test("a fresh volume (no run) offers no issue and no dossier/run", () => {
    const model = coverModelOf({
      campaignId: "trors",
      boxCode: "MC10",
      name: "The Rise of Red Skull",
      record: null,
      definition: TRORS_CAMPAIGN_DEFINITION,
      expertUnlocked: false,
    });
    expect(model.hasRun).toBe(false);
    expect(model.canReadIssue).toBe(false);
    expect(model.canOpenDossier).toBe(false);
    expect(model.canOpenRun).toBe(false);
    expect(model.villainScenarioId).toBe("red-skull");
    expect(model.pips).toEqual(["empty", "empty", "empty", "empty", "empty"]);
  });

  test("mid-run: issue 3 of 5, next issue billed from the story, pips from the log", () => {
    const model = coverModelOf({
      campaignId: "trors",
      boxCode: "MC10",
      name: "The Rise of Red Skull",
      record: record(),
      definition: TRORS_CAMPAIGN_DEFINITION,
      expertUnlocked: false,
      identityNameOf: nameOf,
    });
    expect(model.issueNumber).toBe(3);
    expect(model.nextIssueTitle).toBe("Welcome to Hydra City");
    expect(model.nextIssueVillain).toBe("Taskmaster");
    expect(model.pips).toEqual(["done", "done", "current", "empty", "empty"]);
    expect(model.rosterNames).toEqual(["Hawkeye", "Spider-Woman"]);
    expect(model.canReadIssue).toBe(true);
    expect(model.finished).toBeNull();
  });

  test("a won run has no next issue: all pips done, read-issue disabled", () => {
    const model = coverModelOf({
      campaignId: "trors",
      boxCode: "MC10",
      name: "The Rise of Red Skull",
      record: record({ status: "won", position: { nextNodeId: null, resolved: {}, progress: {} } }),
      definition: TRORS_CAMPAIGN_DEFINITION,
      expertUnlocked: true,
    });
    expect(model.finished).toBe("won");
    expect(model.canReadIssue).toBe(false);
    expect(model.pips).toEqual(["done", "done", "done", "done", "done"]);
    expect(model.expertUnlocked).toBe(true);
  });
});
