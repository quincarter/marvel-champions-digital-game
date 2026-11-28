import type { GalleryTileModel } from "../mc-pack-card/mc-pack-card.types.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/** A group of the gallery: its title and its cards. */
export interface GallerySectionModel {
  readonly title: string;
  readonly cards: readonly GalleryTileModel[];
}

export interface McPackGalleryProps {
  size: ModStoreSize;
  /** The count line: "CARDS  ·  9 cards" (or "...PREVIEW, NOT INSTALLED"). */
  heading: string;
  /** What the list shows (`gallery:<pack id>`): its scroll place is kept under this id. */
  listId: string;
  sections: readonly GallerySectionModel[];
}
