import { MUT_GEN_STARTER_DECKS, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type GameState,
} from "@mc/engine";
import { cardsOfComposedSets } from "../../campaigns/composed-sets.js";
import { MUT_GEN_CAMPAIGN_DEFINITION } from "../../campaigns/mut_gen.js";
import { firstLegal, settle, type Picker } from "../../testing/harness.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../index.js";

/**
 * A real Mutant Genesis campaign game for the campaign-card tests: the definition composes the node's setup (roles, role
 * upgrades, the Future Past deck, the campaign side scheme revealed), then the engine builds the game from that start, as
 * `campaigns/mut_gen.test.ts` composes it and `wave5/sm/campaign/encounter.test.ts` plays it.
 */
const DEF = MUT_GEN_CAMPAIGN_DEFINITION;
const DEPS: CampaignDeps = { pool: WAVE6_CARDS };
export const MUT_GEN_NODES = ["sabretooth", "project-wideawake", "master-mold", "mansion-attack", "magneto"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = MUT_GEN_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no mut_gen starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = [seatFor("colossus-protection", 1), seatFor("shadowcat-aggression", 2)];
const MODES: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const ROLES: Record<number, string> = { 1: "brawler", 2: "defender" };

function settleBy<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
): T {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return result.value;
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: pick(result.choice),
    });
  }
  throw new Error("the runner asked for more than 64 choices");
}
const pickRoles = (choice: CampaignPendingChoice): readonly string[] =>
  choice.slot === "role" ? [ROLES[choice.seatNumber ?? 0] ?? choice.options[0]!] : [];

/** The log composed for its next game: the role choices answered (`ROLES`), the setup instructions applied. */
export const compose = (log: CampaignLog): CampaignLog =>
  settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), pickRoles);

/** The campaign log just before node `nodeIndex`'s game: every earlier scenario won with nothing else recorded. */
export function logBefore(nodeIndex: number, seed = 4242): CampaignLog {
  let log = createCampaignLog(DEF, {
    id: `mut-gen-cards-${seed}`,
    seats: SEATS,
    modes: MODES,
    poolVersion: "test",
    seed,
  });
  for (let index = 0; index < nodeIndex; index++) {
    log = settleBy(
      (answers) =>
        applyCampaignResult(
          DEF,
          compose(log),
          {
            nodeId: MUT_GEN_NODES[index]!,
            outcome: "won",
            records: [],
            removedFromCampaign: [],
            logWrites: [],
            expiringGrants: [],
          },
          { at: index, gameId: `mut-gen-cards-${seed}-${index}` },
          DEPS,
          answers,
        ),
      () => [],
    );
  }
  return log;
}

/** The game node `nodeIndex` starts: set up and settled to the first player phase. */
export function campaignGame(nodeIndex: number, pick: Picker = firstLegal): GameState {
  const state = gameFromComposedLog(compose(logBefore(nodeIndex)), pick);
  if (state.campaign?.nodeId !== MUT_GEN_NODES[nodeIndex])
    throw new Error(`expected ${MUT_GEN_NODES[nodeIndex]}, got ${state.campaign?.nodeId}`);
  return state;
}

/** The game a composed log (`compose`) starts, settled to the first player phase. */
export function gameFromComposedLog(log: CampaignLog, pick: Picker = firstLegal): GameState {
  const start = startGameFromLog(DEF, log);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config = wave6Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: log.modes,
    modularSetIds: [],
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.deck)],
      setAside: [...(config.setAside ?? []), ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.setAside)],
      campaign: start.input,
    },
    WAVE6_DEPS,
  );
  if (!created.ok) throw new Error(`${start.nodeId}: setup failed: ${created.error.message}`);
  return settle(created.state, pick, (state) => state.step.phase === "player", WAVE6_DEPS);
}
