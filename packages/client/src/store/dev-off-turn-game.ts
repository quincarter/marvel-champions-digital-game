/**
 * A real two-seat game stopped on the board at the start of round 2, on Spider-Man's turn, with Deadpool (hero form)
 * holding Mulligan (44048, "Action: discard your hand, then draw up to your hand size"): an Action event the
 * waiting seat may play during another player's turn (RRG 1.8 "Player Turn", pp. 34-35; docs/phase7-wave7.md §4.1).
 * Played forward through the store with `SessionConfig.stack`, never a state edit, so it replays byte for byte like
 * any saved game. `dev-off-turn-game.test.ts` proves it reaches the state.
 */
import { WAVE7_STARTER_DECKS } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";
import { ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const MULLIGAN_CARD = "44048";

const DEADPOOL_DECK = WAVE7_STARTER_DECKS.find((deck) => (deck.id as string) === "deadpool-pool")!;
const PRECON_CODES = DEADPOOL_DECK.cards.flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string));
// Two 44017s become Mulligans: the end-of-phase hand limit discards the first card of a six-card hand in round 1, so
// the second copy is the one still held in round 2.
const MULLIGAN_DECK = (() => {
  const deck = [...PRECON_CODES];
  for (let swapped = 0; swapped < 2; swapped++) deck[deck.indexOf("44017")] = MULLIGAN_CARD;
  return deck;
})();

export const OFF_TURN_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [
    { starterDeckId: "core-spider-man-justice" },
    { identityCardId: DEADPOOL_DECK.identityCardId as string, deck: MULLIGAN_DECK, aspects: ["pool"] },
  ],
  seed: 3,
  stack: { players: { 1: ids(MULLIGAN_CARD, MULLIGAN_CARD) } },
};

/** Round 1 is played out (Deadpool flips to hero form on his own turn), so round 2 opens on Spider-Man's turn. */
export async function startOffTurnDevGame(store: SessionStore): Promise<void> {
  await store.start(OFF_TURN_DEV_CONFIG);
  for (let step = 0; step < 30; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const active = game.players.find((player) => player.playerId === store.state.legal?.playerId);
    if (game.round >= 2 && active === game.players[0]) return;
    const flip = active?.identity.form === "alterEgo" ? turn.legal.find((e) => e.action.kind === "changeForm") : null;
    if (flip && active === game.players[1]) {
      await store.dispatch(flip.example);
      continue;
    }
    const end = turn.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
