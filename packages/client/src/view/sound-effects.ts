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
  | "spell-cast"
  | "cloak-of-levitation"
  | "shield-toss";

/** How loud each one plays, under the music's own level. */
export const SOUND_EFFECT_VOLUME: Readonly<Record<SoundEffect, number>> = {
  "extras-unlocked": 0.7,
  "hand-refill": 0.6,
  "basic-attack": 0.7,
  "basic-thwart": 0.7,
  "card-played": 0.6,
  "spell-cast": 0.7,
  "cloak-of-levitation": 0.7,
  "shield-toss": 0.7,
};

/**
 * A card's own sound, by its name: played when the card is played (in place of the card or Spell sound) or when one of
 * its abilities is used. Doctor Strange's Cloak of Levitation, Captain America's Shield Toss.
 */
export const CARD_SOUNDS: Readonly<Record<string, SoundEffect>> = {
  "Cloak of Levitation": "cloak-of-levitation",
  "Shield Toss": "shield-toss",
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

export interface CardSoundInfo {
  readonly name: string;
  readonly traits: readonly string[];
}

/**
 * The sounds one or more commands make on the table, in the order they play (the owner, 2026-10-17: the card first,
 * then its attack or thwart):
 *
 * 1. A card played (an event too) or a card entering play: the card's own sound (`CARD_SOUNDS`), else the spell sound
 *    when it is a Spell (Doctor Strange's, Adam Warlock's, any hero's), else the card sound.
 * 2. An ability used on a card with its own sound (Cloak of Levitation).
 * 3. A basic attack, then a basic thwart.
 * 4. The end-of-turn draw up to hand size.
 *
 * `cardOf` names a card by id; `abilityCardOf` names the card a `useAbility` command used, by its instance.
 */
export function tableSoundsOf(
  entries: readonly { readonly command: Command | undefined; readonly events: readonly GameEvent[] }[],
  cardOf: (cardId: CardId) => CardSoundInfo | null,
  abilityCardOf: (command: Command & { readonly type: "useAbility" }) => string | null = () => null,
): SoundEffect[] {
  const events = entries.flatMap((entry) => entry.events);
  const played = events.flatMap((event) => {
    const card = event.type === "cardPlayed" ? cardOf(event.cardId) : null;
    return card ? [card] : [];
  });
  const sounds: SoundEffect[] = [];
  const own = played.map((card) => CARD_SOUNDS[card.name]).find((sound) => sound !== undefined);
  if (own) sounds.push(own);
  else if (played.some((card) => card.traits.includes("Spell"))) sounds.push("spell-cast");
  else if (played.length > 0 || cardEnteredPlay(events)) sounds.push("card-played");
  for (const entry of entries) {
    if (entry.command?.type !== "useAbility") continue;
    const name = abilityCardOf(entry.command);
    const sound = name ? CARD_SOUNDS[name] : undefined;
    if (sound && !sounds.includes(sound)) sounds.push(sound);
  }
  if (entries.some((entry) => madeBasicAttack(entry.command, entry.events))) sounds.push("basic-attack");
  if (entries.some((entry) => madeBasicThwart(entry.command, entry.events))) sounds.push("basic-thwart");
  if (refilledHand(events)) sounds.push("hand-refill");
  return sounds;
}
