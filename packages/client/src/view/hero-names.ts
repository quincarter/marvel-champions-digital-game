/**
 * A hero's name as the player reads it.
 *
 * Some hero identities share a printed name — Peter Parker's and Miles Morales's are both "Spider-Man", T'Challa's and
 * Shuri's both "Black Panther" — so a roster, a seat or a log line that says "Spider-Man" doesn't say which one. Those
 * heroes are shown with their alter ego: "Spider-Man (Peter Parker)", "Black Panther (Shuri)". The card's own name stays "Spider-Man" in content and
 * the engine, because uniqueness and "named" effects go by the printed title (RRG "Unique"); this is display only.
 */
import type { AnyCard, HeroIdentityCard } from "@mc/content";

/** Hero names printed on more than one hero identity, qualified with the alter ego wherever a hero is named. */
const SHARED_HERO_NAMES: ReadonlySet<string> = new Set(["Spider-Man", "Black Panther"]);

/** "Spider-Man" → "Spider-Man (Peter Parker)" for a hero whose name another hero shares; any other name as is. */
export function qualifiedHeroName(identity: HeroIdentityCard, name: string = identity.name): string {
  return SHARED_HERO_NAMES.has(name) ? `${name} (${identity.alterEgo.faceName})` : name;
}

/** The identity's hero-side name, qualified: what the hero face is called on the table. */
export function heroFaceDisplayName(identity: HeroIdentityCard): string {
  return qualifiedHeroName(identity, identity.hero.faceName);
}

/** Any card's display name: a hero identity qualified as above, everything else its printed name. */
export function cardDisplayName(card: AnyCard): string {
  return card.type === "hero_identity" ? qualifiedHeroName(card) : card.name;
}
