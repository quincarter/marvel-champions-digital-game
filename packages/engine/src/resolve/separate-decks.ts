/**
 * The Doctor Strange insert, "The Invocation Deck": "If the INVOCATION deck is ever empty, shuffle the INVOCATION discard
 * pile back into the INVOCATION deck. There is no penalty for doing this." (`IdentitySeparateDeck.whenEmpty`). Unlike
 * RRG 1.8 "Player Deck" (p. 33), no encounter card is dealt and no acceleration token is placed.
 *
 * The reset happens the moment the deck empties: `settlePlayerDecks` (`ctx.ts`) calls `resetSeparateDeckIfEmpty` after
 * every `moveCard` out of a separate deck or into its discard pile. A card whose Special resolves from the deck leaves it
 * when it starts resolving (`executeResolveSpecials`), so if it was the last card the deck is reset without it, and it
 * reaches the discard pile afterwards. That is ruling, Apr 30, 2026 (3) answer 7 ("The deck is reshuffled **before** the
 * currently resolving card enters the discard pile"), applied to the Invocation deck as it is to a player deck
 * (docs/phase7-wave1.md §4 Q9, resolved 2026-09-25; docs/phase7-wave3.md §4 Q15).
 */

import { type Ctx, emit, moveCard } from "../ctx.js";
import type { PlayerId } from "../ids.js";
import { shuffleSeparateDeck } from "./cards.js";

/** Resets that separate deck if it is empty and its discard pile is not. An eliminated player's zones are left alone. */
export function resetSeparateDeckIfEmpty(ctx: Ctx, playerId: PlayerId, name: string): boolean {
  const player = ctx.state.players.find((p) => p.playerId === playerId);
  const piles = player?.separateDecks[name];
  if (!player || player.eliminated || !piles || piles.deck.length > 0 || piles.discard.length === 0) return false;
  for (const id of piles.discard) moveCard(ctx, id, { kind: "separateDeck", playerId, name });
  shuffleSeparateDeck(ctx, playerId, name);
  emit(ctx, { type: "separateDeckReset", playerId, name });
  return true;
}

/**
 * Every separate deck, checked by `runFlow` before each frame and step. Since every move already settles its deck, this
 * only finds an empty deck in a state built another way (a save from before 2026-09-25, a test's surgery).
 */
export function resetEmptySeparateDecks(ctx: Ctx): void {
  for (const player of ctx.state.players) {
    for (const name of Object.keys(player.separateDecks)) resetSeparateDeckIfEmpty(ctx, player.playerId, name);
  }
}
