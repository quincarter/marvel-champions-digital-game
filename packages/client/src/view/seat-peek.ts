/**
 * Looking at another seat's side of the table (`SessionState.peekSeat`). One person plays every seat in a multi-seat
 * game, so a teammate's hand is theirs to read: PEEK AT TABLE's banner lists every seat to switch the table beneath to
 * (the acting seat first among equals, marked as the one deciding), and the team rail's View does the same outside a
 * decision. Back, from any seat, puts the table on the seat that acts and the decision in front again.
 *
 * Controller: every seat button wears LB + a face button, by seat order (seat 1 LB + A, seat 2 LB + B, seat 3 LB + X,
 * seat 4 LB + Y), the bumper row of the direct-pick combos (`view/pick-assign.ts`), so the same seat wears the same
 * combo on the banner and in the team rail and nothing pages.
 *
 * Pure: the scenes draw into these.
 */
import type { PlayerId } from "@mc/engine";
import { PAD_PICK_FACES, PAD_PICK_MODIFIERS, padPickBinding } from "./pick-assign.js";

export interface SeatPeekChip {
  readonly playerId: PlayerId;
  /** The hero's name as the table shows it. */
  readonly name: string;
  /** The seat the table is showing now. */
  readonly viewing: boolean;
  /** The seat the decision (or the turn) belongs to: where Back goes. */
  readonly home: boolean;
  /** The direct-pick slot whose combo selects it (LB + a face button), or null past the fourth seat. */
  readonly slot: number | null;
}

/** The pick slot (`view/pick-assign.ts`) seat `index` (0-based, in seat order) wears: LB with A, B, X, Y in turn. */
export function seatPeekSlot(index: number): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= PAD_PICK_FACES.length) return null;
  const slot = PAD_PICK_MODIFIERS.indexOf("lb") * PAD_PICK_FACES.length + index;
  return padPickBinding(slot) ? slot : null;
}

/** The seat index (0-based) a seat combo's slot means, or null for a slot that is no seat's. */
export function seatIndexOfSlot(slot: number | null): number | null {
  if (slot === null) return null;
  const base = PAD_PICK_MODIFIERS.indexOf("lb") * PAD_PICK_FACES.length;
  const index = slot - base;
  return index >= 0 && index < PAD_PICK_FACES.length ? index : null;
}

/**
 * Every seat the banner offers, in seat order: each one's name, whether the table shows it, and whether it is the seat
 * that acts. A one-seat game offers none (there is nobody else to look at). A seat that is out stays listed: its
 * player may still want to read what it left behind.
 */
export function seatPeekChips(
  game: { readonly players: readonly { readonly playerId: PlayerId }[] },
  viewingId: PlayerId | null,
  homeId: PlayerId | null,
  nameOf: (playerId: PlayerId) => string,
): readonly SeatPeekChip[] {
  if (game.players.length < 2) return [];
  return game.players.map((player, index) => ({
    playerId: player.playerId,
    name: nameOf(player.playerId),
    viewing: player.playerId === viewingId,
    home: player.playerId === homeId,
    slot: seatPeekSlot(index),
  }));
}

/** A seat button's words: the hero, with a mark on the one deciding so Back's destination is never a guess. */
export function seatPeekLabel(chip: SeatPeekChip): string {
  return chip.home ? `${chip.name} ★` : chip.name;
}

/** The banner's line while a seat other than the acting one is shown: whose side the table is on. */
export function seatPeekQuestionPrefix(viewingName: string | null): string {
  return viewingName === null ? "Your decision" : `Looking at ${viewingName} · your decision`;
}
