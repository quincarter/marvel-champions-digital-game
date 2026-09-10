import type { CardId } from "./ids.js";

export type CoreAspect = "aggression" | "justice" | "leadership" | "protection" | "basic" | "pool";

/**
 * Signature cards are printed with the owning hero's symbol instead of an
 * aspect icon. Tagged with the identity's CardId so "which hero" is traceable
 * to an actual identity record rather than a free string.
 */
export type HeroAspect = `hero:${string}`;
export type Aspect = CoreAspect | HeroAspect;

export const heroAspect = (heroIdentityId: CardId): HeroAspect => `hero:${heroIdentityId}`;
