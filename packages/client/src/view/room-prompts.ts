/**
 * The small prompts a room game shows under the board's top bar (issue #881): what the host must decide or may do
 * (a seat's holder is away and the game waits on it, a returned holder to hand a seat back to, a request to undo or
 * change something) and what a seated guest hears back about their own request. Plain data from the room's state;
 * the board draws the first and says how many more wait. Nothing blocks: each is answered, or ignored, in its own time.
 */
import type { MessageKey, Params } from "../i18n/translate.js";
import { seatOfPlayerIn, type RoomState } from "../live/room-state.js";
import { heroNameOf, type Acting } from "./whose-turn.js";

export type RoomPrompt =
  /** Host: the game waits on a seat whose holder is away. */
  | {
      readonly kind: "away";
      readonly seat: string;
      readonly name: string;
      readonly hero: string;
      /** Its holder left the seat (conceded) rather than dropping: nobody holds it. */
      readonly vacant: boolean;
    }
  /** Host: a seat it took over has its holder back. */
  | { readonly kind: "giveBack"; readonly seat: string; readonly name: string; readonly hero: string }
  /** Host: a seat holder asks for an undo or a change. */
  | {
      readonly kind: "request";
      readonly id: string;
      readonly name: string;
      readonly what: "undo" | "adjust";
      readonly note: string;
    }
  /** Guest: my own request, waiting or answered. */
  | { readonly kind: "answer"; readonly what: "undo" | "adjust"; readonly status: "waiting" | "accepted" | "declined" };

/** What a button on a prompt does. */
export type PromptActionId = "take-over" | "give-back" | "accept" | "decline" | "dismiss" | "message" | "wait";

/**
 * Whether the host may take over or hand off a hero when its player leaves (the lobby's "Host can take over or hand off a
 * hero" setting, on unless the host turned it off).
 */
export const handoverOn = (room: Pick<RoomState, "settings">): boolean => room.settings?.handover !== false;

/** The room's chat is on (a room game's in-game chat follows the lobby's setting). */
export const roomChatOn = (room: Pick<RoomState, "settings">): boolean => room.settings?.chat !== false;

export interface PromptAction {
  readonly id: PromptActionId;
  readonly labelKey: MessageKey;
}

export interface PromptView {
  readonly prompt: RoomPrompt;
  readonly titleKey: MessageKey;
  readonly params: Params;
  /** The asker's note, when they wrote one; null otherwise. */
  readonly detail: string | null;
  readonly actions: readonly PromptAction[];
  /** Prompts waiting behind this one. */
  readonly more: number;
}

/** Every prompt for this device now, the most urgent first: a seat the game waits on, a seat to give back, requests, my own answer. */
export function roomPromptsOf(
  room: RoomState,
  acting: Acting | null,
  /** Seats the host chose to wait on: no prompt for them until they change. */
  waiting: ReadonlySet<string> = new Set(),
): readonly RoomPrompt[] {
  const prompts: RoomPrompt[] = [];
  if (room.role === "host") {
    const found = acting ? seatOfPlayerIn(room, acting.playerId) : null;
    if (found && (found.away || found.seat.holder === null) && !found.takenOver && !waiting.has(found.seat.id)) {
      prompts.push({
        kind: "away",
        seat: found.seat.id,
        name: found.holderName ?? "",
        vacant: found.seat.holder === null,
        hero: heroNameOf(found.seat),
      });
    }
    for (const seat of room.seats) {
      if (seat.takenOver && !seat.away && seat.holder !== null) {
        prompts.push({ kind: "giveBack", seat: seat.id, name: seat.holderName ?? "", hero: heroNameOf(seat) });
      }
    }
    for (const request of room.requests) {
      prompts.push({ kind: "request", id: request.id, name: request.name, what: request.what, note: request.note });
    }
  } else if (room.myRequest) {
    prompts.push({ kind: "answer", what: room.myRequest.what, status: room.myRequest.status });
  }
  return prompts;
}

/** The first prompt in words and buttons, or null when there is none. */
export function promptViewOf(
  prompts: readonly RoomPrompt[],
  room: Pick<RoomState, "settings"> = { settings: null },
): PromptView | null {
  const prompt = prompts[0];
  if (!prompt) return null;
  const more = prompts.length - 1;
  switch (prompt.kind) {
    case "away":
      return {
        prompt,
        titleKey: prompt.vacant ? "prompt.vacant" : handoverOn(room) ? "prompt.away" : "prompt.awayWait",
        params: { name: prompt.name, hero: prompt.hero },
        detail: null,
        actions: [
          ...(handoverOn(room) ? [{ id: "take-over" as const, labelKey: "prompt.takeOver" as const }] : []),
          ...(roomChatOn(room) && !prompt.vacant
            ? [{ id: "message" as const, labelKey: "prompt.message" as const }]
            : []),
          { id: "wait", labelKey: "prompt.wait" },
        ],
        more,
      };
    case "giveBack":
      return {
        prompt,
        titleKey: "prompt.back",
        params: { name: prompt.name, hero: prompt.hero },
        detail: null,
        actions: [{ id: "give-back", labelKey: "prompt.giveBack" }],
        more,
      };
    case "request":
      return {
        prompt,
        titleKey: prompt.what === "undo" ? "prompt.asksUndo" : "prompt.asksChange",
        params: { name: prompt.name },
        detail: prompt.note === "" ? null : prompt.note,
        actions: [
          { id: "decline", labelKey: "prompt.decline" },
          { id: "accept", labelKey: "prompt.accept" },
        ],
        more,
      };
    case "answer": {
      const asked = prompt.what === "undo" ? "undo" : "change";
      const titleKey: MessageKey =
        prompt.status === "waiting"
          ? asked === "undo"
            ? "prompt.waitingUndo"
            : "prompt.waitingChange"
          : prompt.status === "accepted"
            ? asked === "undo"
              ? "prompt.acceptedUndo"
              : "prompt.acceptedChange"
            : asked === "undo"
              ? "prompt.declinedUndo"
              : "prompt.declinedChange";
      return {
        prompt,
        titleKey,
        params: {},
        detail: null,
        // A waiting ask can be dismissed too: the host may be slow, and the guest need not stare at it.
        actions: [{ id: "dismiss", labelKey: "prompt.dismiss" }],
        more,
      };
    }
  }
}
