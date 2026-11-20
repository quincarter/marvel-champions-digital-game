/**
 * The host's side of starting a Competitive room (issue #883): each seat's hero label (the lobby keeps the identity card
 * id after it) becomes one of this device's decks, as the Epic table host does (`epic-table-config.ts`), and the result
 * is the `CompetitiveSetup` `startCompetitive` takes.
 */
import type { CompetitiveSetup } from "../live/competitive-start.js";
import type { RoomState } from "../live/room-state.js";
import { corePlayerForSeat } from "./deck-seat.js";
import type { DeckOption } from "./deck-list-model.js";
import { deckForSeat, HERO_UNSET, missingHeroes } from "./seat-label.js";
import { expertOn } from "./competitive-lobby-model.js";
import { initialSetupDraft } from "./setup-draft.js";

export type CompetitiveSetupResult =
  | { readonly ok: true; readonly setup: CompetitiveSetup }
  | { readonly ok: false; readonly missing: readonly string[] };

/** The heroes (from the seat labels) that none of `decks` can play. */
export const missingCompetitiveDecks = (
  state: Pick<RoomState, "seats">,
  decks: readonly DeckOption[],
): readonly string[] =>
  missingHeroes(
    state.seats.map((s) => s.label),
    decks,
  );

export function competitiveSetupOf(
  state: Pick<RoomState, "seats" | "settings">,
  decks: readonly DeckOption[],
  seed: number,
): CompetitiveSetupResult {
  const picks = state.seats.map((s) => (s.label === HERO_UNSET ? null : deckForSeat(s.label, decks)));
  if (picks.length === 0 || picks.some((p) => p === null)) {
    return { ok: false, missing: missingCompetitiveDecks(state, decks) };
  }
  const swaps = initialSetupDraft({ scenarioId: "", seatDeckId: null, seed }).deckSwaps;
  return {
    ok: true,
    setup: {
      seed,
      expert: expertOn(state as RoomState),
      seats: state.seats.map((s, i) => ({ seat: s.id, player: corePlayerForSeat(picks[i]!, swaps) })),
    },
  };
}
