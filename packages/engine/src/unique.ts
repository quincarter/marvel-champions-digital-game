/**
 * RRG "Unique Icon ()" — one copy of a unique card, by *match*, in play across the table.
 *
 * Source: Marvel Champions Rules Reference, version 1.8 (© 2026), pp. 45–46, entry
 * "Unique Icon ()". Version 1.8 replaced the older "by title, with carve-outs for
 * identities and allies" wording with a single symmetric *match* predicate, quoted in
 * full here because everything in this module is a direct transcription of it:
 *
 *   "The unique icon indicates a card that represents a singular person, place, or thing
 *    within the Marvel universe.
 *    - Two unique cards are considered to 'match' if any of the following apply:
 *        - The two cards share a title, and both have no subtitle and no alter-ego title.
 *          (For example, two copies of the Jarnbjorn upgrade, or the Jessica Jones ally
 *          and the Jessica Jones minion.)
 *        - The subtitle or alter-ego title of one matches the title, subtitle, or
 *          alter-ego title of the other. (For example, the identity with the T'Challa
 *          alter-ego, the T'Challa ally, and the Black Panther ally with the subtitle
 *          'T'Challa' are all considered to match.)
 *    - During deckbuilding, a player cannot include multiple matching cards in their deck.
 *      The identity is included in this evaluation. [...]
 *    - When choosing identities during setup, players cannot choose identities that match.
 *        - The players may choose a scenario even if one or more villains match one or
 *          more chosen identities.
 *    - A non-villain card in an out-of-play state that matches a card in play cannot enter
 *      play. If the out-of-play card is:
 *        - A player card, it cannot be played or put into play. Any effect that attempts
 *          to do so has no effect.
 *        - A non-villain encounter card, it is discarded and any effects of it entering
 *          play are ignored. If it was being revealed, any effects of it being revealed
 *          are ignored and the player revealing it is dealt a facedown encounter card."
 *
 * Two consequences worth spelling out, because they are easy to get wrong:
 *
 * 1. Matching is a pairwise *relation*, not an equivalence class, so it cannot be reduced
 *    to a string key. It is not transitive: "X" (bare) matches "Y (X)", and "Y (X)"
 *    matches "Z (Y)", but "X" does not match "Z (Y)". Every check here is a pairwise scan.
 * 2. The restriction is on the card *entering* play being non-villain. Nothing exempts a
 *    card already *in* play — a villain in play still blocks a matching minion from
 *    entering (FFG's Ronan the Accuser ruling), and an identity in play still blocks a
 *    matching ally.
 */

import type { AnyCard } from "@mc/content";
import type { InstanceId } from "./ids.js";
import { cardOf, getInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { GameState } from "./state.js";

/** The three names RRG 1.8 compares. `null` means the card does not have that name. */
export interface UniqueNames {
  readonly title: string;
  readonly subtitle: string | null;
  /** Only an identity card has one: the title printed on its alter-ego side. */
  readonly alterEgoTitle: string | null;
}

export const uniqueNamesOf = (card: AnyCard): UniqueNames => ({
  title: card.name,
  subtitle: card.subtitle ?? null,
  alterEgoTitle: card.type === "hero_identity" ? card.alterEgo.faceName : null,
});

/**
 * Every printed identity card carries the unique icon, and the RRG's deckbuilding half of
 * the same entry says so outright ("The identity is included in this evaluation"), so an
 * identity is treated as unique by rule rather than by data flag.
 */
export const isUnique = (card: AnyCard): boolean => card.unique || card.type === "hero_identity";

const isBare = (names: UniqueNames): boolean => names.subtitle === null && names.alterEgoTitle === null;

/** Title, subtitle and alter-ego title: everything the *other* card's names are compared against. */
const allNames = (names: UniqueNames): readonly string[] =>
  [names.title, names.subtitle, names.alterEgoTitle].filter((n): n is string => n !== null);

/** Subtitle and alter-ego title: the names that do the comparing in the second bullet. */
const secondaryNames = (names: UniqueNames): readonly string[] =>
  [names.subtitle, names.alterEgoTitle].filter((n): n is string => n !== null);

/** RRG 1.8 "Unique Icon", bullet 1 — the match predicate, transcribed. Symmetric by construction. */
export function cardsMatch(a: AnyCard, b: AnyCard): boolean {
  if (!isUnique(a) || !isUnique(b)) return false;
  const x = uniqueNamesOf(a);
  const y = uniqueNamesOf(b);
  // "The two cards share a title, and both have no subtitle and no alter-ego title."
  if (x.title === y.title && isBare(x) && isBare(y)) return true;
  // "The subtitle or alter-ego title of one matches the title, subtitle, or alter-ego
  // title of the other." Checked in both directions — "of one"/"of the other" is symmetric.
  const yNames = allNames(y);
  const xNames = allNames(x);
  return secondaryNames(x).some((n) => yNames.includes(n)) || secondaryNames(y).some((n) => xNames.includes(n));
}

/**
 * The card already in play that `card` would match, or `null` if it may enter play.
 *
 * Facedown cards in play (drones, facedown encounter cards) are skipped: a facedown card
 * shows no title, so it cannot be matched against.
 */
export function matchingCardInPlay(
  state: GameState,
  card: AnyCard,
  ignore: ReadonlySet<InstanceId> = new Set(),
): InstanceId | null {
  if (!isUnique(card)) return null;
  for (const id of cardsInPlay(state)) {
    if (ignore.has(id)) continue;
    const instance = getInstance(state, id);
    if (!instance || !instance.faceup) continue;
    const other = cardOf(state, id);
    if (other && cardsMatch(card, other)) return id;
  }
  return null;
}

/**
 * Card types that enter play when a player plays them (RRG "Enters Play").
 *
 * Events and resources are deliberately absent: RRG "Event" says the played event "is not
 * in play", so a unique event is never a card entering play and the uniqueness rule — whose
 * premise is "...cannot enter play" — does not reach it. Resources are discarded to pay
 * costs, never played.
 */
const ENTERS_PLAY_WHEN_PLAYED: ReadonlySet<AnyCard["type"]> = new Set<AnyCard["type"]>([
  "ally",
  "support",
  "upgrade",
  "player_side_scheme",
]);

export const entersPlayWhenPlayed = (card: AnyCard): boolean => ENTERS_PLAY_WHEN_PLAYED.has(card.type);

/** How the engine names a card for a uniqueness message: "Black Panther (T'Challa)". */
export const uniqueLabel = (card: AnyCard): string => {
  const names = uniqueNamesOf(card);
  const qualifier = names.subtitle ?? names.alterEgoTitle;
  return qualifier === null ? names.title : `${names.title} (${qualifier})`;
};

/** The message a client can show verbatim when a unique card is refused. */
export const uniqueBlockedMessage = (entering: AnyCard, inPlay: AnyCard): string =>
  `${uniqueLabel(entering)} matches ${uniqueLabel(inPlay)}, already in play: the players as a group may have only one copy of each unique card in play`;
