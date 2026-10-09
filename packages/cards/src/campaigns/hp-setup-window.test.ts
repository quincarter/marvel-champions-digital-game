/**
 * Ruling June 2, 2026 (3) #2 (the GMW Collector II case, `gmw.qa.test.ts`): the expert campaign's "set each player's
 * hit points to their recorded value" is a hard set, so it has to run before the scenario's own setup damage or it
 * erases that damage. The same instruction in The Rise of Red Skull (`trors.ts`, two sites) and The Mad Titan's
 * Shadow (`mts.ts`) used to run at the default `afterScenarioSetup` window.
 *
 * Neither box prints a setup-damage source on an identity (surveyed in `mts.qa.test.ts` and in the handoff for this
 * fix), so each test injects a stand-in through `everyNodeSetup`: a campaign instruction at `afterScenarioSetup`, the
 * window scenario setup itself resolves in, that deals 2 damage to every identity. The real game must then show
 * `max - recordedHp + 2`: the carried-over hit points and the setup damage compose.
 */
import { describe, expect, it } from "vitest";
import { MTS_STARTER_DECKS, TRORS_STARTER_DECKS, WAVE2_CARDS, type PlayModes } from "@mc/content";
import {
  createCampaignLog,
  createGame,
  getInstance,
  maxHitPoints,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDefinition,
  type CampaignDeps,
  type CampaignInstruction,
  type CampaignLog,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type GameState,
  applyCampaignResult,
} from "@mc/engine";
import { dealDamage, eachPlayer, forEachPlayer, identityOf, thatPlayer } from "../dsl/index.js";
import { firstLegal, settle as settleGame, type Picker } from "../testing/harness.js";
import { WAVE2_DEPS, wave2Scenario } from "../wave2/index.js";
import { WAVE4_CARDS, WAVE4_DEPS } from "../wave4/index.js";
import { wave4Scenario } from "../wave4/setup.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { MTS_CAMPAIGN_DEFINITION } from "./mts.js";
import { TRORS_CAMPAIGN_DEFINITION } from "./trors.js";

const SETUP_DAMAGE = 2;
const RECORDED_HP = 5;

/** MTS's optional "Heal to full" (acceleration token) comes next; decline it so the hit points under test stand. */
const declineHeal: Picker = (state) => {
  const decline = state.pendingChoice?.options.find((o) => o.label === "Decline");
  return decline ? [decline.optionId] : firstLegal(state);
};

const setupDamage: CampaignInstruction = {
  id: "test.setup-damage",
  text: "(Test only: damage an identity during scenario setup.)",
  citation: "test",
  step: {
    kind: "inGame",
    window: "afterScenarioSetup",
    effects: [forEachPlayer(eachPlayer, dealDamage(SETUP_DAMAGE, identityOf(thatPlayer)))],
  },
};

function withSetupDamage(def: CampaignDefinition): CampaignDefinition {
  return { ...def, everyNodeSetup: [...(def.everyNodeSetup ?? []), setupDamage] };
}

/** Runs a campaign step list, answering every choice with the first legal pick (none for an optional one). */
function settleCampaign<T>(step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 40; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return outcome.value;
    const { instructionId, slot, seatNumber, optional, options, count } = outcome.choice;
    answers.push({ instructionId, slot, seatNumber, picked: optional ? [] : options.slice(0, count) });
  }
  throw new Error("the campaign runner kept asking questions");
}

/** A log at `targetNode` (every earlier node recorded as won) with `RECORDED_HP` carried for every seat. */
function logAt(
  def: CampaignDefinition,
  deps: CampaignDeps,
  seats: readonly CampaignSeatSetup[],
  modes: PlayModes,
  nodeOrder: readonly string[],
  targetNode: string,
): CampaignLog {
  let log = createCampaignLog(def, { id: `hp-window-${targetNode}`, seats, modes, poolVersion: "qa-test", seed: 4242 });
  for (const nodeId of nodeOrder) {
    if (nodeId === targetNode) break;
    const composed = settleCampaign((answers) => resolveBetweenGames(def, log, deps, log.modes, answers));
    log = settleCampaign((answers) =>
      applyCampaignResult(
        def,
        composed,
        { nodeId, outcome: "won", records: [], removedFromCampaign: [], logWrites: [], expiringGrants: [] },
        { at: 1 },
        deps,
        answers,
      ),
    );
  }
  return {
    ...log,
    seats: log.seats.map((seat) => ({
      ...seat,
      fields: { ...seat.fields, remainingHp: { kind: "number", value: RECORDED_HP } },
    })),
  };
}

function expectComposed(state: GameState, deps: typeof WAVE2_DEPS | typeof WAVE4_DEPS): void {
  expect(state.players.length).toBeGreaterThan(0);
  for (const player of state.players) {
    const id = player.identity.instanceId;
    const max = maxHitPoints(state, id, deps);
    if (max === undefined) throw new Error("identity has no hit point dial");
    expect(getInstance(state, id)?.damage).toBe(max - RECORDED_HP + SETUP_DAMAGE);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The Rise of Red Skull
// ---------------------------------------------------------------------------------------------------------------

const TRORS_DEF = withSetupDamage(TRORS_CAMPAIGN_DEFINITION);
const TRORS_EXPERT: PlayModes = { campaign: { campaignId: TRORS_DEF.campaignId, expertCampaign: true } };
const TRORS_STARTERS = ["hawkeye-leadership", "spider-woman-aggression-justice"] as const;
const TRORS_SEATS: readonly CampaignSeatSetup[] = TRORS_STARTERS.map((id, index) => {
  const starter = TRORS_STARTER_DECKS.find((deck) => (deck.id as string) === id);
  if (!starter) throw new Error(`no trors starter deck ${id}`);
  return {
    seatNumber: index + 1,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
});
const TRORS_ORDER = ["crossbones", "absorbing-man", "taskmaster", "zola", "red-skull"];

function trorsGameAt(nodeId: string): GameState {
  const deps: CampaignDeps = { pool: WAVE2_CARDS };
  const log = logAt(TRORS_DEF, deps, TRORS_SEATS, TRORS_EXPERT, TRORS_ORDER, nodeId);
  const composed = settleCampaign((answers) => resolveBetweenGames(TRORS_DEF, log, deps, log.modes, answers));
  const start = startGameFromLog(TRORS_DEF, composed);
  if (start.nodeId !== nodeId || !start.scenarioId) throw new Error(`expected ${nodeId}, got ${start.nodeId}`);
  const config = wave2Scenario(start.scenarioId as string, {
    players: TRORS_STARTERS.map((starterDeckId) => ({ starterDeckId })),
    seed: start.input.seed,
    modes: start.modes,
  });
  const created = createGame({ ...config, campaign: start.input }, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settleGame(created.state, firstLegal, (s) => s.step.phase === "player", WAVE2_DEPS);
}

describe("TRORS expert campaign: carried-over hit points compose with damage dealt during setup", () => {
  it("repeatedSetup's hp-set (scenarios 2-4, trors.ts:240): Absorbing Man", () => {
    expectComposed(trorsGameAt("absorbing-man"), WAVE2_DEPS);
  });

  it("scenario 5's own mc10.s5.setup.hp (trors.ts:754): Red Skull", () => {
    expectComposed(trorsGameAt("red-skull"), WAVE2_DEPS);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The Mad Titan's Shadow
// ---------------------------------------------------------------------------------------------------------------

const MTS_DEF = withSetupDamage(MTS_CAMPAIGN_DEFINITION);
const MTS_EXPERT: PlayModes = { campaign: { campaignId: MTS_DEF.campaignId, expertCampaign: true } };
const MTS_SEATS: readonly CampaignSeatSetup[] = ["spectrum-leadership", "adam-warlock-all-aspects"].map((id, index) => {
  const starter = MTS_STARTER_DECKS.find((deck) => (deck.id as string) === id);
  if (!starter) throw new Error(`no mts starter deck ${id}`);
  return {
    seatNumber: index + 1,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
});
const MTS_ORDER = ["ebony-maw", "tower-defense", "thanos", "hela", "loki"];

function mtsGameAt(nodeId: string): GameState {
  const deps: CampaignDeps = { pool: WAVE4_CARDS };
  const log = logAt(MTS_DEF, deps, MTS_SEATS, MTS_EXPERT, MTS_ORDER, nodeId);
  const composed = settleCampaign((answers) => resolveBetweenGames(MTS_DEF, log, deps, log.modes, answers));
  const start = startGameFromLog(MTS_DEF, composed);
  if (start.nodeId !== nodeId || !start.scenarioId) throw new Error(`expected ${nodeId}, got ${start.nodeId}`);
  const config = wave4Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: log.modes,
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE4_CARDS, start.encounterSets.deck)],
      setAside: [...(config.setAside ?? []), ...cardsOfComposedSets(WAVE4_CARDS, start.encounterSets.setAside)],
      campaign: start.input,
    },
    WAVE4_DEPS,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settleGame(created.state, declineHeal, (s) => s.step.phase === "player", WAVE4_DEPS);
}

describe("MTS expert campaign: carried-over hit points compose with damage dealt during setup", () => {
  it("hpSet (mts.ts:146): Thanos (the optional heal is declined)", () => {
    expectComposed(mtsGameAt("thanos"), WAVE4_DEPS);
  });
});
