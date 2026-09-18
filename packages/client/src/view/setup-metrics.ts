/**
 * The spacing/sizing rules every setup screen shares (Title menu, Scenario
 * select, Take your seats, Table setup): the same tiers `view/title-layout.ts`
 * used before W2 split one page into four, kept in one place now that four
 * pure layout functions read them instead of one.
 */
import { formFactorFor, type FormFactor } from "./layout.js";

/** Below this height, spacing (not control sizes — a 44px touch target never shrinks) compacts further. */
export const SHORT_HEIGHT = 700;

/** How far above its control a section label ("Scenario", "Difficulty"…) is drawn, and so the least room a layout leaves for one. */
export const LABEL_ROOM = 16;

export interface SetupMetrics {
  readonly formFactor: FormFactor;
  readonly phone: boolean;
  readonly short: boolean;
  readonly pad: number;
  readonly gap: number;
  readonly labelGap: number;
  readonly smallGap: number;
}

export function setupMetrics(width: number, height: number): SetupMetrics {
  const formFactor = formFactorFor(width, height);
  const phone = formFactor === "phone";
  const short = height < SHORT_HEIGHT;
  return {
    formFactor,
    phone,
    short,
    pad: phone ? 16 : short ? 12 : height < 820 ? 24 : 40,
    gap: phone ? 12 : short ? 8 : 18,
    labelGap: LABEL_ROOM,
    smallGap: short ? 2 : 8,
  };
}

/** The content column's width alone — every setup screen stacks vertically inside it, same as `title-layout.ts` did. */
export function setupColumnWidth(width: number, height: number): number {
  const { pad } = setupMetrics(width, height);
  return Math.min(width - pad * 2, 640);
}
