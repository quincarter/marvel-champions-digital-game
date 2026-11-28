/**
 * `@mc/ui`: the Lit components the client draws its panel screens with, over the Phaser table. Each component is
 * presentational: the client passes in every value (already translated) and listens for its events; nothing here
 * imports Phaser, the engine or the client. Importing a component's registration file defines its element once.
 */
export { ThemeStyles } from "./shared/theme.styles.js";
export { McCreditsList } from "./components/mc-credits-list/mc-credits-list.js";
export { McAspectChip } from "./components/mc-aspect-chip/mc-aspect-chip.js";
export { McButton } from "./components/mc-button/mc-button.js";
export { McSettingsBody } from "./components/mc-settings-body/mc-settings-body.js";
export { cancelPressesWithin, onActivate, onHold, onTap, HOLD_MS, HOLD_SLOP_PX, TAP_SLOP_PX } from "./shared/tap.js";
export { watchCard } from "./shared/card-events.js";
export type { CardHoverDetail, CardHoverEndDetail, CardRef } from "./shared/card-events.js";
export { McSheet } from "./components/mc-sheet/mc-sheet.js";
export {
  McGlyph,
  GLYPH_ART_OUTLINE,
  GLYPH_ART_UNIT,
  GLYPH_CHORD_GAP,
  GLYPH_COLLAPSE_MS,
  GLYPH_EXPAND_MS,
  GLYPH_FONT_FAMILY,
  GLYPH_TAB_WIDTH,
  artDrawSize,
  artMarkup,
  layoutGlyph,
  measureGlyphText,
  parseArt,
} from "./components/mc-glyph/mc-glyph.js";
export { McGameLog } from "./components/mc-game-log/mc-game-log.js";
export { McSectionHeader } from "./components/mc-section-header/mc-section-header.js";
export { McTabRail } from "./components/mc-tab-rail/mc-tab-rail.js";
export { McPictureTile } from "./components/mc-picture-tile/mc-picture-tile.js";
export { McPictureCard } from "./components/mc-picture-card/mc-picture-card.js";
export { McListRow } from "./components/mc-list-row/mc-list-row.js";
export { McEmptyState } from "./components/mc-empty-state/mc-empty-state.js";
export { McFirstPlayerToken } from "./components/mc-first-player-token/mc-first-player-token.js";
export type {
  TokenFlight,
  TokenFrame,
  TokenPoint,
  TokenRect,
} from "./components/mc-first-player-token/mc-first-player-token.types.js";
export { flipOffset } from "./components/mc-first-player-token/token-motion.js";
export { McSearchField } from "./components/mc-search-field/mc-search-field.js";
export { McArticle } from "./components/mc-article/mc-article.js";
export { McFilterChip } from "./components/mc-filter-chip/mc-filter-chip.js";
export { McTextField } from "./components/mc-text-field/mc-text-field.js";
export type { McFieldFocusDetail, McInputDetail } from "./components/mc-text-field/mc-text-field.types.js";
export type { McMediaRowModel, McMediaRowStamp } from "./components/mc-media-row/mc-media-row.types.js";
export { McMediaRow } from "./components/mc-media-row/mc-media-row.js";
export { McActionBar } from "./components/mc-action-bar/mc-action-bar.js";
export { McBarChart } from "./components/mc-bar-chart/mc-bar-chart.js";
export { McStatTiles } from "./components/mc-stat-tiles/mc-stat-tiles.js";
export { McLineList } from "./components/mc-line-list/mc-line-list.js";
export { McDeckGrid } from "./components/mc-deck-grid/mc-deck-grid.js";
export { McCardSections } from "./components/mc-card-sections/mc-card-sections.js";
export { McShelfRoster } from "./components/mc-shelf-roster/mc-shelf-roster.js";
export { McDeckDetails } from "./components/mc-deck-details/mc-deck-details.js";
export { fitTextWithin } from "./shared/fit-text.js";
export { lineOf, sizeCss } from "./shared/text-line.js";
export { McFilterBar } from "./components/mc-filter-bar/mc-filter-bar.js";
export { McMenuButton } from "./components/mc-menu-button/mc-menu-button.js";
export { McMenuGrid } from "./components/mc-menu-grid/mc-menu-grid.js";
export { McRankBar } from "./components/mc-rank-bar/mc-rank-bar.js";
export { McNewsBar } from "./components/mc-news-bar/mc-news-bar.js";
export { McAlertBanner } from "./components/mc-alert-banner/mc-alert-banner.js";
export { McPromoPanel } from "./components/mc-promo-panel/mc-promo-panel.js";
export { McFooterBar } from "./components/mc-footer-bar/mc-footer-bar.js";
export { McTitlePanel } from "./components/mc-title-panel/mc-title-panel.js";
export { fitBlock, fitOneLine } from "./shared/fit.js";
export type { McButtonKind } from "./shared/button.types.js";
export type {
  GlyphKeySpec,
  GlyphLayout,
  GlyphPadArt,
  GlyphPadSpec,
  GlyphSpec,
  GlyphSymbol,
  GlyphTextMeasure,
  LaidCell,
  McGlyphGround,
} from "./shared/glyph.types.js";
export type {
  SheetArticle,
  SheetBox,
  SheetButton,
  SheetChip,
  SheetDots,
  SheetEmptyState,
  SheetFilterBar,
  SheetStatTiles,
  SheetBarChart,
  SheetLineList,
  SheetGlyph,
  SheetHalftone,
  SheetImage,
  SheetListRow,
  SheetMediaRow,
  SheetTextField,
  SheetNode,
  SheetPictureCard,
  SheetPictureTile,
  SheetPoly,
  SheetQr,
  SheetRect,
  SheetScroll,
  SheetSearch,
  SheetSectionHeader,
  SheetSlider,
  SheetSvg,
  SheetTap,
  SheetText,
  SvgOp,
  SvgStyle,
} from "./shared/sheet.types.js";
export type { TapOptions } from "./shared/tap.types.js";
export type { TabRailTab } from "./shared/tab-rail.types.js";
export type { FilterBarModel, FilterChip, FilterSort } from "./shared/filter.types.js";
export type { PictureFit, PictureFocus, PictureGround, PictureSource } from "./shared/picture.types.js";
export type { SectionHeaderLevel } from "./components/mc-section-header/mc-section-header.types.js";
export type { PictureErrorDetail } from "./components/mc-picture-tile/mc-picture-tile.types.js";
export type { McPictureCardModel, PictureCardStamp } from "./components/mc-picture-card/mc-picture-card.types.js";
export type { McListRowModel } from "./components/mc-list-row/mc-list-row.types.js";
export type {
  McSearchDetail,
  McSearchFocusDetail,
  McSubmitDetail,
} from "./components/mc-search-field/mc-search-field.types.js";
export type { McArticleBlock, McArticleModel } from "./components/mc-article/mc-article.types.js";
export type { CreditsListRow } from "./components/mc-credits-list/mc-credits-list.types.js";
export type {
  GameLogClose,
  GameLogLine,
  GameLogTag,
  GameLogVoice,
} from "./components/mc-game-log/mc-game-log.types.js";
export type {
  BodyButton,
  BodyCell,
  BodyControl,
  BodyField,
  BodyHeading,
  BodyList,
  BodyRect,
  BodyRow,
  SettingsBodyModel,
} from "./components/mc-settings-body/mc-settings-body.types.js";
export type { TextLine } from "./shared/text-line.types.js";
export type { BarChartBar } from "./components/mc-bar-chart/mc-bar-chart.types.js";
export type { StatTile } from "./components/mc-stat-tiles/mc-stat-tiles.types.js";
export type { LineListEntry, LineListGroup } from "./components/mc-line-list/mc-line-list.types.js";
export type { DeckGridItem, DeckGridModel, DeckGridPick } from "./components/mc-deck-grid/mc-deck-grid.types.js";
export type {
  CardCellModel,
  CardFaceTileModel,
  CardSection,
  CardSectionsModel,
} from "./components/mc-card-sections/mc-card-sections.types.js";
export type {
  ShelfRosterHint,
  ShelfRosterItem,
  ShelfRosterModel,
  ShelfRosterShelf,
} from "./components/mc-shelf-roster/mc-shelf-roster.types.js";
export type { DeckDetailsAction, DeckDetailsModel } from "./components/mc-deck-details/mc-deck-details.types.js";
export type { MenuButton, MenuButtonGlyph, MenuButtonIcon } from "./components/mc-menu-button/mc-menu-button.types.js";
export type { MenuGridModel } from "./components/mc-menu-grid/mc-menu-grid.types.js";
export type { RankBarModel } from "./components/mc-rank-bar/mc-rank-bar.types.js";
export type { NewsBarGlyph, NewsBarModel } from "./components/mc-news-bar/mc-news-bar.types.js";
export type { AlertBannerModel } from "./components/mc-alert-banner/mc-alert-banner.types.js";
export type { PromoPanelModel } from "./components/mc-promo-panel/mc-promo-panel.types.js";
export type { FooterBarLink, FooterBarModel } from "./components/mc-footer-bar/mc-footer-bar.types.js";
export type { Placed, TitlePanelModel } from "./components/mc-title-panel/mc-title-panel.types.js";
export { McStatTile } from "./components/mc-stat-tile/mc-stat-tile.js";
export { McChartBar } from "./components/mc-chart-bar/mc-chart-bar.js";
export { McTipPlate } from "./components/mc-tip-plate/mc-tip-plate.js";
