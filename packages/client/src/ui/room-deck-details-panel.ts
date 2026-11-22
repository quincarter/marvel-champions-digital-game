/**
 * The room deck picker's details panel (#880; Quin, 2026-11-21): one deck's hero picture, names, stats and card list
 * above a fixed footer of "Use this deck", "Edit deck" and "Close". The same drawing is the desktop's slide-out and a
 * phone's full sheet; the scene decides where it sits (`view/room-deck-picker-layout.ts`) and how far from home it is
 * while it moves, and this only draws what it is given. The body scrolls in a masked region; the footer never does.
 */
import type Phaser from "phaser";
import { currentCardsById } from "../content/pool.js";
import { t, tPlural } from "../i18n/translate.js";
import { hit, ink, surface, typeRole } from "../tokens.js";
import type { DeckDetails } from "../view/room-deck-details-model.js";
import { CHIP_GAP } from "../view/chip-layout.js";
import type { Rect } from "../view/layout.js";
import type { VariableListScroll } from "../view/variable-list-scroll.js";
import {
  drawCompositionTiles,
  compositionTileDefs,
  drawGroupedCardList,
  drawStatCurveBars,
} from "./deck-stats-widgets.js";
import { McScrollRegion } from "./scroll-region.js";
import { drawHeroAvatar } from "./seat-avatar.js";
import { textStyle } from "./theme.js";
import { McButton, fitText, label } from "./widgets.js";

const PAD = 14;
const SCROLLBAR_ROOM = 12;
/** The footer: padding, the primary action, a gap, the second row, padding. */
export const DETAILS_FOOTER_HEIGHT = PAD + hit.primary + 8 + hit.target + PAD;

export interface DetailsPanelOptions {
  /** Where the panel rests; `offset` is how far from there it is drawn now. */
  readonly rect: Rect;
  readonly offset: { readonly x: number; readonly y: number };
  readonly details: DeckDetails;
  readonly scroll: VariableListScroll;
  readonly onUse: () => void;
  /** The reason "Use this deck" is unavailable has to be said when it is pressed (a touch has no hover). */
  readonly onUnavailable: () => void;
  readonly onEdit: () => void;
  readonly onClose: () => void;
}

export interface DetailsPanelStop {
  readonly key: string;
  readonly rect: Rect;
  readonly activate: () => void;
}

export interface DetailsPanel {
  readonly buttons: McButton[];
  readonly region: McScrollRegion;
  /** The masked body: the hover popover clips its card faces to it. */
  readonly body: Rect;
  /** Card faces in the body, at their unscrolled place: the hero picture and each card line. */
  readonly faces: { readonly cardId: string; readonly rect: Rect }[];
  readonly stops: readonly DetailsPanelStop[];
}

export function drawDetailsPanel(scene: Phaser.Scene, options: DetailsPanelOptions): DetailsPanel {
  const { details, offset } = options;
  const r: Rect = { ...options.rect, x: options.rect.x + offset.x, y: options.rect.y + offset.y };
  const g = scene.add.graphics();
  g.fillStyle(surface.paper.hex, 1).fillRect(r.x, r.y, r.width, r.height);
  g.lineStyle(3, surface.ink.hex, 1).strokeRect(r.x + 1.5, r.y + 1.5, r.width - 3, r.height - 3);

  const footerTop = r.y + r.height - DETAILS_FOOTER_HEIGHT;
  const body: Rect = {
    x: r.x + PAD,
    y: r.y + PAD,
    width: r.width - PAD * 2,
    height: Math.max(0, footerTop - r.y - PAD * 1.5),
  };
  const heights = [body.height];
  const region = new McScrollRegion(scene, { rect: body, heights, scroll: options.scroll, clipInteractive: true });
  const before = scene.children.list.length;
  const column = body.width - SCROLLBAR_ROOM;
  const faces: { cardId: string; rect: Rect }[] = [];
  let y = body.y;

  const artHeight = Math.round(Math.min(200, Math.max(110, column * 0.5)));
  const artRect: Rect = { x: body.x, y, width: column, height: artHeight };
  drawHeroAvatar(scene, artRect, currentCardsById().get(details.cardId), surface.ink.hex);
  faces.push({ cardId: details.cardId, rect: artRect });
  y += artHeight + 10;

  const name = scene.add
    .text(body.x, y, details.title, textStyle({ ...typeRole.rowTitle, size: 20 }, surface.ink.hex))
    .setFontSize(20)
    .setWordWrapWidth(column, true);
  y += name.height + 2;
  const who = [details.heroName, details.aspects].filter((p) => p !== "").join(" · ");
  const line = scene.add.text(body.x, y, who, textStyle(typeRole.body, surface.ink.hex, ink.secondary)).setFontSize(14);
  fitText(line, column, 14);
  y += line.height + 2;
  const counts = [details.countText, details.averageCostText].filter((p): p is string => p !== null).join(" · ");
  const countLine = scene.add
    .text(body.x, y, counts, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
    .setFontSize(12);
  fitText(countLine, column, 12);
  y += countLine.height + 2;
  // The deck's standing, in words: never a colour alone.
  const status = details.checking
    ? t("room.picker.checking")
    : !details.seatable
      ? t("room.picker.notReady", { reason: details.blockedReason ?? "" })
      : details.current
        ? t("room.picker.current")
        : null;
  if (status) {
    const s = scene.add
      .text(body.x, y, status, textStyle(typeRole.body, surface.ink.hex, 1))
      .setFontSize(12)
      .setFontStyle("bold")
      .setWordWrapWidth(column, true);
    y += s.height + 2;
  }
  if (details.missing > 0) {
    const m = scene.add
      .text(
        body.x,
        y,
        tPlural("room.picker.missing", details.missing),
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setFontSize(12)
      .setWordWrapWidth(column, true);
    y += m.height + 2;
  }
  y += 10;

  label(scene, body.x, y, t("room.picker.statsHeading"), typeRole.label, surface.ink.hex, ink.label);
  y += 16;
  const chart = 84;
  drawStatCurveBars(scene, { x: body.x, y, width: column, height: chart }, details.curve, false);
  y += chart + 10;
  if (details.tiles.length > 0) {
    y = drawCompositionTiles(scene, { x: body.x, y, width: column, height: 0 }, compositionTileDefs(details.tiles)) + 2;
  }
  y += 6;

  label(scene, body.x, y, t("room.picker.cardsHeading"), typeRole.label, surface.ink.hex, ink.label);
  y += 16;
  y = drawGroupedCardList(
    scene,
    body.x,
    y,
    column,
    details.groups,
    Number.MAX_SAFE_INTEGER,
    false,
    undefined,
    undefined,
    undefined,
    (entry, rect) => faces.push({ cardId: entry.cardId as string, rect }),
  );
  y += CHIP_GAP;

  heights[0] = Math.max(body.height, y - body.y);
  const added = scene.children.list.slice(before).filter((node) => node !== region.root);
  if (added.length > 0) region.content.add(added);
  region.refresh();

  // The footer.
  const buttons: McButton[] = [];
  const stops: DetailsPanelStop[] = [];
  const left = r.x + PAD;
  const width = r.width - PAD * 2;
  const useRect: Rect = { x: left, y: footerTop + PAD, width, height: hit.primary };
  const second: Rect = { x: left, y: useRect.y + hit.primary + 8, width, height: hit.target };
  const button = (
    key: string,
    rect: Rect,
    kind: "primary" | "secondary",
    text: string,
    go: () => void,
    extra = {},
  ): void => {
    buttons.push(
      new McButton(scene, { kind, label: text, type: { ...typeRole.label, size: 13 }, rect, onClick: go, ...extra }),
    );
    stops.push({ key, rect, activate: go });
  };
  button("panel:use", useRect, details.seatable ? "primary" : "secondary", t("room.picker.use"), options.onUse, {
    enabled: details.seatable,
    ...(details.blockedReason ? { reason: details.blockedReason } : {}),
    onUnavailablePress: options.onUnavailable,
  });
  if (details.edit) {
    const half = (width - 8) / 2;
    button(
      "panel:edit",
      { ...second, width: half },
      "secondary",
      details.edit.copy ? t("room.picker.editCopy") : t("room.picker.edit"),
      options.onEdit,
    );
    button(
      "panel:close",
      { ...second, x: left + half + 8, width: half },
      "secondary",
      t("room.picker.close"),
      options.onClose,
    );
  } else {
    button("panel:close", second, "secondary", t("room.picker.close"), options.onClose);
  }
  return { buttons, region, body, faces, stops };
}
