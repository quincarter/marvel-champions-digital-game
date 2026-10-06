/**
 * Real games stopped on the board with one of Deadpool's unusual wave 7 cards in hand (or, for The Merc with the Mouth,
 * in play), for the board audit in `docs/phase7-wave7-qa-deadpool-board.md` and `e2e/wave7-deadpool-cards.spec.ts`.
 * Played forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state
 * edit, so each replays byte for byte like any saved game. `dev-qa-deadpool-game.test.ts` proves each reaches its state.
 *
 * The card is stacked into the opening hand behind a 44017, so the hand limit's discard (the first card, answered with
 * its minimum) takes the 44017. Most are unique (one copy per deck), so one 44017 is swapped for it;
 * Armed to the Teeth is already in the precon and The Merc with the Mouth is an obligation setup deals itself.
 */
import { WAVE7_STARTER_DECKS } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export type DeadpoolQaCard =
  | "blackout"
  | "ticTacToe"
  | "gitGud"
  | "plotConvenience"
  | "rockPaperScissors"
  | "armedToTheTeeth"
  | "merc";

interface QaSetup {
  readonly code: string;
  readonly twoPlayers: boolean;
  /** Stacked on top of the encounter deck: round 1's boost card (Charge), then the reveal (Merc only). */
  readonly encounter?: readonly string[];
}

export const DEADPOOL_QA: Record<DeadpoolQaCard, QaSetup> = {
  blackout: { code: "44053", twoPlayers: false },
  ticTacToe: { code: "44057", twoPlayers: false },
  gitGud: { code: "44028", twoPlayers: false },
  plotConvenience: { code: "44050", twoPlayers: true },
  rockPaperScissors: { code: "44056", twoPlayers: false },
  armedToTheTeeth: { code: "44009", twoPlayers: false },
  merc: { code: "44032", twoPlayers: false, encounter: ["01099", "44032"] },
};

const DEADPOOL_DECK = WAVE7_STARTER_DECKS.find((deck) => (deck.id as string) === "deadpool-pool")!;
const PRECON_CODES = DEADPOOL_DECK.cards.flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string));

/** 'Pool precon with one 44017 swapped for `code`, which keeps the deck the same size (unless the precon has it). */
const deckWith = (code: string): string[] => {
  const deck = [...PRECON_CODES];
  if (!deck.includes(code) && code !== "44032") deck[deck.indexOf("44017")] = code;
  return deck;
};

export function deadpoolQaConfig(which: DeadpoolQaCard): SessionConfig {
  const setup = DEADPOOL_QA[which];
  const deadpool = {
    identityCardId: DEADPOOL_DECK.identityCardId as string,
    deck: deckWith(setup.code),
    aspects: ["pool" as const],
  };
  return {
    scenarioId: "rhino",
    difficulty: "standard",
    players: setup.twoPlayers ? [deadpool, { starterDeckId: "core-spider-man-justice" }] : [deadpool],
    seed: 3,
    stack: {
      ...(which === "merc" ? {} : { players: { 0: ids("44017", setup.code) } }),
      ...(setup.encounter ? { encounter: ids(...setup.encounter) } : {}),
    },
  };
}

/**
 * Starts the game and plays it forward until Deadpool is on his own turn in hero form holding the card (everything but
 * Break Time-style cards is a hero card or form-free); `merc` instead runs until the obligation is in his play area on
 * his turn. A choice met on the way is answered with its minimum.
 */
export async function startDeadpoolQaGame(store: SessionStore, which: DeadpoolQaCard): Promise<void> {
  const setup = DEADPOOL_QA[which];
  await store.start(deadpoolQaConfig(which));
  for (let step = 0; step < 30; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const active = game.players.find((player) => player.playerId === store.state.legal?.playerId);
    if (active !== me) {
      const end = turn.legal.find((e) => e.action.kind === "endTurn");
      if (!end) return;
      await store.dispatch(end.example);
      continue;
    }
    const held = me.hand.some((id) => codeOf(game, id) === setup.code);
    if (which === "merc") {
      if (me.playArea.some((id) => codeOf(game, id) === setup.code)) return;
    } else if (me.identity.form !== "alterEgo" && held) {
      // Tic-Tac-Toe needs someone damaged and Blackout a scheme with threat: stay in hero form until a villain phase gives it.
      if ((which !== "ticTacToe" || damaged(game)) && (which !== "blackout" || threatened(game))) return;
    } else if (me.identity.form === "alterEgo" && held) {
      const flip = turn.legal.find((e) => e.action.kind === "changeForm");
      if (flip) {
        await store.dispatch(flip.example);
        continue;
      }
    }
    const end = turn.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}

/** Blackout moves threat off a scheme, so a scheme must hold some (the main scheme gets 1 each villain phase). */
const threatened = (game: NonNullable<SessionStore["state"]["game"]>): boolean =>
  Object.values(game.instances).some((instance) => (instance.threat ?? 0) > 0);

const damaged = (game: NonNullable<SessionStore["state"]["game"]>): boolean =>
  game.players.some((player) => (game.instances[player.identity.instanceId]?.damage ?? 0) > 0);
