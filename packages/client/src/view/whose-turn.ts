/**
 * Whose turn it is in a room game (issue #881, docs/live-game-rooms.md section 9; Quin's requirement, section 7): the
 * one line the board's top bar shows on every device, as plain data worked out from the room's seats and the engine's
 * acting player. The words are the whole signal (colour only backs them up), and a game with no room says nothing.
 *
 * Nothing here decides a rule: the engine says who must act (`actingPlayer`), the room says who sits behind each hero.
 */
import type { GameState } from "@mc/engine";
import type { MessageKey, Params } from "../i18n/translate.js";
import { seatOfPlayerIn, type RoomSeat, type RoomState } from "../live/room-state.js";
import { parseSeatLabel } from "./room-table-setup.js";

/** `turn`: it is that hero's turn to act. `choice`: the game waits on a decision addressed to them (a villain-phase choice). */
export type TurnKind = "turn" | "choice";

export interface Acting {
  readonly playerId: string;
  readonly kind: TurnKind;
}

/** Who the game is waiting on, from the engine's state (`engine/acting-player.ts`'s rule, with the kind kept); null between decisions. */
export function actingOf(
  game: Pick<GameState, "outcome" | "pendingChoice" | "step"> | null | undefined,
): Acting | null {
  if (!game || game.outcome) return null;
  if (game.pendingChoice) return { playerId: game.pendingChoice.playerId, kind: "choice" };
  const { step } = game;
  if (step.phase === "player" && step.kind === "turn") return { playerId: step.activePlayerId, kind: "turn" };
  return null;
}

/** `mine` is a line for me to act on, `other` is someone else's, `away` is a seat or the host that is not here. */
export type TurnTone = "mine" | "other" | "away";

export interface TurnLine {
  readonly key: MessageKey;
  readonly params?: Params;
  readonly tone: TurnTone;
}

/** The hero's short name from a seat label ("Spider-Man (Justice) - Core Set deck" is "Spider-Man"). */
export function heroNameOf(seat: Pick<RoomSeat, "label">): string {
  const text = parseSeatLabel(seat.label).text;
  const hero = (text.split(" - ")[0] ?? text).replace(/\s*\(.*\)\s*$/, "").trim();
  return hero === "" ? text : hero;
}

/** A room game with seats mapped to its heroes (the host's Start does that): the only games with a turn line. */
export const inRoomGame = (room: RoomState): boolean =>
  room.role !== "none" && room.seats.some((seat) => seat.player !== null);

/** The host left the room and the game waits for them to come back: no host in the roster of a connected guest. */
export const hostAwayOf = (room: RoomState): boolean =>
  room.role === "guest" && room.connection === "connected" && !room.participants.some((p) => p.role === "host");

/** How many heroes this device acts for: when more than one, the line names the hero. */
function heldHeroes(room: RoomState): number {
  let held = 0;
  for (const seat of room.seats) {
    if (seat.player !== null && seatOfPlayerIn(room, seat.player)?.mine) held += 1;
  }
  return held;
}

/**
 * The line for the top bar, or null when there is none to show: no room, or the game is between decisions with nobody
 * away. "Your turn" / "Your choice" when it is mine; "Ava's turn (Spider-Man)" / "Waiting for Ava (Spider-Man)" when it
 * is another seat's; "Ava is away (Spider-Man)" when that seat's holder dropped; "Host away" when the host did.
 */
export function whoseTurnOf(room: RoomState, acting: Acting | null): TurnLine | null {
  if (!inRoomGame(room)) return null;
  if (hostAwayOf(room)) return { key: "turn.hostAway", tone: "away" };
  if (!acting) return null;
  const found = seatOfPlayerIn(room, acting.playerId);
  if (!found) return null;
  const hero = heroNameOf(found.seat);
  const name = found.holderName ?? hero;
  const params: Params = { name, hero };
  if (found.mine) {
    const several = heldHeroes(room) > 1 || found.takenOver;
    const key: MessageKey =
      acting.kind === "turn"
        ? several
          ? "turn.yourTurnHero"
          : "turn.yourTurn"
        : several
          ? "turn.yourChoiceHero"
          : "turn.yourChoice";
    return { key, params, tone: "mine" };
  }
  if (found.takenOver) return { key: "turn.hostPlays", params, tone: "other" };
  // A guest who conceded left the seat: nobody holds the hero until the host takes it over or hands it on.
  if (found.seat.holder === null) return { key: "turn.vacant", params: { hero }, tone: "away" };
  if (found.away) return { key: "turn.away", params, tone: "away" };
  return { key: acting.kind === "turn" ? "turn.theirTurn" : "turn.waiting", params, tone: "other" };
}
