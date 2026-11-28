import type { SheetGlyph, SheetRect } from "../../shared/sheet.types.js";
import type { AlertBannerModel } from "../mc-alert-banner/mc-alert-banner.types.js";
import type { FooterBarModel } from "../mc-footer-bar/mc-footer-bar.types.js";
import type { MenuButton } from "../mc-menu-button/mc-menu-button.types.js";
import type { NewsBarModel } from "../mc-news-bar/mc-news-bar.types.js";
import type { PromoPanelModel } from "../mc-promo-panel/mc-promo-panel.types.js";
import type { RankBarModel } from "../mc-rank-bar/mc-rank-bar.types.js";

/** A component placed at a rect of the screen. */
export interface Placed<M> {
  readonly rect: SheetRect;
  readonly model: M;
}

/**
 * Everything the Title's panel shows over the canvas, in the screen's own coordinates (its top left is 0, 0): the menu
 * the client's layout (`view/title-menu-layout.ts`) places, with the banners, the rank plate, the promo panel, the
 * footer and the glyphs that hang on the focused control. The client's art, ground and wordmark stay Phaser's, drawn
 * under it; a panel with nothing at a place leaves the canvas showing there.
 */
export interface TitlePanelModel {
  /** The ground the menu column sits on (the footer's words are ink on paper, paper on ink). */
  readonly ground: "ink" | "paper";
  /**
   * Where the menu scrolls, or null when it fits: a window too short for every row (a phone held landscape) scrolls
   * everything from the logo's rule down inside this box, the footer included.
   */
  readonly scroll: SheetRect | null;
  /** The scrolling content's height, from the top of `scroll`. */
  readonly scrollHeight: number;
  readonly news: Placed<NewsBarModel> | null;
  readonly banner: Placed<AlertBannerModel> | null;
  readonly rank: Placed<RankBarModel>;
  /** The menu's buttons, in screen coordinates. */
  readonly menu: readonly MenuButton[];
  /** The feature panel: it scrolls with the menu when it stands beside it, and stays put in the art panel. */
  readonly promo: (Placed<PromoPanelModel> & { readonly scrolls: boolean }) | null;
  readonly footer: Placed<FooterBarModel>;
  /** A line above the footer (why a game could not be resumed). */
  readonly status: { readonly rect: SheetRect; readonly text: string } | null;
  /** A line at the top of the screen for a moment (why a replay did not open). */
  readonly problem: string | null;
  /** Key and pad glyphs that hang on the focused control, in screen coordinates. */
  readonly glyphs: readonly SheetGlyph[];
}
