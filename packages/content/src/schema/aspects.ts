import type { CardId } from "./ids.js";

export type CoreAspect = "aggression" | "justice" | "leadership" | "protection" | "basic" | "pool";

/**
 * Signature cards are printed with the owning hero's symbol instead of an
 * aspect icon. Tagged with the identity's CardId so "which hero" is traceable
 * to an actual identity record rather than a free string.
 */
export type HeroAspect = `hero:${string}`;

/**
 * A player card printed with no identity, aspect or basic classification at all: its only classification is
 * scenario-specific or campaign-specific (RRG 1.8 "Classifications", p. 12), recorded on
 * `PlayerCardCommon.specificTo`. The Rise of Red Skull's Captive allies (Moon Knight, Shang-Chi, White Tiger, Elektra)
 * are ally cards in the Taskmaster encounter set. Curation must confirm from the card image that no aspect or
 * "Basic" is printed before using this value; a card printed "Campaign / Basic" is `"basic"` with `specificTo`.
 */
export type UnclassifiedAspect = "none";

export type Aspect = CoreAspect | HeroAspect | UnclassifiedAspect;

export const heroAspect = (heroIdentityId: CardId): HeroAspect => `hero:${heroIdentityId}`;
