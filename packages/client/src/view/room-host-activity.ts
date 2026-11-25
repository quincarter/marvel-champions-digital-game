/**
 * The lobby's "what is the host doing" status line (issue #880): words for the host's setup step, and the animated dots
 * after them. The room relays the step (`host-activity`) and never stores it; the lobby shows it in its status bar.
 */
import type { RoomHostActivity } from "../live/room-state.js";
import type { Words } from "./room-lobby-model.js";

/** The line for a step, or null when the host is not in a setup screen. */
export function hostActivityWords(activity: RoomHostActivity | null): Words | null {
  if (!activity) return null;
  switch (activity.step) {
    case "scenario":
      return { key: "room.activity.scenario" };
    case "table":
      return activity.scenario
        ? { key: "room.activity.tableScenario", params: { scenario: activity.scenario } }
        : { key: "room.activity.table" };
    case "modular":
      return { key: "room.activity.modular" };
    case "decks":
      return { key: "room.activity.decks" };
    case "starting":
      return { key: "room.activity.starting" };
  }
}

/** How long each dot count shows. */
export const ACTIVITY_DOT_MS = 400;

/** The ellipsis at `ms`: one, two, then three dots, around again. A static three under reduced motion. */
export function activityDots(ms: number, reducedMotion: boolean): string {
  if (reducedMotion) return "...";
  return ".".repeat((Math.floor(Math.max(0, ms) / ACTIVITY_DOT_MS) % 3) + 1);
}
