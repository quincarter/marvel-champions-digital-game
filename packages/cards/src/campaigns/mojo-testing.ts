/**
 * Shared scaffolding for `mojo.test.ts` and `mojo.qa.test.ts` (MojoMania's campaign): Core precon seats, the runner's
 * choice loop, a real game built from a composed log, and the state surgery the tests stage games with (each helper says
 * what it changes). Not a test file and imported by tests only.
 */
import { CORE_STARTER_DECKS, PLAYABLE_CARDS, cardId, type CardId, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
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
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../wave6/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { MOJO_CAMPAIGN_DEFINITION as DEF, mojoModularSetPicks } from "./mojo.js";

export const MOJO_DEF = DEF;
export const DEPS: CampaignDeps = { pool: WAVE6_CARDS };
export const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
export const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no Core starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

/** Spider-Man (Justice) and Captain Marvel (Leadership), the Core preconstructed decks the other box tests use. */
export const SEATS: readonly CampaignSeatSetup[] = [
  seatFor("core-spider-man-justice", 1),
  seatFor("core-captain-marvel-leadership", 2),
];
export const SOLO_SEATS: readonly CampaignSeatSetup[] = [SEATS[0]!];

export function newLog(modes: PlayModes, seats: readonly CampaignSeatSetup[] = SEATS, seed = 4242): CampaignLog {
  return createCampaignLog(DEF, { id: `mojo-${seed}`, seats, modes, poolVersion: "qa-test", seed });
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

/** The default between-games answers: the first options of every modular set pick, every optional choice declined. */
export const firstSets = (choice: CampaignPendingChoice): readonly string[] =>
  /^(set|checked)\d$/.test(choice.slot) ? [choice.options[0]!] : [];

export function compose(log: CampaignLog, pick: (choice: CampaignPendingChoice) => readonly string[] = firstSets) {
  const composed = settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), pick);
  return { log: composed.value, asked: composed.asked, start: startGameFromLog(DEF, composed.value) };
}

export function finish(
  composed: CampaignLog,
  result: CampaignGameResult,
  pick: (choice: CampaignPendingChoice) => readonly string[] = () => [],
): { readonly log: CampaignLog; readonly asked: readonly CampaignPendingChoice[] } {
  const done = settleBy(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa" }, DEPS, answers),
    pick,
  );
  return { log: done.value, asked: done.asked };
}

export type RecordEntry = CampaignGameResult["records"][number];

/** A bare stand-in result (no real game behind it): the facts a finished game would derive are given as `records`. */
export function bareResult(nodeId: string, won: boolean, records: readonly RecordEntry[] = []): CampaignGameResult {
  return { nodeId, outcome: won ? "won" : "lost", records, removedFromCampaign: [], logWrites: [], expiringGrants: [] };
}
export const flagRecord = (instructionId: string, field: string, value: boolean): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "flag", value } },
});
export const numberRecord = (instructionId: string, field: string, value: number): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "number", value } },
});
export const seatList = (
  instructionId: string,
  field: string,
  seatNumber: number,
  ids: readonly string[],
): RecordEntry => ({
  instructionId,
  write: { field, seatNumber, mode: "set", value: { kind: "cardList", cardIds: ids as readonly CardId[] } },
});
export const seatNumberRecord = (
  instructionId: string,
  field: string,
  seatNumber: number,
  value: number,
): RecordEntry => ({
  instructionId,
  write: { field, seatNumber, mode: "set", value: { kind: "number", value } },
});

export const sharedField = (log: CampaignLog, id: string) => log.shared[id];
export const seatField = (log: CampaignLog, seatIndex: number, id: string) => log.seats[seatIndex]?.fields[id];
export const struckOf = (log: CampaignLog, id: string): readonly string[] => {
  const value = log.shared[id];
  return value?.kind === "strikeList" ? value.struck : [];
};
export const recordedOf = (log: CampaignLog, seatIndex: number): readonly string[] => {
  const value = seatField(log, seatIndex, "recordedCards");
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
  /** The first copy of each of these cards is taken out of a seat's deck (index 0 = seat 1). */
  readonly dropDeckCards?: readonly (readonly string[])[];
}

/**
 * The real game a composed log starts, exactly as the campaign card harness builds it (unsettled): the log's modular
 * set picks go to the builder (`modularSetIds` for Spiral, `setAsideModularSetIds` for Mojo; MaGog's one set is its
 * `modularSetIds`), the composed sets (Longshot, set aside) are added, and the campaign input is the game's baseline.
 */
export function build(composed: CampaignLog, options: BuildOptions = {}): Built {
  const start = startGameFromLog(DEF, composed);
  const removedCardIds = composed.removedFromCampaign.map((face) => face.cardId);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const picks = [...mojoModularSetPicks(composed)];
  const config = wave6Scenario(start.scenarioId, {
    players: start.input.seats.map((seat, index) => ({
      identityCardId: seat.identityCardId,
      deck: (() => {
        const deck = [...seat.deck];
        for (const code of options.dropDeckCards?.[index] ?? []) {
          const at = deck.indexOf(cardId(code));
          if (at >= 0) deck.splice(at, 1);
        }
        return [...deck, ...(options.extraDeckCards?.[index] ?? []).map((code) => cardId(code))];
      })(),
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: composed.modes,
    ...(start.scenarioId === "mojo" ? { setAsideModularSetIds: picks } : { modularSetIds: picks }),
  });
  const created = createGame(
    {
      ...config,
      encounterDeck: [
        ...config.encounterDeck,
        ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.deck, removedCardIds),
      ],
      setAside: [
        ...(config.setAside ?? []),
        ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.setAside, removedCardIds),
      ],
      campaign: start.input,
    },
    WAVE6_DEPS,
  );
  if (!created.ok) throw new Error(`${start.nodeId}: setup failed: ${created.error.message}`);
  return { start, state: created.state, events: created.events };
}

/** The game settled to the first player phase, every choice answered by `pick`. */
export const settledStart = (composed: CampaignLog, pick = firstLegal, options: BuildOptions = {}): GameState =>
  settle(build(composed, options).state, pick, (state) => state.step.phase === "player", WAVE6_DEPS);

export const inst = (state: GameState, id: InstanceId) => state.instances[id]!;
export const codeOf = (state: GameState, id: InstanceId): string => inst(state, id).cardId as string;
export const nameOf = (code: string): string | undefined =>
  WAVE6_CARDS.find((card) => (card.id as string) === code)?.name;
export const anywhere = (state: GameState, code: string): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => (instance.cardId as string) === code)
    .map((instance) => instance.instanceId);
export const playAreaOf = (state: GameState, seat: number): readonly string[] =>
  (state.players[seat]?.playArea ?? []).map((id) => codeOf(state, id));
/** Every card in a seat's play area, attachments of the identity included, as printed ids. */
export const controlledBy = (state: GameState, seat: number): readonly string[] => {
  const player = state.players[seat]!;
  const attached = inst(state, player.identity.instanceId).attachments;
  return [...player.playArea, ...attached].map((id) => codeOf(state, id));
};

/** The printed cost of a card of the pool; throws on an unknown id. */
export const printedCost = (code: string): number => {
  const card = PLAYABLE_CARDS.find((candidate) => (candidate.id as string) === code);
  if (!card || !("cost" in card)) throw new Error(`${code} has no printed cost`);
  return card.cost;
};

/**
 * State surgery: puts the first copy of `code` (from the player's deck, hand or discard pile) into play under their
 * control, a support in the play area and an upgrade attached to their identity. No cost is paid and nothing triggers.
 * `as` re-prints that instance as another card of the pool first (a card no precon can legally hold, such as a dash-cost
 * support, takes the place of a card the deck has).
 */
export function intoPlay(state: GameState, player: PlayerId, code: string, as: string = code): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const id = [...owner.deck, ...owner.hand, ...owner.discard].find((candidate) => codeOf(state, candidate) === code);
  if (!id) throw new Error(`${player} has no ${code} to put into play`);
  const card = WAVE6_CARDS.find((candidate) => (candidate.id as string) === as)!;
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
