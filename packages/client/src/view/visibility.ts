/**
 * Whether this table may see a card's face.
 *
 * `CardInstance.faceup` is about the *table*, not about who is looking: a card
 * in a hand is not faceup, and a card in a discard pile may never have been
 * turned over, yet both are things the player is plainly entitled to read. So
 * visibility is a question of zone first and of that flag second:
 *
 *  - a hand and a discard pile are open to the player;
 *  - a deck is never open, however the card sits in it;
 *  - everything else is open exactly when it is faceup, which covers a facedown
 *    boost card, a dealt encounter card, a tucked card and a set-aside nemesis
 *    set without naming any of them.
 *
 * Phase 4 is multi-handed solo — one human plays every seat (PLAN.md Phase 4,
 * "hero seats") — so every hand at the table is that human's own and no hand
 * needs hiding from them. When Phase 5 puts real opponents on the far side of a
 * network, hidden information stops being the client's business at all: the
 * server must not send a card the player may not see, and this function becomes
 * a rendering detail rather than the thing keeping the secret.
 */

import { getInstance, locateCard, type GameState, type InstanceId } from "@mc/engine";

export function faceVisible(state: GameState, id: InstanceId): boolean {
  const instance = getInstance(state, id);
  if (!instance) return false;
  const zone = locateCard(state, id);
  if (!zone) return instance.faceup;
  switch (zone.kind) {
    case "hand":
    case "discard":
    case "encounterDiscard":
    case "victoryDisplay":
      return true;
    case "deck":
    case "encounterDeck":
      return false;
    default:
      return instance.faceup;
  }
}
