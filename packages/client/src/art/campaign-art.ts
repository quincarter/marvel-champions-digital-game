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
 * Pure over a path → URL map, like `hero-art.ts`, so it is tested without the glob.
 */
import { pickPicture, type Picture } from "./pictures.js";

export interface CampaignArtCatalog {
  /** By `<campaignId>/<name>`. */
  readonly artboards: ReadonlyMap<string, readonly Picture[]>;
  /** By `<campaignId>`, at most one file (`cover.<ext>` has no variant convention — it's the box's one key art). */
  readonly covers: ReadonlyMap<string, Picture>;
  /** Files under `art/campaigns/` outside an `artboards/` folder that aren't a campaign's `cover.*`. */
  readonly unrecognized: readonly string[];
}

/** `name-2` → `name`: a variant suffix is a trailing `-<digits>`. */
const baseName = (stem: string): string => stem.replace(/-\d+$/, "");

export function parseCampaignArt(files: Readonly<Record<string, string>>): CampaignArtCatalog {
  const artboards = new Map<string, Picture[]>();
  const covers = new Map<string, Picture>();
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
    if (parts[0] !== "campaigns" || parts.length !== 4 || parts[2] !== "artboards" || stem === "") {
      unrecognized.push(underArt);
      continue;
    }
    const slot = `${parts[1]}/${baseName(stem)}`;
    const entry = artboards.get(slot) ?? [];
    entry.push({ key: `scene-art:${underArt}`, url: files[fullPath]! });
    artboards.set(slot, entry);
  }
  return { artboards, covers, unrecognized };
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

const files = import.meta.glob("../../../../art/campaigns/*/**/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Everything in `art/campaigns/`. */
export const CAMPAIGN_ART: CampaignArtCatalog = parseCampaignArt(files);
