/**
 * Setting the table up for a room (issue #880): the existing New game flow (scenario, seats, Table setup) run in "room
 * mode". The host opens it from the lobby; where it would deal the game it instead hands its draft back here and
 * returns to the lobby, the draft's heroes becoming the room's seats. Start (in the lobby) then deals the game from the
 * kept draft.
 *
 * Module state, as `view/builder-origin` style flows keep theirs: a screen reload leaves room mode, which is right (the
 * room does not survive one either).
 */
import type { SetupDraft } from "./setup-draft.js";
import type { LobbySeatSpec } from "../live/room-state.js";

interface RoomTable {
  /** True while the New game flow is the room host's: its last step returns to the lobby. */
  active: boolean;
  /** The draft the host finished the flow with. */
  draft: SetupDraft | null;
}

const table: RoomTable = { active: false, draft: null };

/** The host is setting up a table for the room: Title's Back and Table setup's last button go to the lobby. */
export const roomSetupActive = (): boolean => table.active;

export function enterRoomSetup(): void {
  table.active = true;
}

/** Leaves room mode, keeping the draft. */
export function leaveRoomSetup(): void {
  table.active = false;
}

/** The host finished the flow: the draft is kept for Start. */
export function keepRoomDraft(draft: SetupDraft): void {
  table.draft = draft;
  table.active = false;
}

export const roomDraft = (): SetupDraft | null => table.draft;

/** Forgets the table (the room was left or closed). */
export function clearRoomTable(): void {
  table.active = false;
  table.draft = null;
}

/** The longest seat label the room takes. */
export const SEAT_LABEL_MAX = 80;

/** Seat ids the room takes are `s1`..`s4`. */
const seatIdOf = (index: number): string => `s${index + 1}`;

/** One seat per hero in the draft: the hero and deck as the label. `names[i]` is seat i's label, already worded. */
export function seatSpecsOf(names: readonly string[]): readonly LobbySeatSpec[] {
  return names.map((name, index) => ({
    id: seatIdOf(index),
    label: name.trim().slice(0, SEAT_LABEL_MAX) || seatIdOf(index),
  }));
}

/**
 * A seat's label: the hero and the deck, or the deck alone when its name already says the hero ("Spider-Man (Justice) -
 * Core Set starter deck" names Spider-Man), so a label never says the hero twice.
 */
export function seatLabelOf(hero: string | null, deck: string | null): string {
  const heroShort = hero?.replace(/\s*\(.*\)\s*$/, "").trim() ?? "";
  if (deck && heroShort !== "" && deck.toLowerCase().includes(heroShort.toLowerCase())) return deck.trim();
  return [hero, deck].filter((part): part is string => !!part && part.trim() !== "").join(" - ");
}
