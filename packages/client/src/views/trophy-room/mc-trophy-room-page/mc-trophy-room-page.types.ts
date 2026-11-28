import type { ControlGlyph } from "@mc/ui";
import type { TrophyFiltersModel } from "../../../components/trophy-room/mc-trophy-filters/mc-trophy-filters.types.js";
import type { TrophyListModel } from "../../../components/trophy-room/mc-trophy-list/mc-trophy-list.types.js";
import type { TrophySheetModel } from "../../../components/trophy-room/mc-trophy-sheet/mc-trophy-sheet.types.js";
import type { TrophyHeader } from "../../../view/trophy-room-model.js";

/** The top bar: Back (with its Cancel glyph on a keyboard or pad) and the title, clear of the dark mode tab. */
export interface TrophyBarModel {
  readonly backLabel: string;
  readonly backGlyph: ControlGlyph | undefined;
  readonly title: string;
}

/** "Your stats" at the bar's right end (X on a pad). */
export interface TrophyStatsButtonModel {
  readonly label: string;
  readonly glyph: ControlGlyph | undefined;
}

/** Everything the Trophy Room shows. The scene builds it from the achievements and its own state (`scenes/trophy-room/`). */
export interface TrophyRoomPageModel {
  readonly phone: boolean;
  readonly bar: TrophyBarModel;
  readonly stats: TrophyStatsButtonModel;
  readonly header: TrophyHeader;
  readonly filters: TrophyFiltersModel;
  readonly list: TrophyListModel;
  /** The achievement whose sheet is open, or null. */
  readonly sheet: TrophySheetModel | null;
}
