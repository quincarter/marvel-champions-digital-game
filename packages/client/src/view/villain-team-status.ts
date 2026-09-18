/**
 * "TEAM STATUS" (L02): the tablet villain-phase rail's per-seat HP list, so a
 * multiplayer table can still see who is about to take a hit while the
 * full-bleed walkthrough (or its inline interrupt window) is covering the
 * board underneath. Desktop (D11) keeps the phase log on its rail instead —
 * this panel is additive for the narrower tablet rail, not a replacement of
 * that log anywhere else.
 *
 * Every field is `seatRow` (`board-model.ts`), the same selector the Team tab
 * already uses — no new engine reads, just a per-seat list of it plus which
 * seat the *current* activation targets, read off the walkthrough's own
 * `ActivationBeat` rather than recomputed here.
 */
import type { EngineDeps, GameState, PlayerId } from "@mc/engine";
import { seatRow, type SeatRow } from "./board-model.js";

export interface TeamStatusRow {
  readonly seat: SeatRow;
  /** This seat is who the currently-showing activation is attacking/scheming against. */
  readonly targeted: boolean;
}

/**
 * All seats in table order (including an eliminated one, worded by `seatRow`
 * itself) — a villain phase can hit anyone at the table, not just the viewer.
 */
export function teamStatusOf(state: GameState, deps: EngineDeps, targetPlayerId: PlayerId | null): readonly TeamStatusRow[] {
  return [...state.players]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((player) => ({ seat: seatRow(state, player.playerId, deps), targeted: player.playerId === targetPlayerId }));
}
