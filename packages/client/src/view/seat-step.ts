/**
 * LB / RB (or R / F) on Take your seats: the seat being edited steps to the previous or next one. A seat can be
 * edited once the seat before it is filled (`seatIsSelectable`), so the choices are the filled seats and the one empty
 * seat after them, and stepping off either end wraps around to the other.
 */

import { seatIsSelectable, type SetupDraft } from "./setup-draft.js";

export function steppedSeatIndex(draft: SetupDraft, direction: 1 | -1, maxSeats: number): number {
  const choices: number[] = [];
  for (let index = 0; index < maxSeats; index++) if (seatIsSelectable(draft, index)) choices.push(index);
  const at = Math.max(0, choices.indexOf(draft.activeSeatIndex));
  return choices[(at + direction + choices.length) % choices.length]!;
}

/** The seat the pad's X clears: the focused seat tile's, else the active seat's. Null for an empty seat or the last hero. */
export function seatToClear(draft: SetupDraft, focusedKey: string | null): number | null {
  const fromTile = focusedKey?.startsWith("seat:") ? Number(focusedKey.slice("seat:".length)) : draft.activeSeatIndex;
  if (!Number.isInteger(fromTile) || fromTile >= draft.seats.length || draft.seats.length <= 1) return null;
  return fromTile;
}
