/**
 * The game's sound effects (the owner's picks, 2026-10-17), and when the table plays them. The files live in
 * `audio/sfx/`, outside `music/`, so the jukebox never lists them; the music controller plays them
 * (`audio/music-controller.ts`'s `playEffects`).
 */
import type { CardId } from "@mc/content";
import type { Command, GameEvent, ZoneId } from "@mc/engine";

export type SoundEffect =
  | "extras-unlocked"
  | "hand-refill"
  | "basic-attack"
  | "basic-thwart"
  | "card-played"
  | "spell-cast";

/** How loud each one plays, under the music's own level. */
export const SOUND_EFFECT_VOLUME: Readonly<Record<SoundEffect, number>> = {
  "extras-unlocked": 0.7,
  "hand-refill": 0.6,
  "basic-attack": 0.7,
  "basic-thwart": 0.7,
  "card-played": 0.6,
  "spell-cast": 0.7,
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

/** The same for a basic thwart: the Thwart button, or a card that has a character make one. */
export function madeBasicThwart(command: Command | undefined, events: readonly GameEvent[]): boolean {
  if (command?.type === "basicThwart") return true;
  return events.some((event) => event.type === "basicPowerInstructed" && event.power === "thwart");
}

const IN_PLAY: ReadonlySet<ZoneId["kind"]> = new Set(["playArea", "villainArea", "attachment", "scenarioPlayArea"]);

/**
 * True when a card entered play from out of play: a hero's card played to their play area (or attached), a minion or
 * attachment the villain side put out, a side scheme. A card moving between two in-play places (a minion changing
 * engagement, an attachment moving hosts) is not entering play, and makes no sound.
 */
export function cardEnteredPlay(events: readonly GameEvent[]): boolean {
  return events.some(
    (event) => event.type === "cardMoved" && IN_PLAY.has(event.to.kind) && !IN_PLAY.has(event.from.kind),
  );
}

/**
 * The sounds one or more commands make on the table, in the order they play (the owner, 2026-10-17: the card first,
 * then its attack or thwart):
 *
 * 1. A card played (an event too) or a card entering play: the spell sound when a played card is a Spell (Doctor
 *    Strange's, Adam Warlock's, any hero's), else the card sound.
 * 2. A basic attack, then a basic thwart.
 * 3. The end-of-turn draw up to hand size.
 */
export function tableSoundsOf(
  entries: readonly { readonly command: Command | undefined; readonly events: readonly GameEvent[] }[],
  traitsOf: (cardId: CardId) => readonly string[],
): SoundEffect[] {
  const events = entries.flatMap((entry) => entry.events);
  const played = events.flatMap((event) => (event.type === "cardPlayed" ? [event.cardId] : []));
  const sounds: SoundEffect[] = [];
  if (played.some((cardId) => traitsOf(cardId).includes("Spell"))) sounds.push("spell-cast");
  else if (played.length > 0 || cardEnteredPlay(events)) sounds.push("card-played");
  if (entries.some((entry) => madeBasicAttack(entry.command, entry.events))) sounds.push("basic-attack");
  if (entries.some((entry) => madeBasicThwart(entry.command, entry.events))) sounds.push("basic-thwart");
  if (refilledHand(events)) sounds.push("hand-refill");
  return sounds;
}
