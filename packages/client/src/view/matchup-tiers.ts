/**
 * The Matchups tiers' colours, as CSS: green for Standard and purple for Expert, as the issue asked; a paler green for a
 * Skirmish, shades of red for Heroic. Hues no color scheme changes. The ink that reads on each is a token too: the bright
 * tiers take ink, the rest take paper.
 */
import { surface } from "../tokens.js";
import type { WinTier } from "./matchup-grid.js";

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

export const TIER_COLORS: Readonly<Record<WinTier, string>> = {
  skirmish: css(0x9ccc9c),
  standard: css(0x2e8b57),
  expert: css(0x6b3fa0),
  extreme: css(0x1f6fb5),
  heroic1: css(0xf08a7c),
  heroic2: css(0xe05241),
  heroic3: css(0xbf1e2e),
  heroic4: css(0x7a0f1c),
};

const LIGHT_TIERS: ReadonlySet<WinTier> = new Set(["skirmish", "heroic1", "heroic2"]);

/** The ink on a tier's colour. */
export const tierInk = (tier: WinTier): string =>
  css(LIGHT_TIERS.has(tier) ? surface.inkOnHue.hex : surface.paperOnInk.hex);

/** Every tier's colour and ink, for the grid's cells and the key. */
export const TIER_LOOKS: Readonly<Record<string, { readonly color: string; readonly ink: string }>> =
  Object.fromEntries(
    (Object.keys(TIER_COLORS) as WinTier[]).map((tier) => [tier, { color: TIER_COLORS[tier], ink: tierInk(tier) }]),
  );
