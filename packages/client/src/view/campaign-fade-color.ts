/**
 * The colour a campaign page's side pane fades into (`Settings.campaignFadeColor`, issue #609): the plain ground with
 * the faded art off, and the colour the box art blends into with it on. Plain data plus the contrast arithmetic that
 * keeps each colour dark enough for the pane's pale text.
 */
import { surface } from "../tokens.js";
import type { CampaignFadeColor } from "../settings.js";

export const CAMPAIGN_FADE_COLOR_LABELS: Readonly<Record<CampaignFadeColor, string>> = {
  grey: "Grey",
  blue: "Blue",
  red: "Red",
  purple: "Purple",
  green: "Green",
};

/** Each ground, dark enough for `PANE_TEXT_COLOR` at AA contrast through the art and the veil (see the test). */
export const CAMPAIGN_FADE_COLOR_FILLS: Readonly<Record<CampaignFadeColor, number>> = {
  grey: 0x3b3d42,
  blue: 0x1f4a82,
  red: 0x8a1226,
  purple: 0x4e2f66,
  green: 0x1b5a3a,
};

/** The box art's opacity over the ground, and the dark veil drawn over both. */
export const PANE_ART_ALPHA = 0.34;
export const PANE_VEIL_ALPHA = 0.34;
export const PANE_VEIL_COLOR = surface.inkOnHue.hex;
/** The pane's text: bright in light and dark mode alike. */
export const PANE_TEXT_COLOR = surface.paperOnInk.hex;

/** The pane's ground for a stored value (an unknown one reads as the default, grey). */
export function campaignFadeFillOf(color: CampaignFadeColor): number {
  return CAMPAIGN_FADE_COLOR_FILLS[color] ?? CAMPAIGN_FADE_COLOR_FILLS.grey;
}

const channel = (hex: number, shift: number): number => (hex >> shift) & 0xff;

/** WCAG relative luminance of a 0xRRGGBB colour. */
export function luminanceOf(hex: number): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(channel(hex, 16)) + 0.7152 * lin(channel(hex, 8)) + 0.0722 * lin(channel(hex, 0));
}

export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const mix = (under: number, over: number, alpha: number): number =>
  [16, 8, 0].reduce((out, shift) => {
    const value = Math.round(channel(under, shift) * (1 - alpha) + channel(over, shift) * alpha);
    return out | (value << shift);
  }, 0);

/**
 * What the pane's ground looks like under a picture pixel of the given grey (0 to 255): the colour, the art over it at
 * `PANE_ART_ALPHA`, then the veil. Art off is the colour under the veil alone (`artGrey` null).
 */
export function paneGroundUnder(color: CampaignFadeColor, artGrey: number | null): number {
  let ground = campaignFadeFillOf(color);
  if (artGrey !== null) ground = mix(ground, (artGrey << 16) | (artGrey << 8) | artGrey, PANE_ART_ALPHA);
  return mix(ground, PANE_VEIL_COLOR, PANE_VEIL_ALPHA);
}
