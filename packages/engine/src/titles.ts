/**
 * Naming a character by title, the way Team-Up cards do (docs/phase7-wave3.md §3.34).
 *
 * RRG 1.8 "Team-Up" (p. 43) spells the keyword out as a constant: "You cannot include this card in your deck unless
 * your alter-ego or hero title matches name 1 or name 2. You cannot play this card unless there is a friendly
 * character in play whose title or subtitle matches name 1 and a friendly character in play whose title or subtitle
 * matches name 2." Its effects then name the same characters: "Ready Cyclops and Phoenix", "Heal 3 damage each from
 * Gwen Stacy and Miles Morales", "a Rocket Raccoon upgrade", "the total ATK of Colossus and Wolverine". Every reader
 * of those names goes through here, so the play check, deckbuilding and card effects cannot disagree.
 *
 * - **A character in play** matches a name by the title it is showing: an identity by its faceup side only (RRG 1.8
 *   "Identity", p. 23: "If a card refers to a hero or alter-ego by title, it refers only to the identity with that
 *   title, and not to the other side of the card"), any other character by its title or subtitle (RRG 1.8
 *   "Subtitle", p. 41). Groot and Rocket Raccoon print the same title on both sides; Gwen Stacy / Miles Morales and
 *   Cindy Moon / Peter Parker are alter-ego titles, which match only while that side is up.
 * - **An identity card** (deckbuilding, and "a <name> card" for an identity-specific set) matches by any of its
 *   titles: its hero face(s), its alter-ego face, or the card's own name.
 * - **"Hero/Alter-ego"** — "Black Panther/T'Challa and Black Panther/Shuri" (Heart of the Panther, `bp` 51025) — names
 *   one identity card by both of its sides, because the two Black Panthers share a hero title. It matches an identity
 *   whose hero face is the first half and whose alter-ego face is the second, whichever side is up. A reading of the
 *   printed disambiguation (§4 Q13): no rule text covers the slash.
 */

import type { AnyCard, HeroIdentityCard } from "@mc/content";
import type { InstanceId } from "./ids.js";
import { cardOf, getInstance, heroFacesOf, titleShowing } from "./query.js";
import type { GameState } from "./state.js";

/** "Black Panther/T'Challa" → `["Black Panther", "T'Challa"]`; a plain name → null. */
function slashName(name: string): readonly [string, string] | null {
  const slash = name.indexOf("/");
  if (slash < 0) return null;
  const hero = name.slice(0, slash).trim();
  const alterEgo = name.slice(slash + 1).trim();
  return hero && alterEgo ? [hero, alterEgo] : null;
}

/** Whether an identity card is named by `name`, by any of its titles (deckbuilding, identity-specific sets). */
export function identityCardTitledAs(card: HeroIdentityCard, name: string): boolean {
  const heroTitles = heroFacesOf(card).map((face) => face.faceName);
  const both = slashName(name);
  if (both) return heroTitles.includes(both[0]) && card.alterEgo.faceName === both[1];
  return card.name === name || card.alterEgo.faceName === name || heroTitles.includes(name);
}

/** Whether the character `id` is named by `name` right now (see the module docblock). Facedown cards have no title. */
export function characterTitledAs(state: GameState, id: InstanceId, name: string): boolean {
  const instance = getInstance(state, id);
  const card: AnyCard | undefined = cardOf(state, id);
  if (!instance || !card || instance.facedownAs) return false;
  const isIdentity = card.type === "hero_identity" && state.players.some((p) => p.identity.instanceId === id);
  const both = slashName(name);
  if (both) return isIdentity && card.type === "hero_identity" && identityCardTitledAs(card, name);
  if (isIdentity) return titleShowing(state, id) === name;
  return titleShowing(state, id) === name || ("subtitle" in card && card.subtitle === name);
}
