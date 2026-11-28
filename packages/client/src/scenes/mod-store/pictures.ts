/**
 * The Mod Store's pictures, resolved to what the page takes: a URL and the key to read it again by. Pack art is held by a
 * lease while it shows (`PackLeases`, begun and ended around each draw by the scene); a scan that is missing is a
 * supported outcome, so every lookup may come back empty and the card draws its generated frame or says its name.
 */
import { customCardPrefix, officialCardsByPictureCode, parsePackCardImagePath, type AnyCard } from "@mc/content";
import { artFor, artLanguageNow, packPictureCodes, type ArtSource, type CardFace } from "../../art/art-source.js";
import { PackLeases, packFileArt } from "../../art/pack-art.js";
import { previewPictureFor } from "../../art/preview-art.js";
import { currentPool } from "../../content/pool.js";
import { loadedPacks } from "../../packs/pack-registry.js";
import { previewInMemory, requestPreview } from "../../packs/preview-client.js";
import { previewPictureUrl, type ParsedPackPreview } from "../../packs/pack-preview.js";
import type { InstalledPack } from "../../packs/pack-store.js";
import { featuredFacesOf, tileArtOf, type ModStoreTile, type PackCover } from "../../view/mod-store-model.js";
import type { PackThumb } from "../../components/mod-store/mc-pack-tile/mc-pack-tile.types.js";

/** The official cards by printed picture code, for a house-rule tile's featured face (undefined for any other tile). */
export function ruleCardsOf(tile: ModStoreTile): ReadonlyMap<string, AnyCard> | undefined {
  return tile.kind === "house-rule" ? officialCardsByPictureCode(currentPool()) : undefined;
}

/**
 * A house rule's rebuilt faces, by the official picture code each is filed under (`cards/<lang>/<code>.webp`, base
 * language): from the installed pack's files, else the store's preview. Codes no official card owns are left out.
 */
export function ruleFacesOf(
  installed: InstalledPack | undefined,
  preview: ParsedPackPreview | null,
): readonly { readonly code: string; readonly card: AnyCard }[] {
  const base = installed?.manifest.languages?.base ?? preview?.languages?.base;
  const paths = installed ? installed.manifest.files.map((file) => file.path) : [...(preview?.images ?? [])];
  const cards = officialCardsByPictureCode(currentPool());
  return paths.flatMap((path) => {
    const picture = parsePackCardImagePath(path);
    const card = picture && picture.lang === base ? cards.get(picture.code) : undefined;
    return picture && card ? [{ code: picture.code, card }] : [];
  });
}

export class StorePictures {
  readonly leases = new PackLeases();

  /** A pack's art for `source`, as the page takes it (its URL, and the key to read it again by). */
  src(source: ArtSource | null): { src: string | null; retry?: string } {
    return this.leases.image(source);
  }

  /** The featured card's preview for a tile, requesting it the first time a visible tile asks. */
  previewOf(tile: ModStoreTile): ParsedPackPreview | null {
    if (!tile.previewUrl) return null;
    const known = previewInMemory(tile.previewUrl);
    if (known === undefined) void requestPreview(tile.previewUrl, tile.id);
    return known ?? null;
  }

  /** A pack's cover, whole: the installed copy's own file first, so it shows offline, else the catalog's thumbnail. */
  coverSource(packId: string, cover: PackCover): ArtSource | null {
    return (
      (cover.path !== undefined ? packFileArt(packId, cover.path) : null) ??
      (cover.url !== undefined ? previewPictureFor(cover.url) : null)
    );
  }

  /**
   * A tile's left side, a portrait card: the pack's cover, else the catalog's thumbnail, else the featured card's
   * picture, else (no picture) the pack's initial, big and faint, on ink while nothing has loaded.
   */
  thumbOf(tile: ModStoreTile): PackThumb {
    const preview = this.previewOf(tile);
    const art = tileArtOf(tile, preview, artLanguageNow(), ruleCardsOf(tile));
    if (art.kind === "cover") {
      const source = this.coverSource(tile.id, art);
      if (source) return { ...this.src(source), fit: "contain" };
    }
    if (art.kind === "thumbnail") return { src: art.url, fit: "cover" };
    // A pack with a cover shows the initial while the cover loads, not the featured face it would then swap away from.
    const first =
      art.kind === "cover" ? undefined : featuredFacesOf(preview, tile.baseUrl, artLanguageNow(), ruleCardsOf(tile))[0];
    if (first?.pictureUrl) {
      const source = previewPictureFor(first.pictureUrl);
      if (source) return { ...this.src(source), fit: "contain" };
    }
    return { src: null, fit: "contain" };
  }

  /** The art for pack `packId`'s card `record`, or null while it loads or when there is none. */
  artOf(
    record: AnyCard,
    face: CardFace,
    packId: string,
    preview: ParsedPackPreview | null,
    base: string | undefined,
  ): ArtSource | null {
    const own = (record.id as string).startsWith(customCardPrefix(packId));
    if (own && !loadedPacks().some((pack) => pack.id === packId)) {
      // Not installed (or not loaded): the picture comes from the pack host, by URL, when the pack ships one.
      const url =
        preview && base !== undefined
          ? packPictureCodes(record, face)
              .map((code) => previewPictureUrl(preview, base, code, artLanguageNow()))
              .find((found) => found !== undefined)
          : undefined;
      return url ? previewPictureFor(url) : null;
    }
    return artFor(record, face);
  }
}
