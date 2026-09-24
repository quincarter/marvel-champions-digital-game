/**
 * `campaign-run-model.ts` against MC10's real definition: a fresh run (issue #1 current, the rest sealed) and a
 * run with Crossbones won (issue #1 finished with a real result line, issue #2 current).
 */
import { describe, expect, it } from "vitest";
import {
  campaignChoiceKey,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignLog,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
} from "@mc/engine";
import { GMW_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { TRORS_STARTER_DECKS } from "@mc/content";
import { buildScenario, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import type { SessionConfig } from "../engine/host.js";
import { storyFor } from "../campaign/story.js";
import { CampaignService } from "../campaign/campaign-service.js";
import { seedGmwRun } from "../campaign/dev-fixtures.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { campaignLaunchConfig, campaignPostGameFold } from "./campaign-step-model.js";
import { campaignRunModel } from "./campaign-run-model.js";

const DEPS: CampaignDeps = { pool: POOL_CARDS };
const STARTER_IDS = ["hawkeye-leadership", "spider-woman-aggression-justice"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = TRORS_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no trors starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = STARTER_IDS.map((id, index) => seatFor(id, index + 1));

const createCampaignGame = (config: SessionConfig) => {
  const setup = buildScenario(config.scenarioId, {
    difficulty: config.difficulty,
    players: config.players,
    seed: config.seed,
    ...(config.modes ? { modes: config.modes } : {}),
  });
  return createGame(config.campaign ? { ...setup, campaign: config.campaign } : setup, POOL_DEPS);
};

function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return outcome.value;
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) throw new Error(`no scripted answer for ${campaignChoiceKey(outcome.choice)}`);
    answers.push(found);
  }
  throw new Error("more than 24 choices in one step list");
}

const freshLog = (): CampaignLog =>
  createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
    id: "run-model-test",
    seats: SEATS,
    modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
    poolVersion: "run-model-test",
    seed: 4242,
  });

/** Wins the log's current node, folding the result exactly as `campaignPostGameFold` requires. */
function winCurrentNode(log: CampaignLog, script: readonly CampaignChoiceAnswer[]): CampaignLog {
  const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, log, DEPS);
  if (composed.kind !== "done") throw new Error("expected composition to need no answers");
  const config = campaignLaunchConfig(TRORS_CAMPAIGN_DEFINITION, composed.value);
  const setup = createCampaignGame(config);
  if (!setup.ok) throw new Error(`setup failed: ${setup.error.message}`);
  const finished = { ...setup.state, outcome: { result: "win" as const, reason: "villainDefeated" as const } };
  return settle(
    (answers) =>
      campaignPostGameFold(
        TRORS_CAMPAIGN_DEFINITION,
        composed.value,
        finished,
        setup.events,
        { at: 1_700_000_000_000, gameId: "run-model-test-game" },
        DEPS,
        POOL_DEPS,
        answers,
      ),
    script,
  );
}

const cardName = (id: string): string => id;

describe("campaignRunModel", () => {
  it("a fresh run: issue #1 current with its teaser, the rest sealed", () => {
    const model = campaignRunModel(
      { ...freshLog(), name: "The Rise of Red Skull", box: "MC10" },
      TRORS_CAMPAIGN_DEFINITION,
      storyFor("trors"),
      cardName,
    );
    expect(model.issueNumber).toBe(1);
    expect(model.totalIssues).toBe(5);
    expect(model.finished).toBe(false);
    expect(model.issues).toHaveLength(5);
    const [first, second] = model.issues;
    expect(first).toMatchObject({ nodeId: "crossbones", status: "current" });
    expect(first?.teaser).toBeTruthy();
    expect(second).toMatchObject({ nodeId: "absorbing-man", status: "sealed", villain: null });
  });

  it("after winning Crossbones: issue #1 finished with a real result line, issue #2 current", () => {
    const won = winCurrentNode(freshLog(), [
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 1, picked: ["04155"] },
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 2, picked: ["04156"] },
    ]);
    const model = campaignRunModel(
      { ...won, name: "The Rise of Red Skull", box: "MC10" },
      TRORS_CAMPAIGN_DEFINITION,
      storyFor("trors"),
      cardName,
    );
    expect(model.issueNumber).toBe(2);
    const [first, second] = model.issues;
    expect(first?.status).toBe("finished");
    expect(first?.won).toBe(true);
    expect(first?.resultLine).toMatch(/^Won/);
    expect(second?.status).toBe("current");
  });

  it("GMW's units field pluralizes by count: '1 unit', never '1 units'", async () => {
    const service = new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
      engineDeps: POOL_DEPS,
    });
    const record = await seedGmwRun(service, "afterIssue1");
    const model = campaignRunModel(
      { ...record, name: "Galaxy's Most Wanted", box: "MC16" },
      GMW_CAMPAIGN_DEFINITION,
      storyFor("gmw"),
      cardName,
    );
    const first = model.issues[0];
    expect(first?.status).toBe("finished");
    // Never "1 units" — singular count reads as singular noun.
    expect(first?.resultLine).not.toMatch(/\b1 units\b/);
    expect(first?.resultLine).toMatch(/\bunits?\b/);
  });

  it("GMW's page-based issues carry their own comic-page crop; MC10's plain columns carry none", async () => {
    const service = new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
      engineDeps: POOL_DEPS,
    });
    const record = await seedGmwRun(service, "afterIssue2");
    const model = campaignRunModel(
      { ...record, name: "Galaxy's Most Wanted", box: "MC16" },
      GMW_CAMPAIGN_DEFINITION,
      storyFor("gmw"),
      cardName,
    );
    // Issue #2 and #3 split one page (02-museum): #2 (finished) crops to its own beats, #3 (current) to the rest,
    // and #3's crop lands on that page's own last beat, so it reads "last panel" rather than a mid-page number.
    const [, second, third] = model.issues;
    expect(second?.status).toBe("finished");
    expect(second?.pageCrop?.file).toBe("02-museum");
    expect(third?.status).toBe("current");
    expect(third?.pageCrop?.file).toBe("02-museum");
    expect(third?.pageCrop?.rect).not.toEqual(second?.pageCrop?.rect);
    expect(third?.pageProgressLine).toBe("Up next · page 2, last panel");
    expect(third?.teaser).toBeNull();
    expect(third?.blurb).toBeNull();

    const trorsModel = campaignRunModel(
      { ...freshLog(), name: "The Rise of Red Skull", box: "MC10" },
      TRORS_CAMPAIGN_DEFINITION,
      storyFor("trors"),
      cardName,
    );
    for (const issue of trorsModel.issues) expect(issue.pageCrop).toBeNull();
  });
});
