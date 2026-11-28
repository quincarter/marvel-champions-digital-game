import { activeSeat } from "../../platform/seat-play.js";
import { roomState, setSeatShowsHand } from "../../platform/room.js";
import { t } from "../../i18n/translate.js";
import { appSession } from "../../session.js";
import { askAllowedOf } from "../../view/room-ask-policy.js";
import { showHandToggleOf } from "../../view/hand-privacy.js";
import { handoverOn, roomChatOn } from "../../view/room-prompts.js";
import { roomCheatsOf } from "../../view/room-strict.js";
import { inRoomGame } from "../../view/whose-turn.js";

/** This device plays a room's game from a seat (a guest): Pause leaves instead of saving, and Concede leaves the seat. */
export const seatGame = (): boolean => activeSeat() !== null;

/** Manual adjust is offered when Settings allows it and the game is not a strict lobby room's (`view/room-strict.ts`). */
export function manualAdjustOn(): boolean {
  // A seated guest does not adjust the table: in a Host control room the same place asks the host for a change (#881).
  if (seatGame()) return askAllowedOf("adjust", roomState().settings);
  return roomCheatsOf(appSession().settings, appSession().store.state.config).manualAdjust;
}

/** The room's chat is on in this room game: Pause has a Chat entry (the stats' place) (#881). */
export function roomChatShown(): boolean {
  const room = roomState();
  return inRoomGame(room) && roomChatOn(room);
}

/** What the Concede confirm says: a guest's Concede is leaving the seat, not ending the game. */
export function concedeSentenceOf(): string {
  if (!seatGame()) return t("pause.concedeSentence");
  return handoverOn(roomState())
    ? `${t("concede.seatTitle")} ${t("concede.seatBody")}`
    : `${t("concede.seatTitle")} ${t("concede.seatStays")}`;
}

/** The "Show my hand" control's words in a room game, else null (single player, offline, every hand already open, no seat). */
export function showHandLabelOf(short: boolean): string | null {
  const toggle = showHandToggleOf(roomState());
  if (!toggle) return null;
  const key = toggle.on ? "room.showHand.hide" : "room.showHand.show";
  return t(short ? (`${key}Short` as "room.showHand.showShort" | "room.showHand.hideShort") : key);
}

/** Flips the hands this device may show; the room echoes the new lobby state, which redraws Pause. */
export function flipShowHand(): void {
  const toggle = showHandToggleOf(roomState());
  if (toggle) for (const seat of toggle.seats) setSeatShowsHand(seat, !toggle.on);
}

/** A change to the room's hand sharing or seats, as a string, so Pause redraws only when it matters. */
export const showHandKey = (): string => JSON.stringify(showHandToggleOf(roomState()));
