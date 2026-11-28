/**
 * The Briefing's slots: where the call piece (B, `calls/call-slot.ts`) and the sections piece (C, `sections/sections-slot.ts`)
 * plug into the shell. Each is one object of the shape `context.ts` names, and `briefingSlots` is what the scene hands every
 * block.
 */
import type { BriefingSlots } from "./context.js";
import { callSlot } from "./calls/call-slot.js";
import { sectionsSlot } from "./sections/sections-slot.js";

export const briefingSlots: BriefingSlots = { call: callSlot, sections: sectionsSlot };
