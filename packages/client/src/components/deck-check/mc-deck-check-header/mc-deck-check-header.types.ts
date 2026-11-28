import type { DeckStatusBadgeTone } from "../mc-deck-status-badge/mc-deck-status-badge.types.js";

/** Which layout the screen is in: the three-column desktop, the one-column tablet, or the phone. */
export type DeckCheckSize = "wide" | "narrow" | "phone";

export interface McDeckCheckHeaderProps {
  size: DeckCheckSize;
  /** The Back button's words ("Back", "◂ Seats"). */
  backLabel: string;
  /** "HERO — ASPECT" (wide) or "Your deck · N" (narrow). */
  title: string;
  /** The verdict badge (wide); empty text shows none. */
  badgeText: string;
  badgeTone: DeckStatusBadgeTone;
  /** The right-hand words on the narrow layouts ("40 CARDS · LEGAL", or "3/4" in the setup flow). */
  meta: string;
}
