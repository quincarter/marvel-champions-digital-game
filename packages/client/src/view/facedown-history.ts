/**
 * What a card was while it sat in play facedown, for lines written after it left play (#291).
 *
 * The log, the villain-phase walkthrough and its recap are all written from the state after a whole command, and one
 * command often carries a whole villain phase. A facedown Drone that attacks and then dies to Retaliate in that same
 * command is in its owner's discard pile, faceup, by the time anything reads it, so "Drone attacks you" came out as
 * "Indomitable attacks you". The engine says what the card was treated as on the event that took it out of play
 * (`characterDefeated` / `cardDiscardedFromPlay` `facedownAs`); this module looks for that event later in the command.
 */

import type { FacedownRole, GameEvent, InstanceId } from "@mc/engine";

/** "Drone": what a facedown card is treated as, the same words `cardName` uses for one still in play. */
export const facedownRoleName = (role: FacedownRole): string => role.traits.join(" ") || "facedown minion";

/**
 * The role `id` had in play facedown, when an event after `at` in this command's `events` takes it out of play
 * facedown; null when it stays, was faceup, or the command says nothing more about it.
 */
export function facedownUntilLater(events: readonly GameEvent[], at: number, id: InstanceId): FacedownRole | null {
  for (let i = at + 1; i < events.length; i++) {
    const later = events[i]!;
    if ((later.type === "characterDefeated" || later.type === "cardDiscardedFromPlay") && later.instanceId === id) {
      return later.facedownAs ?? null;
    }
  }
  return null;
}

/** Ultron's Drone minions (`01140` Ultron Drones): a player's card in play facedown "as a Drone minion". */
export const isDroneRole = (role: FacedownRole | null | undefined): boolean =>
  role?.kind === "minion" && role.traits.some((trait) => String(trait).toLowerCase() === "drone");
