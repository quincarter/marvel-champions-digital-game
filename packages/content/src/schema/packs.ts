/**
 * Custom content packs (docs/custom-content-packs.md §5 and §11): the shape of a pack's `pack.json` and of the mod
 * store's `index.json` catalog. A pack is data only (§6): card records, ability definitions, scenarios and decks as
 * JSON, plus images. Nothing here imports the engine, so the client, the mod SDK and the build scripts can all read it.
 */

/**
 * What a pack adds. `house-rule` (§11.11) adds no card: it changes official cards (`PackHouseRule`) and is switched on
 * per game.
 */
export type PackKind = "hero" | "scenario" | "modular" | "campaign" | "art" | "house-rule";

export const PACK_KINDS: readonly PackKind[] = ["hero", "scenario", "modular", "campaign", "art", "house-rule"];

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

/**
 * Traits a house rule adds to one official card face (§11.11). `code` is a printed face code of the base game: a card's
 * own code (a hero identity's hero face), or the `b` sibling of a hero identity for its alter-ego face. `traits` are
 * written as printed ("Web-Warrior"); the game compares them in their normalized form (`trait`).
 */
export interface PackTraitAddition {
  readonly code: string;
  readonly traits: readonly string[];
}

/** The game modes a house rule may switch on: `balanced` is Galaxy's Most Wanted's rebalanced campaign. */
export type PackHouseRuleMode = "balanced";

export const PACK_HOUSE_RULE_MODES: readonly PackHouseRuleMode[] = ["balanced"];

/**
 * A `house-rule` pack's rule (§11.11): data only, no cards and no abilities. While the rule is on, its pictures
 * (`cards/<lang>/<code>.webp`, keyed by the official face code they rebuild) replace those faces' normal pictures.
 *
 * - `traitAdditions`: the rule is a per-game toggle in Table setup; while on, the game's pool carries the added traits.
 * - `enablesMode`: the rule unlocks a mode the game already scripts (the Balanced campaign option is offered only with
 *   the pack installed). A saved game or run in that mode carries its own flag and keeps playing without the pack.
 */
export interface PackHouseRule {
  readonly traitAdditions?: readonly PackTraitAddition[];
  readonly enablesMode?: PackHouseRuleMode;
}

/** The permission a pack's content may be distributed under (§11.4), as the store's reviewers check it. */
export interface PackPermission {
  /**
   * The approval gate (§11.4): "granted" once the owner has an explicit grant on record with its date and evidence,
   * "pending" while any of it is missing or second-hand. Only a "granted" pack is published by this repo's
   * publish-packs workflow (`mc-pack validate --publish`, `publishIssues`); a pack with a `DRAFT` file may leave the
   * whole `permission` out. Absent reads as not granted.
   */
  readonly status?: PackPermissionStatus;
  /** Who gave permission: the creator, or whoever granted it on their behalf. */
  readonly by: string;
  /** Where it was given, or where the message is kept (a link, or a line saying how). Required when granted. */
  readonly evidence?: string;
  /** `YYYY-MM-DD`. Required when granted; a pack imported from a draft that recorded none leaves it out. */
  readonly date?: string;
  /** What was agreed: "inclusion", "inclusion and translation". Required when granted. */
  readonly scope?: string;
  /**
   * The languages the grant covers: the original's and each translation it allows. Required when granted, and every
   * language of `PackManifest.languages.available` must be in it (a translation needs its own permission).
   */
  readonly languages?: readonly string[];
  /** What is still missing or second-hand while the status is "pending", for the owner and the publish log. */
  readonly note?: string;
}

/** `PackPermission.status`. */
export type PackPermissionStatus = "granted" | "pending";

/** Every `PackPermissionStatus`. */
export const PACK_PERMISSION_STATUSES: readonly PackPermissionStatus[] = ["granted", "pending"];

/**
 * What a pack achievement asks for (docs/custom-content-packs.md §11.12): data only, never code. Exactly one MEASURE
 * (`win`, `play`, `gamesWon`, `gamesPlayed` or `campaignWon`), plus FILTERS that narrow which games count. A game counts
 * once it is finished (won or lost) and carries the pack; a `win` or `gamesWon` needs the win. Filters name the pack's
 * OWN content only, so one pack can never be earned by playing another's.
 */
export interface PackAchievementWhen {
  /** Win one game. */
  readonly win?: true;
  /** Finish one game, won or lost. */
  readonly play?: true;
  /** Win this many games (1 to 1000). */
  readonly gamesWon?: number;
  /** Finish this many games, won or lost (1 to 1000). */
  readonly gamesPlayed?: number;
  /** Win one of the pack's own campaigns, by its campaign id. No filters with it. */
  readonly campaignWon?: string;
  /** Filter: the game seats this hero (the identity card id of one of the pack's heroes, e.g. `x.my-pack.01a`). */
  readonly hero?: string;
  /** Filter: the game's scenario is this one of the pack's own scenarios. */
  readonly villain?: string;
  /** Filter: the game was played on Expert. */
  readonly expert?: true;
  /** Filter: the game switched this house rule on: the pack's own id, on a house-rule pack that adds traits. */
  readonly houseRule?: string;
}

/** One pack-defined achievement (`PackManifest.achievements`): worth no points, shown in the Trophy Room under its pack. */
export interface PackAchievement {
  /** Lowercase letters, digits and single dashes, unique in the pack; the game scopes it as `<pack-id>/<id>`. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly when: PackAchievementWhen;
}

/** The most achievements one pack may define. */
export const PACK_ACHIEVEMENTS_MAX = 24;
export const PACK_ACHIEVEMENT_NAME_MAX = 48;
export const PACK_ACHIEVEMENT_DESCRIPTION_MAX = 160;
const PACK_ACHIEVEMENT_COUNT_MAX = 1000;
const PACK_ACHIEVEMENT_MEASURES = ["win", "play", "gamesWon", "gamesPlayed", "campaignWon"] as const;
const PACK_ACHIEVEMENT_FILTERS = ["hero", "villain", "expert", "houseRule"] as const;

/** The pack's own content a pack achievement's conditions may name (`packAchievementProblems`). */
export interface PackAchievementContext {
  readonly packId: string;
  /** Identity card ids (`a` faces) of the pack's heroes. */
  readonly heroIds: ReadonlySet<string>;
  readonly scenarioIds: ReadonlySet<string>;
  readonly campaignIds: ReadonlySet<string>;
  /** The pack is a house rule whose trait additions are a per-game toggle (the only rule `houseRule` can name). */
  readonly houseRuleToggle: boolean;
}

const isRecordValue = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const ACHIEVEMENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= PACK_ACHIEVEMENT_COUNT_MAX;

/** The problems with one achievement's own shape (no look at the pack's content). Messages start with the field. */
function achievementShapeProblems(entry: unknown): string[] {
  if (!isRecordValue(entry)) return ["must be an object { id, name, description, when }"];
  const problems: string[] = [];
  for (const key of Object.keys(entry)) {
    if (!["id", "name", "description", "when"].includes(key)) problems.push(`${key} is not an achievement field`);
  }
  if (typeof entry.id !== "string" || !ACHIEVEMENT_ID.test(entry.id) || entry.id.length > 48)
    problems.push("id must be lowercase letters, digits and single dashes, at most 48 characters");
  for (const [field, max] of [
    ["name", PACK_ACHIEVEMENT_NAME_MAX],
    ["description", PACK_ACHIEVEMENT_DESCRIPTION_MAX],
  ] as const) {
    const value = entry[field];
    if (typeof value !== "string" || value.trim() === "") problems.push(`${field} must be non-empty text`);
    else if (value.length > max) problems.push(`${field} is ${value.length} characters, over the ${max} limit`);
  }
  const when = entry.when;
  if (!isRecordValue(when)) {
    problems.push("when must be a condition object, such as { win: true }");
    return problems;
  }
  const known: readonly string[] = [...PACK_ACHIEVEMENT_MEASURES, ...PACK_ACHIEVEMENT_FILTERS];
  for (const key of Object.keys(when)) if (!known.includes(key)) problems.push(`when.${key} is not a condition`);
  const measures = PACK_ACHIEVEMENT_MEASURES.filter((key) => when[key] !== undefined);
  if (measures.length !== 1)
    problems.push(`when needs exactly one of ${PACK_ACHIEVEMENT_MEASURES.join(", ")} (it has ${measures.length})`);
  for (const key of ["win", "play", "expert"] as const)
    if (when[key] !== undefined && when[key] !== true) problems.push(`when.${key} must be true`);
  for (const key of ["gamesWon", "gamesPlayed"] as const)
    if (when[key] !== undefined && !isCount(when[key]))
      problems.push(`when.${key} must be a whole number from 1 to ${PACK_ACHIEVEMENT_COUNT_MAX}`);
  for (const key of ["campaignWon", "hero", "villain", "houseRule"] as const)
    if (when[key] !== undefined && (typeof when[key] !== "string" || (when[key] as string).length > 96))
      problems.push(`when.${key} must be an id (text up to 96 characters)`);
  if (when.campaignWon !== undefined && PACK_ACHIEVEMENT_FILTERS.some((key) => when[key] !== undefined))
    problems.push("when.campaignWon takes no filters (hero, villain, expert, houseRule)");
  return problems;
}

/**
 * Everything wrong with a pack's `achievements`, as messages (each starts with its entry, `[0] ...`; the caller adds the
 * `pack.json achievements` path): the list's shape and size, each entry's shape, ids unique, and every `hero`,
 * `villain`, `campaignWon` and `houseRule` naming the pack's OWN content (`context`).
 */
export function packAchievementProblems(achievements: unknown, context: PackAchievementContext): string[] {
  if (achievements === undefined) return [];
  if (!Array.isArray(achievements)) return ["must be a list of { id, name, description, when }"];
  const problems: string[] = [];
  if (achievements.length > PACK_ACHIEVEMENTS_MAX)
    problems.push(`has ${achievements.length} achievements, over the ${PACK_ACHIEVEMENTS_MAX} limit`);
  const seen = new Set<string>();
  achievements.forEach((entry: unknown, index) => {
    const at = `[${index}]`;
    for (const problem of achievementShapeProblems(entry)) problems.push(`${at} ${problem}`);
    if (!isRecordValue(entry)) return;
    if (typeof entry.id === "string") {
      if (seen.has(entry.id)) problems.push(`${at} id "${entry.id}" is used by two achievements`);
      seen.add(entry.id);
    }
    const when = entry.when;
    if (!isRecordValue(when)) return;
    if (typeof when.hero === "string" && !context.heroIds.has(when.hero))
      problems.push(`${at} when.hero "${when.hero}" is not one of this pack's heroes (an identity card id)`);
    if (typeof when.villain === "string" && !context.scenarioIds.has(when.villain))
      problems.push(`${at} when.villain "${when.villain}" is not one of this pack's scenarios`);
    if (typeof when.campaignWon === "string" && !context.campaignIds.has(when.campaignWon))
      problems.push(`${at} when.campaignWon "${when.campaignWon}" is not one of this pack's campaigns`);
    if (typeof when.houseRule === "string") {
      if (when.houseRule !== context.packId)
        problems.push(`${at} when.houseRule must be this pack's own id "${context.packId}"`);
      else if (!context.houseRuleToggle)
        problems.push(`${at} when.houseRule needs a house-rule pack whose trait additions are switched on per game`);
    }
  });
  return problems;
}

/**
 * The well-formed achievements of untrusted data (a `preview.json`, a manifest from a store): each entry that passes the
 * shape check, ids unique, at most `PACK_ACHIEVEMENTS_MAX`. The rest are dropped, never thrown on.
 */
export function parsePackAchievements(data: unknown): readonly PackAchievement[] {
  if (!Array.isArray(data)) return [];
  const out: PackAchievement[] = [];
  const seen = new Set<string>();
  for (const entry of data as unknown[]) {
    if (out.length >= PACK_ACHIEVEMENTS_MAX) break;
    if (achievementShapeProblems(entry).length > 0) continue;
    const one = entry as PackAchievement;
    if (seen.has(one.id)) continue;
    seen.add(one.id);
    out.push({ id: one.id, name: one.name, description: one.description, when: { ...one.when } });
  }
  return out;
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
  /** A `house-rule` pack's rule; required for that kind and refused on any other. */
  readonly houseRule?: PackHouseRule;
  /** The permission the pack's creator gave for the store to distribute it; mirrors `PERMISSION.md`. */
  readonly permission?: PackPermission;
  /** The pack's own achievements (§11.12): worth no points, conditions are data only (`PackAchievementWhen`). */
  readonly achievements?: readonly PackAchievement[];
  /** Who made the card template the pack's cards are laid out on ("Hitch", "G.Triskelion"). */
  readonly templateCredit?: string;
  /** Who translated the pack, by language: `{ es: "Francisco Merchán" }`. */
  readonly translators?: Readonly<Record<string, string>>;
  /**
   * The pack's store cover, a listed `.webp` file of the pack (`"cover.webp"`): a portrait box-art picture, the same in
   * every language. `mc-pack build` makes it the catalog's `thumb.webp` in place of the featured card's picture.
   */
  readonly cover?: string;
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
  /**
   * The pack's `preview.json` (`PackPreview`), a small sibling of the zip the store screen reads before anything is
   * installed. Optional: a version published without one shows the store's letter placeholder and a text-only page.
   */
  readonly preview?: string;
}

/** The `preview.json` format version. */
export const PACK_PREVIEW_SCHEMA_VERSION = 1;

/** The most bytes of `preview.json` a client reads: it is fetched before the pack is trusted (it is untrusted data). */
export const PACK_PREVIEW_MAX_BYTES = 1_048_576;

/** One precon deck in a preview: card ids and quantities. Base-game ids stay ids (the client has those cards). */
export interface PackPreviewDeck {
  readonly id: string;
  readonly name: string;
  readonly identityCardId: string;
  readonly cards: readonly { readonly cardId: string; readonly quantity: number }[];
}

/**
 * What the store shows of a pack before it is installed (`mc-pack build` writes it next to the zip as `preview.json`,
 * with `thumb.webp`: the pack's cover when it has one, else the featured card's picture when it has one). The cards are
 * the pack's own full records; their pictures are `<version base>/<path>` for each path in `images`.
 */
export interface PackPreview {
  readonly schema: typeof PACK_PREVIEW_SCHEMA_VERSION;
  readonly packId: string;
  readonly version: string;
  /**
   * The card the store leads with: the hero identity of a hero pack (both faces), the villain (stage I) or main scheme
   * of a scenario pack, the first scenario's villain of a campaign pack. `images` are its faces' pictures, pack paths.
   */
  readonly featured?: { readonly cardId: string; readonly images: readonly string[] };
  /**
   * The pack's cover (`PackManifest.cover`), a pack path, when it has one. `thumb.webp` is then that cover, not the
   * featured card's picture, so the store shows it in every language. The file itself ships only in the zip.
   */
  readonly cover?: string;
  /** The pictures the pack ships: `cards/<lang>/<code>.webp` paths, every language. */
  readonly images: readonly string[];
  readonly languages?: PackLanguages;
  /** The pack's own card records, sorted by id. */
  readonly cards: readonly unknown[];
  readonly decks: readonly PackPreviewDeck[];
  /** The pack's achievements (`PackManifest.achievements`), for the store page's list. */
  readonly achievements?: readonly PackAchievement[];
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
  /**
   * Who publishes the pack (§11.5): "game", this repo's publish-packs workflow, or "registry", the registry repo's.
   * A pack id has one publisher; an entry without it was written by the game repo before the field existed.
   */
  readonly source?: "game" | "registry";
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

/** The most bytes a pack's cover may have (`PackManifest.cover`): a store thumbnail, a few hundred KB at most. */
export const PACK_COVER_MAX_BYTES = 1_000_000;

/** Whether `path` can name a pack's cover: a safe pack path to a `.webp` file. */
export function isPackCoverPath(path: string): boolean {
  return isSafePackPath(path) && path.endsWith(".webp");
}

/**
 * A WebP file's pixel size, read from its header (lossy `VP8 `, lossless `VP8L` or extended `VP8X`), or undefined when
 * the bytes are not a WebP file.
 */
export function webpSize(bytes: Uint8Array): { readonly width: number; readonly height: number } | undefined {
  const ascii = (at: number, length: number): string => String.fromCharCode(...bytes.subarray(at, at + length));
  if (bytes.length < 30 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return undefined;
  // The RIFF size counts every byte after its own 8-byte header: a file shorter than that is truncated.
  const riffSize = (bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24)) >>> 0;
  if (riffSize + 8 > bytes.length) return undefined;
  const u16 = (at: number): number => bytes[at]! | (bytes[at + 1]! << 8);
  const u24 = (at: number): number => u16(at) | (bytes[at + 2]! << 16);
  const chunk = ascii(12, 4);
  if (chunk === "VP8X") return { width: u24(24) + 1, height: u24(27) + 1 };
  if (chunk === "VP8 ") {
    // The key frame's start code, then 14-bit width and height.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return undefined;
    return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return undefined;
    const bits = (u24(21) | (bytes[24]! << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return undefined;
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
 * The pack picture code of the `index`th (0-based) picture of a multi-picture card, by the naming convention in
 * docs/custom-content-packs.md section 5.1: pictures are lettered in order from the card's own code. A code ending in
 * a letter (`02a`) is the first picture and the letters run on from it (`02a`, `02b`, `02c`...); a code without one
 * (`01`) is its own first picture and the rest are `01b`, `01c`...
 */
export function packSequentialPictureCode(code: string, index: number): string {
  const lettered = /[a-z]$/.test(code);
  if (index === 0 && !lettered) return code;
  return `${lettered ? code.slice(0, -1) : code}${String.fromCharCode(97 + index)}`;
}

interface StagedCard {
  readonly id: string;
  readonly type?: string;
  readonly sides?: readonly { readonly stages?: readonly unknown[] }[];
  readonly stages?: readonly unknown[];
}

/**
 * The picture codes a villain or main scheme record needs, in picture order: a villain's stages (every side, in order),
 * a main scheme's stages with side A then side B each. Empty for any other card.
 */
export function packStagedPictureCodes(card: StagedCard): readonly string[] {
  let count = 0;
  if (card.type === "villain") count = (card.sides ?? []).reduce((n, side) => n + (side.stages?.length ?? 0), 0);
  else if (card.type === "main_scheme") count = (card.stages?.length ?? 0) * 2;
  return Array.from({ length: count }, (_, i) => packSequentialPictureCode(card.id, i));
}

/**
 * The picture codes to try for one villain stage (`sideIndex`, `stageIndex`) or main scheme stage and side, best first:
 * the stage's own picture, then the card's own code.
 */
export function packStagePictureCodes(
  card: StagedCard,
  face:
    | { readonly kind: "villainStage"; readonly sideIndex: number; readonly stageIndex: number }
    | { readonly kind: "mainSchemeStage"; readonly stageIndex: number; readonly side: "A" | "B" },
): readonly string[] {
  let index = -1;
  if (face.kind === "villainStage" && card.type === "villain") {
    const sides = card.sides ?? [];
    index = sides.slice(0, face.sideIndex).reduce((n, side) => n + (side.stages?.length ?? 0), 0) + face.stageIndex;
  } else if (face.kind === "mainSchemeStage" && card.type === "main_scheme") {
    index = face.stageIndex * 2 + (face.side === "B" ? 1 : 0);
  }
  if (index < 0) return [card.id];
  const own = packSequentialPictureCode(card.id, index);
  return own === card.id ? [card.id] : [own, card.id];
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
