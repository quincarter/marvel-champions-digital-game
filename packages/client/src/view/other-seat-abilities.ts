/**
 * Cards another seat controls that the perspective player may use right now.
 *
 * "Any player may trigger this ability" (Deadpool's Plot Convenience) puts a `useAbility` entry for a card in another
 * seat's play area into the acting player's own legal list. The board draws other seats only as summary rows, so each
 * such card becomes a small chip on its controller's row. Everything here is read off the engine's legal list.
 */

import type { InstanceId, LegalActions, PlayerId } from "@mc/engine";
import { cardOf, getInstance, type EngineDeps, type GameState } from "@mc/engine";
import { artFor, type ArtSource } from "../art/art-source.js";
import { faceOf } from "./board-model.js";
import { legalEntriesOf } from "./highlights.js";
import { cardName, playerName } from "./names.js";

export interface OtherSeatAbilityCard {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** The seat whose play area holds it (the row it is drawn on). */
  readonly seatId: PlayerId;
  /** The hero name of the card's owner, which differs from the seat's when the card was lent. */
  readonly ownerName: string;
  readonly art: ArtSource | null;
}

/** In legal-list order, one entry per card; empty when no other seat's card has a legal ability for the viewer. */
export function otherSeatAbilityCards(
  state: GameState,
  actions: LegalActions | null,
  perspectiveId: PlayerId,
  _deps: EngineDeps,
): readonly OtherSeatAbilityCard[] {
  if (!actions) return [];
  const seen = new Set<InstanceId>();
  const out: OtherSeatAbilityCard[] = [];
  for (const entry of legalEntriesOf(actions)) {
    if (entry.action.kind !== "useAbility") continue;
    const id = entry.action.instanceId;
    if (seen.has(id)) continue;
    const seat = state.players.find((player) => player.playerId !== perspectiveId && player.playArea.includes(id));
    if (!seat) continue;
    seen.add(id);
    const ownerId = getInstance(state, id)?.ownerId ?? seat.playerId;
    out.push({
      instanceId: id,
      name: cardName(state, id),
      seatId: seat.playerId,
      ownerName: playerName(state, ownerId),
      art: artFor(cardOf(state, id), faceOf(state, id)),
    });
  }
  return out;
}
