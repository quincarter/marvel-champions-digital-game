/**
 * MarvelCDB → @mc/content ingestion.
 *
 *   pnpm --filter @mc/content ingest                     # fetch core, cache, normalize, emit
 *   pnpm --filter @mc/content ingest -- --offline        # re-normalize from the committed raw cache
 *   pnpm --filter @mc/content ingest -- --pack core
 *   pnpm --filter @mc/content ingest -- --pack ant --dry-run --offline   # one pack, report only
 *   pnpm --filter @mc/content ingest -- --all --dry-run --offline        # every raw/marvelcdb/*.json, report only
 *
 * 1. Fetch `https://marvelcdb.com/api/public/cards/<pack>` (or read the cache with --offline).
 * 2. Write the response verbatim to `raw/marvelcdb/<pack>.json` — every field the
 *    API returns, imagesrc/backimagesrc/meta/octgn_id/url included. Those are
 *    references (MarvelCDB paths, an OCTGN guid, a page URL), not image bytes; no
 *    art is stored in the repo (CLAUDE.md "Content & IP boundaries").
 * 3. Normalize against the schema + hand curation (scripts/marvelcdb/curation/<pack>.ts).
 * 4. Emit typed TS modules to the curation's outDir (src/data/<pack> unless the
 *    curation overrides it — Core keeps its historical src/data/core).
 *
 * Curation registry: `REGISTERED_CURATIONS` below is the only place a pack
 * gets its real (hand-verified) curation wired in. A pack with no entry there
 * has no business emitting real data — `--dry-run` is the only mode that will
 * touch it, normalizing with `bareCuration` (scripts/marvelcdb/curation/empty.ts,
 * zero hand corrections) purely to report what's wrong. `--pack <code>
 * --allow-bare` is the one escape hatch, for the rare pack that turns out to
 * need no curation at all (see `scripts/marvelcdb/survey.ts`'s gap matrix for
 * why that's not the common case) — it still emits with placeholder cycle/pack
 * metadata that a human must replace before the data is trustworthy.
 *
 * Runs under Node ≥ 22.6 type stripping (`node --experimental-strip-types`); no build step, no extra deps.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawCard } from "./marvelcdb/raw-types.ts";
import { normalizePack, type NormalizedPack } from "./marvelcdb/normalize.ts";
import { emitModule, type ModuleSpec } from "./marvelcdb/emit.ts";
import { CORE_CURATION } from "./marvelcdb/curation/core.ts";
import { GOB_CURATION } from "./marvelcdb/curation/gob.ts";
import { TWC_CURATION } from "./marvelcdb/curation/twc.ts";
import { CAP_CURATION } from "./marvelcdb/curation/cap.ts";
import { MSM_CURATION } from "./marvelcdb/curation/msm.ts";
import { THOR_CURATION } from "./marvelcdb/curation/thor.ts";
import { BKW_CURATION } from "./marvelcdb/curation/bkw.ts";
import { DRS_CURATION } from "./marvelcdb/curation/drs.ts";
import { HLK_CURATION } from "./marvelcdb/curation/hlk.ts";
import { SCW_CURATION } from "./marvelcdb/curation/scw.ts";
import { ANT_CURATION } from "./marvelcdb/curation/ant.ts";
import { WSP_CURATION } from "./marvelcdb/curation/wsp.ts";
import { TRORS_CURATION } from "./marvelcdb/curation/trors.ts";
import { bareCuration } from "./marvelcdb/curation/empty.ts";
import type { PackCuration } from "./marvelcdb/curation/types.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(PKG_ROOT, "raw", "marvelcdb");

/** Every pack with a real, hand-verified curation. Add a pack here — never in this file's logic — to bring it fully online. */
const REGISTERED_CURATIONS: Readonly<Record<string, PackCuration>> = {
  core: CORE_CURATION,
  gob: GOB_CURATION,
  twc: TWC_CURATION,
  cap: CAP_CURATION,
  msm: MSM_CURATION,
  thor: THOR_CURATION,
  bkw: BKW_CURATION,
  drs: DRS_CURATION,
  hlk: HLK_CURATION,
  scw: SCW_CURATION,
  ant: ANT_CURATION,
  wsp: WSP_CURATION,
  trors: TRORS_CURATION,
};

interface RawCache {
  readonly source: string;
  readonly fetchedAt: string;
  readonly pack: string;
  readonly cards: RawCard[];
}

interface Args {
  readonly packs: string[];
  readonly offline: boolean;
  readonly dryRun: boolean;
  readonly allowBare: boolean;
}

async function allPackCodes(): Promise<string[]> {
  const files = await readdir(RAW_DIR);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length)).sort();
}

async function parseArgs(argv: readonly string[]): Promise<Args> {
  let pack: string | undefined;
  let all = false;
  let offline = false;
  let dryRun = false;
  let allowBare = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") offline = true;
    else if (a === "--all") all = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--allow-bare") allowBare = true;
    else if (a === "--pack") pack = argv[++i] ?? pack;
    else if (a?.startsWith("--pack=")) pack = a.slice("--pack=".length);
    else if (a === "--") continue;
    else throw new Error(`unknown argument ${String(a)}`);
  }
  if (all && pack) throw new Error("--all and --pack are mutually exclusive");
  if (all && !offline) throw new Error("--all requires --offline — it reads the committed raw caches, it does not refetch 63 packs");
  const packs = all ? await allPackCodes() : [pack ?? "core"];
  return { packs, offline, dryRun, allowBare };
}

async function loadRaw(pack: string, offline: boolean): Promise<RawCache> {
  const cachePath = join(PKG_ROOT, "raw", "marvelcdb", `${pack}.json`);
  if (offline) return JSON.parse(await readFile(cachePath, "utf8")) as RawCache;
  const source = `https://marvelcdb.com/api/public/cards/${pack}`;
  const res = await fetch(source, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${source} → HTTP ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error(`GET ${source} did not return an array`);
  const cache: RawCache = {
    source,
    fetchedAt: new Date().toISOString().slice(0, 10),
    pack,
    cards: body as RawCard[],
  };
  const json = `${JSON.stringify(cache, null, 2)}\n`;
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, json);
  console.log(`cached ${cache.cards.length} records → ${relative(PKG_ROOT, cachePath)}`);
  return cache;
}

function modules(n: NormalizedPack, curation: PackCuration, cache: RawCache): Record<string, string> {
  const P = curation.exportPrefix;
  const schema = "../../schema/index.js";
  const header = [
    "GENERATED FILE — do not edit by hand.",
    `Source: MarvelCDB public API ${cache.source} (fetched ${cache.fetchedAt}; raw cache: packages/content/raw/marvelcdb/${cache.pack}.json).`,
    `Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/${curation.packCode}.ts`,
    `Regenerate: pnpm --filter @mc/content ingest -- --pack ${curation.packCode} [--offline]`,
  ];
  const mod = (spec: Omit<ModuleSpec, "header" | "schemaSpecifier">) => emitModule({ header, schemaSpecifier: schema, ...spec });
  return {
    "cards.ts": mod({
      typeImports: { [schema]: ["AnyCard"] },
      exports: [
        {
          name: `${P}_CARDS`,
          type: "readonly AnyCard[]",
          value: n.cards,
          rootBrands: { id: "cardId" },
          doc: `Every ${curation.pack.name} card, one record per distinct physical card, ordered by id.`,
        },
      ],
    }),
    "packs.ts": mod({
      typeImports: { [schema]: ["Cycle", "Pack"] },
      exports: [
        { name: `${P}_CYCLE`, type: "Cycle", value: n.cycle, rootBrands: { id: "cycleId" } },
        {
          name: `${P}_PACK`,
          type: "Pack",
          value: n.pack,
          rootBrands: { code: "setCode" },
          doc: `Release date source: ${curation.pack.releaseDateSource}`,
        },
      ],
    }),
    "encounterSets.ts": mod({
      typeImports: { [schema]: ["EncounterSet"] },
      exports: [{ name: `${P}_ENCOUNTER_SETS`, type: "readonly EncounterSet[]", value: n.encounterSets, rootBrands: { id: "encounterSetId" } }],
    }),
    "scenarios.ts": mod({
      typeImports: { [schema]: ["Scenario"] },
      exports: [
        {
          name: `${P}_SCENARIOS`,
          type: "readonly Scenario[]",
          value: n.scenarios,
          rootBrands: { id: "scenarioId" },
          doc: curation.scenarios.map((s) => `${s.id}: ${s.evidence}`).join("; "),
        },
      ],
    }),
    "starterDecks.ts": mod({
      typeImports: { [schema]: ["StarterDeck"] },
      exports: [{ name: `${P}_STARTER_DECKS`, type: "readonly StarterDeck[]", value: n.starterDecks, rootBrands: { id: "starterDeckId" } }],
    }),
    "provenance.ts": mod({
      typeImports: { "../types.js": ["CardProvenance", "DroppedSourceRecord"] },
      exports: [
        { name: `${P}_PROVENANCE`, type: "readonly CardProvenance[]", value: n.provenance, rootBrands: { cardId: "cardId" } },
        {
          name: `${P}_DROPPED_SOURCE_RECORDS`,
          type: "readonly DroppedSourceRecord[]",
          value: n.dropped,
          rootBrands: {},
          doc: "MarvelCDB records deliberately not ingested, with the reason.",
        },
      ],
    }),
    "index.ts": [
      ...header.map((h) => `// ${h}`),
      "",
      ...["cards", "packs", "encounterSets", "scenarios", "starterDecks", "provenance"].map((m) => `export * from "./${m}.js";`),
      "",
    ].join("\n"),
  };
}

async function ingestOne(pack: string, args: Args): Promise<{ ok: boolean; summary: string }> {
  const registered = REGISTERED_CURATIONS[pack];
  if (!registered && !args.dryRun && !args.allowBare) {
    throw new Error(
      `no curation for pack "${pack}" — add scripts/marvelcdb/curation/${pack}.ts and register it in REGISTERED_CURATIONS, ` +
        `or pass --dry-run to survey it, or --allow-bare to emit with a zero-correction placeholder curation`,
    );
  }
  const cache = await loadRaw(pack, args.offline);
  const curation = registered ?? bareCuration(pack, cache.cards[0]);
  let normalized: NormalizedPack;
  try {
    normalized = normalizePack(cache.cards, curation);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (args.dryRun) return { ok: false, summary: `${pack}: FAILED\n${message}` };
    throw err;
  }
  const byType = new Map<string, number>();
  for (const c of normalized.cards) byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
  const stats =
    `${pack}: ${normalized.cards.length} cards (${[...byType].map(([t, n]) => `${t} ${n}`).join(", ")}), ` +
    `${normalized.encounterSets.length} encounter sets, ${normalized.scenarios.length} scenarios, ` +
    `${normalized.starterDecks.length} starter decks, ${normalized.dropped.length} dropped aggregates`;
  if (args.dryRun) return { ok: true, summary: `${stats} [dry run, ${registered ? "registered" : "bare"} curation — nothing written]` };

  const outDir = join(PKG_ROOT, curation.outDir);
  await mkdir(outDir, { recursive: true });
  for (const [file, source] of Object.entries(modules(normalized, curation, cache))) {
    await writeFile(join(outDir, file), source);
  }
  return { ok: true, summary: `${stats} → ${relative(PKG_ROOT, outDir)}${registered ? "" : " [BARE CURATION — placeholder cycle/pack metadata, verify before trusting]"}` };
}

async function main(): Promise<void> {
  const args = await parseArgs(process.argv.slice(2));
  let failures = 0;
  for (const pack of args.packs) {
    const { ok, summary } = await ingestOne(pack, args);
    console.log(summary);
    if (!ok) failures++;
  }
  if (args.packs.length > 1) console.log(`\n${args.packs.length - failures}/${args.packs.length} packs normalized cleanly.`);
  if (failures > 0 && !args.dryRun) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
