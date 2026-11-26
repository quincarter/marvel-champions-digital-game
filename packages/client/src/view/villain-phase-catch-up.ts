/**
 * What the villain phase screen takes in for one store update (issue #1017).
 *
 * The screen builds its steps from each command's events (`appendWalkthrough`). A store update normally carries one
 * command's events (`lastEvents`). A room guest's device, though, takes a catch-up without events: a batch of the
 * host's moves after the connection blipped, or the whole log again after a reconnect, arrives as one resumed update
 * (`live/seat-core.ts`). The board is right after it, but a screen that waited for events stayed on the last step it
 * knew (a defend it was paused on) until Skip. Each command's events are still in the command trail
 * (`commandTrail.length === version`), so the screen takes the commands it missed from there, in order.
 */
import type { GameEvent, GameState } from "@mc/engine";

export interface CatchUpSource {
  readonly version: number;
  readonly lastEvents: readonly GameEvent[];
  readonly commandTrail: readonly { readonly events: readonly GameEvent[] }[];
}

/**
 * The event lists to append, oldest first, for an update at `state.version` when the screen has taken in `seen`
 * commands (negative: none yet, so the update's own events, which began the phase). An update that moves one command
 * on with its events is taken as it is; one that skipped commands, or carries none of its own, takes each missed
 * command's events from the trail when the trail holds them. A rewind, or a trail too short, falls back to the update's
 * own events, as before.
 */
export function eventsToTakeIn(seen: number, state: CatchUpSource): readonly (readonly GameEvent[])[] {
  const { version, lastEvents, commandTrail } = state;
  if (seen < 0 || version <= seen) return [lastEvents];
  if (version === seen + 1 && lastEvents.length > 0) return [lastEvents];
  // The trail must line up with the commands exactly: one short (the host's own move, whose trail entry the store adds
  // after this update) or one long falls back to the update's own events.
  if (commandTrail.length !== version) return [lastEvents];
  return commandTrail.slice(seen, version).map((entry) => entry.events);
}

/**
 * The table each taken-in command is read against. Only the last command's table is known (the update's); an earlier
 * one is given the same table with its round wound back by the rounds the commands after it started, since the
 * walkthrough works out which round a command began in from its table's round and its own `roundStarted` events.
 */
export function gamesForTakeIn(takeIn: readonly (readonly GameEvent[])[], game: GameState): readonly GameState[] {
  let later = 0;
  const out: GameState[] = [];
  for (let i = takeIn.length - 1; i >= 0; i--) {
    out[i] = later === 0 ? game : { ...game, round: game.round - later };
    later += (takeIn[i] ?? []).filter((event) => event.type === "roundStarted").length;
  }
  return out;
}
