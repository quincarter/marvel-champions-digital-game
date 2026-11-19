/**
 * The picture that stands for a game's villain and each of its heroes: the hero's or scenario's own artwork, else the
 * card's scan; for a custom hero or villain, its pack's picture or scan from the game's own packs (#758). Past games'
 * covers (`scenes/past-games.ts`) and a shared replay's versus screen (`scenes/replay-versus.ts`, #858) both use it.
 */
import { CARDS_BY_ID, POOL_CARDS } from "../content/pool.js";
import { packPictureFor } from "./pack-art.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { isCustomCard } from "../view/custom-content.js";
import { artFor } from "./art-source.js";
import { HERO_ART, heroArtForIdentity } from "./hero-art.js";
import { ART_CATALOG, villainArtFor } from "./scenario-art.js";
import { cardInPacks } from "../view/game-label-names.js";
import type { PictureFocus } from "./focus.js";

/** Each hero's picture by identity, kept while the app runs (finding one walks the pool). */
const heroPictures = new Map<string, string | null>();

/** A hero's picture by identity card id, or null when there is none. */
export function heroPictureOf(identityCardId: string, packs: readonly PackRuntime[] | undefined): string | null {
  // A pack's hero: its own picture, or its card's scan, from the pack installed now. Not cached: the picture arrives a
  // moment after the pack loads, and a pack removed since the game was played has none (#758).
  if (isCustomCard(identityCardId)) {
    const card = cardInPacks(packs, identityCardId);
    return packPictureFor("hero", identityCardId)?.url ?? artFor(card, { kind: "front" })?.url ?? null;
  }
  if (!heroPictures.has(identityCardId)) {
    const art = heroArtForIdentity(HERO_ART, identityCardId, POOL_CARDS, () => 0)?.url ?? null;
    heroPictures.set(identityCardId, art ?? artFor(CARDS_BY_ID.get(identityCardId), { kind: "front" })?.url ?? null);
  }
  return heroPictures.get(identityCardId) ?? null;
}

/** Where the hero is in its own artwork (its `focus.json`), when the art says. */
export function heroFocusOf(identityCardId: string): PictureFocus | null {
  if (isCustomCard(identityCardId)) return null;
  return heroArtForIdentity(HERO_ART, identityCardId, POOL_CARDS, () => 0)?.focus ?? null;
}

/** A scenario's villain picture (`villainCardId` is the card that pictures it), or null when there is none. */
export function villainPictureOf(
  scenarioId: string,
  villainCardId: string | null,
  packs: readonly PackRuntime[] | undefined,
): string | null {
  if (villainCardId && isCustomCard(villainCardId)) {
    const card = cardInPacks(packs, villainCardId);
    return packPictureFor("villain", villainCardId)?.url ?? artFor(card, { kind: "front" })?.url ?? null;
  }
  return (
    villainArtFor(ART_CATALOG, scenarioId, () => 0)?.url ??
    (villainCardId ? (artFor(CARDS_BY_ID.get(villainCardId), { kind: "front" })?.url ?? null) : null)
  );
}
