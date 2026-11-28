import type { TitleBannerInput } from "../../../components/title/mc-title-banner/mc-title-banner.types.js";
import type { TitleFooterInput } from "../../../components/title/mc-title-footer/mc-title-footer.types.js";
import type { TitleGamesInput } from "../../../components/title/mc-title-games/mc-title-games.types.js";
import type { TitleIconRowInput } from "../../../components/title/mc-title-icon-row/mc-title-icon-row.types.js";
import type { TitleLogoInput } from "../../../components/title/mc-title-logo/mc-title-logo.types.js";
import type { TitleMenuInput } from "../../../components/title/mc-title-menu/mc-title-menu.types.js";
import type { TitleNoticeInput } from "../../../components/title/mc-title-notice-bar/mc-title-notice-bar.types.js";
import type { TitlePromoInput } from "../../../components/title/mc-title-promo/mc-title-promo.types.js";
import type { TitleRankInput } from "../../../components/title/mc-title-rank/mc-title-rank.types.js";
import type { TitleStatusInput } from "../../../components/title/mc-title-status/mc-title-status.types.js";

/** Everything the Title shows, already worded and translated: one input per section. */
export interface TitlePageInput {
  /** The release notice strip across the top, or none. */
  readonly notice: TitleNoticeInput | null;
  readonly logo: TitleLogoInput;
  readonly icons: TitleIconRowInput;
  /** The update, restart, saves-stuck or old-save banner, or none. */
  readonly banner: TitleBannerInput | null;
  readonly menu: TitleMenuInput;
  /** The In-progress games panel (a wide screen with games to list), or none. */
  readonly games: TitleGamesInput | null;
  /** The "Play online" panel (a wide screen); its `variant` says where it stands. */
  readonly promo: TitlePromoInput | null;
  readonly rank: TitleRankInput;
  readonly footer: TitleFooterInput;
  /** Why a game could not be resumed, above the footer. */
  readonly status: TitleStatusInput | null;
  /** Why a replay did not open, at the top of the screen for a moment. */
  readonly problem: TitleStatusInput | null;
}
