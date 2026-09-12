/**
 * Human names for the things the engine refers to by id.
 *
 * Every name comes from `@mc/content` through the state's card pool — the
 * design canvases' card text is placeholder, so nothing here invents a label
 * (PLAN.md Phase 4, "the client must render every name, stat and rules text
 * from `@mc/content`").
 */

import { cardOf, getInstance, getPlayer, type GameState, type InstanceId, type PlayerId } from "@mc/engine";

/**
 * A card's name. A facedown card in play is named for what it is treated as
 * ("Drone"), because that is all the players can see; a facedown card that is
 * nothing in particular reads as "a facedown card".
 */
export function cardName(state: GameState, id: InstanceId): string {
  const instance = getInstance(state, id);
  if (!instance) return "something";
  if (!instance.faceup) {
    if (instance.facedownAs) return instance.facedownAs.traits.join(" ") || "facedown minion";
    return "a facedown card";
  }
  return cardOf(state, id)?.name ?? "a card";
}

/** A seat's name: the identity's card name ("Captain Marvel"), not "player 2". */
export function playerName(state: GameState, id: PlayerId): string {
  const player = getPlayer(state, id);
  if (!player) return id;
  return cardOf(state, player.identity.instanceId)?.name ?? id;
}

/**
 * A seat's name from the reader's side of the table: their own seat is "you",
 * everyone else is named. The design canvas's log reads "You played Stun",
 * so the perspective seat has to be addressed in the second person.
 */
export function seatName(state: GameState, id: PlayerId, perspectiveId: PlayerId | null): string {
  return id === perspectiveId ? "You" : playerName(state, id);
}
