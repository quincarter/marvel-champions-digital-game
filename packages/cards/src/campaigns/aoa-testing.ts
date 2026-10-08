/**
 * Shared scaffolding for `aoa.test.ts` (Age of Apocalypse's campaign, MC45): Core precon seats, the runner's choice
 * loop, stand-in game results, and a real game built from a composed log the way a client must build it. Not a test
 * file and imported by tests only.
 */
import { CORE_STARTER_DECKS, cardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignChoiceRecord,
  type CampaignDefinition,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { firstLegal, settle, type Picker } from "../testing/harness.js";
import { WAVE8_CARDS, WAVE8_DEPS, wave8Scenario } from "../wave8/index.js";
import { AOA_CAMPAIGN_DEFINITION, AOA_MISSIONS } from "./aoa.js";
import { cardsOfComposedSets } from "./composed-sets.js";

export const DEF = AOA_CAMPAIGN_DEFINITION;
export const DEPS: CampaignDeps = { pool: WAVE8_CARDS };
export const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
export const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };
export const NODES = ["unus", "four-horsemen", "apocalypse", "dark-beast", "en-sabah-nur"] as const;

export function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no Core starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

/** Captain Marvel (Leadership, 12 hit points) and Spider-Man (Justice, 10 hit points), the Core preconstructed decks. */
export const SEATS: readonly CampaignSeatSetup[] = [
  seatFor("core-captain-marvel-leadership", 1),
  seatFor("core-spider-man-justice", 2),
];

export const newLog = (
  modes: PlayModes = STANDARD,
  seed = 4242,
  seats: readonly CampaignSeatSetup[] = SEATS,
  definition: CampaignDefinition = DEF,
): CampaignLog => createCampaignLog(definition, { id: `aoa-${seed}`, seats, modes, poolVersion: "qa-test", seed });

export type Pick = (choice: CampaignPendingChoice) => readonly string[];
/** Declines every optional choice and takes the first option of a required one. */
export const declineAll: Pick = (choice) => (choice.optional ? [] : choice.options.slice(0, choice.count));
/** Takes the first option of every choice, optional or not. */
export const takeFirst: Pick = (choice) => choice.options.slice(0, choice.count);

/** Answers every pending choice with `pick`, recording what was asked. Throws if a step list never settles. */
export function settleBy<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: Pick,
): { readonly value: T; readonly asked: readonly CampaignPendingChoice[] } {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return { value: result.value, asked };
    asked.push(result.choice);
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: pick(result.choice),
    });
  }
  throw new Error("the runner asked for more than 64 choices");
}

export function compose(log: CampaignLog, pick: Pick = declineAll, definition: CampaignDefinition = DEF) {
  const composed = settleBy((answers) => resolveBetweenGames(definition, log, DEPS, log.modes, answers), pick);
  return { log: composed.value, asked: composed.asked, start: startGameFromLog(definition, composed.value) };
}

export function apply(
  composed: CampaignLog,
  result: CampaignGameResult,
  pick: Pick = declineAll,
  definition: CampaignDefinition = DEF,
): { readonly log: CampaignLog; readonly asked: readonly CampaignPendingChoice[] } {
  const done = settleBy(
    (answers) =>
      applyCampaignResult(definition, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    pick,
  );
  return { log: done.value, asked: done.asked };
}

export const optionOf = (log: CampaignLog, field: string): string | undefined => {
  const value = log.shared[field];
  return value?.kind === "choice" && value.option !== "" ? value.option : undefined;
};
export const struckOf = (log: CampaignLog, field: string): readonly string[] => {
  const value = log.shared[field];
  return value?.kind === "strikeList" ? value.struck : [];
};
export const missionOf = (log: CampaignLog): string => optionOf(log, "currentMission") ?? "";
export const overseerOf = (log: CampaignLog): string => optionOf(log, "currentOverseer") ?? "";

/** What a finished game is said to have been (a stand-in: no real game is behind it). */
export interface Outcome {
  readonly won?: boolean;
  /** The mission that started the game in play was defeated during it. */
  readonly missionDefeated?: boolean;
  /** The Overseer is in the victory display. */
  readonly overseerDefeated?: boolean;
  /** Expert campaign: each seat's remaining hit points, by seat number; a seat left out records nothing. */
  readonly hp?: Readonly<Record<number, number>>;
  /** Seats eliminated in a game the others won (expert campaign). */
  readonly sittingOut?: readonly number[];
}

/**
 * The result a finished game of the composed attempt would produce, as `campaignResultOf` derives it: every `record`
 * instruction of the node is answered, the gated ones included (the runner applies only those whose gate holds), so
 * the record for a mission that was not in the game reads "not defeated".
 */
export function resultOf(composed: CampaignLog, outcome: Outcome = {}): CampaignGameResult {
  const nodeId = composed.attempt?.nodeId ?? "";
  const n = NODES.indexOf(nodeId as (typeof NODES)[number]) + 1;
  const mission = missionOf(composed);
  const defeated = outcome.missionDefeated ?? false;
  const flag = (instructionId: string, field: string, value: boolean) => ({
    instructionId,
    write: { field, seatNumber: null, mode: "set" as const, value: { kind: "flag" as const, value } },
  });
  const records =
    n === 5
      ? [flag("mc45.s5.victory.record", "missionDefeated", defeated)]
      : [
          flag(`mc45.s${n}.victory.overseer-record`, "overseerDefeated", outcome.overseerDefeated ?? false),
          ...AOA_MISSIONS.map((row) =>
            flag(`mc45.s${n}.victory.${row.id}.record`, "missionDefeated", defeated && row.name === mission),
          ),
          ...Object.entries(outcome.hp ?? {}).map(([seat, value]) => ({
            instructionId: `mc45.s${n}.victory.hp`,
            write: {
              field: "remainingHp",
              seatNumber: Number(seat),
              mode: "set" as const,
              value: { kind: "number" as const, value },
            },
          })),
        ];
  const won = outcome.won ?? true;
  return {
    nodeId,
    outcome: won ? "won" : "lost",
    records: won ? records : [],
    removedFromCampaign: [],
    logWrites: [],
    expiringGrants: [],
    ...(outcome.sittingOut ? { sittingOut: outcome.sittingOut } : {}),
  };
}

/** Composes the next scenario and finishes it at once with a stand-in result. */
export function playNode(
  log: CampaignLog,
  outcome: Outcome = {},
  picks: { readonly before?: Pick; readonly after?: Pick } = {},
) {
  const composed = compose(log, picks.before);
  const applied = apply(composed.log, resultOf(composed.log, outcome), picks.after);
  return { composed, log: applied.log, asked: applied.asked };
}

/** The trace of one instruction of the composed attempt. */
export const stepOf = (composed: CampaignLog, instructionId: string) =>
  (composed.attempt?.steps ?? []).find((step) => step.instructionId === instructionId);
export const drawOf = (composed: CampaignLog, instructionId: string): CampaignChoiceRecord | undefined =>
  stepOf(composed, instructionId)?.choices[0];

// ---------------------------------------------------------------------------------------------------------------
// Real games
// ---------------------------------------------------------------------------------------------------------------

export interface Built {
  readonly start: ReturnType<typeof startGameFromLog>;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * The real game a composed log starts, built the way a client must: the node's scenario from `wave8Scenario` with the
 * campaign's seats and seed, the composed sets added to the encounter deck (less what the campaign removed), and the
 * campaign input as the game's baseline. The input carries the set-aside cards, the instructions and the scenario
 * rules, so nothing else is passed by hand. Unsettled: parked on the first choice.
 */
export function build(composed: CampaignLog): Built {
  const start = startGameFromLog(DEF, composed);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const removed = composed.removedFromCampaign.map((face) => face.cardId);
  const config = wave8Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: start.modes,
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE8_CARDS, start.encounterSets.deck, removed)],
      campaign: start.input,
    },
    WAVE8_DEPS,
  );
  if (!created.ok) throw new Error(`${start.nodeId}: setup failed: ${created.error.message}`);
  return { start, state: created.state, events: created.events };
}

/** The game settled until `stop`, every choice answered by `pick`. */
export const settled = (state: GameState, stop: (state: GameState) => boolean, pick: Picker = firstLegal): GameState =>
  settle(state, pick, stop, WAVE8_DEPS);
export const firstTurn = (state: GameState, pick: Picker = firstLegal): GameState =>
  settled(state, (s) => s.step.phase === "player", pick);

export const codeOf = (state: GameState, id: InstanceId): string => state.instances[id]!.cardId as string;
export const typeOf = (state: GameState, id: InstanceId): string | undefined =>
  state.cardPool[state.instances[id]!.cardId]?.type;
export const anywhere = (state: GameState, code: string): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => (instance.cardId as string) === code)
    .map((instance) => instance.instanceId);
export const inDeck = (state: GameState, seat: number, code: string): number =>
  (state.players[seat]?.deck ?? []).filter((id) => codeOf(state, id) === code).length;
export const setAsideCodes = (state: GameState): readonly string[] =>
  state.encounterSetAside.map((id) => codeOf(state, id)).sort();

/**
 * Whether the game is parked on the campaign's ally search: a choice among cards of a player's own deck. Every
 * campaign instruction before the search (the mission area, the mission's Setup cell, the carried rows) has resolved
 * by then, and no starting hand has been drawn.
 */
export const atAllySearch = (state: GameState): boolean => {
  const choice = state.pendingChoice;
  if (!choice || choice.prompt.kind !== "chooseCards" || choice.options.length === 0) return false;
  const deck = state.players.find((player) => player.playerId === choice.playerId)?.deck ?? [];
  return choice.options.every((option) => deck.includes(option.optionId as InstanceId));
};

export const card = (code: string) => cardId(code);
