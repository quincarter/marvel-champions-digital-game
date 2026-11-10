/**
 * Custom content packs (docs/custom-content-packs.md §5 and §11): the shape of a pack's `pack.json` and of the mod
 * store's `index.json` catalog. A pack is data only (§6): card records, ability definitions, scenarios and decks as
 * JSON, plus images. Nothing here imports the engine, so the client, the mod SDK and the build scripts can all read it.
 */

/** What a pack adds. Only `hero` and `scenario` are planned for the first store version (§11). */
export type PackKind = "hero" | "scenario" | "modular" | "campaign" | "art";

export const PACK_KINDS: readonly PackKind[] = ["hero", "scenario", "modular", "campaign", "art"];

/** The current `pack.json` schema version. */
export const PACK_SCHEMA_VERSION = 1;

/** The current store `index.json` schema version (§11.5). */
export const PACK_INDEX_SCHEMA_VERSION = 2;

/** One file shipped in a pack, so a download can be verified file by file (§5.1). */
export interface PackFile {
  /** The file's path inside the pack, with `/` separators and no leading `/` or `..`. */
  readonly path: string;
  readonly bytes: number;
  /** Lowercase hex sha256 of the file's bytes. */
  readonly sha256: string;
}

/** What a client needs to load a pack (§6, §11.2). */
export interface PackRequires {
  /** A semver range on the app's version, e.g. `">=0.40.0"`. */
  readonly app: string;
  /** The DSL features the pack's abilities use, checked against the client's own list. */
  readonly dslFeatures: readonly string[];
  /** Ids of other packs this one needs (a scenario that uses a fan modular set). */
  readonly packs: readonly string[];
}

/** The data files a pack carries, as paths inside the pack. */
export interface PackContents {
  readonly cards: string;
  readonly abilities?: string;
  /** `Scenario` records (§11.9): a scenario pack's villain, main scheme and encounter set choices. */
  readonly scenarios?: string;
  readonly decks?: string;
  /**
   * `EncounterSet` records for the pack's own sets (a nemesis set, a modular set, a scenario's own set), so a set has
   * a display name and a role instead of a bare id (§11.9). Ids are `<pack-id>-<name>`.
   */
  readonly encounterSets?: string;
  /** The engine's plain-data `CampaignDefinition`s, plus their display records (§11.9). */
  readonly campaigns?: string;
}

/**
 * The languages a pack's card pictures come in. A picture is `cards/<lang>/<card code>.webp` (`packCardImagePath`).
 * A client shows the player's language where the pack has that picture and falls back to `base` for any card that
 * lacks it (`resolvePackCardImage`), so a translation may cover only some cards.
 */
export interface PackLanguages {
  /** The fallback language: the one every card has a picture in. */
  readonly base: string;
  /** Every language the pack has pictures in, `base` included. */
  readonly available: readonly string[];
  /** The language the card records' text is written in, when it is not `base` (Spanish art over English data). */
  readonly text?: string;
}

/**
 * Alternate art, by language, then by card code: `{ en: { "01088": "alt-art/en/01088.webp" } }`. A code may be a
 * base-game card (an art pack that re-skins Core cards) or one of the pack's own (an alternate face of its identity).
 * It is shown instead of the card's normal picture where the player turns alternate art on; it adds no card.
 */
export type PackAltArt = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * A pack campaign's content record (docs/custom-content-packs.md §11.10): the `@mc/content` `Campaign` shape without
 * its box fields (`boxCode`, `packCode`, `roles`, `perSeatSetIds`, `logSheetReference`), with plain strings for ids
 * since a pack's are JSON.
 */
export interface PackCampaignContent {
  /** The scenarios the campaign plays, in order: pack scenarios, base scenarios or a required pack's. */
  readonly scenarioIds: readonly string[];
  /** Encounter sets whose cards are campaign-specific to this campaign (a pack set, or a required pack's). */
  readonly campaignSetIds: readonly string[];
  /** Player cards and modular sets the campaign forbids inside itself. */
  readonly prohibited?: {
    readonly cardIds?: readonly string[];
    readonly encounterSetIds?: readonly string[];
  };
}

/** Who speaks a story line: the narrator, the issue's villain, or a named supporting voice. */
export type PackCampaignSpeaker =
  | { readonly kind: "narrator" }
  | { readonly kind: "villain" }
  | { readonly kind: "npc"; readonly name: string };

/** One spoken line of a pack campaign's story. */
export interface PackCampaignLine {
  readonly speaker: PackCampaignSpeaker;
  readonly text: string;
}

/** The story of one node (an "issue"): the data fields of the client's `IssueStory`, without its art and functions. */
export interface PackCampaignIssueStory {
  /** The campaign definition's node id. */
  readonly nodeId: string;
  readonly title: string;
  /** The villain's display name as the issue is billed. */
  readonly villain: string;
  readonly blurb?: string;
  readonly briefing?: PackCampaignLine;
  readonly aftermath?: PackCampaignLine;
  /** The villain's taunt on a loss. */
  readonly rewindTaunt?: string;
}

/** A pack campaign's optional story: the data fields of the client's `CampaignStory`, without its art and functions. */
export interface PackCampaignStory {
  /** The cover's pitch. */
  readonly blurb: string;
  readonly rosterBanner?: string;
  readonly issues?: readonly PackCampaignIssueStory[];
  readonly finale?: {
    readonly caption: string;
    readonly headline: string;
    readonly villainLine: string;
    readonly heroLines: readonly string[];
  };
}

/**
 * One entry of a pack's `campaigns/*.json` (§11.10). `Definition` is the engine's `CampaignDefinition` (plain JSON);
 * `@mc/content` cannot import the engine, so the mod SDK's `PackCampaign` fills it in.
 */
export interface PackCampaignOf<Definition = unknown> {
  /** `<pack-id>-<name>`; equals `definition.campaignId`. */
  readonly id: string;
  /** Equals `definition.version`. */
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly tagline?: string;
  readonly definition: Definition;
  readonly record: PackCampaignContent;
  readonly story?: PackCampaignStory;
  /** Pack-relative paths of the campaign's art (the pack's own, never a base-game file). */
  readonly art?: { readonly cover?: string };
}

/** The permission a pack's content may be distributed under (§11.4), as the store's reviewers check it. */
export interface PackPermission {
  /** Who gave permission: the creator, or whoever granted it on their behalf. */
  readonly by: string;
  /** Where it was given (a link, or a line saying how). */
  readonly evidence?: string;
  /** `YYYY-MM-DD`. A pack imported from a draft that recorded none leaves it out; the registry review asks for it. */
  readonly date?: string;
  /** What was agreed: "inclusion", "inclusion and translation". */
  readonly scope?: string;
}

/** A pack's `pack.json` (§5.1). */
export interface PackManifest {
  readonly schema: typeof PACK_SCHEMA_VERSION;
  /** Lowercase letters, digits and `-`; the `x.<id>.` prefix of every custom card code. */
  readonly id: string;
  /** Semver. */
  readonly version: string;
  readonly kind: PackKind;
  readonly name: string;
  readonly authors: readonly string[];
  readonly description: string;
  readonly requires: PackRequires;
  readonly contents: PackContents;
  /** Full-bleed pictures by role, then by card code: `{ hero: { "x.fan-x.01a": "pictures/hero.webp" } }`. */
  readonly pictures?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** The languages of the pack's `cards/<lang>/<code>.webp` pictures. Absent = the pack has no per-card pictures. */
  readonly languages?: PackLanguages;
  /** Alternate art for base-game cards, or the pack's own (see `PackAltArt`). Any pack kind may carry it. */
  readonly altArt?: PackAltArt;
  /** The permission the pack's creator gave for the store to distribute it; mirrors `PERMISSION.md`. */
  readonly permission?: PackPermission;
  /** Who made the card template the pack's cards are laid out on ("Hitch", "G.Triskelion"). */
  readonly templateCredit?: string;
  /** Who translated the pack, by language: `{ es: "Francisco Merchán" }`. */
  readonly translators?: Readonly<Record<string, string>>;
  /** Every file in the pack except `pack.json` itself. */
  readonly files: readonly PackFile[];
  readonly totalBytes: number;
  readonly license: string;
}

/** One published version of a pack in the store catalog (§5.2). */
export interface PackIndexVersion {
  readonly manifest: string;
  readonly base: string;
  readonly zip: string;
  /** A second address for the zip, for native clients (§5.2). */
  readonly zipFallback?: string;
  readonly zipBytes: number;
  readonly zipSha256: string;
  readonly requires: Pick<PackRequires, "app"> & Partial<Pick<PackRequires, "dslFeatures" | "packs">>;
}

/** One pack in the store catalog (§11.5). */
export interface PackIndexEntry {
  readonly id: string;
  readonly kind: PackKind;
  readonly name: string;
  readonly creator: string;
  /** One line for the store list. */
  readonly summary: string;
  readonly tags: readonly string[];
  readonly thumbnail?: string;
  /** The date the owner approved the pack, `YYYY-MM-DD`. */
  readonly approved: string;
  readonly latest: string;
  readonly versions: Readonly<Record<string, PackIndexVersion>>;
  /** Withdrawn packs stay playable where installed, but the store doesn't offer them (§11.4). */
  readonly withdrawn: boolean;
}

/** The store's `index.json` (§11.5). */
export interface PackIndex {
  readonly schema: typeof PACK_INDEX_SCHEMA_VERSION;
  /** ISO 8601 time the catalog was generated. */
  readonly generated: string;
  readonly packs: readonly PackIndexEntry[];
}

const PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Whether `id` is a legal pack id. */
export function isPackId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && PACK_ID.test(id);
}

/** The prefix every card code in pack `packId` starts with: `x.<pack-id>.` (§3). */
export function customCardPrefix(packId: string): string {
  return `x.${packId}.`;
}

/** Whether `code` is a custom card code (`x.<pack-id>.<rest>`), which can never collide with a MarvelCDB code. */
export function isCustomCardCode(code: string): boolean {
  return code.startsWith("x.");
}

/** The pack id a custom card code belongs to, or `undefined` for a base-game code. */
export function packIdOfCardCode(code: string): string | undefined {
  if (!isCustomCardCode(code)) return undefined;
  const end = code.indexOf(".", 2);
  return end > 2 ? code.slice(2, end) : undefined;
}

/** Whether a pack file path is safe to store and serve: relative, `/`-separated, no `..`, no empty segment. */
export function isSafePackPath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\")) return false;
  return path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

/** A language tag as a pack folder uses it: `en`, `es`, `pt-BR`. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/** Whether `tag` is a legal language tag for a pack's picture folder. */
export function isLanguageTag(tag: string): boolean {
  return tag.length <= 16 && LANGUAGE_TAG.test(tag);
}

/** Where a pack ships its picture of card `code` in language `lang`: `cards/<lang>/<code>.webp`. */
export function packCardImagePath(lang: string, code: string): string {
  return `cards/${lang}/${code}.webp`;
}

/** The language and card code a pack picture path names, or `undefined` for any other path. */
export function parsePackCardImagePath(path: string): { readonly lang: string; readonly code: string } | undefined {
  const match = /^cards\/([^/]+)\/([^/]+)\.webp$/.exec(path);
  return match ? { lang: match[1] as string, code: match[2] as string } : undefined;
}

/**
 * The picture to show for card `code` when the player's language is `wanted`: that language's picture where the pack
 * has it, else the base language's, else `undefined` (the card has no picture, and the client draws its text face).
 * `has` says whether a pack path exists, so this works on a zip's file list or an unzipped folder alike.
 */
export function resolvePackCardImage(
  languages: PackLanguages | undefined,
  code: string,
  wanted: string,
  has: (path: string) => boolean,
): string | undefined {
  if (!languages) return undefined;
  for (const lang of wanted === languages.base ? [wanted] : [wanted, languages.base]) {
    const path = packCardImagePath(lang, code);
    if (languages.available.includes(lang) && has(path)) return path;
  }
  return undefined;
}
