/**
 * Node-only: converts a community pack in MarvelCDB public-API shape into our pack source folder
 * (docs/custom-content-packs.md section 11, `packages/mod-sdk/README.md` "Importing a MarvelCDB-shaped pack").
 *
 * The input folder is the shape BluefireF5ran's `mc-digital-custom-packs` uses:
 *
 *   mod.json              draft metadata: id, name, kind, author, template, version, permission, languages
 *   <id>.json             { source, fetchedAt, pack, cards }, the cards in MarvelCDB's public-API shape
 *   images/<lang>/<source code>.webp   card faces, one per record
 *   alt-art/<lang>/<name>.webp         alternate art: a base-game code ("01088") or "<source code>-alt"
 *
 * The cards go through the content package's own MarvelCDB normalizer (`packages/content/scripts/marvelcdb`, what
 * `pnpm --filter @mc/content ingest` runs), so a converted card has exactly the shape an ingested one has. Only what
 * is specific to a custom pack happens here: renumbering the codes to `x.<pack-id>.<NN>[a|b]`, rewriting every
 * reference to them, dropping the MarvelCDB art paths, mapping the pictures per language, and writing the source
 * layout the SDK's `buildPack` reads.
 *
 * The normalizer is imported by path from the content package's scripts folder, at run time: it is a script, not part
 * of `@mc/content`'s public entry point, and it needs a runtime that imports `.ts` (Vitest, or Node's type stripping).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  PACK_KINDS,
  isLanguageTag,
  isPackId,
  packCardImagePath,
  type AnyCard,
  type EncounterSet,
  type PackAltArt,
  type PackKind,
  type PackPermission,
  type StarterDeck,
} from "@mc/content";
import { assemblePack, type PackAuthorManifest, type PackSource } from "./build.js";
import { abilityRefsOf, readPackInput, splitIssues, validatePack, type PackIssue } from "./validate.js";

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

/** The slice of the normalizer's result this importer uses. */
interface NormalizedPackLike {
  readonly cards: readonly AnyCard[];
  readonly encounterSets: readonly EncounterSet[];
  readonly scenarios: readonly unknown[];
  readonly starterDecks: readonly StarterDeck[];
  readonly provenance: readonly { readonly cardId: string; readonly marvelcdbCodes: readonly string[] }[];
  readonly dropped: readonly { readonly marvelcdbCode: string; readonly reason: string }[];
}
type NormalizePack = (raw: readonly unknown[], curation: unknown) => NormalizedPackLike;

let normalizer: NormalizePack | undefined;
async function loadNormalizer(): Promise<NormalizePack> {
  if (normalizer) return normalizer;
  const url = new URL("../../content/scripts/marvelcdb/normalize.ts", import.meta.url).href;
  const module = (await import(/* @vite-ignore */ url)) as { normalizePack?: NormalizePack };
  if (typeof module.normalizePack !== "function") throw new Error("the content package's normalizePack is missing");
  return (normalizer = module.normalizePack);
}

/**
 * Hand curation for one import: the ingest's own `PackCuration` fields (`corrections`, `errata`, `scriptingNotes`,
 * `cardNotes`, `ignoredRecords`, ...; see `packages/content/scripts/marvelcdb/curation/types.ts`), merged over a bare
 * curation. Arrays are appended to the importer's own automatic corrections, objects are merged key by key. A card or
 * ability is named by its source code (`night_thrasher_dh_02a`) or its final one (`x.<pack-id>.02a`).
 */
export type ImportCuration = Readonly<Record<string, unknown>>;

export interface ImportOptions {
  /** The pack id, which prefixes every card code: `x.<packId>.<NN>`. Defaults to `mod.json`'s `id` in kebab case. */
  readonly packId?: string;
  /** Where to write the pack source folder. Absent = a dry run: convert and validate, write nothing. */
  readonly outDir?: string;
  /** Hand curation for cards the normalizer cannot read from MarvelCDB data alone. See `ImportCuration`. */
  readonly curation?: ImportCuration;
  /** `requires.app` for the written `pack.json`. Default `>=0.1.0`. */
  readonly app?: string;
  /** The pack's description. Default: a line built from `mod.json`. */
  readonly description?: string;
  /** The language the card records' text is written in. Default `en`: the normalizer reads English card text. */
  readonly textLanguage?: string;
  /** Skip the automatic curation of permanent no-cost cards (dash cost). Default: apply it, and say so in the report. */
  readonly noAutoCuration?: boolean;
}

/** One correction the importer made on its own, so a person can check it against the card. */
export interface AutoCuration {
  readonly code: string;
  readonly finalCode: string;
  readonly what: string;
}

export interface ImportReport {
  readonly packId: string;
  readonly name: string;
  /** Whether the normalizer accepted the cards. When false, nothing else was produced or written. */
  readonly normalized: boolean;
  /** What the normalizer rejected, one entry per problem. */
  readonly normalizerFailures: readonly string[];
  /** Cards (records) converted, counting each double-sided card once. */
  readonly cards: number;
  /** Physical copies, from the records' `quantity`. */
  readonly copies: number;
  readonly sourceToFinal: Readonly<Record<string, string>>;
  readonly autoCurations: readonly AutoCuration[];
  /** The ability ids no script covers yet (also reported by `validatePack`, as `unscripted-ability` issues). */
  readonly unscriptedAbilities: readonly string[];
  /** `validatePack` issues that are real defects. Empty = the pack is valid apart from its missing scripts. */
  readonly validationIssues: readonly PackIssue[];
  /** `validatePack` issues that only say an ability is not scripted yet. */
  readonly unscriptedIssues: readonly PackIssue[];
  /** Pictures `mod.json` promised or a language folder lacks: `<lang>/<source code>`. */
  readonly missingImages: readonly string[];
  /** Files in a picture folder that name no card. */
  readonly unmatchedImages: readonly string[];
  readonly languages: { readonly base: string; readonly available: readonly string[] };
  readonly altArt: PackAltArt;
  /** Things to look at that are not errors: `mod.json`'s open items, a missing permission date, a guessed version. */
  readonly notes: readonly string[];
  /** Where the pack was written, if it was. */
  readonly outDir?: string;
}

/** `carnage_nep` to `carnage-nep`. */
const kebab = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const KIND_ALIASES: Readonly<Record<string, PackKind>> = Object.fromEntries(
  PACK_KINDS.flatMap((kind) => [
    [kind, kind],
    [`${kind}_pack`, kind],
  ]),
);

/** The folder's pack data file: `<id>.json`, or the one `.json` that is not `mod.json`. */
function dataFileOf(srcDir: string, modId: string): string {
  const named = join(srcDir, `${modId}.json`);
  if (existsSync(named)) return named;
  const others = readdirSync(srcDir).filter((name) => name.endsWith(".json") && name !== "mod.json");
  if (others.length !== 1) throw new Error(`${srcDir}: expected ${modId}.json (or one .json besides mod.json)`);
  return join(srcDir, others[0] as string);
}

const tailOf = (code: string): { readonly key: string; readonly letter: string } => {
  const match = /^(.*\d)([a-z])$/.exec(code);
  return match ? { key: match[1] as string, letter: match[2] as string } : { key: code, letter: "" };
};

/** Source code to final code, in the order the cards appear (a double-sided card's other face follows its front). */
function planCodes(records: readonly Obj[], packId: string): Map<string, string> {
  const order: string[] = [];
  const visit = (record: Obj): void => {
    const code = str(record.code);
    if (code === undefined) throw new Error("a card record has no code");
    order.push(code);
    if (isObj(record.linked_card)) visit(record.linked_card);
  };
  records.forEach(visit);
  const numbers = new Map<string, number>();
  const out = new Map<string, string>();
  for (const code of order) {
    if (out.has(code)) throw new Error(`card code ${code} appears twice`);
    const { key, letter } = tailOf(code);
    if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
    const n = numbers.get(key) as number;
    out.set(code, `x.${packId}.${String(n).padStart(numbers.size > 99 ? 3 : 2, "0")}${letter}`);
  }
  return out;
}

/** Source set code to final encounter set id: the hero's own set is the pack id, the rest are `<pack id>-<name>`. */
function planSets(records: readonly Obj[], packId: string): Map<string, string> {
  const all: Obj[] = records.flatMap((r) => (isObj(r.linked_card) ? [r, r.linked_card] : [r]));
  const heroSet = all.map((r) => (r.type_code === "hero" ? str(r.card_set_code) : undefined)).find(Boolean);
  const out = new Map<string, string>();
  for (const record of all) {
    const set = str(record.card_set_code);
    if (set === undefined || out.has(set)) continue;
    if (set === heroSet) out.set(set, packId);
    else {
      const rest = heroSet !== undefined && set.startsWith(`${heroSet}_`) ? set.slice(heroSet.length + 1) : set;
      out.set(set, `${packId}-${kebab(rest)}`);
    }
  }
  const finals = [...out.values()];
  if (new Set(finals).size !== finals.length) throw new Error("two source sets map to the same encounter set id");
  return out;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A deep copy of `value` with every string that is, or starts a dotted id with, a source code swapped for its final. */
function makeRewriter(map: ReadonlyMap<string, string>): (value: unknown) => unknown {
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`(?<![A-Za-z0-9_])(?:${keys.join("|")})(?![A-Za-z0-9_])`, "g");
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return node.replace(pattern, (hit) => map.get(hit) ?? hit);
    if (Array.isArray(node)) return node.map(walk);
    if (isObj(node)) {
      return Object.fromEntries(
        // The MarvelCDB art paths (`images`, `image`) are not ours: the pack's pictures are files by convention.
        Object.entries(node)
          .filter(([key]) => key !== "images" && key !== "image")
          .map(([key, child]) => [key, walk(child)]),
      );
    }
    return node;
  };
  return walk;
}

/** The number a code's collector number shows: `x.a.01a` is `1A`. */
const collectorOf = (finalCode: string): string =>
  (/\.(\d+[a-z]?)$/.exec(finalCode)?.[1] ?? finalCode).replace(/^0+(?=\d)/, "").toUpperCase();

/** `ImportCuration` codes in final form turned back into the source codes the normalizer sees. */
function toSourceCodes(curation: ImportCuration, finalToSource: ReadonlyMap<string, string>): Obj {
  const source = (code: string): string => finalToSource.get(code) ?? code;
  const pattern = new RegExp(`^(${[...finalToSource.keys()].map(escapeRegExp).join("|")})(?=\\.|$)`);
  const fixKeys = (record: unknown): unknown =>
    isObj(record)
      ? Object.fromEntries(
          Object.entries(record).map(([key, value]) => [key.replace(pattern, (m) => source(m)), value]),
        )
      : record;
  const fixCode = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((e) => (isObj(e) && typeof e.code === "string" ? { ...e, code: source(e.code) } : e))
      : list;
  const out: Obj = { ...curation };
  for (const key of ["corrections", "errata", "ignoredRecords"]) if (key in out) out[key] = fixCode(out[key]);
  for (const key of ["cardNotes", "scriptingNotes"]) if (key in out) out[key] = fixKeys(out[key]);
  return out;
}

/**
 * MarvelCDB sends the back face of a double-sided card that is not an identity (a flip upgrade, a two-faced encounter
 * card) as a nested `linked_card` of the same `type_code` with `hidden: true`, and the normalizer reads that flag to
 * tell a flip side from a stray link. A community file that omits it gets it added here, and the report says so.
 */
function markFlipSides(records: readonly Obj[], notes: string[], codes: ReadonlyMap<string, string>): Obj[] {
  return records.map((record) => {
    const back = record.linked_card;
    const type = record.type_code;
    if (!isObj(back) || back.type_code !== type || back.hidden !== undefined) return record;
    if (type === "hero" || type === "alter_ego" || type === "villain" || type === "main_scheme") return record;
    const code = str(back.code) ?? "?";
    notes.push(
      `marked ${codes.get(code) ?? code} as the hidden flip side of ${str(record.name) ?? "?"}, as the API does`,
    );
    return { ...record, linked_card: { ...back, hidden: true } };
  });
}

/** The permanent, cost-less upgrades and supports: a printed dash cost (RRG 1.8 "Dash (Value)", p. 15). */
function dashCostCorrections(records: readonly Obj[], finalOf: (code: string) => string, skip: ReadonlySet<string>) {
  const found: { correction: Obj; auto: AutoCuration }[] = [];
  for (const record of records) {
    const code = str(record.code);
    if (code === undefined || skip.has(code)) continue;
    const noCost = record.cost === undefined || record.cost === null;
    if (record.permanent !== true || !noCost || record.cost_per_hero === true) continue;
    if (record.type_code !== "upgrade" && record.type_code !== "support") continue;
    const what = `${String(record.name)}: a permanent ${String(record.type_code)} with no cost in the source reads as a printed dash cost (cannot be played, enters play through its own text)`;
    found.push({
      correction: {
        code,
        reason: what,
        evidence: "pack importer: permanent card, no cost in the MarvelCDB-shaped record; check the card image",
        specialCost: "dash",
      },
      auto: { code, finalCode: finalOf(code), what },
    });
  }
  return found;
}

const APPENDED = new Set(["corrections", "errata", "scenarios", "starterDecks", "separateDecks", "ignoredRecords"]);

function mergeCuration(base: Obj, extra: Obj): Obj {
  const out: Obj = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    if (APPENDED.has(key) && Array.isArray(current) && Array.isArray(value)) out[key] = [...current, ...value];
    else if (isObj(current) && isObj(value)) out[key] = { ...current, ...value };
    else out[key] = value;
  }
  return out;
}

/** The leading `1`, `1.2` or `1.2.3` of a free-text version, as semver; `undefined` when it does not start with one. */
function semverOf(text: string): string | undefined {
  const match = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?![\d.])/.exec(text);
  return match ? `${match[1]}.${match[2] ?? "0"}.${match[3] ?? "0"}` : undefined;
}

interface ModJson {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly author: string;
  readonly template?: string;
  readonly version?: string;
  readonly permission?: { readonly status?: string; readonly scope?: string; readonly date?: string };
  readonly languages?: Readonly<Record<string, string>>;
  readonly files?: { readonly images?: Readonly<Record<string, string>>; readonly alt_art?: string | null };
  readonly open?: readonly string[];
  readonly status?: string;
}

function readMod(srcDir: string): ModJson {
  const mod = JSON.parse(readFileSync(join(srcDir, "mod.json"), "utf8")) as unknown;
  if (!isObj(mod) || !str(mod.id) || !str(mod.name) || !str(mod.kind) || !str(mod.author))
    throw new Error(`${join(srcDir, "mod.json")}: needs id, name, kind and author`);
  return mod as unknown as ModJson;
}

const subDirs = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

interface Pictures {
  readonly copies: readonly { readonly from: string; readonly to: string }[];
  readonly languages: readonly string[];
  readonly missing: readonly string[];
  readonly unmatched: readonly string[];
  readonly altArt: PackAltArt;
}

/** Maps `images/<lang>/<source code>.webp` and `alt-art/<lang>/<name>.webp` to the pack's picture paths. */
function mapPictures(srcDir: string, codes: ReadonlyMap<string, string>): Pictures {
  const copies: { from: string; to: string }[] = [];
  const missing: string[] = [];
  const unmatched: string[] = [];
  const languages = subDirs(join(srcDir, "images")).sort();
  for (const lang of languages) {
    const dir = join(srcDir, "images", lang);
    const present = new Set(readdirSync(dir));
    for (const [source, final] of codes) {
      if (present.delete(`${source}.webp`))
        copies.push({ from: join(dir, `${source}.webp`), to: packCardImagePath(lang, final) });
      else missing.push(`${lang}/${source}`);
    }
    unmatched.push(...[...present].sort().map((name) => `images/${lang}/${name}`));
  }
  const altArt: Record<string, Record<string, string>> = {};
  for (const lang of subDirs(join(srcDir, "alt-art")).sort()) {
    const dir = join(srcDir, "alt-art", lang);
    for (const name of readdirSync(dir).sort()) {
      const match = /^(.+)\.webp$/.exec(name);
      if (!match) {
        unmatched.push(`alt-art/${lang}/${name}`);
        continue;
      }
      const stem = match[1] as string;
      // "<source code>-alt" is an alternate face of the pack's own card; anything else is a base-game card code.
      const own = codes.get(stem.replace(/-alt$/, ""));
      const code = own !== undefined && stem.endsWith("-alt") ? own : stem;
      const to = `alt-art/${lang}/${code}.webp`;
      (altArt[lang] ??= {})[code] = to;
      copies.push({ from: join(dir, name), to });
    }
  }
  return { copies, languages, missing, unmatched, altArt };
}

const bytesOf = (path: string): Uint8Array => new Uint8Array(readFileSync(path));

function creditsMarkdown(mod: ModJson, packId: string, languages: readonly string[], base: string): string {
  const translators = Object.entries(mod.languages ?? {}).filter(([lang, who]) => lang !== "base" && who !== "author");
  const lines = [
    `# Credits`,
    ``,
    `${mod.name} (\`${packId}\`) is a fan-made pack by ${mod.author}.`,
    ``,
    `- Card design and art direction: ${mod.author}.`,
    ...(mod.template ? [`- Card template: ${mod.template}.`] : []),
    ...translators.map(([lang, who]) => `- Translation and layout (${lang}): ${who}.`),
    `- Pictures: ${languages.join(", ")} (base language ${base}).`,
    ...(mod.version ? [`- Source version: ${mod.version}.`] : []),
    ``,
    `The card data was converted from MarvelCDB-shaped records with the mod SDK's \`importMarvelCdbPack\`.`,
    `Character art is Marvel comics art, as used by each author.`,
    ``,
    `Marvel Champions: The Card Game is the property of Fantasy Flight Games and Marvel.`,
    ``,
  ];
  return lines.join("\n");
}

function permissionMarkdown(mod: ModJson, granted: boolean): string {
  const p = mod.permission ?? {};
  return [
    `# Permission`,
    ``,
    granted
      ? `${mod.author}, the author of ${mod.name}, gave permission for this pack to be distributed through the mod store.`
      : `**Permission is not recorded as granted for this pack (status: ${p.status ?? "none"}). Do not publish it.**`,
    ``,
    `- Status: ${p.status ?? "not recorded"}`,
    `- Scope: ${p.scope ?? "not recorded"}`,
    `- Date: ${p.date ?? "not recorded"}`,
    ``,
    `Recorded in the pack's draft \`mod.json\`. The registry review asks for the evidence (a link or a quoted message).`,
    ``,
  ].join("\n");
}

/** One face or card with abilities, for the stub's comments. */
interface AbilityFace {
  readonly title: string;
  readonly text: string;
  readonly ids: readonly string[];
}

function abilityFacesOf(card: AnyCard): AbilityFace[] {
  const faces: AbilityFace[] = [];
  const walk = (node: unknown, title: string): void => {
    if (Array.isArray(node)) return void node.forEach((n) => walk(n, title));
    if (!isObj(node)) return;
    const ids = Array.isArray(node.abilities)
      ? node.abilities.flatMap((a) => (isObj(a) && typeof a.id === "string" ? [a.id] : []))
      : [];
    const here = str(node.faceName) ?? str(node.name) ?? title;
    if (ids.length > 0) {
      const text = isObj(node.text) ? (str(node.text.printed) ?? "") : "";
      faces.push({ title: here, text, ids });
    }
    for (const [key, child] of Object.entries(node)) if (key !== "abilities" && key !== "text") walk(child, here);
  };
  walk(card, card.name);
  return faces;
}

function abilitiesStub(cards: readonly AnyCard[], packName: string): { source: string; ids: string[] } {
  const ids: string[] = [];
  const blocks: string[] = [];
  for (const card of cards) {
    for (const face of abilityFacesOf(card)) {
      const fresh = face.ids.filter((id) => !ids.includes(id));
      if (fresh.length === 0) continue;
      ids.push(...fresh);
      const text = face.text.split("\n").map((line) => `  //     ${line}`);
      blocks.push(
        [`  // ${String(card.id)} ${face.title} (${card.type})`, ...text, ...fresh.map((id) => `  //   ${id}`)].join(
          "\n",
        ),
      );
    }
  }
  const source = [
    `/**`,
    ` * ${packName}: abilities still to script (${ids.length}).`,
    ` *`,
    ` * Generated by the mod SDK's importMarvelCdbPack. Every card below names the ability ids listed under it; until`,
    ` * a script exists, \`validatePack\` reports each as an "unscripted-ability" issue, apart from real defects.`,
    ` * Write each one with the DSL (see the sample pack), as \`"<id>": heroAction(...)\` and so on, and delete its`,
    ` * comment. The printed text is above its ids.`,
    ` */`,
    `import { definePackAbilities } from "@mc/mod-sdk";`,
    ``,
    `export default definePackAbilities({`,
    blocks.join("\n\n"),
    `});`,
    ``,
  ].join("\n");
  return { source, ids };
}

const writeText = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const jsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Converts the MarvelCDB-shaped pack in `srcDir` into a pack source folder at `options.outDir` (or just checks it, with
 * no `outDir`). Never throws for bad card data: the normalizer's rejections come back in `normalizerFailures`.
 * Throws for an unreadable folder (no `mod.json`, no data file, an unusable pack id).
 *
 * The result of a successful conversion passes `validatePack` except for the abilities it has no script for, which
 * are reported apart (`unscriptedIssues`, category `unscripted-ability`) and listed in `abilities/index.ts`. An
 * existing `abilities/index.ts` in `outDir` is never overwritten: it holds an author's scripts.
 */
export async function importMarvelCdbPack(srcDir: string, options: ImportOptions = {}): Promise<ImportReport> {
  const mod = readMod(srcDir);
  const packId = options.packId ?? kebab(mod.id);
  if (!isPackId(packId)) throw new Error(`"${packId}" is not a legal pack id`);
  const kind = KIND_ALIASES[mod.kind];
  if (!kind) throw new Error(`mod.json kind "${mod.kind}" is not one of ${PACK_KINDS.join(", ")} (or ..._pack)`);
  const data = JSON.parse(readFileSync(dataFileOf(srcDir, mod.id), "utf8")) as unknown;
  if (!isObj(data) || !Array.isArray(data.cards))
    throw new Error(`${basename(srcDir)}: no "cards" list in the data file`);
  const records = (data.cards as unknown[]).filter(isObj);
  if (records.length !== data.cards.length) throw new Error("every card record must be an object");

  const notes: string[] = [];
  const codes = planCodes(records, packId);
  const sets = planSets(records, packId);
  const finalToSource = new Map([...codes].map(([source, final]) => [final, source]));
  const rewrite = makeRewriter(new Map([...codes, ...sets]));
  const sourceToFinal = Object.fromEntries(codes);
  const nested = records.flatMap((r) => (isObj(r.linked_card) ? [r, r.linked_card] : [r]));
  const shaped = markFlipSides(records, notes, codes);

  // Curation: the importer's automatic dash-cost correction, then the caller's.
  const userCuration = toSourceCodes(options.curation ?? {}, finalToSource);
  const corrected = new Set(
    (Array.isArray(userCuration.corrections) ? userCuration.corrections : []).flatMap((c) =>
      isObj(c) && typeof c.code === "string" ? [c.code] : [],
    ),
  );
  const auto = options.noAutoCuration ? [] : dashCostCorrections(records, (c) => codes.get(c) ?? c, corrected);
  const bare: Obj = {
    packCode: packId,
    cycle: { id: packId, name: mod.name, order: 0 },
    pack: { name: mod.name, releaseDate: "custom", releaseDateSource: "custom pack: no release date" },
    outDir: "",
    exportPrefix: packId.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
    corrections: auto.map((a) => a.correction),
    errata: [],
    scriptingNotes: {},
    cardNotes: {},
    scenarios: [],
    starterDecks: [],
  };
  const curation = mergeCuration(bare, userCuration);

  const base: Pick<ImportReport, "packId" | "name" | "sourceToFinal" | "autoCurations" | "notes"> = {
    packId,
    name: mod.name,
    sourceToFinal,
    autoCurations: auto.map((a) => a.auto),
    notes,
  };
  const empty = { cards: 0, copies: 0, unscriptedAbilities: [], validationIssues: [], unscriptedIssues: [] } as const;
  const noPictures = { missingImages: [], unmatchedImages: [], altArt: {} } as const;

  let normalized: NormalizedPackLike;
  try {
    normalized = (await loadNormalizer())(shaped, curation);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failures = message.includes("\n  - ") ? message.split("\n  - ").slice(1) : [message];
    return {
      ...base,
      ...empty,
      ...noPictures,
      normalized: false,
      normalizerFailures: failures,
      languages: { base: mod.languages?.base ?? "en", available: [] },
    };
  }

  const rewritten = (normalized.cards.map((c) => rewrite(c)) as AnyCard[]).map((card) => {
    const from = normalized.provenance.find((p) => rewrite(p.cardId) === (card.id as string));
    const sources = from?.marvelcdbCodes ?? [];
    const numbers = sources.map((s) => collectorOf(codes.get(s) ?? s));
    return numbers.length > 0 ? { ...card, collectorNumber: numbers.join("/") } : card;
  }) as AnyCard[];
  const decks = normalized.starterDecks.map((d) => rewrite(d) as StarterDeck);
  const scenarios = normalized.scenarios.map((s) => rewrite(s));
  const topCopies = records.reduce((n, r) => n + (typeof r.quantity === "number" ? r.quantity : 0), 0);

  // Pictures and alternate art.
  const pictures = mapPictures(srcDir, codes);
  const baseLanguage = mod.languages?.base ?? pictures.languages[0] ?? "en";
  const declared = Object.keys(mod.languages ?? {}).filter((l) => l !== "base" && isLanguageTag(l));
  const available = [...new Set([baseLanguage, ...declared, ...pictures.languages])].filter(isLanguageTag).sort();
  const withPictures = pictures.copies.length > 0 || pictures.languages.length > 0;
  const languages = { base: baseLanguage, available };
  const textLanguage = options.textLanguage ?? "en";

  // Assets: pictures, alt art, credits.
  const assets = new Map<string, Uint8Array>();
  for (const { from, to } of pictures.copies) assets.set(to, bytesOf(from));
  const granted = mod.permission?.status === "granted";
  assets.set("CREDITS.md", new TextEncoder().encode(creditsMarkdown(mod, packId, pictures.languages, baseLanguage)));
  assets.set("PERMISSION.md", new TextEncoder().encode(permissionMarkdown(mod, granted)));

  const translators = Object.fromEntries(
    Object.entries(mod.languages ?? {}).filter(
      ([lang, who]) => lang !== "base" && who !== "author" && isLanguageTag(lang),
    ),
  );
  const version = semverOf(mod.version ?? "");
  if (version === undefined) notes.push(`version "${mod.version ?? ""}" is not semver: the pack is 0.1.0`);
  const permission: PackPermission | undefined = granted
    ? {
        by: mod.author,
        ...(mod.permission?.date ? { date: mod.permission.date } : {}),
        ...(mod.permission?.scope ? { scope: mod.permission.scope } : {}),
      }
    : undefined;
  if (!granted) notes.push(`permission is not granted (status: ${mod.permission?.status ?? "none"})`);
  else if (!mod.permission?.date) notes.push("permission has no date recorded");
  if (mod.status && mod.status !== "ready") notes.push(`mod.json status: ${mod.status}`);
  for (const open of mod.open ?? []) notes.push(`open: ${open}`);
  for (const dropped of normalized.dropped) notes.push(`dropped ${dropped.marvelcdbCode}: ${dropped.reason}`);

  const author: PackAuthorManifest = {
    id: packId,
    version: version ?? "0.1.0",
    kind,
    name: mod.name,
    authors: [mod.author],
    description: options.description ?? `Fan-made ${kind} pack by ${mod.author}: ${mod.name}.`,
    license: "Fan-made, non-commercial; see CREDITS.md",
    requires: { app: options.app ?? ">=0.1.0", packs: [] },
    ...(withPictures
      ? { languages: { ...languages, ...(textLanguage !== baseLanguage ? { text: textLanguage } : {}) } }
      : {}),
    ...(Object.keys(pictures.altArt).length > 0 ? { altArt: pictures.altArt } : {}),
    ...(permission ? { permission } : {}),
    ...(mod.template ? { templateCredit: mod.template } : {}),
    ...(Object.keys(translators).length > 0 ? { translators } : {}),
  };

  // Validate what a build would ship, with no ability scripts.
  const sortedCards = [...rewritten].sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1));
  const source: PackSource = { author, cards: sortedCards, abilities: {}, decks, scenarios, assets };
  const built = assemblePack(source);
  const { unscripted, defects } = splitIssues(validatePack(readPackInput(built.manifest, built.files)));
  const stub = abilitiesStub(sortedCards, mod.name);
  const unscriptedAbilities = [...new Set(sortedCards.flatMap((c) => abilityRefsOf(c)))];

  // x_* fields are the author's own extensions (Gwenpool's speech bubbles): kept beside the pack, not in the cards.
  const extensions: Record<string, Obj> = {};
  for (const record of nested) {
    const own = Object.fromEntries(Object.entries(record).filter(([key]) => key.startsWith("x_")));
    const code = str(record.code);
    if (code !== undefined && Object.keys(own).length > 0) extensions[codes.get(code) ?? code] = own;
  }

  const report: ImportReport = {
    ...base,
    normalized: true,
    normalizerFailures: [],
    cards: normalized.cards.length,
    copies: topCopies,
    unscriptedAbilities,
    validationIssues: defects,
    unscriptedIssues: unscripted,
    missingImages: pictures.missing,
    unmatchedImages: pictures.unmatched,
    languages,
    altArt: pictures.altArt,
    ...(options.outDir ? { outDir: options.outDir } : {}),
  };
  if (!options.outDir) return report;

  const out = options.outDir;
  for (const dir of ["cards", "alt-art", "decks", "scenarios"])
    rmSync(join(out, dir), { recursive: true, force: true });
  writeText(join(out, "pack.json"), jsonText(author));
  for (const card of sortedCards) writeText(join(out, "cards", `${card.id as string}.json`), jsonText(card));
  for (const deck of decks) writeText(join(out, "decks", `${deck.id}.json`), jsonText(deck));
  scenarios.forEach((s, i) => writeText(join(out, "scenarios", `${str((s as Obj).id) ?? i}.json`), jsonText(s)));
  for (const { from, to } of pictures.copies) {
    mkdirSync(dirname(join(out, to)), { recursive: true });
    copyFileSync(from, join(out, to));
  }
  writeText(join(out, "CREDITS.md"), new TextDecoder().decode(assets.get("CREDITS.md")));
  writeText(join(out, "PERMISSION.md"), new TextDecoder().decode(assets.get("PERMISSION.md")));
  const stubPath = join(out, "abilities", "index.ts");
  if (existsSync(stubPath)) notes.push("abilities/index.ts already exists and was left alone");
  else writeText(stubPath, stub.source);
  if (Object.keys(extensions).length > 0) writeText(join(out, "extensions.json"), jsonText(extensions));
  return report;
}

/** The report as the lines a person reads after a hand run. */
export function formatImportReport(report: ImportReport): string {
  const lines = [`${report.name} (${report.packId})`];
  if (!report.normalized) {
    lines.push(`  normalizer FAILED (${report.normalizerFailures.length}):`);
    for (const failure of report.normalizerFailures) lines.push(`    - ${failure}`);
    return lines.join("\n");
  }
  lines.push(`  cards: ${report.cards} (${report.copies} copies)`);
  lines.push(`  normalizer failures: 0`);
  for (const auto of report.autoCurations)
    lines.push(`  auto-curation ${auto.code} -> ${auto.finalCode}: ${auto.what}`);
  lines.push(`  unscripted abilities: ${report.unscriptedAbilities.length}`);
  lines.push(`  validation issues (not counting unscripted abilities): ${report.validationIssues.length}`);
  for (const issue of report.validationIssues) lines.push(`    - ${issue.path}: ${issue.message}`);
  lines.push(`  languages: ${report.languages.available.join(", ")} (base ${report.languages.base})`);
  lines.push(`  missing images: ${report.missingImages.length}, unmatched files: ${report.unmatchedImages.length}`);
  const altCount = Object.values(report.altArt).reduce((n, byCode) => n + Object.keys(byCode).length, 0);
  lines.push(`  alt art: ${altCount}`);
  for (const note of report.notes) lines.push(`  note: ${note}`);
  return lines.join("\n");
}
