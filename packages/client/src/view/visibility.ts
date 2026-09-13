/**
 * Whether this table may see a card's face.
 *
 * `CardInstance.faceup` is about the *table*, not about who is looking: a card
 * in a hand is not faceup, and a card in a discard pile may never have been
 * turned over, yet both are things the player is plainly entitled to read. So
 * visibility is a question of zone first and of that flag second:
 *
 *  - a hand and a discard pile are open to the player;
 *  - a deck is closed, *except* for the cards an open decision is offering from
 *    it (see `offeredFromDeck`);
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
      return offeredFromDeck(state, id);
    default:
      return instance.faceup;
  }
}

/**
 * A deck card the open decision offers is one the deciding player is looking at.
 *
 * Every choice the engine opens over a deck is a real look: a search (Black
 * Panther's Foresight, Shuri, Klaw's search for a Masters of Evil minion) or
 * "look at the top 3" (Iron Man). In the physical game the searching player
 * reads those cards — the shuffle afterwards is what keeps the deck's *order*
 * secret, not the cards themselves — so drawing them as card backs made the
 * decision one the player couldn't actually make.
 *
 * Deliberately scoped to deck zones. A choice can also offer a card that is
 * facedown *in play* — a facedown Drone as an attack target — and being offered
 * one doesn't turn it over; that still falls through to `faceup`.
 *
 * The viewer is the player the choice is addressed to. In Phase 4 every seat
 * is the same human; in Phase 5 the server should send these faces only to that
 * player (see the file comment).
 */
function offeredFromDeck(state: GameState, id: InstanceId): boolean {
  return (
    state.pendingChoice?.options.some((option) => (option.ref.kind === "card" || option.ref.kind === "ability") && option.ref.instanceId === id) ??
    false
  );
}
