/**
 * The pictures Set up the table shows, looked up once per draw and handed to the elements as plain `PictureSource`s: a
 * set's most recognizable card, each seat's hero and the villain. The elements know no art catalog; a held picture
 * (`PackLeases`) is kept while it is on screen and carries its key so a URL gone stale under a lazy image is asked for again.
 */
import type { PictureSource } from "@mc/ui";
import type { Scenario } from "@mc/content";
import { CARD_BACKS, artFor } from "../../art/art-source.js";
import type { PackLeases } from "../../art/pack-art.js";
import { ART_CATALOG, villainArtFor } from "../../art/scenario-art.js";
import { currentCardsById } from "../../content/pool.js";
import { heroPictureOf } from "../../dom/hero-picture.js";
import { cardsBySet, setFacesOf, type FaceRef } from "../../view/civil-war-builder-art.js";
import type { ModularSetOption } from "../../view/modular-sets.js";
import { hasRandomChosenVillain } from "../../view/random-villain.js";
import type { SetPicture } from "../../components/table-setup/mc-setup-set-tile/mc-setup-set-tile.types.js";
import type { SeatCell } from "../../components/table-setup/mc-setup-seating/mc-setup-seating.types.js";
import type { SummaryVillain } from "../../components/table-setup/mc-setup-summary/mc-setup-summary.types.js";

/** The modular tiles' pictures: the set's most recognizable card, framed from the top. */
const PICTURE_FOCUS = { x: 0.5, y: 0.12 } as const;

const facesBySet = new WeakMap<object, Map<string, FaceRef | null>>();

/** A set's most recognizable card, or null for a set with no cards on hand (cached per card pool). */
function faceOf(setId: string): FaceRef | null {
  const cards = currentCardsById();
  let cache = facesBySet.get(cards);
  if (!cache) facesBySet.set(cards, (cache = new Map()));
  if (!cache.has(setId)) cache.set(setId, setFacesOf(cardsBySet(cards).get(setId) ?? [], 1)[0] ?? null);
  return cache.get(setId) ?? null;
}

const withRetry = (source: PictureSource, retry: string | undefined): PictureSource =>
  retry === undefined ? source : { ...source, retry };

/** Each candidate set's picture, by set id (the Random chip and a set with no cards have none). */
export function setPicturesOf(options: readonly ModularSetOption[], leases: PackLeases): Map<string, SetPicture> {
  const out = new Map<string, SetPicture>();
  for (const option of options) {
    if (option.kind === "random") continue;
    const face = faceOf(option.id);
    if (!face) continue;
    const held = leases.image(artFor(currentCardsById().get(face.cardId as string), face.face));
    out.set(option.id, {
      source: withRetry({ src: held.src, cover: PICTURE_FOCUS }, held.retry),
      cardId: face.cardId as string,
      face: face.face,
    });
  }
  return out;
}

/** Each seat's hero picture, by seat index. */
export function seatPicturesOf(seats: readonly SeatCell[], leases: PackLeases): Map<number, PictureSource> {
  const out = new Map<number, PictureSource>();
  for (const seat of seats) {
    const identity = seat.identityCardId ? currentCardsById().get(seat.identityCardId) : undefined;
    const pic = heroPictureOf(identity, leases);
    out.set(seat.index, withRetry({ src: pic.src, cover: pic.cover }, pic.retry));
  }
  return out;
}

/** The villain this table faces: its artwork, else its stage I card; the encounter card back for a villain drawn at random. */
export function villainOf(scenario: Scenario, name: string, leases: PackLeases): SummaryVillain {
  const villainId = scenario.villainCardId as string;
  const cover = { x: 0.5, y: 0.12 } as const;
  // A villain drawn at random from a pool (Shadows in the Night) is not known yet: the card back, and no hover.
  if (hasRandomChosenVillain(scenario))
    return { name, picture: { src: CARD_BACKS.encounter.url, cover }, cardId: null };
  const bundled = villainArtFor(ART_CATALOG, scenario.id as string, () => 0)?.url;
  const held: { src: string | null; retry?: string } = bundled
    ? { src: bundled }
    : leases.image(artFor(currentCardsById().get(villainId), { kind: "villainStage", sideIndex: 0, stageIndex: 0 }));
  return { name, picture: withRetry({ src: held.src, cover }, held.retry), cardId: villainId };
}
