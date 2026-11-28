import type { BarChartBar, ControlGlyph, StatTile, LineListGroup } from "@mc/ui";
import type { DeckCheckTab } from "../../../components/deck-check/shared/deck-check-events.types.js";
import type { DeckCheckSize } from "../../../components/deck-check/mc-deck-check-header/mc-deck-check-header.types.js";
import type { DeckStatusBadgeTone } from "../../../components/deck-check/mc-deck-status-badge/mc-deck-status-badge.types.js";
import type { AspectSegmentModel } from "../../../components/deck-check/mc-aspect-segment/mc-aspect-segment.types.js";
import type { TypeFilterChip } from "../../../components/deck-check/mc-deck-type-filter/mc-deck-type-filter.types.js";
import type { DeckCardRowModel } from "../../../components/deck-check/mc-deck-card-row/mc-deck-card-row.types.js";
import type {
  DeckCardGroupModel,
  DeckFaceGroupModel,
} from "../../../components/deck-check/mc-deck-card-sections/mc-deck-card-sections.types.js";

export type { DeckCheckSize, DeckCheckTab };

/** One aspect's tip, as its plate shows it. */
export interface DeckCheckTipModel {
  readonly heading: string;
  readonly tagline: string;
  readonly body: string;
  readonly linkLabel: string;
  /** Why the lesson link is not live (empty when it is). */
  readonly linkReason: string;
  readonly linkAvailable: boolean;
}

/** Everything Deck check shows, already computed and translated by the scene's view models. */
export interface DeckCheckPageModel {
  readonly header: {
    readonly backLabel: string;
    readonly title: string;
    readonly badgeText: string;
    readonly badgeTone: DeckStatusBadgeTone;
    readonly meta: string;
    readonly backGlyph?: ControlGlyph | undefined;
  };
  /** The LB / RB glyph over the tab strip (narrow, a keyboard or pad in use). */
  readonly tabsGlyph?: ControlGlyph | undefined;
  /** The wide layout's left rail. */
  readonly rail: {
    readonly aspectHeading: string;
    readonly aspects: readonly AspectSegmentModel[];
    /** Each aspect's tip, by aspect id. */
    readonly tips: Readonly<Record<string, DeckCheckTipModel>>;
    readonly filterHeading: string;
    readonly chips: readonly TypeFilterChip[];
    readonly curveHeading: string;
    readonly bars: readonly BarChartBar[];
  };
  /** The narrow Curve tab. */
  readonly curve: {
    readonly heading: string;
    readonly average: string;
    readonly bars: readonly BarChartBar[];
    readonly tiles: readonly StatTile[];
    readonly rows: readonly DeckCardRowModel[];
  };
  /** The narrow Aspect tab. */
  readonly composition: { readonly heading: string; readonly tiles: readonly StatTile[]; readonly empty: string };
  readonly tabs: readonly { readonly id: DeckCheckTab; readonly label: string }[];
  /** The wide layout's ink panel. */
  readonly panel: { readonly heading: string; readonly groups: readonly LineListGroup[]; readonly more: string };
  readonly sortLabel: string;
  readonly actions: { readonly editLabel: string; readonly startLabel: string; readonly startUnavailable: string };
  /** The deck's cards (wide always, narrow on the Cards tab). */
  readonly cards: {
    readonly faces: readonly DeckFaceGroupModel[];
    readonly groups: readonly DeckCardGroupModel[];
    readonly note: string;
    readonly cardScale: number;
    readonly desktop: boolean;
  };
}
