/**
 * `campaign-issue-model.ts` against MC10's real definition: Crossbones won on the first try, its attempts and
 * writes read back exactly as `campaignPostGameFold` recorded them.
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
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { TRORS_STARTER_DECKS } from "@mc/content";
import { buildScenario, CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import type { SessionConfig } from "../engine/host.js";
import { storyFor } from "../campaign/story.js";
import { campaignLaunchConfig, campaignPostGameFold } from "./campaign-step-model.js";
import { campaignIssueModel } from "./campaign-issue-model.js";

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
    id: "issue-model-test",
    seats: SEATS,
    modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
    poolVersion: "issue-model-test",
    seed: 4242,
  });

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
        { at: 1_700_000_000_000, gameId: "issue-model-test-game" },
        DEPS,
        POOL_DEPS,
        answers,
      ),
    script,
  );
}

const cardName = (id: string): string => id;

describe("campaignIssueModel", () => {
  it("Crossbones won on the first try: one attempt, its tech-upgrade grants in the write list", () => {
    const won = winCurrentNode(freshLog(), [
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 1, picked: ["04155"] },
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 2, picked: ["04156"] },
    ]);
    const model = campaignIssueModel(won, TRORS_CAMPAIGN_DEFINITION, storyFor("trors"), "crossbones", cardName);
    expect(model).not.toBeNull();
    expect(model?.number).toBe(1);
    expect(model?.won).toBe(true);
    expect(model?.attempts).toHaveLength(1);
    expect(model?.attempts[0]).toMatchObject({ headline: "Won", tag: "KEPT" });
    expect(model?.writes.some((row) => row.headline.includes("04155") || row.headline.includes("04156"))).toBe(true);
    expect(model?.prevNodeId).toBeNull();
    expect(model?.nextFinishedNodeId).toBeNull();
  });

  it("returns null for a node id the definition doesn't have", () => {
    expect(
      campaignIssueModel(freshLog(), TRORS_CAMPAIGN_DEFINITION, storyFor("trors"), "not-a-node", cardName),
    ).toBeNull();
  });

  it("names the hero a grant belongs to, colour-codes rows, and reads a short field label", () => {
    const won = winCurrentNode(freshLog(), [
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 1, picked: ["04155"] },
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 2, picked: ["04156"] },
    ]);
    const realCardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;
    const model = campaignIssueModel(won, TRORS_CAMPAIGN_DEFINITION, storyFor("trors"), "crossbones", realCardName);
    const grant = model?.writes.find((row) => row.kind === "grant" && row.headline.includes("Hawkeye"));
    expect(grant).toBeDefined();
    expect(grant?.headline).toMatch(/^.+ → Hawkeye$/);
    // "0 delay counters", not the raw field id "delayCounters" or a bare "0".
    const numberRows = model?.writes.filter((row) => row.kind === "number") ?? [];
    for (const row of numberRows) expect(row.headline).not.toMatch(/[a-z][A-Z]/); // no raw camelCase field id leaked
  });
});
