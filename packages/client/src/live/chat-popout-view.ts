/** What the pop-out window says about the room, decided from what it has heard (`chat-popout.html`'s page reads this). */
import type { PopoutSnapshot } from "./chat-popout-protocol.js";

export type PopoutStatus =
  /** Waiting for the first snapshot. */
  | "connecting"
  /** Chat is flowing: lines, field and Send. */
  | "live"
  /** The host switched chat off. */
  | "off"
  /** The room closed (or its connection ended). */
  | "ended"
  /** This device left the room. */
  | "left"
  /** The game window stopped answering its heartbeat (closed or crashed). */
  | "lost";

export function popoutStatusOf(facts: {
  readonly snapshot: PopoutSnapshot | null;
  readonly left: boolean;
  readonly silent: boolean;
}): PopoutStatus {
  if (facts.left) return "left";
  if (facts.silent) return "lost";
  if (!facts.snapshot) return "connecting";
  if (facts.snapshot.ended) return "ended";
  return facts.snapshot.chatOn ? "live" : "off";
}

/** A line can be sent only while chat is flowing. */
export const popoutCanSay = (status: PopoutStatus): boolean => status === "live";

/** Whether the window offers to close itself: whenever the room is no longer there to talk to. */
export const popoutOffersClose = (status: PopoutStatus): boolean =>
  status === "ended" || status === "left" || status === "lost";
