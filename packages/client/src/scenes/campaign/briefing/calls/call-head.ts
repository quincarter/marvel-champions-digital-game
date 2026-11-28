/**
 * What every call opens with: the "Your call" heading, the line saying why Open issue waits, and the seat's own header for a
 * per-seat call. A plain pick (role tiles, accept / decline, a list of options) then adds who is deciding, the box's plain
 * words about the question in the player's language and the printed rule (`drawPrompt`).
 */
import { setupCallCopyIn } from "../../../../campaign/briefing-text.js";
import { setupCallCopyFor } from "../../../../campaign/story.js";
import { t } from "../../../../i18n/translate.js";
import { accent, ink, surface, typeRole } from "../../../../tokens.js";
import type { SeatHeaderView } from "../../../../view/campaign-role-call-model.js";
import { seatHeaderOf } from "../../../../view/campaign-role-call-model.js";
import { openHintIn } from "../copy.js";
import { drawRuleHeading } from "../handled.js";
import { heroNameOf } from "../names.js";
import type { CallInput } from "./calls.types.js";
import { drawSeatHeader } from "./seat-header.js";

/** The seat header of a per-seat call, or null for a call to the whole table. */
export function seatHeaderFor({ ctx, pending }: CallInput): SeatHeaderView | null {
  const record = ctx.state.record;
  return record ? seatHeaderOf(pending, record.seats, heroNameOf) : null;
}

/** Draws the heading, the hint and the seat header; returns the y under them and the header (null for a whole-table call). */
export function drawCallHead(input: CallInput): { readonly y: number; readonly header: SeatHeaderView | null } {
  const { ctx, b, col, top } = input;
  let y = drawRuleHeading(b, col.x, top, col.width, t("briefing.call.heading"));
  const hint = openHintIn({
    issueNumber: ctx.state.issueNumber,
    pending: true,
    composing: false,
    starting: false,
    deckBlocked: false,
  })?.call;
  if (hint) {
    y +=
      b.text(col.x, y, hint, typeRole.label, { size: 15, color: accent.heroRed.hex, wrapWidth: col.width }).height + 8;
  }
  const header = seatHeaderFor(input);
  if (header) y = drawSeatHeader(ctx, b, col, y, header);
  return { y, header };
}

/**
 * Who is deciding (a decision for the whole table is labelled as that, never spoken as if "the team" were a character), the
 * box's plain words and the printed rule. Returns the y under the rule.
 */
export function drawPrompt(input: CallInput, top: number, header: SeatHeaderView | null): number {
  const { b, col, pending } = input;
  let y = top;
  if (!header) {
    const who =
      pending.seatNumber !== null
        ? t("briefing.call.seat", { number: pending.seatNumber })
        : t("briefing.call.together");
    y += b.text(col.x, y, who, typeRole.label, { color: accent.heroRed.hex }).height + 4;
  }
  // A box's own plain-words line about the question (`campaign/story.ts`'s `setupCalls`), above the printed rule.
  const words = setupCallCopyIn(pending.instructionId, setupCallCopyFor(pending.instructionId));
  if (words) {
    y +=
      b.text(col.x, y, words.explain, typeRole.emphasis, { color: surface.ink.hex, wrapWidth: col.width }).height + 8;
    y +=
      b.text(col.x, y, t("briefing.call.rule"), typeRole.label, { color: surface.ink.hex, alpha: ink.label }).height +
      4;
  }
  return (
    y + b.text(col.x, y, pending.text, typeRole.body, { color: surface.ink.hex, wrapWidth: col.width }).height + 12
  );
}
