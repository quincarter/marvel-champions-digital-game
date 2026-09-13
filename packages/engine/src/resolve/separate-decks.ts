/**
 * The Doctor Strange insert, "The Invocation Deck": "If the INVOCATION deck is ever empty, shuffle the INVOCATION discard
 * pile back into the INVOCATION deck. There is no penalty for doing this." (`IdentitySeparateDeck.whenEmpty`). Unlike
 * RRG 1.8 "Player Deck" (p. 33), no encounter card is dealt and no acceleration token is placed.
 *
 * `runFlow` calls this before every frame and step, so the reshuffle happens as soon as the deck is empty. By then the
 * card whose own last sentence emptied the deck ("Place this card in the Invocation deck discard pile") is already in
 * the discard pile, so it is shuffled back in. That is docs/phase7-wave1.md §4.9's proposed reading, kept here alone.
 * Ruling, Apr 30, 2026 (3) answer 7 reshuffles a *player* deck "before the currently resolving card enters the discard
 * pile", which would leave that card out; whether it carries over to the Invocation deck is open.
 */

import { type Ctx, emit, moveCard } from "../ctx.js";
import { shuffleSeparateDeck } from "./cards.js";

export function resetEmptySeparateDecks(ctx: Ctx): void {
  for (const player of ctx.state.players) {
    if (player.eliminated) continue;
    for (const [name, piles] of Object.entries(player.separateDecks)) {
      if (piles.deck.length > 0 || piles.discard.length === 0) continue;
      for (const id of piles.discard) moveCard(ctx, id, { kind: "separateDeck", playerId: player.playerId, name });
      shuffleSeparateDeck(ctx, player.playerId, name);
      emit(ctx, { type: "separateDeckReset", playerId: player.playerId, name });
    }
  }
}
