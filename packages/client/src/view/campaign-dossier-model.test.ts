/**
 * `campaign-dossier-model.ts` against MC10's real definition: Crossbones won, its TECH grant readable on the
 * Overview and Heroes tabs, the Log tab's sections and "in force now" tally.
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
import { campaignLaunchConfig, campaignPostGameFold } from "./campaign-step-model.js";
import { campaignDossierHero, campaignDossierLog, campaignDossierOverview } from "./campaign-dossier-model.js";

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
    id: "dossier-model-test",
    seats: SEATS,
    modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
    poolVersion: "dossier-model-test",
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
        { at: 1_700_000_000_000, gameId: "dossier-model-test-game" },
        DEPS,
        POOL_DEPS,
        answers,
      ),
    script,
  );
}

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;
const heroNameOf = (identityCardId: string): string => {
  const card = CARDS_BY_ID.get(identityCardId);
  return card && card.type === "hero_identity" ? card.hero.faceName : identityCardId;
};

describe("campaignDossierOverview / campaignDossierLog / campaignDossierHero", () => {
  const won = winCurrentNode(freshLog(), [
    { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 1, picked: ["04155"] },
    { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 2, picked: ["04156"] },
  ]);
  const record = { ...won, name: "The Rise of Red Skull", box: "MC10" };

  it("overview: seat 1's TECH row reads the real grant; an unearned field carries an honest 'earned in #N' hint", () => {
    const overview = campaignDossierOverview(record, TRORS_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    expect(overview.seats).toHaveLength(2);
    const seat1 = overview.seats.find((seat) => seat.seatNumber === 1)!;
    expect(seat1.heroName).toBeTruthy();
    const tech = seat1.rows.find((row) => row.label === "Tech Upgrade")!;
    expect(tech.empty).toBe(false);
    expect(tech.value).not.toBe("—");
    const condition = seat1.rows.find((row) => row.label === "Basic Upgrade")!;
    expect(condition.empty).toBe(true);
    expect(condition.note).toBe("earned in #2");
  });

  it("world box carries the shared fields as real counted values", () => {
    const overview = campaignDossierOverview(record, TRORS_CAMPAIGN_DEFINITION, heroNameOf, cardName);
    const experimental = overview.world.find((row) => row.id === "experimental")!;
    expect(experimental).toBeDefined();
    expect(experimental.when).toContain("encounter deck");
  });

  it("log: one finished section for Crossbones, WON · 1st try, and a next-issue preview", () => {
    const log = campaignDossierLog(record, TRORS_CAMPAIGN_DEFINITION, cardName);
    expect(log.sections).toHaveLength(1);
    expect(log.sections[0]).toMatchObject({ nodeId: "crossbones", outcomeLabel: "WON · 1st try" });
    expect(log.sections[0]?.entries.length).toBeGreaterThan(0);
    expect(log.next?.nodeId).toBe("absorbing-man");
    expect(log.inForce.find((row) => row.label === "Rewinds")?.value).toBe("0");
  });

  it("heroes: seat 1's campaign card list carries the real granted TECH card", () => {
    const hero = campaignDossierHero(record, TRORS_CAMPAIGN_DEFINITION, 1, (id) => CARDS_BY_ID.get(id));
    expect(hero).not.toBeNull();
    expect(hero?.heroName).toBeTruthy();
    expect(hero?.campaignCards.length).toBeGreaterThan(0);
    expect(hero?.campaignCards[0]?.name).toBeTruthy();
    expect(hero?.issues[0]).toMatchObject({ number: 1, state: "won" });
    expect(hero?.issues[1]).toMatchObject({ number: 2, state: "next" });
    expect(hero?.stats.find((row) => row.label === "Deck")?.value).toMatch(/^\d+ \+ \d+$/);
  });
});
