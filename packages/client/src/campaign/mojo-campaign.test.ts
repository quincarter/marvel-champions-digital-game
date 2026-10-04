/**
 * MojoMania through the same functions the campaign scenes call: the Briefing composes with `CampaignService.compose`
 * and "Open Issue" starts `launchConfig(record)` through the host path. The campaign layer owns the genre-set picks
 * (insert pp. 9, 13-14, 17), so each node's built game must hold exactly the log's picks, with Longshot set aside.
 */
import { MOJO_CAMPAIGN_DEFINITION, cardsOfComposedSets, mojoModularSetPicks } from "@mc/cards";
import {
  applyCampaignResult,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignPendingChoice,
  type GameState,
} from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { MemoryCampaignStorage, type CampaignRecord } from "../engine/campaign-storage.js";
import type { StateWithoutPool } from "../engine/host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { issueStoryFor, storyFor } from "./story.js";
import { preconDecks } from "../view/deck-list-model.js";
import { CampaignService } from "./campaign-service.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));

const deckNamed = (id: string) => {
  const deck = preconDecks(POOL_VERSION).find((candidate) => (candidate.id as string).includes(id));
  if (!deck) throw new Error(`no precon matching ${id}`);
  return deck;
};
const SEATS = [deckNamed("spider-man-justice"), deckNamed("captain-marvel")].map((deck) => ({
  identityCardId: deck.identityCardId,
  deck,
}));

function service() {
  let clock = 1_000;
  return new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: POOL },
    engineDeps: POOL_DEPS,
    now: () => (clock += 1),
    newId: () => "mojo-run",
  });
}

/** What the Briefing does: answers each pending choice until the issue is composed. First option of every set pick. */
async function composeIssue(
  svc: CampaignService,
  record: CampaignRecord,
): Promise<{
  readonly record: CampaignRecord;
  readonly asked: readonly CampaignPendingChoice[];
}> {
  const answers: CampaignChoiceAnswer[] = [];
  const asked: CampaignPendingChoice[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const result = await svc.compose(record, answers);
    if (result.kind === "done") return { record: result.record, asked };
    asked.push(result.choice);
    const { instructionId, slot, seatNumber } = result.choice;
    answers.push({
      instructionId,
      slot,
      seatNumber,
      picked: /^(set|checked)\d$/.test(slot) ? [result.choice.options[0]!] : [],
    });
  }
  throw new Error("composition never finished");
}

const start = async (record: CampaignRecord): Promise<StateWithoutPool> => {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  return (
    await core.start(
      new CampaignService({
        storage: new MemoryCampaignStorage(),
        campaignDeps: { pool: POOL },
        engineDeps: POOL_DEPS,
      }).launchConfig(record),
    )
  ).snapshot.state;
};

const bareWin = (nodeId: string): CampaignGameResult => ({
  nodeId,
  outcome: "won",
  records: [],
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
});

/** Folds a stand-in win (no real game behind it) into the stored record, declining every optional choice. */
async function win(svc: CampaignService, composed: CampaignRecord, nodeId: string): Promise<CampaignRecord> {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const result = applyCampaignResult(
      MOJO_CAMPAIGN_DEFINITION,
      composed,
      bareWin(nodeId),
      { at: 1_700_000_000_000, gameId: "t" },
      { pool: POOL },
      answers,
    );
    if (result.kind === "done") {
      const next: CampaignRecord = {
        ...result.value,
        recordSchema: composed.recordSchema,
        name: composed.name,
        box: composed.box,
        createdAt: composed.createdAt,
        updatedAt: composed.updatedAt + 1,
      };
      await svc.storage.put(next);
      return next;
    }
    const { instructionId, slot, seatNumber } = result.choice;
    answers.push({ instructionId, slot, seatNumber, picked: [] });
  }
  throw new Error("victory never settled");
}

const setsOf = (state: GameState | StateWithoutPool): readonly string[] =>
  (state.setAsideModularSets ?? []).map((s) => s.encounterSetId);
/** Every card of `ids` exists in the built game (wherever setup left it: a deck, the set-aside area or in play). */
const cardsIn = (state: GameState | StateWithoutPool, ids: readonly string[]) => {
  const present = new Set(Object.values(state.instances).map((instance) => instance.cardId as string));
  return ids.every((code) => present.has(code));
};

describe("MojoMania in the campaign client", () => {
  test("has a story file: the screens read its tagline, cast and per-issue copy", () => {
    expect(storyFor("mojo")?.tagline).toBeTruthy();
    expect(issueStoryFor("mojo", "magog")?.villain).toBe("MaGog");
  });

  test("a run can be signed and issue #1's briefing asks the genre-set pick, offering all six", async () => {
    const svc = service();
    const record = await svc.start({ campaignId: "mojo", seats: SEATS, poolVersion: POOL_VERSION, seed: 11 });
    expect(record.position.nextNodeId).toBe("magog");
    const first = await svc.compose(record);
    if (first.kind !== "pending") throw new Error("expected the genre-set pick");
    expect(first.choice.slot).toBe("set1");
    expect([...first.choice.options].sort()).toEqual(["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"]);
  });

  test("issue #1 builds MaGog with the picked set shuffled in and Longshot set aside", async () => {
    const svc = service();
    const signed = await svc.start({ campaignId: "mojo", seats: SEATS, poolVersion: POOL_VERSION, seed: 11 });
    const { record } = await composeIssue(svc, signed);
    const picks = [...mojoModularSetPicks(record)];
    expect(picks).toHaveLength(1);
    const config = svc.launchConfig(record);
    expect(config.scenarioId).toBe("magog");
    expect(config.modularSetIds).toEqual(picks);
    const state = await start(record);
    expect(cardsIn(state, cardsOfComposedSets(POOL_CARDS, picks) as string[])).toBe(true);
    // Scenario 1's setup shuffles Longshot into the encounter deck (insert p. 9) from the composed set-aside card.
    expect(cardsIn(state, ["39071"])).toBe(true);
    expect(Object.values(state.instances).filter((i) => (i.cardId as string) === "39071")).toHaveLength(1);
  });

  test("issues #2 and #3 build Spiral and Mojo with the log's picks", async () => {
    const svc = service();
    let record = await svc.start({ campaignId: "mojo", seats: SEATS, poolVersion: POOL_VERSION, seed: 12 });
    record = (await composeIssue(svc, record)).record;
    record = await win(svc, record, "magog");
    expect(record.position.nextNodeId).toBe("spiral");

    const second = await composeIssue(svc, record);
    const spiralPicks = [...mojoModularSetPicks(second.record)];
    expect(spiralPicks).toHaveLength(3);
    expect(new Set(spiralPicks).size).toBe(3);
    expect(spiralPicks).not.toContain("crime");
    const spiral = await start(second.record);
    expect(svc.launchConfig(second.record).scenarioId).toBe("spiral");
    expect(svc.launchConfig(second.record).modularSetIds).toEqual(spiralPicks);
    expect(cardsIn(spiral, cardsOfComposedSets(POOL_CARDS, spiralPicks) as string[])).toBe(true);

    record = await win(svc, second.record, "spiral");
    expect(record.position.nextNodeId).toBe("mojo");
    const third = await composeIssue(svc, record);
    const mojoPicks = [...mojoModularSetPicks(third.record)];
    expect(mojoPicks).toHaveLength(3);
    const config = svc.launchConfig(third.record);
    expect(config.scenarioId).toBe("mojo");
    expect(config.setAsideModularSetIds).toEqual(mojoPicks);
    expect(config.modularSetIds).toBeUndefined();
    const mojo = await start(third.record);
    // 1B shuffles one of the set-aside sets in at setup: the rest are still set aside, and all are the log's picks.
    expect(setsOf(mojo)).toHaveLength(mojoPicks.length - 1);
    for (const set of setsOf(mojo)) expect(mojoPicks).toContain(set);
    expect(cardsIn(mojo, cardsOfComposedSets(POOL_CARDS, mojoPicks) as string[])).toBe(true);
    expect(Object.values(mojo.instances).filter((i) => (i.cardId as string) === "39071")).toHaveLength(1);
  });
});
