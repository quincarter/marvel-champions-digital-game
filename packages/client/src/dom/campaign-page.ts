/**
 * The two pieces every campaign page shares, as parts of an `mc-sheet`: the box art faded across the whole page
 * (`ui/campaign-pane.ts`'s `drawCampaignPageArt`, in the panel) and the yellow caption box, the narrator's voice
 * (`ui/campaign-chrome.ts`'s `captionBox`).
 */
import type { PictureLeases } from "./picture-leases.js";
import { CAMPAIGN_RECORDS } from "../campaign/campaign-service.js";
import { appSession } from "../session.js";
import { signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { campaignCoverPicture, villainPicture } from "../ui/campaign-chrome.js";
import {
  PAGE_ART_ALPHA,
  PANE_ART_ALPHA,
  PANE_VEIL_ALPHA,
  PANE_VEIL_COLOR,
  campaignFadeFillOf,
} from "../view/campaign-fade-color.js";
import type { Rect } from "../view/layout.js";
import type { SheetBuilder } from "./sheet-builder.js";

/**
 * The campaign's box art faded across `rect` (the whole page), under everything drawn after it, unless
 * `Settings.fadedCampaignArt` is off: the picture, then the page's paper over it at what the art does not take, so the
 * ink text on top stays readable (`view/campaign-fade-color.ts` proves the contrast).
 */
export function drawCampaignPageArt(b: SheetBuilder, leases: PictureLeases, campaignId: string, rect: Rect): void {
  if (!appSession().settings.fadedCampaignArt) return;
  const finale = CAMPAIGN_RECORDS[campaignId]?.scenarioIds.at(-1) as string | undefined;
  const picture = campaignCoverPicture(campaignId) ?? (finale ? villainPicture(finale) : null);
  const held = leases.image(picture);
  if (held.src === null) return;
  b.image(rect, {
    src: held.src,
    cover: { x: 0.5, y: 0.2 },
    key: "page-art",
    ...(held.retry !== undefined ? { retry: held.retry } : {}),
  });
  b.box(rect, { fill: surface.paper.hex, fillAlpha: 1 - PAGE_ART_ALPHA });
}

/**
 * The yellow caption box at (`x`, `y`), at most `maxWidth` wide: an ink border and capitals in italic 800 type. Returns its
 * box, so the caller can lay what follows under it.
 */
export function drawCaptionBox(b: SheetBuilder, x: number, y: number, maxWidth: number, text: string, size = 12): Rect {
  const pad = 12;
  const spec: TypeSpec = { ...typeRole.label, size, letterSpacing: 0, weight: 800 };
  const words = text.toLocaleUpperCase();
  const measured = b.measure(words, spec, { wrapWidth: maxWidth - pad * 2, italic: true, lineSpacing: 2 });
  const single = b.measure(words, spec, { italic: true });
  const width = Math.min(maxWidth, Math.min(single.width, maxWidth - pad * 2) + pad * 2);
  const rect: Rect = {
    x,
    y,
    width: single.width <= maxWidth - pad * 2 ? width : maxWidth,
    height: measured.height + pad * 1.5,
  };
  b.box(rect, { fill: signal.caution.hex });
  b.box(rect, { stroke: surface.inkOnHue.hex, strokeWidth: 3 });
  b.text(x + pad, y + pad * 0.75, words, spec, {
    color: surface.inkOnHue.hex,
    wrapWidth: maxWidth - pad * 2,
    italic: true,
    lineSpacing: 2,
  });
  return rect;
}

/** Moves the parts `b` took since `mark` to index `at`, under what was drawn after `at` (a panel measured after its text). */
function slotUnder(b: SheetBuilder, mark: number, at: number | undefined): void {
  if (at === undefined) return;
  b.nodes.splice(at, 0, ...b.nodes.splice(mark));
}

/**
 * The coloured side pane's ground in `rect` (`ui/campaign-pane.ts`'s `drawCampaignPaneGround`): the chosen fade colour,
 * the box art faded over it unless `Settings.fadedCampaignArt` is off, and the dark veil with its frame. `at` slots it
 * under the parts already drawn from that index of `b.nodes` (a stacked pane is measured after its content).
 */
export function drawPaneGround(
  b: SheetBuilder,
  leases: PictureLeases,
  campaignId: string,
  rect: Rect,
  at?: number,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const mark = b.nodes.length;
  const settings = appSession().settings;
  const ground = campaignFadeFillOf(settings.campaignFadeColor);
  b.box(rect, { fill: ground });
  if (settings.fadedCampaignArt) {
    const finale = CAMPAIGN_RECORDS[campaignId]?.scenarioIds.at(-1) as string | undefined;
    const picture = campaignCoverPicture(campaignId) ?? (finale ? villainPicture(finale) : null);
    const held = leases.image(picture);
    if (held.src !== null) {
      b.image(rect, {
        src: held.src,
        cover: { x: 0.5, y: 0.2 },
        key: `pane-art:${Math.round(rect.y)}`,
        ...(held.retry !== undefined ? { retry: held.retry } : {}),
      });
      // The picture sits at its own opacity over the ground: the ground again over it, at what the picture does not take.
      b.box(rect, { fill: ground, fillAlpha: 1 - PANE_ART_ALPHA });
    }
  }
  b.box(rect, { fill: PANE_VEIL_COLOR, fillAlpha: PANE_VEIL_ALPHA });
  b.box(
    { x: rect.x + 1.5, y: rect.y + 1.5, width: rect.width - 3, height: rect.height - 3 },
    { stroke: PANE_VEIL_COLOR, strokeWidth: 3 },
  );
  slotUnder(b, mark, at);
}

/**
 * A paper panel on the pane for a column of ink-on-paper content (the Briefing's decks and schemes), so its text keeps
 * its colours on any fade colour (`ui/campaign-pane.ts`'s `drawPanePaper`).
 */
export function drawPanePaper(b: SheetBuilder, rect: Rect, at?: number): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const mark = b.nodes.length;
  b.box(rect, { fill: surface.paper.hex });
  b.box(
    { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 },
    { stroke: surface.ink.hex, strokeWidth: 2 },
  );
  slotUnder(b, mark, at);
}
