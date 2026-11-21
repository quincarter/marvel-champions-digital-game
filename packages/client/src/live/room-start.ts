/**
 * The host's Start in a room where players bring their own decks (Quin, 2026-11-20): gathers every seat's deck from the
 * room, has the host's side judge them all (legal, every card known in the host's pool, mod cards only from allowed mods
 * at the same version), tells only each failing seat's holder why, and otherwise builds the game's players from those
 * decks and starts it. Plain logic with its collaborators passed in (`platform/room.ts` wires the real ones), so the
 * routing is tested without a room, a worker or an engine.
 */
import type { CorePlayer } from "@mc/cards";
import type { DeckRefusalCode, LobbyMod } from "@mc/sync-worker/room-protocol";
import type { SessionConfig } from "../engine/host.js";
import { playerOfRoomDeck, type RoomDeckCheckInput, type SeatDeckVerdict } from "./room-deck.js";
import type { RoomState, SeatDeckEntry } from "./room-state.js";

/** A refused seat: who is told is that seat's holder alone. */
export interface SeatDeckRefusal {
  readonly seat: string;
  readonly code: DeckRefusalCode;
  readonly reason: string;
}

/**
 * - `not-host`, `no-seats`: nothing to start from (this device is not the host, or the lobby has no seats);
 * - `unfilled`: these seats have no holder yet (`seats`);
 * - `no-answer`: the room did not hand over the decks (connection down or too slow); try again;
 * - `check-failed`: the deck check could not run (no worker); nothing was started;
 * - `decks`: these seats' decks were refused (`refused`, one per seat; each holder but the host was told by the room);
 * - `start-failed`: the engine would not start the game (`error`).
 */
export type RoomStartResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not-host" | "no-seats" | "no-answer" | "check-failed" }
  | { readonly ok: false; readonly reason: "unfilled"; readonly seats: readonly string[] }
  | { readonly ok: false; readonly reason: "decks"; readonly refused: readonly SeatDeckRefusal[] }
  | { readonly ok: false; readonly reason: "start-failed"; readonly error: string };

export interface RoomStartDeps {
  readonly state: () => RoomState;
  /** The room's full deck lists (host only), or null when it did not answer. */
  readonly requestDecks: () => Promise<readonly SeatDeckEntry[] | null>;
  /** Tells the seat's holder, and only them, why their deck was refused. */
  readonly refuse: (refusal: SeatDeckRefusal) => void;
  /** Judges the decks off the main thread; null when it could not. */
  readonly check: (
    input: Omit<RoomDeckCheckInput, "basePool" | "loaded">,
  ) => Promise<readonly SeatDeckVerdict[] | null>;
  /** Starts the game on this device (it carries the room, watching and play mode itself) and says why if it failed. */
  readonly start: (config: SessionConfig) => Promise<string | null>;
}

/** The scenario, difficulty, rules and the rest of the host's choices: everything of a game but its players. */
export type RoomGameBase = Omit<SessionConfig, "players">;

export async function startRoomGame(base: RoomGameBase, deps: RoomStartDeps): Promise<RoomStartResult> {
  const state = deps.state();
  if (state.role !== "host") return { ok: false, reason: "not-host" };
  if (state.seats.length === 0) return { ok: false, reason: "no-seats" };
  const empty = state.seats.filter((seat) => seat.holder === null).map((seat) => seat.id);
  if (empty.length > 0) return { ok: false, reason: "unfilled", seats: empty };

  const entries = await deps.requestDecks();
  if (!entries) return { ok: false, reason: "no-answer" };
  const byseat = new Map(entries.map((entry) => [entry.seat, entry.deck] as const));
  const allowed: readonly LobbyMod[] = state.settings?.mods ?? [];
  const verdicts = await deps.check({
    seats: state.seats.map((seat) => ({ seat: seat.id, deck: byseat.get(seat.id) ?? null })),
    allowed,
  });
  // One verdict for every seat, by id: a short, doubled or foreign list is a check that did not do its job.
  const judged =
    verdicts !== null &&
    verdicts.length === state.seats.length &&
    state.seats.every((seat) => verdicts.filter((v) => v.seat === seat.id).length === 1);
  if (!verdicts || !judged) return { ok: false, reason: "check-failed" };

  const refused: SeatDeckRefusal[] = [];
  for (const verdict of verdicts) {
    if (!verdict.ok) refused.push({ seat: verdict.seat, code: verdict.code, reason: verdict.reason });
  }
  if (refused.length > 0) {
    for (const refusal of refused) deps.refuse(refusal);
    return { ok: false, reason: "decks", refused };
  }

  const players: CorePlayer[] = [];
  for (const seat of state.seats) {
    const deck = byseat.get(seat.id);
    // A check that passed a seat with no deck is a broken check, not a game to start.
    if (!deck) return { ok: false, reason: "check-failed" };
    players.push(playerOfRoomDeck(deck));
  }
  const error = await deps.start({ ...base, players });
  return error === null ? { ok: true } : { ok: false, reason: "start-failed", error };
}
