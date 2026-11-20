/**
 * The game a table host starts for its own table in an Epic room (Trickster Takeover Epic Multiplayer, issue #882), as
 * a pure function. The organizer chose each seat's hero (the seat label carries the hero's identity card id); the table
 * host's device plays the table, so it finds a deck of its own for each of those heroes (the deck whose name the label
 * carries first, else any seatable deck of that hero) and builds the ordinary scenario config from them with the table's
 * difficulty. `startEpicTable` (`platform/room.ts`) then adds the seed, the group's place in the pod and the room.
 */
import type { LobbySeatSpec } from "@mc/sync-worker/room-protocol";
import type { SessionConfig } from "../engine/host.js";
import type { Scenario } from "@mc/content";
import type { TableRules } from "@mc/engine";
import { corePlayerForSeat } from "./deck-seat.js";
import type { DeckOption } from "./deck-list-model.js";
import { difficultyOf, HERO_UNSET } from "./epic-lobby-model.js";
import { parseSeatLabel } from "./room-table-setup.js";
import { initialSetupDraft, toSessionConfig } from "./setup-draft.js";

/** The scenario every Epic table plays: Trickster Takeover's Loki, God of Lies (`@mc/content` `tt`). */
export const EPIC_SCENARIO_ID = "god-of-lies";

export type EpicConfigResult =
  | { readonly ok: true; readonly config: SessionConfig }
  | { readonly ok: false; readonly missing: readonly string[] };

/** The deck options that can play `cardId`'s hero, the one whose name the seat's label carries first. */
export function deckForSeat(label: string, decks: readonly DeckOption[]): DeckOption | null {
  const { text, cardId } = parseSeatLabel(label);
  if (cardId === null) return null;
  const same = decks.filter((o) => o.seatable && (o.deck.identityCardId as string) === cardId);
  if (same.length === 0) return null;
  const wanted = text.toLowerCase();
  return same.find((o) => wanted.includes(o.deck.name.toLowerCase())) ?? same[0] ?? null;
}

/** The hero names (from the seat labels) that none of `decks` can play. */
export function missingHeroes(labels: readonly string[], decks: readonly DeckOption[]): readonly string[] {
  return labels
    .filter((label) => label !== HERO_UNSET && deckForSeat(label, decks) === null)
    .map((label) => parseSeatLabel(label).text.split(" - ")[0] ?? label);
}

export interface EpicConfigInput {
  /** This table's seats in order (the players p1..), as the room lists them. */
  readonly seats: readonly Pick<LobbySeatSpec, "label">[];
  /** The table's difficulty as the organizer set it (opaque in the room). */
  readonly difficulty: unknown;
  readonly decks: readonly DeckOption[];
  readonly scenario: Scenario | undefined;
  readonly tableRules?: TableRules | undefined;
}

/** The scenario config for the table, or the heroes this device has no deck for. */
export function epicTableSessionConfig(input: EpicConfigInput): EpicConfigResult {
  const picks = input.seats.map((s) => deckForSeat(s.label, input.decks));
  if (picks.length === 0 || picks.some((p) => p === null)) {
    return {
      ok: false,
      missing: missingHeroes(
        input.seats.map((s) => s.label),
        input.decks,
      ),
    };
  }
  const options = picks as DeckOption[];
  const draft = {
    ...initialSetupDraft({
      scenarioId: EPIC_SCENARIO_ID,
      seatDeckId: null,
      seed: 0,
    }),
    difficulty: difficultyOf(input.difficulty),
    seats: options.map((o) => o.deck.id as string),
  };
  const players = options.map((o) => corePlayerForSeat(o, draft.deckSwaps));
  return { ok: true, config: toSessionConfig(draft, players, input.scenario, input.tableRules) };
}
