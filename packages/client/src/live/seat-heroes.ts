/**
 * Which engine heroes a guest's device acts for (issue #881), read from the room's state as plain logic: a seat counts
 * while it is mine, has an engine player, is not marked `mismatch` (another build) and is not taken over by the host.
 * Pure, so the rule is tested without a room.
 */
import type { RoomState } from "./room-state.js";

/** The engine player ids this device may act for, in seat order. */
export function heroesOfSeats(state: Pick<RoomState, "seats">): readonly string[] {
  const heroes: string[] = [];
  for (const seat of state.seats) {
    if (seat.mine && !seat.mismatch && !seat.takenOver && seat.player) heroes.push(seat.player);
  }
  return heroes;
}

/** Whether two sets of heroes are the same, in the same order. */
export const sameHeroes = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((hero, index) => hero === b[index]);
