/**
 * The Title panel's parts as plain data (`@mc/ui`'s `mc-title-panel`), built from the same layout rects and wording the
 * Phaser screen drew from, so the panel has the Phaser screen's geometry. No Phaser, no DOM: the scene supplies the
 * layout, the translated words and the state; this places them (`scenes/title.ts`).
 */
import type {
  AlertBannerModel,
  MenuButton,
  MenuButtonIcon,
  PromoPanelModel,
  RankBarModel,
  SheetRect,
  SvgOp,
} from "@mc/ui";
import { typeRole } from "../tokens.js";
import { desktopTypeSize } from "../view/desktop-type.js";
import type { Rect } from "../view/layout.js";
import { ICON_GRID, playPlatformSlotIn, type PlayPlatformMark } from "../view/play-platform-mark.js";
import type { OnlinePanelLayout } from "../view/title-online-panel.js";
import type { UpdateBannerParts } from "../view/title-menu-layout.js";
import { RANK_BADGE_HEIGHT } from "../view/title-menu-layout.js";
import type { TitleRankBadge } from "../view/title-rank-badge.js";

const rel = (rect: Rect, origin: { readonly x: number; readonly y: number }): SheetRect => ({
  x: rect.x - origin.x,
  y: rect.y - origin.y,
  width: rect.width,
  height: rect.height,
});

/** A platform mark's shapes as drawing ops in its own 24-unit grid, painted in the button's text colour. */
export function platformIconOps(mark: PlayPlatformMark): readonly SvgOp[] {
  const ink = "currentColor";
  return mark.shapes.map((shape): SvgOp => {
    switch (shape.kind) {
      case "ring":
        return { k: "circle", cx: shape.cx, cy: shape.cy, r: shape.r, stroke: ink, sw: shape.w };
      case "ellipse":
        // An ellipse as two arcs: the ops have no ellipse.
        return {
          k: "path",
          d: `M${shape.cx - shape.rx} ${shape.cy}a${shape.rx} ${shape.ry} 0 1 0 ${shape.rx * 2} 0a${shape.rx} ${shape.ry} 0 1 0 ${-shape.rx * 2} 0`,
          stroke: ink,
          sw: shape.w,
        };
      case "line":
        return { k: "line", x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2, stroke: ink, sw: shape.w };
      case "box":
        return { k: "rect", x: shape.x, y: shape.y, w: shape.width, h: shape.height, stroke: ink, sw: shape.w };
      case "fillBox":
        return { k: "rect", x: shape.x, y: shape.y, w: shape.width, h: shape.height, fill: ink };
      case "dot":
        return { k: "circle", cx: shape.cx, cy: shape.cy, r: shape.r, fill: ink };
    }
  });
}

/** The Continue row's icon: at the row's left edge, centred vertically (`playPlatformSlotIn`), with its tooltip. */
export function continueIconOf(mark: PlayPlatformMark, row: Rect): { icon: MenuButtonIcon; labelInset: number } {
  const slot = playPlatformSlotIn(row);
  return {
    icon: { rect: rel(slot.box, row), grid: ICON_GRID, ops: platformIconOps(mark), label: mark.label },
    labelInset: slot.labelInset,
  };
}

/** A full-width menu row's label type: a row title sized to read at desk distance. */
export const MENU_LABEL = { plain: true, size: typeRole.menuButton.size } as const;

/** The update banner's inside, in the banner's own coordinates: its text and its buttons (the close button last). */
export function bannerModelOf(
  banner: Rect,
  parts: UpdateBannerParts,
  text: { readonly heading: string; readonly detail: string },
  buttons: readonly (MenuButton | null)[],
): AlertBannerModel {
  return {
    heading: text.heading,
    detail: text.detail,
    text: { x: parts.text.x - banner.x, y: parts.text.y - banner.y, width: parts.textWidth },
    buttons: buttons.filter((button): button is MenuButton => button !== null),
  };
}

/** A banner button: a row title on its rect inside the banner, a touch-sized target. */
export function bannerButtonOf(
  banner: Rect,
  key: string,
  kind: "primary" | "secondary",
  label: string,
  rect: Rect,
  desktop: boolean,
): MenuButton {
  return {
    key,
    label,
    kind,
    rect: rel(rect, banner),
    plain: true,
    size: desktopTypeSize(typeRole.rowTitle.size, desktop),
  };
}

/** The rank plate's words: a full plate stacks the rank over its name, a phone's strip puts them on one line. */
export function rankBarOf(
  rect: Rect,
  badge: TitleRankBadge,
  up: string | null,
  words: { readonly rankUp: string },
): RankBarModel {
  const compact = rect.height < RANK_BADGE_HEIGHT;
  const name = up ? up.replace(/^Rank up: /, "") : badge.title;
  return {
    compact,
    up: up !== null,
    label: compact
      ? up
        ? `${words.rankUp} · ${name}`
        : `${badge.rankLabel} · ${badge.title}`
      : up
        ? words.rankUp
        : badge.rankLabel,
    title: name,
    points: up ? null : badge.pointsLabel,
    // A plate too narrow for the next rank's name says "300 to rank 4" instead.
    next: up ? null : !compact && rect.width - 16 < 170 ? badge.shortNextLabel : badge.nextLabel,
    fraction: badge.fraction,
    summary: badge.summary,
  };
}

export interface PromoWords {
  /** The panel's title as typed ("Play online"). */
  readonly title: string;
  readonly pitch: string;
  readonly liveText: string | null;
  readonly host: string;
  readonly join: string;
}

/** The "Play online" panel's parts (`view/title-online-panel.ts`) in the panel's own coordinates. */
export function promoModelOf(panel: OnlinePanelLayout, words: PromoWords, available: boolean): PromoPanelModel {
  const origin = panel.rect;
  const side = panel.placement === "side";
  const upper = words.title.toUpperCase();
  const cut = upper.lastIndexOf(" ");
  const text = panel.titleLines === 2 && cut > 0 ? `${upper.slice(0, cut)}\n${upper.slice(cut + 1)}!` : `${upper}!`;
  const size = panel.titleLines === 2 ? 40 : side ? 30 : 26;
  const button = (key: string, rect: Rect, label: string): MenuButton => ({
    key,
    label,
    kind: "secondary",
    rect: rel(rect, origin),
    disabled: !available,
    ...MENU_LABEL,
  });
  return {
    available,
    band: rel(panel.band, origin),
    title: { rect: rel(panel.title, origin), text, size, lines: panel.titleLines },
    live:
      words.liveText !== null && panel.live
        ? { rect: rel(panel.live, origin), text: words.liveText, align: side ? "left" : "right" }
        : null,
    pitch: { rect: rel(panel.pitch, origin), text: words.pitch, size: typeRole.body.size + (side ? 4 : 2) },
    seats: panel.seats ? rel(panel.seats, origin) : null,
    buttons: [button("play-online-host", panel.host, words.host), button("play-online-join", panel.join, words.join)],
  };
}
