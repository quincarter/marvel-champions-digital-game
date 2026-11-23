/**
 * When a host who reloaded mid-game may be taken to its board (`scenes/online.ts`). The room worker names the game in
 * progress before the room has answered, and the local save loads meanwhile; neither says this device is still the room
 * host. The board opens only once the room has confirmed it: the connected host of the same room the rejoin named. A host
 * token the room no longer honours falls back to a guest session, and then the game is put away and the player lands in
 * the guest lobby, never on a host board that would run without its room.
 */
export interface HostGameRoom {
  readonly role: "none" | "host" | "guest";
  readonly connection: "idle" | "connecting" | "connected" | "reconnecting" | "ended";
  readonly roomId: string | null;
}

export type HostGameStep =
  /** Still deciding (the save is loading, or the room has not answered): stay where we are. */
  | { readonly kind: "wait" }
  /** Confirmed host of the same room: open the game's screen, or the lobby when the save could not be resumed. */
  | { readonly kind: "open"; readonly toLobby: boolean }
  /** No longer the host: put the loaded game away; the guest lobby opens once that session is connected. */
  | { readonly kind: "put-away"; readonly toLobby: boolean };

/**
 * `screenLoaded`: the save finished loading (resumed or not). `hostRoomId`: the room the rejoin named, learned from the
 * first host state (null until seen). Returns the step and the room id to keep.
 */
export function hostGameStep(
  loaded: { readonly screenLoaded: boolean; readonly resumed: boolean },
  hostRoomId: string | null,
  room: HostGameRoom,
): { readonly step: HostGameStep; readonly hostRoomId: string | null } {
  const named = hostRoomId ?? (room.role === "host" ? room.roomId : null);
  if (!loaded.screenLoaded) return { step: { kind: "wait" }, hostRoomId: named };
  if (room.role === "host" && room.connection === "connected" && room.roomId !== null && room.roomId === named) {
    return { step: { kind: "open", toLobby: !loaded.resumed }, hostRoomId: named };
  }
  if (room.role === "guest" && room.connection !== "idle") {
    return { step: { kind: "put-away", toLobby: room.connection === "connected" }, hostRoomId: named };
  }
  return { step: { kind: "wait" }, hostRoomId: named };
}
