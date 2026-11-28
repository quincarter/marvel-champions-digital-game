/**
 * The speaker: a round portrait of whoever the story's briefing line speaks as (a hero, the villain, an NPC, or the first
 * seat for narration) and the white speech bubble beside it, as parts of the panel. Returns the bottom of both.
 */
import type { CardId } from "@mc/content";
import { CAMPAIGN_ART, campaignCoverFor } from "../../../art/campaign-art.js";
import { lineForRoster } from "../../../campaign/story.js";
import { campaignCardsById } from "../../../content/campaign-pool.js";
import { heroPictureOf } from "../../../dom/hero-picture.js";
import { sheetColor, type SheetBuilder } from "../../../dom/sheet-builder.js";
import { accent, surface, typeRole } from "../../../tokens.js";
import { bangers, villainPicture } from "../../../ui/campaign-chrome.js";
import { briefingSpeakerOf } from "../../../view/campaign-briefing-speaker.js";
import type { Rect } from "../../../view/layout.js";
import type { BriefingCtx, Column } from "./context.js";
import { briefingTextIn } from "./copy.js";

const BUBBLE_PAD_X = 16;
const BUBBLE_PAD_Y = 12;
const BUBBLE_SHADOW = 5;
/** The room left of the bubble for its tail. */
const TAIL_ROOM = 14;

interface PortraitPicture {
  readonly src: string | null;
  readonly cover: { readonly x: number; readonly y: number; readonly centered?: boolean };
  readonly retry?: string;
}

/** The crop of a picture whose focus may be set: faces sit in the upper part. */
function coverOf(focus: { readonly x?: number; readonly y?: number } | undefined): PortraitPicture["cover"] {
  return focus?.y !== undefined ? { x: focus.x ?? 0.5, y: focus.y, centered: true } : { x: focus?.x ?? 0.5, y: 0.15 };
}

export function drawSpeaker(ctx: BriefingCtx, b: SheetBuilder, col: Column, top: number): number {
  const { record, story } = ctx.state;
  if (!record || !story) return top;
  const resolved = lineForRoster(
    story.briefing,
    record.seats.map((seat) => seat.identityCardId),
  );
  if (!resolved) return top;
  const nodeId = record.attempt?.nodeId ?? record.position.nextNodeId ?? "";
  const speaker = briefingSpeakerOf(
    resolved.speaker,
    { scenarioId: nodeId, villainName: story.villain },
    record.seats[0]?.identityCardId ?? null,
  );
  const size = col.phone ? 64 : 84;
  const portrait: Rect = { x: col.x, y: top, width: size, height: size };
  b.box(portrait, { fill: surface.ink.hex, round: true });
  // A hero whose portrait is not filed yet (a new box's `art/heroes/_pending/`) speaks over the box's own cover.
  let picture: PortraitPicture | null = null;
  if (speaker.villainScenarioId) {
    const villain = villainPicture(speaker.villainScenarioId);
    picture = { ...ctx.leases.image(villain), cover: coverOf(villain?.focus) };
  } else if (speaker.heroIdentityId) {
    const hero = heroPictureOf(campaignCardsById().get(speaker.heroIdentityId as CardId), ctx.leases);
    const cover = campaignCoverFor(CAMPAIGN_ART, record.campaignId as string);
    picture = hero.src !== null ? hero : { ...ctx.leases.image(cover), cover: coverOf(cover?.focus) };
  }
  if (picture?.src) {
    b.image(portrait, {
      src: picture.src,
      cover: picture.cover,
      round: true,
      key: "speaker-portrait",
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
    });
  } else if (!speaker.heroIdentityId && speaker.initial) {
    // A voice with no picture draws its initial rather than somebody else's face.
    b.text(portrait.x + size / 2, portrait.y + size / 2, speaker.initial.toLocaleUpperCase(), bangers(size * 0.5), {
      color: surface.paper.hex,
      origin: [0.5, 0.5],
    });
  }
  b.box(portrait, { stroke: surface.ink.hex, strokeWidth: 3, round: true });

  const bubble = drawBubble(
    b,
    col.x + size + 16,
    top,
    col.width - size - 16,
    briefingTextIn().bubble(resolved.text),
    speaker.name,
    col.phone ? 14 : 15,
  );
  return Math.max(top + size, bubble.y + bubble.height);
}

/** A white speech bubble with a 3px ink border, an offset shadow and a tail pointing left at the portrait. */
function drawBubble(
  b: SheetBuilder,
  x: number,
  y: number,
  maxWidth: number,
  text: string,
  speaker: string | null,
  size: number,
): Rect {
  const inner = maxWidth - BUBBLE_PAD_X * 2;
  const body = { size, lineSpacing: 3, wrapWidth: inner } as const;
  const speakerText = speaker?.toLocaleUpperCase() ?? null;
  const speakerBox = speakerText ? b.measure(speakerText, typeRole.label, { letterSpacing: 1.2 }) : null;
  const wrapped = b.measure(text, typeRole.emphasis, body);
  const single = b.measure(text, typeRole.emphasis, { size });
  const contentWidth = Math.max(Math.min(single.width, inner), speakerBox?.width ?? 0);
  const width = Math.min(maxWidth, contentWidth + BUBBLE_PAD_X * 2);
  const textTop = y + BUBBLE_PAD_Y + (speakerBox ? speakerBox.height + 4 : 0);
  const rect: Rect = { x, y, width, height: textTop - y + wrapped.height + BUBBLE_PAD_Y };
  const radius = Math.min(16, rect.height / 2);
  // The shadow, the bubble and its border as one drawing: a rounded box the sheet's plain boxes cannot make.
  const room: Rect = {
    x: rect.x - TAIL_ROOM,
    y: rect.y - 2,
    width: rect.width + TAIL_ROOM + BUBBLE_SHADOW,
    height: rect.height + BUBBLE_SHADOW + 2,
  };
  const ox = TAIL_ROOM;
  const ty = Math.min(rect.height / 2, 22) + 2;
  const card = sheetColor(surface.card.hex, "fill");
  const ink = sheetColor(surface.ink.hex, "line");
  b.svg(
    room,
    [room.width, room.height],
    [
      {
        k: "rect",
        x: ox + BUBBLE_SHADOW,
        y: BUBBLE_SHADOW + 2,
        w: rect.width,
        h: rect.height,
        rx: radius,
        fill: sheetColor(surface.ink.hex, "fill"),
      },
      { k: "rect", x: ox, y: 2, w: rect.width, h: rect.height, rx: radius, fill: card, stroke: ink, sw: 3 },
      { k: "path", d: `M ${ox + 2} ${ty - 8} L ${ox - 12} ${ty} L ${ox + 2} ${ty + 8} Z`, fill: card },
      { k: "path", d: `M ${ox} ${ty - 8} L ${ox - 12} ${ty} L ${ox} ${ty + 8}`, stroke: ink, sw: 3 },
    ],
    "speaker-bubble",
  );
  if (speakerText) {
    b.text(x + BUBBLE_PAD_X, y + BUBBLE_PAD_Y, speakerText, typeRole.label, {
      color: accent.heroRed.hex,
      letterSpacing: 1.2,
    });
  }
  b.text(x + BUBBLE_PAD_X, textTop, text, typeRole.emphasis, { ...body, color: surface.ink.hex });
  return rect;
}
