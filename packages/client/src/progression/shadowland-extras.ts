/**
 * Shadowland's owner-supplied pictures on the Extras ▸ Artwork shelf as earned extras (docs/phase7-shadowland.md §7,
 * owner 2026-10-20): each scenario win opens its share, and finishing the campaign opens the rest. The campaign's
 * first panel is the box's cover (`art/campaigns/shadowland/cover.png`, a copy of the same picture), which the shelf
 * already files under "a campaign's first run", so it is not listed twice here.
 *
 * Pure data over `ExtrasUnlock`; `extras.ts` resolves each `file` against `CAMPAIGN_ART` and builds the entries.
 */
import type { ExtrasUnlock } from "./extras.js";

export const SHADOWLAND_COMIC_CREDIT = "Shadowland (Marvel, 2010) · Andy Diggle, Billy Tan";

export interface ShadowlandExtra {
  /** An artboard name or a page file under `art/campaigns/shadowland/`. */
  readonly file: string;
  readonly kind: "artboard" | "page";
  readonly title: string;
  readonly subtitle: string;
  readonly unlock: ExtrasUnlock;
}

const won = (scenarioId: string): ExtrasUnlock => ({ kind: "scenarioWon", scenarioId });
const PANEL = "Marvel Champions: Shadowland · Marvel / FFG";
const PAGE = `Comic page · ${SHADOWLAND_COMIC_CREDIT}`;

export const SHADOWLAND_EXTRAS: readonly ShadowlandExtra[] = [
  { file: "hand-ninja", kind: "artboard", title: "Hand Ninja", subtitle: PANEL, unlock: won("shadows-in-the-night") },
  {
    file: "01-iron-fist",
    kind: "page",
    title: "Iron Fist Faces Matt",
    subtitle: PAGE,
    unlock: won("shadows-in-the-night"),
  },
  { file: "02-spider-man", kind: "page", title: "Old Pals", subtitle: PAGE, unlock: won("shadows-in-the-night") },
  { file: "dojo", kind: "artboard", title: "The Dojo", subtitle: PANEL, unlock: won("shadow-labyrinth") },
  {
    file: "daredevil-flame",
    kind: "artboard",
    title: "Daredevil in Flame",
    subtitle: PANEL,
    unlock: won("shadow-labyrinth"),
  },
  { file: "03-radar-sense", kind: "page", title: "Radar Sense", subtitle: PAGE, unlock: won("shadow-labyrinth") },
  { file: "04-all-who-dare", kind: "page", title: "All Who Dare", subtitle: PAGE, unlock: won("shadow-labyrinth") },
  { file: "throne", kind: "artboard", title: "The Throne", subtitle: PANEL, unlock: won("heart-of-shadow") },
  { file: "05-wakey-wakey", kind: "page", title: "Wakey Wakey, Matt", subtitle: PAGE, unlock: won("heart-of-shadow") },
  {
    file: "06-end-your-suffering",
    kind: "page",
    title: "End Your Suffering",
    subtitle: PAGE,
    unlock: { kind: "campaignWon", campaignId: "shadowland" },
  },
];
