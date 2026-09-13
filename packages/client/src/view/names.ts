/**
 * Human names for the things the engine refers to by id.
 *
 * Every name comes from `@mc/content` through the state's card pool — the
 * design canvases' card text is placeholder, so nothing here invents a label
 * (PLAN.md Phase 4, "the client must render every name, stat and rules text
 * from `@mc/content`").
 */

import { cardOf, getInstance, getPlayer, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { faceVisible } from "./visibility.js";

/**
 * A card's name. A card whose face this table can't see is named for what it is
 * treated as ("Drone"), because that is all the players can see; one that is
 * nothing in particular reads as "a facedown card". What counts as unseeable is
 * `faceVisible`'s call, so the log and the Inspect sheet agree — a card in your
 * own hand is not a mystery to you just because the engine doesn't call it
 * faceup.
 */
export function cardName(state: GameState, id: InstanceId): string {
  const instance = getInstance(state, id);
  if (!instance) return "something";
  if (!faceVisible(state, id)) {
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
 * A seat named by both faces of its identity — "Spider-Man / Peter Parker" —
 * for a decision that picks a seat. The identity card's own name alone reads
 * the same whichever face is up, and "p2" means nothing at the table.
 */
export function seatIdentityName(state: GameState, id: PlayerId): string {
  const player = getPlayer(state, id);
  if (!player) return id;
  const card = cardOf(state, player.identity.instanceId);
  if (!card || card.type !== "hero_identity") return playerName(state, id);
  return `${card.hero.faceName} / ${card.alterEgo.faceName}`;
}

/**
 * A seat's name from the reader's side of the table: their own seat is "you",
 * everyone else is named. The design canvas's log reads "You played Stun",
 * so the perspective seat has to be addressed in the second person.
 */
export function seatName(state: GameState, id: PlayerId, perspectiveId: PlayerId | null): string {
  return id === perspectiveId ? "You" : playerName(state, id);
}
