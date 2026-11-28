/**
 * A pack's page, built from the store's state (`views/mod-store/mc-mod-store-page` draws it): the pictures that lead it,
 * the title, the text, the status line, the buttons and a gallery of the pack's cards, which come from the loaded pack once
 * it is installed and from the preview fetched from the store before that. Also what the scene needs to answer a card
 * picture's hover and Inspect (`DetailBuild`): the records by id and the pictures the popover shows.
 */
import { parsePackAchievements, type AnyCard } from "@mc/content";
import type { CardRef } from "@mc/ui";
import { artFor, artLanguageNow, defaultFaceFor, type ArtSource } from "../../art/art-source.js";
import { houseRuleFaceFor, packFileArt } from "../../art/pack-art.js";
import { previewPictureFor } from "../../art/preview-art.js";
import { currentCardsById } from "../../content/pool.js";
import { activePackStatuses } from "../../packs/active-packs.js";
import { previewPictureUrl } from "../../packs/pack-preview.js";
import { loadedPacks } from "../../packs/pack-registry.js";
import { actionsOf, coverOf, featuredFacesOf, packPageOf, type ModStoreTile } from "../../view/mod-store-model.js";
import {
  galleryCardCount,
  galleryFocusKey,
  gallerySectionsOf,
  loadStatusOf,
  type GalleryCard,
} from "../../view/pack-gallery-model.js";
import { galleryHeadingOf, packBodyOf, packStatusOf, packTitleOf } from "../../view/mod-store-detail-model.js";
import type { PackDetailModel } from "../../components/mod-store/mc-pack-detail/mc-pack-detail.types.js";
import type { PackFacesModel } from "../../components/mod-store/mc-pack-faces/mc-pack-faces.types.js";
import type { GalleryTileModel } from "../../components/mod-store/mc-pack-card/mc-pack-card.types.js";
import type { ModStoreController } from "./store-controller.js";
import { ruleCardsOf, ruleFacesOf, type StorePictures } from "./pictures.js";

/** What the popover shows for a card picture beyond its id: the record of a card no pool has, and the picture. */
export interface HoverInfo {
  readonly card?: AnyCard;
  readonly art?: ArtSource;
}

/** The key of one card picture in `DetailBuild.hovers` and `.cards`: its card and which face. */
export const hoverKeyOf = (cardId: string, face: unknown): string =>
  `${cardId}:${(face as { kind?: string } | undefined)?.kind ?? ""}`;

export interface DetailBuild {
  readonly model: PackDetailModel;
  readonly hovers: ReadonlyMap<string, HoverInfo>;
  /** The gallery's cards by the key of their picture, for Inspect from a hold. */
  readonly cards: ReadonlyMap<string, GalleryCard>;
  /** The page's cards by their gallery key, for Inspect from a tap. */
  readonly byKey: ReadonlyMap<string, GalleryCard>;
  readonly records: ReadonlyMap<string, AnyCard>;
  /** Draws a card's picture the way the page does (a tap's reference sheet shows it too). */
  readonly artOf: (record: AnyCard, card?: GalleryCard) => ArtSource | null;
}

export function buildDetail(ctl: ModStoreController, tile: ModStoreTile, pictures: StorePictures): DetailBuild {
  const entry = ctl.index?.packs.find((one) => one.id === tile.id);
  const installed = ctl.installed.get(tile.id);
  const preview = pictures.previewOf(tile);
  const packCards = loadedPacks().find((pack) => pack.id === tile.id);
  const installedAchievements = parsePackAchievements(installed?.manifest.achievements);
  const achievements =
    installedAchievements.length > 0 ? installedAchievements : (packCards?.achievements ?? preview?.achievements ?? []);
  const page = packPageOf(tile, entry, installed, achievements, preview?.description);
  const running = ctl.installStateFor(tile.id);
  const busy = ctl.pageBusy(tile.id);
  const rule = tile.kind === "house-rule";
  const source = packCards ?? preview;
  const ruleFaces = rule ? ruleFacesOf(installed, preview) : [];
  const { sections, records } = source
    ? gallerySectionsOf({
        cards: source.cards,
        decks: source.decks,
        baseCards: currentCardsById(),
        ruleFaces,
        // Set names and the scenario's own sets come from the loaded pack; a preview has none (names come from ids).
        ...(packCards
          ? {
              encounterSets: packCards.encounterSets ?? [],
              scenarioSetIds: (packCards.scenarios ?? []).flatMap((s) => [...s.encounterSetIds] as string[]),
            }
          : {}),
      })
    : rule
      ? gallerySectionsOf({ cards: [], decks: [], baseCards: currentCardsById(), ruleFaces })
      : { sections: [], records: new Map<string, AnyCard>() };
  const cardCount = galleryCardCount(sections);
  const faces = featuredFacesOf(preview, tile.baseUrl, artLanguageNow(), ruleCardsOf(tile));
  const cover = coverOf(tile, preview);
  const hovers = new Map<string, HoverInfo>();
  const cards = new Map<string, GalleryCard>();
  const byKey = new Map<string, GalleryCard>();
  const context = { packId: tile.id, preview, base: tile.baseUrl, records, rule };

  /** The art for one gallery card of the page's pack. A house rule's rebuilt face is drawn in the rule's own picture. */
  const artOfTile = (record: AnyCard, card?: GalleryCard): ArtSource | null => {
    if (context.rule && card?.rebuilt) {
      if (loadedPacks().some((pack) => pack.id === context.packId)) {
        return houseRuleFaceFor(context.packId, card.cardId, artLanguageNow());
      }
      const url =
        context.preview && context.base !== undefined
          ? previewPictureUrl(context.preview, context.base, card.cardId, artLanguageNow())
          : undefined;
      return url ? previewPictureFor(url) : null;
    }
    return pictures.artOf(record, defaultFaceFor(record), context.packId, context.preview, context.base);
  };

  const picturesModel = ((): PackFacesModel => {
    const thumb = pictures.thumbOf(tile);
    if (faces.length === 0 && !cover) {
      return {
        cover: null,
        faces: [],
        square: { ...thumb, missing: tile.name.charAt(0).toUpperCase() },
      };
    }
    return {
      cover: cover ? { ...pictures.src(pictures.coverSource(tile.id, cover)), missing: "" } : null,
      faces: faces.map((face) => {
        const art = packCards
          ? ((face.path ? packFileArt(tile.id, face.path) : null) ?? (rule ? null : artFor(face.card, face.face)))
          : face.pictureUrl
            ? previewPictureFor(face.pictureUrl)
            : null;
        const ref: CardRef = { cardId: face.card.id as string, face: face.face };
        hovers.set(hoverKeyOf(ref.cardId, face.face), { card: face.card, ...(art ? { art } : {}) });
        return { ...pictures.src(art), missing: face.card.name as string, hover: ref };
      }),
      square: null,
    };
  })();

  const tiles = (card: GalleryCard): GalleryTileModel => {
    const record = records.get(card.cardId);
    const key = galleryFocusKey(card);
    // The pack's picture where it has one for this card and it has arrived; otherwise the card's name stands in (a
    // missing picture is a supported outcome, never a blank tile).
    const art = record ? artOfTile(record, card) : null;
    byKey.set(key, card);
    let hover: CardRef | null = null;
    if (record) {
      // A house rule's rebuilt face shows the rule's picture, not the printed one the pool has.
      const inPool = currentCardsById().has(card.cardId) && !card.rebuilt;
      const own = !inPool;
      hover = { cardId: own ? (record.id as string) : card.cardId, ...(card.face ? { face: card.face } : {}) };
      hovers.set(hoverKeyOf(hover.cardId, card.face), {
        ...(own ? { card: record } : {}),
        ...(own && art ? { art } : {}),
      });
      cards.set(hoverKeyOf(hover.cardId, card.face), card);
    }
    return {
      key,
      name: card.name,
      typeLine: card.typeLine,
      quantity: card.quantity,
      ...pictures.src(art),
      missing: record ? (record.name as string) : card.name,
      hover,
    };
  };

  const loadStatus = loadStatusOf(
    installed !== undefined,
    activePackStatuses().find((one) => one.id === tile.id),
    tile.kind,
  );
  const failed = tile.state === "update" && ctl.failedIds().has(tile.id);
  const model: PackDetailModel = {
    id: tile.id,
    pictures: picturesModel,
    title: packTitleOf(tile, page, failed),
    textId: `text:${tile.id}`,
    body: packBodyOf(loadStatus, page.body),
    status: packStatusOf({ running, removeError: ctl.error, requirement: page.requirement }),
    actions: actionsOf({ tile, busy, confirmingRemove: ctl.confirmingRemove }),
    gallery:
      cardCount > 0
        ? {
            heading: galleryHeadingOf(packCards !== undefined, cardCount),
            listId: `gallery:${tile.id}`,
            sections: sections.map((section) => ({ title: section.title, cards: section.cards.map(tiles) })),
          }
        : null,
  };
  return { model, hovers, cards, byKey, records, artOf: artOfTile };
}
