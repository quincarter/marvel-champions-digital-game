/**
 * Campaign story-panel artwork, found by convention in the repo's `art/` folder (see `art/README.md`):
 *
 *   art/campaigns/<campaignId>/artboards/<name>.<ext>
 *   art/campaigns/<campaignId>/cover.<ext>
 *
 * A story file names a panel's picture by `<name>` (`{ kind: "artboard", name: "mountain-facility", … }` in
 * `campaign/stories/*.ts`), so dropping a file in with that name is all it takes to replace the panel's
 * "Panel art: …" placeholder. Variants work as they do for villains: `mountain-facility.webp`,
 * `mountain-facility-2.jpg`, one picked at random.
 *
 * `cover.<ext>` is a box's own key art for the Cover screen — `art/README.md` marked it "NOT READ YET" until this
 * module started reading it; a box with no cover file simply has none (`campaignCoverFor` returns null), so the
 * Cover screen's existing villain-art/placeholder fallback is unaffected.
 *
 * `rulebook/page_NNN.jpg` (docs/phase7-wave5-handoff.md "Scenario intros from the rulebook art") is the box's own
 * official, already-lettered rulebook comic page: a one-off (non-campaign) game's scenario intro
 * (`campaign/scenario-intros.ts`) shows it instead of new art, since the page is already the villain's own reveal
 * beat. Read only for the boxes that actually wire a one-off intro to it (`RULEBOOK_CAMPAIGN_IDS` below) — globbing
 * every box's `rulebook/` would bundle all ~43 MB of every captured page, most of it for boxes with no scenario
 * intro pointed at it yet.
 *
 * Pure over a path → URL map, like `hero-art.ts`, so it is tested without the glob.
 */
import { pickPicture, type Picture } from "./pictures.js";

export interface CampaignArtCatalog {
  /** By `<campaignId>/<name>`. */
  readonly artboards: ReadonlyMap<string, readonly Picture[]>;
  /** By `<campaignId>`, at most one file (`cover.<ext>` has no variant convention — it's the box's one key art). */
  readonly covers: ReadonlyMap<string, Picture>;
  /**
   * A full comic page, by `<campaignId>/<file>` (`file` matches the story's `ComicPage.file`, e.g. `01-badoon`).
   * No variant convention, same as `covers` — a page is one specific piece of art, not an interchangeable one.
   */
  readonly pages: ReadonlyMap<string, Picture>;
  /**
   * A box's own official rulebook comic page, by `<campaignId>/page_NNN` (`page_008`, matching the file on disk) —
   * read only for `RULEBOOK_CAMPAIGN_IDS`. No variant convention, same as `pages`/`covers`.
   */
  readonly rulebookPages: ReadonlyMap<string, Picture>;
  /** Files under `art/campaigns/` outside an `artboards/`/`pages/`/`rulebook/` folder that aren't a campaign's `cover.*`. */
  readonly unrecognized: readonly string[];
}

/** `name-2` → `name`: a variant suffix is a trailing `-<digits>`. */
const baseName = (stem: string): string => stem.replace(/-\d+$/, "");

export function parseCampaignArt(files: Readonly<Record<string, string>>): CampaignArtCatalog {
  const artboards = new Map<string, Picture[]>();
  const covers = new Map<string, Picture>();
  const pages = new Map<string, Picture>();
  const rulebookPages = new Map<string, Picture>();
  const unrecognized: string[] = [];
  for (const fullPath of Object.keys(files).sort()) {
    const underArt = fullPath.slice(fullPath.indexOf("art/campaigns/") + "art/".length);
    const parts = underArt.split("/");
    const file = parts[parts.length - 1] ?? "";
    const stem = file.slice(0, file.lastIndexOf("."));
    if (parts.length === 3 && stem === "cover") {
      const campaignId = parts[1]!;
      if (!covers.has(campaignId)) covers.set(campaignId, { key: `scene-art:${underArt}`, url: files[fullPath]! });
      continue;
    }
    if (parts.length === 4 && parts[0] === "campaigns" && parts[2] === "pages" && stem !== "") {
      const campaignId = parts[1]!;
      const slot = `${campaignId}/${stem}`;
      // A page has no variant convention (unlike an artboard): the first file found for a slot wins, matching
      // `covers`' own "one specific piece of art" rule above.
      if (!pages.has(slot)) pages.set(slot, { key: `scene-art:${underArt}`, url: files[fullPath]! });
      continue;
    }
    if (parts.length === 4 && parts[0] === "campaigns" && parts[2] === "rulebook" && stem !== "") {
      const campaignId = parts[1]!;
      const slot = `${campaignId}/${stem}`;
      if (!rulebookPages.has(slot)) rulebookPages.set(slot, { key: `scene-art:${underArt}`, url: files[fullPath]! });
      continue;
    }
    if (parts[0] !== "campaigns" || parts.length !== 4 || parts[2] !== "artboards" || stem === "") {
      unrecognized.push(underArt);
      continue;
    }
    const slot = `${parts[1]}/${baseName(stem)}`;
    const entry = artboards.get(slot) ?? [];
    entry.push({ key: `scene-art:${underArt}`, url: files[fullPath]! });
    artboards.set(slot, entry);
  }
  return { artboards, covers, pages, rulebookPages, unrecognized };
}

/** A campaign's artboard by name, or null when there is none yet — the panel then shows its placeholder note. */
export function campaignArtboardFor(
  catalog: CampaignArtCatalog,
  campaignId: string,
  name: string,
  random: () => number = Math.random,
): Picture | null {
  return pickPicture(catalog.artboards.get(`${campaignId}/${name}`) ?? [], null, random);
}

/** A box's `cover.<ext>`, or null when it hasn't shipped one yet — the Cover screen's existing fallback applies. */
export function campaignCoverFor(catalog: CampaignArtCatalog, campaignId: string): Picture | null {
  return catalog.covers.get(campaignId) ?? null;
}

/** A comic page by its story-file name (`ComicPage.file`), or null while the scan hasn't landed yet. */
export function campaignPageFor(catalog: CampaignArtCatalog, campaignId: string, file: string): Picture | null {
  return catalog.pages.get(`${campaignId}/${file}`) ?? null;
}

/** `page_NNN`, zero-padded to match the file `extract-artboards` writes (`page_8` on disk is always `page_008`). */
const rulebookSlot = (campaignId: string, page: number): string =>
  `${campaignId}/page_${String(page).padStart(3, "0")}`;

/**
 * A box's own official rulebook comic page by its printed page number (`campaign/scenario-intros.ts`), or null when
 * that box isn't in `RULEBOOK_CAMPAIGN_IDS` or hasn't captured that page yet — the scenario then falls back to its
 * own `art/scenarios/<id>/intro.*` (`scenario-art.ts`), same as a scenario with no intro art at all.
 */
export function campaignRulebookPageFor(catalog: CampaignArtCatalog, campaignId: string, page: number): Picture | null {
  return catalog.rulebookPages.get(rulebookSlot(campaignId, page)) ?? null;
}

/**
 * The boxes whose `rulebook/` pages a one-off scenario intro actually points at (`scenario-intros.ts`) — every box
 * with scenario content in this build's pool today. Keep in step with that file's own intros: a fifth entry here
 * with no matching intro just bundles pages no screen shows. The glob below is a second copy of this same list
 * (`import.meta.glob`'s pattern must be a literal, never a variable — this module's own docblock note above), so a
 * change here needs updating there too; `campaign-art.test.ts` checks every id on this list actually got at least
 * one rulebook page.
 */
export const RULEBOOK_CAMPAIGN_IDS = ["trors", "gmw", "mts", "sm"] as const;

// Only the folders a screen reads, and only `rulebook/` for the boxes actually wired to it: globbing every box's
// `rulebook/` would ship ~43 MB of pages no screen shows yet in every build (`RULEBOOK_CAMPAIGN_IDS` above).
const files = import.meta.glob(
  [
    "../../../../art/campaigns/*/cover.{png,jpg,jpeg,webp,avif}",
    "../../../../art/campaigns/*/artboards/*.{png,jpg,jpeg,webp,avif}",
    "../../../../art/campaigns/*/pages/*.{png,jpg,jpeg,webp,avif}",
    "../../../../art/campaigns/{trors,gmw,mts,sm}/rulebook/*.{png,jpg,jpeg,webp,avif}",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
) as Record<string, string>;

/** Everything in `art/campaigns/` a screen reads: covers, artboards, comic pages, and `RULEBOOK_CAMPAIGN_IDS`' own rulebook pages. */
export const CAMPAIGN_ART: CampaignArtCatalog = parseCampaignArt(files);
