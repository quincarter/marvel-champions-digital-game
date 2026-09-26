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
 *
 * The one per-player permission that exists today is passed in as a `ViewerContext`: a card that only one player may
 * look at (RRG 1.8 "Look, Looked-At", p. 27: "only the player who is resolving the ability can look at those cards")
 * has no table-wide answer, so it is face-visible only when a viewer is named and the permission is that viewer's.
 * Without a viewer (the log's card names, `preview()`'s truncation) the card stays hidden.
 */

import type { EngineDeps } from "./abilities.js";
import { activeEncounterDeck, getInstance, locateCard } from "./query.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeRules, rulePlayers } from "./select.js";
import type { GameState, ZoneId } from "./state.js";

/** Whose eyes: the player looking, and the deps that let their per-player permissions (rules on cards) be read. */
export interface ViewerContext {
  readonly viewer: PlayerId;
  readonly deps: EngineDeps;
}

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

/**
 * "You may look at the top card of the encounter deck at any time" (`RuleSpec mayLookAtTopOfEncounterDeck`,
 * docs/phase7-wave5.md §3.28): the card is the active encounter deck's top card and one of the viewer's rules says so.
 */
const viewerMayLookAtEncounterTop = (state: GameState, id: InstanceId, view: ViewerContext | undefined): boolean => {
  if (!view || activeEncounterDeck(state).deck[0] !== id) return false;
  return activeRules(state, view.deps, "mayLookAtTopOfEncounterDeck").some((active) =>
    rulePlayers(state, active.rule, active).includes(view.viewer),
  );
};

/**
 * Whether this table may read the card's face right now. `view` names the player looking, for the permissions only one
 * player holds; without it the answer is the table-wide one.
 */
export function faceVisible(state: GameState, id: InstanceId, view?: ViewerContext): boolean {
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
    case "encounterDeck":
      return instance.faceup || offeredByOpenChoice(state, id) || viewerMayLookAtEncounterTop(state, id, view);
    case "deck":
    case "separateDeck":
      // A separate deck's top card can be faceup by its own rules (the Invocation deck), which `faceup` already says.
      return instance.faceup || offeredByOpenChoice(state, id);
    case "attachment":
      // A player's own card attached facedown (George Stacy's events, docs/phase7-wave5.md §3.15) is one its owner may
      // look at and play; table-wide today, as every hand is (see "Whose eyes" above).
      return instance.faceup || (instance.facedownAs !== null && instance.ownerId !== null);
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
