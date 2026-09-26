/**
 * The `?screen=alliance` dev jump's game (`scenes/boot.ts`): a real two-seat hot-seat game stopped on War Machine's
 * own turn with an alliance card in hand and Star-Lord's hand free to help pay, so the per-helper approval bar
 * (docs/phase7-wave4.md §4 Q10) is one play and one pick away. Kept out of `boot.ts` so
 * `dev-alliance-game.test.ts` can prove the jump reaches the state it claims.
 */

import { WAVE4_STARTER_DECKS } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";
import type { SessionStore } from "./session-store.js";

/** Cosmic Alliance (25036, basic): "Alliance. Hero Action: Choose an avenger character and a guardian character → …" */
export const ALLIANCE_DEV_CARD = "25036";

/**
 * War Machine's precon with its three Hand-to-Hand (23016) swapped for three Cosmic Alliance, which keeps the deck
 * legal at 40 cards, beside Star-Lord's precon. Seed 1 was traced to reach round two on War Machine's own turn with
 * both heroes in hero form (Cosmic Alliance needs an avenger and a guardian character, and both identities only
 * carry those traits on their hero side), one Cosmic Alliance in hand and five Star-Lord cards to help pay.
 */
export const ALLIANCE_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [
    {
      identityCardId: "23001a",
      deck: [
        ...WAVE4_STARTER_DECKS.find((deck) => (deck.id as string) === "war-machine-leadership")!
          .cards.flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string))
          .filter((id) => id !== "23016"),
        ALLIANCE_DEV_CARD,
        ALLIANCE_DEV_CARD,
        ALLIANCE_DEV_CARD,
      ],
      aspects: ["leadership"],
    },
    { starterDeckId: "star-lord-leadership" },
  ],
  seed: 1,
};

/**
 * Starts `ALLIANCE_DEV_CONFIG` and plays it forward: every choice answered with its minimum, each seat flipping to
 * hero form once and otherwise ending its turn, until both heroes are in hero form on the first seat's turn.
 */
export async function startAllianceDevGame(store: SessionStore): Promise<void> {
  await store.start(ALLIANCE_DEV_CONFIG);
  for (let step = 0; step < 40; step++) {
    const game = store.state.game;
    const actions = store.state.legal?.actions;
    if (!game || game.outcome || !actions) return;
    if (actions.kind === "choice") {
      await store.resolveChoice(actions.choice.options.slice(0, actions.choice.minSelections).map((o) => o.optionId));
      continue;
    }
    if (actions.kind !== "turn") return;
    const bothHeroes = game.players.every((player) => player.identity.form === "hero");
    if (bothHeroes && store.state.perspectiveId === game.players[0]!.playerId) return;
    const acting = game.players.find((player) => player.playerId === store.state.perspectiveId);
    const flip =
      acting?.identity.form === "alterEgo"
        ? actions.legal.find((entry) => entry.action.kind === "changeForm")
        : undefined;
    const next = flip ?? actions.legal.find((entry) => entry.action.kind === "endTurn");
    if (!next) return;
    await store.dispatch(next.example);
  }
}
