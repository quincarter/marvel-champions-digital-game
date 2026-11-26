/**
 * What a room's state changes tell the player, as plain data (issue #880, docs/live-game-rooms.md section 8): who joined
 * or left, which chat lines are new, when a sound plays, and how many chat lines are unread. `scenes/room-notice-watch.ts`
 * feeds these from `onRoomState` and plays the sounds; `scenes/room-toast.ts` draws the toasts; the lobby's Chat tab
 * shows the unread count. No timers or Phaser here, so every rule is a plain test.
 */
import type { RoomChatLine, RoomDevice, RoomProblem, RoomState } from "../live/room-state.js";
import { closedUnderPlayer } from "./room-lobby-model.js";
import { lobbyUndoFor } from "@mc/sync-worker/room-protocol";

/** One person arriving in or leaving the room I am in. */
export interface ParticipantChange {
  readonly kind: "joined" | "left";
  readonly id: string;
  /** Empty when they sent no name. */
  readonly name: string;
  readonly device: RoomDevice | undefined;
}

/**
 * Who came or went between two room states. Nothing is reported for my own arrival (the first roster), for a new
 * socket of mine (a reconnect gets a new id and a fresh roster: those who came meanwhile are not news) or for me.
 */
export function participantChanges(prev: RoomState, next: RoomState): ParticipantChange[] {
  if (!prev.me || !next.me || prev.me.id !== next.me.id) return [];
  if (next.connection !== "connected" || prev.connection !== "connected") return [];
  const before = new Map(prev.participants.map((p) => [p.id, p]));
  const after = new Map(next.participants.map((p) => [p.id, p]));
  const changes: ParticipantChange[] = [];
  for (const p of next.participants) {
    if (!p.me && !before.has(p.id)) changes.push({ kind: "joined", id: p.id, name: p.name, device: p.device });
  }
  for (const p of prev.participants) {
    if (!p.me && !after.has(p.id)) changes.push({ kind: "left", id: p.id, name: p.name, device: p.device });
  }
  return changes;
}

/** The chat lines that arrived live between two states and are not mine (the backlog on joining is history). */
export function newChatFromOthers(prev: RoomState, next: RoomState): RoomChatLine[] {
  const fresh = next.chatLive - prev.chatLive;
  if (fresh <= 0 || prev.roomId !== next.roomId) return [];
  return next.chat.slice(-fresh).filter((line) => !line.mine);
}

/**
 * Requests that reached the host since `prev` (a guest asking for an Undo or a change): they sound, focused window or
 * not, because a host who missed the prompt kept the asker waiting (GarethMagis, 2026-11-25).
 */
export function newRequestsForHost(prev: RoomState, next: RoomState): RoomState["requests"] {
  if (next.role !== "host" || prev.roomId !== next.roomId) return [];
  const known = new Set((prev.requests ?? []).map((request) => request.id));
  return (next.requests ?? []).filter((request) => !known.has(request.id));
}

/**
 * The new requests the host's device answers by itself: a guest's Undo when the room lets each player take back their
 * own moves (`LobbyUndo` `own`). The host's usual Undo for that guest's hero does it, within single player's limits, and
 * nothing is asked of the host (or sounded).
 */
export function selfAnsweredRequests(prev: RoomState, next: RoomState): RoomState["requests"] {
  return newRequestsForHost(prev, next).filter((request) => selfAnswered(next, request));
}

/**
 * Whether the host's device answers `request` by itself: an Undo while the room lets each player take back their own
 * moves, and bound to the table the guest saw (`RoomRequest.base` / `target`).
 */
export function selfAnswered(room: RoomState, request: RoomState["requests"][number]): boolean {
  const settings = room.settings;
  // Only a bound Undo: one asked under "Ask the host" before the host switched stays the host's to answer.
  return (
    room.role === "host" &&
    request.what === "undo" &&
    request.base !== undefined &&
    request.target !== undefined &&
    !!settings &&
    lobbyUndoFor(settings.playMode, settings.undo) === "own"
  );
}

/** The new requests the host is asked to answer, and hears: every one it does not answer by itself. */
export function requestsForHostToAnswer(prev: RoomState, next: RoomState): RoomState["requests"] {
  const self = new Set(selfAnsweredRequests(prev, next).map((request) => request.id));
  return newRequestsForHost(prev, next).filter((request) => !self.has(request.id));
}

/** The sounds a state change calls for: someone else joined, and chat from someone else (when allowed to sound). */
export interface NoticeSounds {
  readonly roomEnter: boolean;
  readonly chatMessage: boolean;
}

/** A chat line sounds at most this often, and only while the window is away. */
export const CHAT_SOUND_GAP_MS = 3000;

/** The throttle for the chat sound: one per `CHAT_SOUND_GAP_MS`, never while the window has focus. */
export class ChatSoundGate {
  #last = Number.NEGATIVE_INFINITY;

  /** True when a line from someone else should sound now; records it when it does. */
  take(now: number, windowFocused: boolean): boolean {
    if (windowFocused || now - this.#last < CHAT_SOUND_GAP_MS) return false;
    this.#last = now;
    return true;
  }
}

/** The scenes of a game in progress, whose player is taken out when the room is closed under them. */
export const IN_GAME_SCENES: ReadonlySet<string> = new Set([
  "SetupDeal",
  "ScenarioIntro",
  "ReplayVersus",
  "Board",
  "VillainPhaseOverlay",
]);

/**
 * The room just closed under a player who is in a game (the host closed it, it sat idle, or rooms were switched off):
 * the problem to show on Play online, else null. The lobby, Play online and the deck picker deal with their own
 * endings, and a game that is over (Game Over up) keeps its own end-of-game screen, so this fires only while a game
 * scene is up and no Game Over is. Only the moment of ending counts (not each later state of an ended room).
 */
export function roomClosedInGame(
  before: Pick<RoomState, "connection">,
  next: Pick<RoomState, "connection"> & { readonly problem?: RoomState["problem"] },
  activeScenes: readonly string[],
): RoomProblem | null {
  if (before.connection === "ended" || next.connection !== "ended" || !closedUnderPlayer(next.problem ?? null))
    return null;
  if (activeScenes.includes("GameOver")) return null;
  return activeScenes.some((key) => IN_GAME_SCENES.has(key)) ? (next.problem ?? null) : null;
}

/** Whether this window is in front of the player: focused and visible. Read from the document, never from Phaser. */
export function windowFocused(doc: Pick<Document, "hasFocus" | "visibilityState"> | undefined): boolean {
  if (!doc) return true;
  return doc.visibilityState !== "hidden" && doc.hasFocus();
}

/**
 * Chat lines from others since the player last looked at the Chat tab: `seenLive` is `chatLive` at that moment.
 * Lines I said myself never count, and a count past the kept lines is cut to what is kept.
 */
export function unreadChatCount(state: Pick<RoomState, "chat" | "chatLive">, seenLive: number): number {
  const fresh = Math.min(Math.max(0, state.chatLive - seenLive), state.chat.length);
  if (fresh === 0) return 0;
  return state.chat.slice(-fresh).filter((line) => !line.mine).length;
}

/** What the lobby has seen of the chat: kept across screens for one room, so leaving and returning keeps the count. */
export class ChatSeen {
  #roomId: string | null = null;
  #seenLive = 0;

  /** The `chatLive` count the player has seen in this room: a new room starts at none (the backlog never counts). */
  seenFor(roomId: string | null): number {
    if (roomId !== this.#roomId) {
      this.#roomId = roomId;
      this.#seenLive = 0;
    }
    return this.#seenLive;
  }

  /** The player looked at the chat: everything so far is read. */
  markSeen(roomId: string | null, chatLive: number): void {
    this.#roomId = roomId;
    this.#seenLive = chatLive;
  }
}
