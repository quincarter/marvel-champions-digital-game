/**
 * The faceup top card of a player's deck (Magik, 45030a) and whether it can be played right now.
 *
 * Every fact here is the engine's: which card shows (`shownDeckTop`) and whether the play is legal and why not
 * (`legalActions`, which lists the top card as a `playCard` entry, legal or illegal, with the engine's own message). The price comes from `playCostOf` through the hand's own card view, which
 * already includes the permission's reduction. Nothing is recomputed on the client.
 */

import {
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
 * The play status of `topId`, the card `shownTopOf` returned, from the viewer's `actions`: the engine's own legal-action
 * list, which carries the refusal and its wording. Without them (no legal list for this seat yet) nothing is playable,
 * because a play is only ever offered from that list.
 */
export function deckTopStatus(actions: LegalActions | null, topId: InstanceId): DeckTopStatus {
  if (!actions) return { playable: false, reason: null, tag: null };
  if (actions.kind === "choice")
    return { playable: false, reason: "Answer the open decision first", tag: "decide first" };
  if (actions.kind !== "turn" && actions.kind !== "notYourTurn") return { playable: false, reason: null, tag: null };

  const isTop = (entry: { readonly action: { readonly kind: string; readonly instanceId?: InstanceId } }): boolean =>
    entry.action.kind === "playCard" && entry.action.instanceId === topId;
  if (actions.legal.some(isTop)) return { playable: true, reason: null, tag: null };
  const illegal = actions.illegal.find(isTop);
  if (illegal) {
    const tag =
      illegal.reason === "insufficient_resources"
        ? "can't afford"
        : illegal.reason === "limit_reached"
          ? "used"
          : "can't play";
    return { playable: false, reason: illegal.message, tag };
  }
  return actions.kind === "notYourTurn"
    ? { playable: false, reason: "Not your turn", tag: "not your turn" }
    : { playable: false, reason: null, tag: "can't play" };
}
