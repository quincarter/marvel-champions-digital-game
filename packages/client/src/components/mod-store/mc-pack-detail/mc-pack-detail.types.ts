import type { PackAction } from "../../../view/mod-store-model.js";
import type { ModStoreSize } from "../mc-mod-store-header/mc-mod-store-header.types.js";
import type { PackFacesModel } from "../mc-pack-faces/mc-pack-faces.types.js";
import type { GallerySectionModel } from "../mc-pack-gallery/mc-pack-gallery.types.js";
import type { PackStatusModel } from "../mc-pack-status/mc-pack-status.types.js";
import type { PackTitleModel } from "../mc-pack-title/mc-pack-title.types.js";

/** The gallery of a pack's page: its count line, the id its scroll place is kept under, and its groups. */
export interface PackGalleryModel {
  readonly heading: string;
  readonly listId: string;
  readonly sections: readonly GallerySectionModel[];
}

/** Everything a pack's page shows, already translated. */
export interface PackDetailModel {
  readonly id: string;
  readonly pictures: PackFacesModel;
  readonly title: PackTitleModel;
  /** The text's scroll id (`text:<pack id>`). */
  readonly textId: string;
  /** The load status when installed, then the description, credits, permission and requirement. */
  readonly body: string;
  readonly status: PackStatusModel;
  readonly actions: readonly PackAction[];
  /** The pack's cards; null when it has none to show. */
  readonly gallery: PackGalleryModel | null;
}

export interface McPackDetailProps {
  size: ModStoreSize;
  pack: PackDetailModel | null;
}
