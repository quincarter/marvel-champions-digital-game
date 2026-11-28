import type { ControlGlyph } from "@mc/ui";
import type { PastGameDetailsModel } from "../../../components/past-games/mc-past-game-details/mc-past-game-details.types.js";
import type { PastGamesFileModel } from "../../../components/past-games/mc-past-games-file-button/mc-past-games-file-button.types.js";
import type { McPastGamesFiltersProps } from "../../../components/past-games/mc-past-games-filters/mc-past-games-filters.types.js";
import type { PastGamesListModel } from "../../../components/past-games/mc-past-games-list/mc-past-games-list.types.js";
import type { PastGamesSearchModel } from "../../../components/past-games/mc-past-games-search/mc-past-games-search.types.js";

/** The top bar: Back (with its Cancel glyph on a keyboard or pad) and the title, clear of the dark mode tab. */
export interface PastGamesBarModel {
  readonly backLabel: string;
  readonly backGlyph: ControlGlyph | undefined;
  readonly title: string;
  /** How far the title drops, and where it must end, to clear the dark mode tab (`sheetThemeFor`). */
  readonly titleDrop: number;
  readonly titleMaxRight: number;
}

/** Everything Past games shows. The scene builds it from the saves and its own state (`scenes/past-games/page-model.ts`). */
export interface PastGamesPageModel {
  /** The details sit in a side panel beside the list (desktop and tablet); false: a popup over it (a phone). */
  readonly side: boolean;
  readonly phone: boolean;
  readonly bar: PastGamesBarModel;
  readonly file: PastGamesFileModel;
  readonly filters: Pick<McPastGamesFiltersProps, "tabs" | "selected" | "glyph">;
  readonly search: PastGamesSearchModel;
  readonly list: PastGamesListModel;
  /** The game whose details show (the side panel, or the open popup), or null. */
  readonly details: PastGameDetailsModel | null;
  /** The note at the foot (a link copied, why an action failed), or empty. */
  readonly status: string;
}
