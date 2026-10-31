/**
 * Which picture the hero tiles on Take Your Seats show (`Settings.heroArt`): the game's own painted art, the card, or
 * an earned promo card. The screen's art button and Settings ▸ Cards both set it.
 *
 * Pure: `scenes/seats.ts` draws what this picks, and falls back to the game art when it picks nothing.
 */
import type { AnyCard } from "@mc/content";
import { artFor, type ArtSource } from "../art/art-source.js";
import type { Picture } from "../art/pictures.js";
import { promoFaceArt, type PromoSet } from "../art/promo-art.js";
import type { HeroArt } from "../settings.js";

export const HERO_ART_LABELS: Readonly<Record<HeroArt, string>> = {
  game: "Game art",
  card: "Card art",
  promo: "Promo art",
};

/** Whether Promo art is on offer: a hero's promo is earned and promo art is on. A villain's or event's is no tile's. */
export const heroPromoShown = (earnedSets: readonly PromoSet[], promoArtOn: boolean): boolean =>
  promoArtOn && earnedSets.some(({ earn }) => earn.kind === "heroWins");

/** The choices on offer. */
export const heroArtChoicesOf = (promoShown: boolean): readonly HeroArt[] =>
  promoShown ? ["game", "card", "promo"] : ["game", "card"];

/** The choice in force: Promo art left saved while it is not on offer reads as Game art. */
export const heroArtInForce = (saved: HeroArt, promoShown: boolean): HeroArt =>
  heroArtChoicesOf(promoShown).includes(saved) ? saved : "game";

/** The choice a press of the art button moves to. */
export function nextHeroArt(saved: HeroArt, promoShown: boolean): HeroArt {
  const choices = heroArtChoicesOf(promoShown);
  return choices[(choices.indexOf(heroArtInForce(saved, promoShown)) + 1) % choices.length]!;
}

/** A card picture as a tile's picture. */
const tilePicture = (art: ArtSource): Picture => ({ key: `tile:${art.key}`, url: art.url });

/**
 * The tile's picture for a hero, or null for the game art. Card art is the card as it is drawn in play, so a promo in
 * use shows there too. Promo art is the hero's promo in use, else its first earned printing; a hero with none earned
 * keeps the game art.
 */
export function heroTilePicture(
  choice: HeroArt,
  identity: AnyCard | undefined,
  earnedSets: readonly PromoSet[],
  inUse: readonly string[],
): Picture | null {
  if (!identity) return null;
  if (choice === "card") {
    const art = artFor(identity, { kind: "hero" });
    return art ? tilePicture(art) : null;
  }
  if (choice !== "promo") return null;
  const own = earnedSets.filter(({ earn }) => earn.kind === "heroWins" && earn.identityCardId === identity.id);
  const set = own.find((one) => inUse.includes(one.id)) ?? own[0];
  return set ? tilePicture(promoFaceArt(set, set.faces[0]!)) : null;
}
