import { customBadge } from "../../../view/custom-content.js";
import { accent, hit, ink, signal, surface, typeRole } from "../../../tokens.js";
import { bangers, campaignFrame } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { inputDevice } from "../../../platform/input-device.js";
import { type SagaVolumeRow } from "../../../view/campaign-saga-model.js";
import { altsOf, featuredCopyOf } from "../../../view/campaign-saga-copy.js";
import { volumeNameIn } from "../../../campaign/campaign-text.js";
import { rememberSagaVolumesView } from "../../../platform/saga-view.js";
import type { Rect } from "../../../view/layout.js";
import { clipToView } from "../../../view/focus-list.js";
import { t } from "../../../i18n/translate.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import { drawIssuePips } from "../../../dom/issue-pips.js";
import {
  TILE_COLUMNS,
  PHONE_TILE_COLUMNS,
  TILE_GAP,
  MIN_TILE_HEIGHT,
  VIEW_STOP,
  SCROLL_GUTTER,
  LIST,
  type VolumeTiles,
  type SagaCtx,
} from "./context.js";
import { drawVolumes } from "./volumes.js";
import { drawArtBadges, drawFeaturedArt } from "./card.js";
import { drawCta, drawAlt } from "./buttons.js";

/**
 * One page that scrolls as a whole (a single scroller from under the top bar to the action bar): the featured volume's
 * art on top, which scrolls away and fades as the page does, then a compact card that pins under the top bar (the
 * volume's status line, name, issue bar and its two buttons), then the rest of the card (the roster line, the note),
 * then ALL VOLUMES with its view toggle and every volume. The one big button stays pinned in the action bar.
 */
export function drawPhone(
  ctx: SagaCtx,
  b: SheetBuilder,
  frame: ReturnType<typeof campaignFrame>,
  topHeight: number,
  row: SagaVolumeRow,
): void {
  const gutter = frame.gutter;
  // A phone held sideways has no height for tiles, or for the toggle.
  const choosesView = frame.formFactor === "tabletPortrait" || frame.formFactor === "phone";
  const showsTiles = choosesView && ctx.state.volumesView === "grid";
  const view: Rect = {
    x: 0,
    y: topHeight,
    width: frame.width - SCROLL_GUTTER,
    height: frame.height - topHeight - frame.actionBar,
  };
  const cardWidth = frame.width - gutter * 2;
  const artHeight = Math.round(Math.min(300, view.height * 0.4));
  const stickyTop = gutter + artHeight;
  const copy = featuredCopyOf(row);
  const alts = altsOf(row, ctx.state.confirmAbandon);
  const pad = 12;
  const innerWidth = cardWidth - pad * 2;

  // The pinned card's height: its status line, the name (which may take two lines), the issue bar and the buttons.
  const nameType = bangers(28, 0.92);
  const name = volumeNameIn(row.volume).toLocaleUpperCase();
  const nameHeight = b.measure(name, nameType, { wrapWidth: innerWidth }).height;
  const altHeight = 40;
  const stickyHeight = 10 + 18 + nameHeight + 9 + (copy.hasPips ? 15 : 0) + (alts.length > 0 ? altHeight + 10 : 4);

  ctx.state.listRect = view;
  ctx.state.listContent = 0;
  ctx.state.moreShown = false;
  const scrolledNow = (): number => ctx.scroller()?.scrollTop ?? ctx.state.listTop;
  // Where the pinned card is in the view now: in its place in the page, then held at the view's top edge.
  const pinnedTop = (): number => view.y + Math.max(0, stickyTop - scrolledNow());
  const onPage = (content: Rect): Rect => ({ ...content, y: view.y + content.y - scrolledNow() });
  const onPinned = (content: Rect): Rect => ({ ...content, y: pinnedTop() + (content.y - stickyTop) });
  // What a row can be seen in: the view below the pinned card.
  const below = (): Rect => {
    const y = pinnedTop() + stickyHeight;
    return { x: 0, y, width: frame.width, height: Math.max(0, view.y + view.height - y) };
  };
  // Scrolls the page the least that brings a row into the part of the view the pinned card leaves free.
  const reveal = (content: Rect): void => {
    const scroller = ctx.scroller();
    if (!scroller) return;
    const top = scroller.scrollTop;
    const edge = Math.max(top, stickyTop) + stickyHeight;
    const bottom = top + view.height;
    if (content.y < edge) scroller.scrollTop = top + (content.y - edge);
    else if (content.y + content.height > bottom) scroller.scrollTop = top + (content.y + content.height - bottom);
  };

  b.scrollFit(LIST, view, (inner) => {
    const artRect: Rect = { x: gutter, y: gutter, width: cardWidth, height: artHeight };
    inner.group("saga-art", artRect, { fade: artHeight }, (art) => {
      drawFeaturedArt(ctx, art, artRect, row);
      art.box(artRect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
      art.box(
        { x: artRect.x + 3, y: artRect.y + 3, width: artRect.width - 6, height: artRect.height - 6 },
        { stroke: surface.ink.hex, strokeWidth: 3 },
      );
      drawArtBadges(ctx, art, { ...artRect, x: artRect.x + 3, y: artRect.y + 3 }, row, true);
    });

    const pinnedRect: Rect = { x: gutter, y: stickyTop, width: cardWidth, height: stickyHeight };
    inner.group("saga-pinned", pinnedRect, { sticky: true }, (card) => {
      card.box(pinnedRect, { fill: surface.ink.hex });
      card.box(pinnedRect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
      card.box(
        { x: pinnedRect.x + 3, y: pinnedRect.y + 3, width: pinnedRect.width - 6, height: pinnedRect.height - 6 },
        { stroke: surface.ink.hex, strokeWidth: 3 },
      );
      let y = pinnedRect.y + 10;
      const statusLine = `${copy.status} · ${row.volume.custom ? `${customBadge()} · ${row.volume.custom.packName}` : row.volume.boxCode}`;
      card.text(pinnedRect.x + pad, y, caseOf(typeRole.label, statusLine.toLocaleUpperCase()), typeRole.label, {
        color: signal.caution.hex,
        letterSpacing: 1,
      });
      if (copy.right) {
        card.text(pinnedRect.x + pinnedRect.width - pad, y, copy.right.toLocaleUpperCase(), typeRole.label, {
          color: surface.paper.hex,
          alpha: ink.meta,
          origin: [1, 0],
          letterSpacing: 1,
        });
      }
      y += 18;
      card.text(pinnedRect.x + pad, y, name, nameType, { color: surface.paper.hex, wrapWidth: innerWidth });
      y += nameHeight + 9;
      if (copy.hasPips) {
        drawIssuePips(card, { x: pinnedRect.x + pad, y, width: innerWidth, height: 7 }, row.pips);
        y += 15;
      }
      if (alts.length > 0) {
        const altWidth = (innerWidth - 8) / 2;
        alts.forEach((alt, index) => {
          const altRect: Rect = {
            x: pinnedRect.x + pad + index * (altWidth + 8),
            y,
            width: altWidth,
            height: altHeight,
          };
          drawAlt(ctx, card, altRect, alt, index, row, 15, () => clipToView(onPinned(altRect), view));
        });
      }
    });

    // The rest of the card, under the pinned part: the roster line and the note, which scroll away with the art.
    const tailTop = stickyTop + stickyHeight;
    const sub = copy.sub ? inner.measure(copy.sub, typeRole.emphasis, { size: 11, wrapWidth: innerWidth }).height : 0;
    const footText = alts.length > 0 && copy.foot ? caseOf(typeRole.label, copy.foot) : "";
    const foot = footText ? inner.measure(footText, typeRole.label, { size: 9.5, wrapWidth: innerWidth }).height : 0;
    const tailHeight = sub + foot > 0 ? 10 + sub + (foot > 0 ? 8 + foot : 0) + 16 : 0;
    if (tailHeight > 0) {
      const tailRect: Rect = { x: gutter, y: tailTop, width: cardWidth, height: tailHeight };
      inner.box(tailRect, { fill: surface.ink.hex });
      inner.box(tailRect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
      inner.box(
        { x: tailRect.x + 3, y: tailRect.y + 3, width: tailRect.width - 6, height: tailRect.height - 6 },
        { stroke: surface.ink.hex, strokeWidth: 3 },
      );
      let y = tailTop + 10;
      if (sub > 0) {
        inner.text(gutter + pad, y, copy.sub, typeRole.emphasis, {
          size: 11,
          color: surface.paper.hex,
          alpha: ink.secondary,
          wrapWidth: innerWidth,
        });
        y += sub + 8;
      }
      if (foot > 0) {
        inner.text(gutter + pad, y, footText, typeRole.label, {
          size: 9.5,
          color: surface.paper.hex,
          alpha: ink.meta,
          wrapWidth: innerWidth,
        });
      }
    }

    // ALL VOLUMES, with the list / grid toggle.
    let y = tailTop + tailHeight + 18;
    const headerHeight = choosesView ? hit.target + 8 : 24;
    const toggleWidth = choosesView ? 130 : 0;
    const headerMiddle = y + (choosesView ? hit.target / 2 : 9);
    const heading = t("saga.allVolumes").toLocaleUpperCase();
    const headingWidth = inner.measure(heading, typeRole.barTitle, { size: 14, letterSpacing: 0.6 }).width;
    inner.text(gutter, headerMiddle, heading, typeRole.barTitle, {
      size: 14,
      color: surface.ink.hex,
      letterSpacing: 0.6,
      origin: [0, 0.5],
    });
    const ruleX = gutter + headingWidth + 12;
    inner.box(
      {
        x: ruleX,
        y: headerMiddle - 1.5,
        width: Math.max(0, frame.width - gutter - (toggleWidth ? toggleWidth + 12 : 0) - ruleX),
        height: 3,
      },
      { fill: surface.ink.hex },
    );
    if (choosesView) {
      const rect: Rect = { x: frame.width - gutter - toggleWidth, y, width: toggleWidth, height: hit.target };
      const toggle = (): void => {
        ctx.state.volumesChosen = ctx.state.volumesView === "grid" ? "list" : "grid";
        rememberSagaVolumesView(ctx.state.volumesChosen);
        ctx.state.listTop = 0;
        ctx.rebuild();
        if (inputDevice().mode === "keyboard" || inputDevice().mode === "pad") ctx.route?.focusKey(VIEW_STOP);
      };
      ctx.glyphs.button(inner, {
        key: VIEW_STOP,
        rect,
        label: showsTiles ? t("saga.viewList") : t("saga.viewGrid"),
        look: "secondary",
        type: typeRole.label,
        ids: ["zoneNext"],
        ground: "paper",
      });
      ctx.actions.set(VIEW_STOP, toggle);
      ctx.stops.set(VIEW_STOP, {
        rect: () => clipToView(onPage(rect), below()),
        view: below,
        activate: toggle,
        ensureVisible: () => reveal(rect),
      });
    }
    y += headerHeight;

    const listWidth = frame.width - gutter * 2;
    const columns = frame.formFactor === "phone" ? PHONE_TILE_COLUMNS : TILE_COLUMNS;
    const tileWidth = (listWidth - TILE_GAP * (columns - 1)) / columns;
    const tileHeight = Math.max(MIN_TILE_HEIGHT, Math.round(tileWidth * 1.25));
    const tiles: VolumeTiles | null = showsTiles ? { columns, height: tileHeight } : null;
    const listRect: Rect = { x: gutter, y, width: listWidth, height: 0 };
    const total = drawVolumes(ctx, inner, listRect, tiles, {
      into: inner,
      top: y,
      onScreen: onPage,
      view: below,
      reveal,
    });
    // Long enough that the art can scroll away completely, however few volumes there are.
    return Math.max(y + total + gutter, view.height + stickyTop);
  });

  // The ink action bar across the bottom, with the one CTA.
  const actionBar: Rect = { x: 0, y: frame.height - frame.actionBar, width: frame.width, height: frame.actionBar };
  b.box(actionBar, { fill: surface.ink.hex });
  const ctaRect: Rect = {
    x: actionBar.x + 12,
    y: actionBar.y + 9,
    width: actionBar.width - 24,
    height: actionBar.height - 18,
  };
  drawCta(ctx, b, ctaRect, row, 18);
}
