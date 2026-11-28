/**
 * The pictures of a finished game for `mc-past-game-pictures`: the villain's and each hero's card, from the game's own
 * packs (a custom hero or scenario, embedded at save time, still pictures after its pack is gone, #758). Pictures are
 * leased (`dom/picture-leases.ts`): a pack scan's blob URL is held while it is mounted.
 */
import type { AnyCard } from "@mc/content";
import type { PictureSource } from "@mc/ui";
import type { PackRuntime } from "../../packs/pack-runtime.js";
import type { ArtSource } from "../../art/art-source.js";
import { heroSourceOf, villainSourceOf } from "../../art/matchup-pictures.js";
import type { PictureLeases } from "../../dom/picture-leases.js";
import type { PastGamePicture } from "../../components/past-games/mc-past-game-pictures/mc-past-game-pictures.types.js";
import { cardInPacks } from "../../view/game-label-names.js";
import { aspectBadgesOf, type PastGameRow } from "../../view/past-games-model.js";

/** At most the villain and this many heroes are pictured on a game (a game seats four). */
const MAX_PICTURED_HEROES = 4;

const packsOf = (row: PastGameRow): readonly PackRuntime[] | undefined =>
  row.save.config.packs as readonly PackRuntime[] | undefined;

/** The cards a game's pictures stand for, villain first. */
export const picturedCards = (row: PastGameRow): readonly (string | null)[] =>
  [row.villainCardId, ...row.seats.map((seat) => seat.identityCardId)].slice(0, 1 + MAX_PICTURED_HEROES);

/** The card records those pictures stand for, from the game's own packs: the hover's card when its pack is gone. */
export const picturedRecords = (row: PastGameRow): readonly (AnyCard | undefined)[] =>
  picturedCards(row).map((id) => (id ? cardInPacks(packsOf(row), id) : undefined));

const picturedSources = (row: PastGameRow): readonly (ArtSource | null)[] =>
  [
    villainSourceOf(row.scenarioId, row.villainCardId, packsOf(row)),
    ...row.seats.map((seat) => heroSourceOf(seat.identityCardId, packsOf(row))),
  ].slice(0, 1 + MAX_PICTURED_HEROES);

/** The names to print on pictures that have no art, villain first (a stand-in never reads as an unnamed blank, #758). */
const picturedNames = (row: PastGameRow): readonly (string | null)[] =>
  [row.villainName, ...row.seats.map((seat) => seat.name)].slice(0, 1 + MAX_PICTURED_HEROES);

/** A game's pictures, villain first, each leased now (call between `leases.begin()` and `leases.end()`). */
export function picturesOf(row: PastGameRow, leases: PictureLeases): readonly PastGamePicture[] {
  const sources = picturedSources(row);
  const names = picturedNames(row);
  const cards = picturedCards(row);
  return cards.map((cardId, i): PastGamePicture => {
    const held = leases.image(sources[i] ?? null);
    const name = names[i];
    const picture: PictureSource = {
      src: held.src,
      fill: "var(--mc-fill-parchment)",
      // A hero's face sits high in its picture (focusY 0.2), as the baked thumbnails cropped it.
      cover: { x: 0.5, y: 0.2 },
      ...(name ? { missing: name } : {}),
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
    };
    return { cardId, picture, badges: i > 0 ? aspectBadgesOf(row.seats[i - 1]?.aspectIds ?? []) : [] };
  });
}
