export type { RoomDialogEvent, RoomGiveModel } from "../room-dialogs.types.js";

/** The stop key of the person `id` (`give:<id>`). */
export const giveStopOf = (id: string): string => `give:${id}`;
