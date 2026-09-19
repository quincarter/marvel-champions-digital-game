/**
 * Who may see a card's face — as a rule over zones, owned by the engine.
 *
 * `CardInstance.faceup` is about the *table*, not about who is looking: a card in a hand is not faceup, and a card in
 * a discard pile may never have been turned over, yet both are things a player is plainly entitled to read. So
 * visibility is a question of zone first and of that flag second:
 *
 *  - a hand and any discard pile are open (RRG 1.8 "Discard Pile", p. 16: "Each discard pile is open information, and
 *    may be looked at by any player at any time"), as is the victory display (p. 47);
 *  - a deck is closed (p. 15 "Deck", p. 17 "Encounter Deck": a deck's order is secret), *except* for the cards an open
 *    decision is offering out of it — an ability that instructs a player to look at or search a deck lets that player
 *    read those cards (p. 27 "Look, Looked-At"), and the shuffle afterwards is what keeps the order secret;
 *  - everything else is open exactly when it is faceup, which covers a facedown boost card, a dealt encounter card, a
 *    tucked card and a set-aside nemesis set without naming any of them.
 *
 * This lives in the engine because two things need the same answer and must not fork: the client's card rendering
 * (`view/visibility.ts` delegates here) and `preview()`'s truncation rule, which is the thing that stops an outcome
 * preview from quietly peeking at a deck.
 *
 * **Whose eyes.** Today the predicate is table-wide rather than per-player: Phase 4 is multi-handed solo, so every
 * hand at the table belongs to the one human. Phase 5 needs a viewer argument (and, more importantly, a server that
 * does not send a card the viewer may not see). The zone rules above are already written per-zone, so adding a viewer
 * is a change to two `case` arms, not a redesign.
 */

import { getInstance, locateCard } from "./query.js";
import type { InstanceId } from "./ids.js";
import type { GameState, ZoneId } from "./state.js";

/** The deck zones: closed by rule, whatever a card's `faceup` flag says. */
const isDeckZone = (zone: ZoneId): boolean =>
  zone.kind === "deck" || zone.kind === "encounterDeck" || zone.kind === "separateDeck";

/**
 * A card the open decision is offering is one the deciding player is looking at (RRG 1.8 "Look, Looked-At", p. 27).
 *
 * Every choice the engine opens over a deck is a real look: a search, or "look at the top 3". Deliberately not scoped
 * to deck zones here — the caller decides where it matters — because being offered a card that is facedown *in play*
 * (a facedown Drone as an attack target) does not turn it over.
 */
export const offeredByOpenChoice = (state: GameState, id: InstanceId): boolean =>
  state.pendingChoice?.options.some(
    (option) => (option.ref.kind === "card" || option.ref.kind === "ability") && option.ref.instanceId === id,
  ) ?? false;

/** Whether this table may read the card's face right now. */
export function faceVisible(state: GameState, id: InstanceId): boolean {
  const instance = getInstance(state, id);
  if (!instance) return false;
  const zone = locateCard(state, id);
  if (!zone) return instance.faceup;
  switch (zone.kind) {
    case "hand":
    case "discard":
    case "encounterDiscard":
    case "separateDiscard":
    case "victoryDisplay":
      return true;
    case "deck":
    case "encounterDeck":
    case "separateDeck":
      // A separate deck's top card can be faceup by its own rules (the Invocation deck), which `faceup` already says.
      return instance.faceup || offeredByOpenChoice(state, id);
    default:
      return instance.faceup;
  }
}

/**
 * The card is inside a closed deck: its identity is not derivable from anything a player may look at.
 *
 * This is the half of the rule `preview()` truncates on. It is deliberately about *zones*, not about a list of risky
 * event kinds, so it cannot rot as new effects are added.
 */
export const zoneHidden = (state: GameState, id: InstanceId): boolean => {
  const zone = locateCard(state, id);
  return zone !== null && isDeckZone(zone) && !faceVisible(state, id);
};

/**
 * The card is out of a deck but has never been turned over: a facedown boost card, a dealt encounter card, a facedown
 * Drone, a tucked card, a set-aside nemesis set card. Turning one of these faceup is a reveal.
 */
export const faceHidden = (state: GameState, id: InstanceId): boolean => {
  const zone = locateCard(state, id);
  return zone !== null && !isDeckZone(zone) && !faceVisible(state, id);
};
