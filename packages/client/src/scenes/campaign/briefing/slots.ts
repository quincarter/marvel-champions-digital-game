/**
 * The Briefing's slots: where the call piece (B) and the sections piece (C) plug into the shell. Each is one object of the
 * shape `context.ts` names; this file holds the placeholders the shell ships with, and `briefingSlots` is what the scene hands
 * every block. To plug a piece in, write its module and replace the placeholder named in the comment below with it: nothing
 * else in the shell changes.
 *
 * The placeholders keep the screen honest until then: the call shows its question's printed text with no way to answer it
 * (Open issue stays greyed, as it does for any pending call), and the sections draw nothing.
 */
import { t } from "../../../i18n/translate.js";
import { accent, ink, surface, typeRole } from "../../../tokens.js";
import type { BriefingSlots, CallSlot, SectionsSlot } from "./context.js";
import { openHintIn } from "./copy.js";
import { drawRuleHeading } from "./handled.js";

/** Piece B replaces this: `shape`, `draw` (its own controls and Confirm / Decline), `isGenreSetPick` and `onInspectTake`. */
const placeholderCall: CallSlot = {
  // A per-seat call takes a phone's column top; role-building (which scrolls itself) takes it on every layout.
  shape: (_ctx, pending, phone) => ({ seatCall: pending.seatNumber !== null && phone, ownsScroll: false }),
  draw(ctx, b, col, top) {
    const pending = ctx.state.pending;
    if (!pending) return top;
    let y = drawRuleHeading(b, col.x, top, col.width, t("briefing.call.heading"));
    const hint = openHintIn({
      issueNumber: ctx.state.issueNumber,
      pending: true,
      composing: false,
      starting: false,
      deckBlocked: false,
    })?.call;
    if (hint)
      y +=
        b.text(col.x, y, hint, typeRole.label, { size: 15, color: accent.heroRed.hex, wrapWidth: col.width }).height +
        8;
    y += b.text(col.x, y, pending.text, typeRole.body, { color: surface.ink.hex, wrapWidth: col.width }).height + 12;
    return (
      y +
      b.text(col.x, y, t("briefing.call.pending"), typeRole.label, {
        color: surface.ink.hex,
        alpha: ink.secondary,
        wrapWidth: col.width,
      }).height
    );
  },
};

/** Piece C replaces this: `pool`, `main` and `aside`. */
const placeholderSections: SectionsSlot = {
  pool: (_ctx, _b, _col, top) => top,
  main: (_ctx, _b, _col, top) => top,
  aside: (_ctx, _b, _col, top) => top,
};

export const briefingSlots: BriefingSlots = { call: placeholderCall, sections: placeholderSections };
