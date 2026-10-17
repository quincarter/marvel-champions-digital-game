/**
 * The game's sound effects (the owner's picks, 2026-10-17), and when the table plays them. The files live in
 * `audio/sfx/`, outside `music/`, so the jukebox never lists them; the music controller plays them
 * (`audio/music-controller.ts`'s `playEffect`).
 */
import type { Command, GameEvent } from "@mc/engine";

export type SoundEffect = "extras-unlocked" | "hand-refill" | "basic-attack";

/** How loud each one plays, under the music's own level. */
export const SOUND_EFFECT_VOLUME: Readonly<Record<SoundEffect, number>> = {
  "extras-unlocked": 0.7,
  "hand-refill": 0.6,
  "basic-attack": 0.7,
};

/** True when a command's events refilled a hand at the end of the player phase (RRG 1.8 p. 18, step 2). */
export function refilledHand(events: readonly GameEvent[]): boolean {
  return events.some((event) => event.type === "handRefilled" && event.drawn > 0);
}

/**
 * True when a command made a basic attack: the Attack button (a hero's or an ally's), or a card that had a character
 * make one (`basicPowerInstructed`, "make a basic attack").
 */
export function madeBasicAttack(command: Command | undefined, events: readonly GameEvent[]): boolean {
  if (command?.type === "basicAttack") return true;
  return events.some((event) => event.type === "basicPowerInstructed" && event.power === "attack");
}
