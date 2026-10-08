/**
 * The faceup top card of a player's deck (Magik, 45030a) and whether it can be played right now.
 *
 * Every fact here is the engine's: which card shows (`shownDeckTop`), the standing permission and its limit
 * (`deckTopPermission`), and whether the play is legal and why not (`legalActions`, which lists the top card as a
 * `playCard` entry, legal or illegal). The price comes from `playCostOf` through the hand's own card view, which
 * already includes the permission's reduction. Nothing is recomputed on the client.
 */

import {
  cardOf,
  deckTopPermission,
  shownDeckTop,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";

/** Whether the shown top card can be played now, and in a few words why not when it cannot. */
export interface DeckTopStatus {
  readonly playable: boolean;
  readonly reason: string | null;
  /** The same in two words for a tag on the pile; the sentence is for Inspect. */
  readonly tag: string | null;
}

/** The card showing on top of `playerId`'s deck, or null when the deck is facedown or empty. */
export const shownTopOf = (state: GameState, playerId: PlayerId, deps: EngineDeps): InstanceId | null =>
  shownDeckTop(state, deps, playerId);

/**
 * The play status of `topId`, the card `shownTopOf` returned. With the viewer's `actions` the answer is the engine's
 * own legal-action list; without them (a model built outside a session) it is the permission alone.
 */
export function deckTopStatus(
  state: GameState,
  playerId: PlayerId,
  deps: EngineDeps,
  topId: InstanceId,
  actions: LegalActions | null,
): DeckTopStatus {
  const permission = deckTopPermission(state, deps, playerId);
  if (!permission) return { playable: false, reason: "Only in hero form", tag: "hero form" };
  if (permission.limitUsed) return { playable: false, reason: "Already played from the top this phase", tag: "used" };
  const card = cardOf(state, topId);
  if (card?.type === "resource") return { playable: false, reason: "A resource card can't be played", tag: "resource" };
  if (!actions) return { playable: true, reason: null, tag: null };
  if (actions.kind === "choice")
    return { playable: false, reason: "Answer the open decision first", tag: "decide first" };
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return { playable: false, reason: null, tag: null };

  const isTop = (entry: { readonly action: { readonly kind: string; readonly instanceId?: InstanceId } }): boolean =>
    entry.action.kind === "playCard" && entry.action.instanceId === topId;
  if (actions.legal.some(isTop)) return { playable: true, reason: null, tag: null };
  const illegal = actions.illegal.find(isTop);
  if (illegal) {
    const afford = illegal.reason === "insufficient_resources";
    return { playable: false, reason: illegal.message, tag: afford ? "can't afford" : "can't play" };
  }
  return actions.kind === "notYourTurn"
    ? { playable: false, reason: "Not your turn", tag: "not your turn" }
    : { playable: false, reason: "Can't be played now", tag: "can't play" };
}
