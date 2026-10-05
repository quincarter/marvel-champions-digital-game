/**
 * The Aftermath's "logged this issue" tag stack for MC32's issue #1 (QA wave 6): Future Past cards that are recorded
 * are counted, the staging field for the victory display is not tagged as a record, and the cards struck from the
 * campaign (MC32 p. 7) get their own tag.
 */
import { describe, expect, it } from "vitest";
import type { CampaignHistoryEntry, CampaignLog, CampaignStepTrace, LogWrite } from "@mc/engine";
import { campaignDefinitionOf } from "@mc/cards";
import { CARDS_BY_ID } from "../content/pool.js";
import { aftermathLogTags } from "./campaign-aftermath-model.js";
import { removalStagingFieldIds } from "./campaign-log-deltas.js";

const DEFINITION = campaignDefinitionOf("mut_gen")!;

const step = (instructionId: string, extra: Partial<CampaignStepTrace>): CampaignStepTrace => ({
  instructionId,
  text: "x",
  citation: "MC32 p. 7",
  kind: "record",
  writes: [],
  choices: [],
  removedFromCampaign: [],
  grants: [],
  ...extra,
});
const cardList = (field: string, cardIds: string[], mode: LogWrite["mode"]): LogWrite =>
  ({ field, seatNumber: null, mode, value: { kind: "cardList", cardIds } }) as unknown as LogWrite;

const log = {
  history: [
    {
      nodeId: "sabretooth",
      modes: {},
      outcome: "won",
      gameId: null,
      logBefore: { shared: {}, seats: [] },
      at: 0,
      steps: [
        step("record", {
          writes: [cardList("futurePast", ["a", "b"], "append"), cardList("futurePastVictoryDisplay", ["c"], "set")],
        }),
        step("remove", { kind: "betweenGames", removedFromCampaign: [{ cardId: "c" } as never] }),
      ],
    } as unknown as CampaignHistoryEntry,
  ],
} as Pick<CampaignLog, "history">;

describe("MC32 aftermath tags", () => {
  const staged = removalStagingFieldIds(DEFINITION);

  it("finds the victory-display field as removal staging", () => {
    expect(staged.has("futurePastVictoryDisplay")).toBe(true);
    expect(staged.has("futurePast")).toBe(false);
  });

  it("counts recorded Future Past cards and the cards removed, and never tags the staging field", () => {
    const tags = aftermathLogTags(log, "sabretooth", DEFINITION.logFields, CARDS_BY_ID, staged).map((tag) => tag.text);
    expect(tags).toEqual(["LOGGED · 2 FUTURE PAST CARDS", "REMOVED · 1 CARD FROM THE CAMPAIGN"]);
  });
});
