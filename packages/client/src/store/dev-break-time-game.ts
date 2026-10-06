/**
 * A real one-seat game stopped on the board with Deadpool in alter-ego form on his own turn and Break Time (44046,
 * "report the minutes you were away") in hand: playing it asks the player a whole-number `reportFact` question
 * (docs/phase7-wave7.md §3.83). Played forward through the store with `SessionConfig.stack` (the opening hand), never a
 * state edit, so it replays byte for byte like any saved game. `dev-break-time-game.test.ts` proves it reaches the state.
 */
import { WAVE7_STARTER_DECKS } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const BREAK_TIME_CARD = "44046";

const DEADPOOL_DECK = WAVE7_STARTER_DECKS.find((deck) => (deck.id as string) === "deadpool-pool")!;

const PRECON_CODES = DEADPOOL_DECK.cards.flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string));
const BREAK_TIME_DECK = [
  ...PRECON_CODES.slice(0, PRECON_CODES.indexOf("44017")),
  BREAK_TIME_CARD,
  ...PRECON_CODES.slice(PRECON_CODES.indexOf("44017") + 1),
];

/** Deadpool's 'Pool precon with one copy of a 44017 swapped for Break Time, which keeps the deck the same size. */
export const BREAK_TIME_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [
    {
      identityCardId: DEADPOOL_DECK.identityCardId as string,
      deck: BREAK_TIME_DECK,
      aspects: ["pool"],
    },
  ],
  seed: 3,
  stack: { players: { 0: ids(BREAK_TIME_CARD) } },
};

export async function startBreakTimeDevGame(store: SessionStore): Promise<void> {
  await store.start(BREAK_TIME_DEV_CONFIG);
  for (let step = 0; step < 20; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const held = me.hand.some((id) => codeOf(game, id) === BREAK_TIME_CARD);
    if (me.identity.form === "alterEgo" && held) return;
    const end = turn.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
