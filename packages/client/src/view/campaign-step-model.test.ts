/**
 * `campaign-step-model.ts` against MC10's real definition — composing Crossbones, forcing a win (the same
 * "force the outcome" technique `@mc/cards`'s `trors.test.ts` documents and uses, so a full greedy-AI playthrough
 * isn't needed just to prove this module's wiring), folding the result, then proving the composed `SessionConfig`
 * actually reaches `EngineSessionCore` the way design §7/§10.1 describes — a real `GameState.campaign` on the
 * other side, not just a plausible-looking object.
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
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
} from "@mc/engine";
import { TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { TRORS_STARTER_DECKS } from "@mc/content";
import { buildScenario, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { EngineSessionCore } from "../engine/session-core.js";
import {
  campaignLaunchConfig,
  campaignPostGameFold,
  campaignStepView,
  type CampaignStepView,
} from "./campaign-step-model.js";

/**
 * `createGame(scenarioFor(config), deps)`, `session-core.ts`'s own composition, copied rather than reached into
 * private module state: `campaign` is attached after `buildScenario` runs, never threaded through its options
 * (`scenarioFor`'s own doc comment explains why), so a test building a real game from a `SessionConfig` has to do
 * the same attach.
 */
const createCampaignGame = (config: SessionConfig) => {
  const setup = buildScenario(config.scenarioId, {
    difficulty: config.difficulty,
    players: config.players,
    seed: config.seed,
    ...(config.modes ? { modes: config.modes } : {}),
  });
  return createGame(config.campaign ? { ...setup, campaign: config.campaign } : setup, POOL_DEPS);
};

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

/** The re-entry loop `@mc/cards`'s `trors.test.ts` uses, copied rather than reinvented. */
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
    id: "step-model-test",
    seats: SEATS,
    modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
    poolVersion: "step-model-test",
    seed: 4242,
  });

describe("campaignLaunchConfig: MC10's real definition", () => {
  it("Crossbones needs no answers to compose (its setup block is empty)", () => {
    const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, freshLog(), DEPS);
    expect(composed.kind).toBe("done");
  });

  it("produces a SessionConfig carrying the composed CampaignGameInput, ready for the existing host path", () => {
    const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, freshLog(), DEPS);
    if (composed.kind !== "done") throw new Error("expected composition to need no answers");

    const config = campaignLaunchConfig(TRORS_CAMPAIGN_DEFINITION, composed.value);
    expect(config.scenarioId).toBe("crossbones");
    expect(config.difficulty).toBe("standard");
    expect(config.players).toEqual([
      { identityCardId: SEATS[0]?.identityCardId, deck: expect.any(Array), aspects: ["leadership"] },
      { identityCardId: SEATS[1]?.identityCardId, deck: expect.any(Array), aspects: ["aggression", "justice"] },
    ]);
    expect(config.campaign?.nodeId).toBe("crossbones");
    expect(config.campaign?.campaignId).toBe(TRORS_CAMPAIGN_DEFINITION.campaignId);
  });

  it("reaches the host through the existing start() path: a real GameState.campaign, and a SaveMeta pointing back at the node", async () => {
    const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, freshLog(), DEPS);
    if (composed.kind !== "done") throw new Error("expected composition to need no answers");
    const config = campaignLaunchConfig(TRORS_CAMPAIGN_DEFINITION, composed.value);

    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    const started = await core.start(config);
    expect(started.snapshot.state.campaign?.nodeId).toBe("crossbones");

    const saved = await storage.latestActive();
    expect(saved?.campaignId).toBe(TRORS_CAMPAIGN_DEFINITION.campaignId as string);
    expect(saved?.campaignNodeId).toBe("crossbones");
  });
});

describe("campaignPostGameFold: MC10's real definition, a real (unplayed) GameState with a forced outcome", () => {
  it("folds a win into the log: Crossbones completed, the campaign advances to Absorbing Man", () => {
    const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, freshLog(), DEPS);
    if (composed.kind !== "done") throw new Error("expected composition to need no answers");
    const config = campaignLaunchConfig(TRORS_CAMPAIGN_DEFINITION, composed.value);

    const setup = createCampaignGame(config);
    if (!setup.ok) throw new Error(`setup failed: ${setup.error.message}`);
    // Forced, not played: `campaignResultOf` only needs `state.outcome` and the event stream so far, exactly the
    // technique `trors.test.ts` uses to prove the victory half without a full greedy-AI playthrough.
    const finished = { ...setup.state, outcome: { result: "win" as const, reason: "villainDefeated" as const } };

    const SCRIPT: readonly CampaignChoiceAnswer[] = [
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 1, picked: ["04155"] },
      { instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 2, picked: ["04156"] },
    ];
    const folded = settle(
      (answers) =>
        campaignPostGameFold(
          TRORS_CAMPAIGN_DEFINITION,
          composed.value,
          finished,
          setup.events,
          { at: 1_700_000_000_000, gameId: "step-model-test-game" },
          DEPS,
          POOL_DEPS,
          answers,
        ),
      SCRIPT,
    );

    expect(folded.position.resolved.crossbones).toBe("completed");
    expect(folded.position.nextNodeId).toBe("absorbing-man");
    expect(folded.history).toHaveLength(1);
    expect(folded.history[0]?.outcome).toBe("won");
  });
});

describe("campaignStepView / campaignStepRows / campaignChoicePrompt", () => {
  it("renders a done result's steps, with each write and choice summarised", () => {
    const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, freshLog(), DEPS);
    const view: CampaignStepView = campaignStepView(composed, (log) => log.attempt?.steps ?? []);
    if (view.kind !== "steps") throw new Error("expected the empty-setup node to compose without a pending choice");
    expect(view.steps).toEqual([
      expect.objectContaining({ instructionId: "mc10.s1.setup.identity", citation: "MC10 p. 5", skipped: null }),
    ]);
  });

  it("renders a pending result as an answerable prompt, options and all", () => {
    const composed = resolveBetweenGames(TRORS_CAMPAIGN_DEFINITION, freshLog(), DEPS);
    if (composed.kind !== "done") throw new Error("expected composition to need no answers");
    const setup = createCampaignGame(campaignLaunchConfig(TRORS_CAMPAIGN_DEFINITION, composed.value));
    if (!setup.ok) throw new Error(`setup failed: ${setup.error.message}`);
    const finished = { ...setup.state, outcome: { result: "win" as const, reason: "villainDefeated" as const } };

    const pending: CampaignRunnerResult<CampaignLog> = campaignPostGameFold(
      TRORS_CAMPAIGN_DEFINITION,
      composed.value,
      finished,
      setup.events,
      { at: 1, gameId: "g" },
      DEPS,
      POOL_DEPS,
      [],
    );
    const view = campaignStepView(pending, (log) => log.history.at(-1)?.steps ?? []);
    expect(view.kind).toBe("pending");
    if (view.kind !== "pending") return;
    expect(view.choice).toMatchObject({ instructionId: "mc10.s1.victory.tech", slot: "tech", seatNumber: 1 });
    expect(view.choice.options).toEqual(expect.arrayContaining(["04155", "04156", "04157", "04158"]));

    // The same choice, rendered directly from the raw `CampaignPendingChoice` `applyCampaignResult` returned.
    const raw: CampaignPendingChoice =
      pending.kind === "pending"
        ? pending.choice
        : (() => {
            throw new Error("expected a pending choice");
          })();
    expect(view.choice).toEqual({
      instructionId: raw.instructionId,
      slot: raw.slot,
      seatNumber: raw.seatNumber,
      text: raw.text,
      citation: raw.citation,
      chooser: raw.chooser,
      options: raw.options,
      count: raw.count,
      optional: raw.optional,
    });
  });
});
