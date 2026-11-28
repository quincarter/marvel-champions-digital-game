/**
 * The Briefing's slots: where the call piece (B, `calls/call-slot.ts`) and the sections piece (C) plug into the shell. Each is one
 * object of the shape `context.ts` names, and `briefingSlots` is what the scene hands every block. The sections are still
 * placeholders that draw nothing: piece C replaces `placeholderSections` and nothing else in the shell changes.
 */
import type { BriefingSlots, SectionsSlot } from "./context.js";
import { callSlot } from "./calls/call-slot.js";

/** Piece C replaces this: `pool`, `main` and `aside`. */
const placeholderSections: SectionsSlot = {
  pool: (_ctx, _b, _col, top) => top,
  main: (_ctx, _b, _col, top) => top,
  aside: (_ctx, _b, _col, top) => top,
};

export const briefingSlots: BriefingSlots = { call: callSlot, sections: placeholderSections };
