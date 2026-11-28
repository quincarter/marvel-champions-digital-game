import type { FilterChip, TabRailTab } from "@mc/ui";
import type { UpdateAllBar } from "../../../view/mod-store-update-all.js";
import type { CreatorModel } from "../../../components/mod-store/mc-creator-row/mc-creator-row.types.js";
import type { McModNoticeProps } from "../../../components/mod-store/mc-mod-notice/mc-mod-notice.types.js";
import type { ModStoreHeaderModel } from "../../../components/mod-store/shared/mod-store-header.types.js";
import type { ModFindersSearch } from "../../../components/mod-store/mc-mod-finders/mc-mod-finders.types.js";
import type { PackDetailModel } from "../../../components/mod-store/mc-pack-detail/mc-pack-detail.types.js";
import type { PackTileModel } from "../../../components/mod-store/mc-pack-tile/mc-pack-tile.types.js";

export type { ModStoreSize } from "../../../components/mod-store/shared/mod-store-size.types.js";

/** The finders over a tab's grid: shown or folded away (a phone), and what they say. */
export interface FindersModel {
  readonly search: ModFindersSearch;
  readonly sortLabel: string;
  readonly chips: readonly FilterChip[];
  /** Clear's words while something narrows the list; empty for no Clear. */
  readonly clearLabel: string;
  readonly countText: string;
}

/** What a browse tab shows under the controls. */
export type BrowseBodyModel =
  /** A line in place of a list: loading, no packs, no match; the failed load carries Try again's words. */
  | { readonly kind: "message"; readonly text: string; readonly retryLabel: string }
  | {
      readonly kind: "grid";
      readonly listId: string;
      readonly scrollFrom: number;
      readonly tiles: readonly PackTileModel[];
    }
  | {
      readonly kind: "credits";
      readonly intro: string;
      readonly empty: string;
      readonly credits: readonly CreatorModel[];
    };

export interface BrowseModel {
  readonly caption: { readonly heading: string; readonly body: string };
  readonly tabs: readonly TabRailTab[];
  readonly selected: string;
  readonly toggle: { readonly shown: boolean; readonly open: boolean; readonly label: string };
  /** The ink strip saying the list is the saved copy; null while online. */
  readonly offline: string | null;
  readonly updateBar: UpdateAllBar | null;
  /** The search box, sort and chips; null where they are folded away or there is nothing to find. */
  readonly finders: FindersModel | null;
  readonly body: BrowseBodyModel;
}

/** Everything the Mod Store's page shows (`view/mod-store-page-model.ts` builds it from the store's state). */
export interface ModStorePageModel {
  readonly header: ModStoreHeaderModel;
  /** The browse view (tabs over a grid or Credits); null while a pack's page is open. */
  readonly browse: BrowseModel | null;
  /** A pack's page; null in the browse view. */
  readonly detail: PackDetailModel | null;
  /** The heads-up about mods over the store; null while it is shut. */
  readonly notice: Omit<McModNoticeProps, "size"> | null;
}
