/**
 * A lost Age of Apocalypse campaign (MC45 p. 20: the last scenario won with the Professor not saved) reads as lost on the
 * Saga, the Cover, The Run and the Dossier, not as an unstarted volume or a sealed issue; the Briefing says what rewards
 * and carried penalties do.
 */
import { describe, expect, it } from "vitest";
import { AOA_CAMPAIGN_DEFINITION as DEF, AOA_DEFEATED, AOA_MISSIONS, AOA_NOT_DEFEATED } from "@mc/cards";
import { createCampaignLog, type CampaignLog, type CampaignGrant } from "@mc/engine";
import { POOL_VERSION } from "../content/pool.js";
import { summaryOf, type CampaignRecord } from "../engine/campaign-storage.js";
import { storyFor } from "../campaign/story.js";
import { campaignSagaRows } from "./campaign-saga-model.js";
import { coverModelOf } from "./campaign-cover-model.js";
import { campaignRunModel, lostAtLineOf } from "./campaign-run-model.js";
import { campaignDossierHero } from "./campaign-dossier-model.js";
import { grantRowsOf } from "./campaign-briefing-model.js";
import { missionBriefingOf } from "./campaign-mission-model.js";
import { campaignStepRows } from "./campaign-step-model.js";
import { preconDecks } from "./deck-list-model.js";

const NODE_IDS = DEF.graph.nodes.map((node) => node.id);

function fresh(): CampaignLog {
  const deck = preconDecks(POOL_VERSION).find((candidate) => (candidate.id as string).includes("bishop"))!;
  return createCampaignLog(DEF, {
    id: "aoa-lost",
    seats: [
      {
        seatNumber: 1,
        identityCardId: deck.identityCardId,
        deck: { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards },
      },
    ],
    modes: { campaign: { campaignId: DEF.campaignId } },
    poolVersion: POOL_VERSION,
    seed: 3,
  });
}

/** What losing the campaign leaves: the first four issues completed, the last one unmarked, no next node. */
function lostRecord(): CampaignRecord {
  const log = fresh();
  const resolved = Object.fromEntries(NODE_IDS.slice(0, -1).map((id) => [id, "completed" as const]));
  return {
    ...log,
    status: "lost",
    position: { nextNodeId: null, resolved, progress: {} },
    recordSchema: 1,
    name: "Age of Apocalypse",
    box: "MC45",
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("a lost campaign", () => {
  it("names the issue it was lost at", () => {
    expect(lostAtLineOf(lostRecord(), NODE_IDS)).toBe("Campaign lost at issue #5");
    expect(lostAtLineOf({ ...lostRecord(), status: "active" }, NODE_IDS)).toBeNull();
  });

  it("reads as lost on the Saga shelf while the volume stays open for a new roster", () => {
    const row = campaignSagaRows([summaryOf(lostRecord())], {
      definitionOf: () => DEF,
      openedByHandOf: () => true,
    }).find((candidate) => candidate.volume.campaignId === (DEF.campaignId as string))!;
    expect(row.status).toBe("fresh");
    expect(row.lost).toEqual({ runId: "aoa-lost", issueNumber: 5 });
  });

  it("is lost on the Cover, with no next issue to read", () => {
    const cover = coverModelOf({
      campaignId: DEF.campaignId as string,
      boxCode: "MC45",
      name: "Age of Apocalypse",
      record: lostRecord(),
      definition: DEF,
      expertUnlocked: false,
    });
    expect(cover.finished).toBe("lost");
    expect(cover.lostLine).toBe("Campaign lost at issue #5");
    expect(cover.canReadIssue).toBe(false);
  });

  it("shows the last issue as played and lost in The Run and the Dossier, not sealed", () => {
    const run = campaignRunModel(lostRecord(), DEF, storyFor(DEF.campaignId as string));
    const last = run.issues.at(-1)!;
    expect(last.status).toBe("finished");
    expect(last.won).toBe(false);
    expect(last.resultLine).toBe("Campaign lost");
    expect(run.lost).toBe(true);
    const hero = campaignDossierHero(lostRecord(), DEF, 1, () => undefined)!;
    expect(hero.issues.at(-1)).toMatchObject({ number: 5, state: "lost", label: "LOST" });
  });
});

describe("the Briefing's grants", () => {
  const withGrants = (grants: readonly CampaignGrant[]): CampaignRecord => {
    const record = lostRecord();
    return { ...record, seats: record.seats.map((seat) => ({ ...seat, grants })) };
  };
  const name = (id: string): string => id;

  it("says a reward is shuffled into the deck, not in play, and a left-out one is left out", () => {
    const rows = grantRowsOf(
      withGrants([
        { cardId: "reward-a" as never, grantedAtNodeId: "unus", permanence: "campaign", deckSize: "maximumOnly" },
        {
          cardId: "reward-b" as never,
          grantedAtNodeId: "unus",
          permanence: "campaign",
          deckSize: "maximumOnly",
          optional: true,
          leftOut: true,
        },
      ]),
      name,
    );
    expect(rows.map((row) => row.title)).toEqual(["Rewards are in the deck", "Rewards left out"]);
    expect(rows[0]!.detail).toContain("reward-a");
    expect(rows[0]!.detail).toContain("not in play");
    expect(rows[0]!.detail).not.toContain("reward-b");
    expect(rows[1]!.detail).toContain("reward-b");
  });

  it("keeps 'start in play' for a setup grant that is not a reward", () => {
    const rows = grantRowsOf(
      withGrants([{ cardId: "tech" as never, grantedAtNodeId: "unus", permanence: "campaign" }]),
      name,
    );
    expect(rows.map((row) => row.title)).toEqual(["Setup cards start in play"]);
  });
});

describe("carried mission penalties", () => {
  it("name the Sea Wall and the Refugees when those missions were not defeated, and nothing for a defeated one", () => {
    const sabotage = AOA_MISSIONS.find((row) => row.id === "sabotage")!;
    const evacuate = AOA_MISSIONS.find((row) => row.id === "evacuate")!;
    const base = fresh();
    const record = {
      ...base,
      shared: {
        ...base.shared,
        [sabotage.resultField]: { kind: "choice" as const, option: AOA_NOT_DEFEATED },
        [evacuate.resultField]: { kind: "choice" as const, option: AOA_DEFEATED },
      },
      attempt: {
        nodeId: NODE_IDS[1]!,
        modes: base.modes,
        logBefore: base,
        steps: [],
      },
    } as unknown as CampaignLog;
    const brief = missionBriefingOf(record, DEF)!;
    expect(brief.carried).toEqual(["Sea Wall in every encounter deck."]);
  });
});

describe("the step list", () => {
  it("does not repeat a name the instruction's own sentence already says", () => {
    const rows = campaignStepRows(
      [
        {
          instructionId: "x",
          text: "Reveal the Protect the Professor side scheme.",
          citation: "p. 1",
          kind: "betweenGames",
          writes: [
            {
              field: "currentMission",
              seatNumber: null,
              mode: "set",
              value: { kind: "choice", option: "Protect the Professor" },
            },
          ],
          choices: [],
          grants: [],
          removedFromCampaign: [],
        } as never,
      ],
      (id) => id as string,
    );
    expect(rows[0]!.effects).toEqual([]);
  });
});
