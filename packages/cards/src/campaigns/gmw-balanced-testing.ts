/**
 * Test helpers for the Balanced house rule (issue #609): a real game built from a composed campaign log, the way the
 * client builds one, with the hidden Balanced flags seeded at campaign start.
 */
import { CORE_STARTER_DECKS, GMW_STARTER_DECKS, WAVE3_CARDS, type PlayModes } from "@mc/content";
import {
  activeEncounterDeck,
  mainSchemeValue,
  campaignChoiceKey,
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
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type LogValue,
} from "@mc/engine";
import { settle, firstLegal, type Picker } from "../testing/harness.js";
import { WAVE3_DEPS, wave3Scenario } from "../wave3/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { GMW_CAMPAIGN_DEFINITION } from "./gmw.js";
import { gmwBalancedHiddenFields, type GmwBalancedToggleId } from "./gmw-balanced.js";

export const CAMPAIGN_ID = GMW_CAMPAIGN_DEFINITION.campaignId;
export const DEPS: CampaignDeps = { pool: WAVE3_CARDS };

/** Seats 1 and 2 are the box's own heroes; seats 3 and 4 (a unique hero cannot repeat) are Core starters. */
export const STARTERS = [
  "groot-protection",
  "rocket-raccoon-aggression",
  "core-spider-man-justice",
  "core-captain-marvel-leadership",
] as const;

export function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = [...GMW_STARTER_DECKS, ...CORE_STARTER_DECKS].find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no gmw starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

export const seats = (count: number): readonly CampaignSeatSetup[] =>
  STARTERS.slice(0, count).map((id, index) => seatFor(id, index + 1));

export interface RunChoice {
  readonly balanced: boolean;
  readonly toggles?: readonly GmwBalancedToggleId[];
  readonly expert?: boolean;
  readonly expertCampaign?: boolean;
}

export const modesOf = (choice: RunChoice): PlayModes => ({
  ...(choice.expert ? { expert: true } : {}),
  campaign: {
    campaignId: CAMPAIGN_ID,
    ...(choice.expertCampaign ? { expertCampaign: true as const } : {}),
    ...(choice.balanced ? { balanced: true as const } : {}),
  },
});

/** A fresh log positioned on `nodeId`, seeded the way the client seeds a run, with `units` for every seat. */
export function logAt(nodeId: string, choice: RunChoice, seatCount: number, units = 0, seed = 4242): CampaignLog {
  const hiddenFields = gmwBalancedHiddenFields({
    enabled: choice.balanced,
    ...(choice.toggles ? { toggles: choice.toggles } : {}),
  });
  const fresh = createCampaignLog(GMW_CAMPAIGN_DEFINITION, {
    id: `balanced-${nodeId}`,
    seats: seats(seatCount),
    modes: modesOf(choice),
    poolVersion: "balanced-test",
    seed,
    ...(Object.keys(hiddenFields).length > 0 ? { hiddenFields } : {}),
  });
  const withUnits: Record<string, LogValue> = units > 0 ? { units: { kind: "number", value: units } } : {};
  return {
    ...fresh,
    position: { ...fresh.position, nextNodeId: nodeId },
    seats: fresh.seats.map((seat) => ({ ...seat, fields: { ...seat.fields, ...withUnits } })),
  };
}

export const answer = (
  instructionId: string,
  slot: string,
  seatNumber: number | null,
  picked: readonly string[],
): CampaignChoiceAnswer => ({ instructionId, slot, seatNumber, picked });

export interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

/** Answers every choice from `script`; one not in the script is declined (`[]`) when allowed, else an error. */
export function settleCampaign<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[],
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 400; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      if (outcome.choice.optional || outcome.choice.options.length === 0) {
        asked.push(outcome.choice);
        answers.push({ ...outcome.choice, picked: [] });
        continue;
      }
      throw new Error(
        `no scripted answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 400 choices");
}

export interface BuiltGame {
  readonly state: GameState;
  readonly composed: Settled<CampaignLog>;
  readonly config: GameSetupConfig;
}

/** Composes `nodeId` from `log` and creates the real game, settled to the first player phase. */
export function buildGame(
  log: CampaignLog,
  choice: RunChoice,
  seatCount: number,
  script: readonly CampaignChoiceAnswer[] = [],
  pick: Picker = firstLegal,
  stopAt: (state: GameState) => boolean = (s) => s.step.phase === "player",
): BuiltGame {
  const modes = modesOf(choice);
  const composed = settleCampaign(
    (answers) => resolveBetweenGames(GMW_CAMPAIGN_DEFINITION, log, DEPS, modes, answers),
    script,
  );
  const start = startGameFromLog(GMW_CAMPAIGN_DEFINITION, composed.value);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config: GameSetupConfig = wave3Scenario(start.scenarioId as string, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes,
  });
  const withSets: GameSetupConfig = {
    ...config,
    encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE3_CARDS, start.encounterSets.deck)],
    setAside: [...config.setAside!, ...cardsOfComposedSets(WAVE3_CARDS, start.encounterSets.setAside)],
  };
  const created = createGame({ ...withSets, campaign: start.input }, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return {
    state: settle(created.state, pick, stopAt, WAVE3_DEPS),
    composed,
    config: withSets,
  };
}

// --- readers the per-scenario test files share ----------------------------------------------------------------
export const cardIdOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;
export const deckCards = (state: GameState): readonly string[] =>
  activeEncounterDeck(state).deck.map((id) => cardIdOf(state, id));
export const countOf = (cards: readonly string[], code: string): number => cards.filter((c) => c === code).length;

/** The main scheme's three values at both stages the scenario has, read as the rules read them. */
export function schemeValues(state: GameState) {
  return [0, 1].map((stageIndex) => {
    const staged = { ...state, mainScheme: { ...state.mainScheme, stageIndex } };
    return {
      acceleration: mainSchemeValue(staged, "acceleration", WAVE3_DEPS),
      startingThreat: mainSchemeValue(staged, "startingThreat", WAVE3_DEPS),
      targetThreat: mainSchemeValue(staged, "targetThreat", WAVE3_DEPS),
    };
  });
}
