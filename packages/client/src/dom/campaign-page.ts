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
import { PAGE_ART_ALPHA } from "../view/campaign-fade-color.js";
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
