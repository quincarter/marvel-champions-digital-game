/**
 * "Edit which deck?": one button per seat, over a scrim that takes every press so nothing behind it moves. Opened by EDIT
 * DECKS when several seats could be meant and none is the problem. Its buttons are the whole focus route while it is up.
 */
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { surface, typeRole } from "../../../tokens.js";
import { bangers, campaignFrame } from "../../../ui/campaign-chrome.js";
import { t } from "../../../i18n/translate.js";
import type { Rect } from "../../../view/layout.js";
import type { BriefingCtx } from "./context.js";
import { cardNameOf } from "./names.js";

export function drawSeatPicker(ctx: BriefingCtx, b: SheetBuilder, frame: ReturnType<typeof campaignFrame>): void {
  const record = ctx.state.record;
  if (!record) return;
  const close = (): void => {
    ctx.state.seatPicker = false;
    ctx.redraw();
  };
  const screen: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
  b.box(screen, { fill: surface.void.hex, fillAlpha: 0.55 });
  // A tap on the scrim closes it; the lift of a drag through the panel never does.
  b.tap("seat-picker-close", screen);
  ctx.actions.set("seat-picker-close", close);

  const rowHeight = 56;
  const width = Math.min(420, frame.width - 32);
  const height = 72 + (record.seats.length + 1) * (rowHeight + 10);
  const panel: Rect = { x: (frame.width - width) / 2, y: Math.max(16, (frame.height - height) / 2), width, height };
  b.box(panel, { fill: surface.paper.hex });
  b.box(panel, { stroke: surface.ink.hex, strokeWidth: 2 });
  b.text(panel.x + 16, panel.y + 16, t("briefing.picker.title").toLocaleUpperCase(), bangers(22), {
    color: surface.ink.hex,
  });
  // Nothing behind the chooser can be reached: its buttons are the whole route.
  ctx.stops.clear();
  const entries = [
    ...record.seats.map((seat) => ({
      key: `pick-seat-${seat.seatNumber}`,
      text: t("briefing.picker.seat", { name: cardNameOf(seat.identityCardId as string), number: seat.seatNumber }),
      run: (): void => ctx.editDecks(seat.seatNumber),
      primary: true,
    })),
    { key: "pick-cancel", text: t("briefing.picker.cancel"), run: close, primary: false },
  ];
  entries.forEach((entry, index) => {
    const rect: Rect = {
      x: panel.x + 16,
      y: panel.y + 60 + index * (rowHeight + 10),
      width: panel.width - 32,
      height: rowHeight,
    };
    b.button({
      key: entry.key,
      rect,
      label: entry.text,
      look: entry.primary ? "primary" : "secondary",
      type: typeRole.label,
    });
    ctx.actions.set(entry.key, entry.run);
    ctx.stops.set(entry.key, { rect, activate: entry.run });
  });
}
