/**
 * Shared scaffolding for `shadowland.test.ts` (Shadowland's campaign): seats, the runner's choice loop, a real game
 * built
 * from a composed log the way a client builds it, and the state surgery the tests stage games with (each helper says
 * what it changes). Not a test file and imported by tests only.
 */
import { CORE_STARTER_DECKS, WAVE11_STARTER_DECKS, cardId, type CardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignResultOf,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { firstLegal, settle } from "../testing/harness.js";
import { WAVE11_CARDS, WAVE11_DEPS } from "../wave11/index.js";
import { wave11Scenario } from "../wave11/setup.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { SHADOWLAND_CAMPAIGN_DEFINITION as DEF } from "./shadowland.js";

export const SL_DEF = DEF;
export const DEPS: CampaignDeps = { pool: WAVE11_CARDS };
export const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
export const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };

export const NODES = ["shadows-in-the-night", "shadow-labyrinth", "heart-of-shadow"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = [...CORE_STARTER_DECKS, ...WAVE11_STARTER_DECKS].find(
    (deck) => (deck.id as string) === starterDeckId,
  );
  if (!starter) throw new Error(`no starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

/** Spider-Man (Justice) and Captain Marvel (Leadership): the Core preconstructed decks the other box tests use. */
export const SEATS: readonly CampaignSeatSetup[] = [
  seatFor("core-spider-man-justice", 1),
  seatFor("core-captain-marvel-leadership", 2),
];
export const SOLO_SEATS: readonly CampaignSeatSetup[] = [SEATS[0]!];
/** Fear No Evil's Daredevil (60001a), whose name the campaign matches (MC65 p. 9). */
export const DAREDEVIL_SEAT: CampaignSeatSetup = seatFor("fne-daredevil-justice", 1);

export function newLog(modes: PlayModes, seats: readonly CampaignSeatSetup[] = SEATS, seed = 4242): CampaignLog {
  return createCampaignLog(DEF, { id: `shadowland-${seed}`, seats, modes, poolVersion: "qa-test", seed });
}

/** Answers every pending choice with `pick`, recording what was asked. Throws if a step list never settles. */
export function settleBy<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
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

/** The default between-games answers: every optional choice declined. */
export const declineAll = (): readonly string[] => [];

export function compose(
  log: CampaignLog,
  pick: (choice: CampaignPendingChoice) => readonly string[] = declineAll,
  deps: CampaignDeps = DEPS,
) {
  const composed = settleBy((answers) => resolveBetweenGames(DEF, log, deps, log.modes, answers), pick);
  return { log: composed.value, asked: composed.asked, start: startGameFromLog(DEF, composed.value) };
}

export function finish(
  composed: CampaignLog,
  result: CampaignGameResult,
  pick: (choice: CampaignPendingChoice) => readonly string[] = declineAll,
): { readonly log: CampaignLog; readonly asked: readonly CampaignPendingChoice[] } {
  const done = settleBy(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    pick,
  );
  return { log: done.value, asked: done.asked };
}

export const sharedField = (log: CampaignLog, id: string) => log.shared[id];
export const seatField = (log: CampaignLog, seatIndex: number, id: string) => log.seats[seatIndex]?.fields[id];
export const listOf = (log: CampaignLog, id: string): readonly string[] => {
  const value = log.shared[id];
  return value?.kind === "cardList" ? (value.cardIds as readonly string[]) : [];
};
export const seatListOf = (log: CampaignLog, seatIndex: number, id: string): readonly string[] => {
  const value = seatField(log, seatIndex, id);
  return value?.kind === "cardList" ? (value.cardIds as readonly string[]) : [];
};

// ---------------------------------------------------------------------------------------------------------------
// Real games
// ---------------------------------------------------------------------------------------------------------------

export interface Built {
  readonly start: ReturnType<typeof startGameFromLog>;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface BuildOptions {
  /** Cards added to a seat's deck (index 0 = seat 1) on top of its precon, so a staged game has the card it needs. */
  readonly extraDeckCards?: readonly (readonly string[])[];
  /** The same game with no campaign input and no composed cards: what the scenario alone sets up (the control). */
  readonly control?: true;
}

/**
 * The real game a composed log starts, built the way a client builds it (unsettled): the villain the campaign drew is
 * the
 * builder's `villainCardId`, the composed sets (Black Flower less 72A, the minions) are added to `encounterDeck` and
 * `setAside`, and the campaign input is the game's baseline.
 */
export function build(composed: CampaignLog, options: BuildOptions = {}): Built {
  const start = startGameFromLog(DEF, composed);
  const removedCardIds = composed.removedFromCampaign.map((face) => face.cardId);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config = wave11Scenario(start.scenarioId, {
    players: start.input.seats.map((seat, index) => ({
      identityCardId: seat.identityCardId,
      deck: [...seat.deck, ...(options.extraDeckCards?.[index] ?? []).map((code) => cardId(code))],
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: composed.modes,
    ...(start.villain ? { villainCardId: start.villain } : {}),
    // Scenario 1 and 2 recommend Ninja Swarm; Black Flower is never a campaign pick (MC65 p. 5).
    modularSetIds: ["ninja_swarm"],
  });
  if (options.control) {
    const control = createGame(config, WAVE11_DEPS);
    if (!control.ok) throw new Error(`${start.nodeId}: control setup failed: ${control.error.message}`);
    return { start, state: control.state, events: control.events };
  }
  const created = createGame(
    {
      ...config,
      encounterDeck: [
        ...config.encounterDeck,
        ...cardsOfComposedSets(WAVE11_CARDS, start.encounterSets.deck, removedCardIds),
      ],
      setAside: [
        ...(config.setAside ?? []),
        ...cardsOfComposedSets(WAVE11_CARDS, start.encounterSets.setAside, removedCardIds),
      ],
      campaign: start.input,
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(`${start.nodeId}: setup failed: ${created.error.message}`);
  return { start, state: created.state, events: created.events };
}

/** The game settled to the first player phase, every choice answered by `pick`. */
export const settledStart = (
  composed: CampaignLog,
  pick: Parameters<typeof settle>[1] = firstLegal,
  options: BuildOptions = {},
): GameState => settle(build(composed, options).state, pick, (state) => state.step.phase === "player", WAVE11_DEPS);

export const inst = (state: GameState, id: InstanceId) => state.instances[id]!;
export const codeOf = (state: GameState, id: InstanceId): string => inst(state, id).cardId as string;
export const anywhere = (state: GameState, code: string): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => (instance.cardId as string) === code)
    .map((instance) => instance.instanceId);
/** Every card a seat controls in play (its play area and what is attached to its identity), as printed ids. */
export const controlledBy = (state: GameState, seat: number): readonly string[] => {
  const player = state.players[seat]!;
  const attached = inst(state, player.identity.instanceId).attachments;
  return [...player.playArea, ...attached].map((id) => codeOf(state, id));
};

/**
 * State surgery: puts the first copy of `code` (from the player's deck, hand or discard pile) into play under their
 * control, a support in the play area and an upgrade attached to their identity. No cost is paid and nothing triggers.
 * `as` re-prints that instance as another card of the pool first.
 */
export function intoPlay(state: GameState, player: PlayerId, code: string, as: string = code): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const id = [...owner.deck, ...owner.hand, ...owner.discard].find((candidate) => codeOf(state, candidate) === code);
  if (!id) throw new Error(`${player} has no ${code} to put into play`);
  const card = WAVE11_CARDS.find((candidate) => (candidate.id as string) === as)!;
  const strip = (zone: readonly InstanceId[]) => zone.filter((candidate) => candidate !== id);
  const identity = owner.identity.instanceId;
  const upgrade = card.type === "upgrade";
  return {
    ...state,
    instances: {
      ...state.instances,
      [id]: {
        ...inst(state, id),
        cardId: card.id,
        controllerId: player,
        faceup: true,
        attachedTo: upgrade ? identity : null,
      },
      ...(upgrade
        ? { [identity]: { ...inst(state, identity), attachments: [...inst(state, identity).attachments, id] } }
        : {}),
    },
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: strip(p.deck),
            hand: strip(p.hand),
            discard: strip(p.discard),
            playArea: upgrade ? p.playArea : [...p.playArea, id],
          }
        : p,
    ),
  };
}

/** The final state with its outcome overridden to a win (`trors.qa.test.ts`'s documented substitution). */
export const asWin = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((player) => ({ ...player, eliminated: false })),
  outcome: { result: "win", reason: "villainDefeated" },
});
export const asLoss = (state: GameState): GameState =>
  state.outcome?.result === "loss" ? state : { ...state, outcome: { result: "loss", reason: "allPlayersDefeated" } };

/** What `campaignResultOf` derives from a finished state of the composed game, for `finish`. */
export const resultOf = (composed: CampaignLog, state: GameState, events: readonly GameEvent[] = []) =>
  campaignResultOf(DEF, composed, state, events, WAVE11_DEPS);

export type { CardId };
