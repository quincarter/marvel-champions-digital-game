/**
 * A `retryBaseline: "keepLog"` loss (Fear No Evil, MC60 p. 8; docs/phase7-wave11-scenarios.md E30) restores nothing:
 * Rewind shows the marks already drawn and sends the players back to Campaign Setup, not to a restored log.
 */
import { describe, expect, test } from "vitest";
import { CAMPAIGNS, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { CARDS_BY_ID } from "../content/pool.js";
import { rewindActionLabelOf, rewindHeadlineOf, rewindIntroOf, rewindViewOf } from "./campaign-rewind-model.js";

// FNE is registered in CAMPAIGNS (the client reaches it by id, as the campaign screens do).
const FNE_CAMPAIGN_DEFINITION = CAMPAIGNS.fne!;
const node = FNE_CAMPAIGN_DEFINITION.graph.nodes[0]!.id;
const villainField = (id: string) => `villain.${id}`;
const completedField = (id: string) => `completed.${id}`;
const recordWith = (shared: Record<string, unknown>) =>
  ({
    status: "active",
    modes: {},
    shared,
    hidden: {},
    removedFromCampaign: [],
    history: [
      {
        nodeId: node,
        modes: {},
        outcome: "lost",
        gameId: null,
        logBefore: { removedFromCampaign: [] },
        steps: [],
        at: 0,
      },
    ],
  }) as never;

describe("Rewind after a keepLog loss", () => {
  test("lists the marks drawn, skips working and empty fields, and goes back to Campaign Setup", () => {
    const record = recordWith({
      [villainField(node)]: { kind: "choice", option: "bullseye" },
      [completedField(node)]: { kind: "flag", value: false },
      unrecordedVillains: { kind: "strikeList", struck: ["bullseye"] },
      trustEstablished: { kind: "flag", value: true },
      checks: { kind: "number", value: 2 },
    });
    const view = rewindViewOf(record, node, () => 1, CARDS_BY_ID, FNE_CAMPAIGN_DEFINITION);
    expect(view.keepLog).toBe(true);
    expect(view.keptMarks).toEqual([expect.stringContaining("Villain:"), "List of Villains", "Trust Established?"]);
    expect(view.keptSummary).toBe(`${view.keptMarks.join(", ")}.`);
    expect(view.replaySeed).toBeNull();
    expect(view.logChanged).toBe(false);
    const intro = rewindIntroOf(view, false);
    expect(intro).toMatch(/Campaign Setup/);
    expect(intro).not.toMatch(/same log|picks up exactly|restored/i);
    expect(rewindActionLabelOf(view)).toBe("Back to Campaign Setup ▸");
    expect(rewindHeadlineOf(view)).toBe("Campaign\nSetup");
  });

  test("an empty log says no marks are drawn yet", () => {
    const view = rewindViewOf(recordWith({}), node, () => 1, CARDS_BY_ID, FNE_CAMPAIGN_DEFINITION);
    expect(view.keptSummary).toBe("No marks drawn yet.");
  });

  test("a nodeStart box is untouched", () => {
    const record = recordWith({});
    const view = rewindViewOf(record, "taskmaster", () => 3, CARDS_BY_ID, TRORS_CAMPAIGN_DEFINITION);
    expect(view.keepLog).toBe(false);
    expect(rewindActionLabelOf(view)).toBe("Rewind, new shuffle ▸");
    expect(rewindHeadlineOf(view)).toBe("Rewind\nIssue #3");
  });
});
