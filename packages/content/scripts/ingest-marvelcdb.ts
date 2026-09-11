/**
 * MarvelCDB → @mc/content ingestion.
 *
 *   pnpm --filter @mc/content ingest                  # fetch core, cache, normalize, emit
 *   pnpm --filter @mc/content ingest -- --offline     # re-normalize from the committed raw cache
 *   pnpm --filter @mc/content ingest -- --pack core
 *
 * 1. Fetch `https://marvelcdb.com/api/public/cards/<pack>` (or read the cache with --offline).
 * 2. Strip art/asset fields (imagesrc, backimagesrc, meta, octgn_id, url — also
 *    inside linked_card) and write `raw/marvelcdb/<pack>.json`. No image URL is
 *    ever written to disk (CLAUDE.md "Content & IP boundaries").
 * 3. Normalize against the schema + hand curation (scripts/marvelcdb/curation/<pack>.ts).
 * 4. Emit typed TS modules to the curation's outDir (src/data/core for the Core Set).
 *
 * Runs under Node ≥ 22.6 type stripping (`node --experimental-strip-types`); no build step, no extra deps.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ART_FIELDS, type RawCard } from "./marvelcdb/raw-types.ts";
import { normalizePack, type NormalizedPack } from "./marvelcdb/normalize.ts";
import { emitModule, type ModuleSpec } from "./marvelcdb/emit.ts";
import { CORE_CURATION } from "./marvelcdb/curation/core.ts";
import type { PackCuration } from "./marvelcdb/curation/types.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CURATIONS: Readonly<Record<string, PackCuration>> = { core: CORE_CURATION };

interface RawCache {
  readonly source: string;
  readonly fetchedAt: string;
  readonly pack: string;
  readonly strippedFields: readonly string[];
  readonly cards: RawCard[];
}

function parseArgs(argv: readonly string[]): { pack: string; offline: boolean } {
  let pack = "core";
  let offline = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") offline = true;
    else if (a === "--pack") pack = argv[++i] ?? pack;
    else if (a?.startsWith("--pack=")) pack = a.slice("--pack=".length);
    else if (a === "--") continue;
    else throw new Error(`unknown argument ${String(a)}`);
  }
  return { pack, offline };
}

function stripArt(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if ((ART_FIELDS as readonly string[]).includes(k)) continue;
    out[k] = k === "linked_card" && v && typeof v === "object" ? stripArt(v as Record<string, unknown>) : v;
  }
  return out;
}

function assertNoArt(json: string): void {
  const hit = /\.(png|jpe?g|webp|gif)\b|\/bundles\/cards\//i.exec(json);
  if (hit) throw new Error(`raw cache still contains an image reference near "${json.slice(hit.index - 40, hit.index + 20)}"`);
  for (const f of ART_FIELDS) if (json.includes(`"${f}":`)) throw new Error(`raw cache still contains field ${f}`);
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
    strippedFields: [...ART_FIELDS],
    cards: body.map((r) => stripArt(r as Record<string, unknown>) as unknown as RawCard),
  };
  const json = `${JSON.stringify(cache, null, 2)}\n`;
  assertNoArt(json);
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

async function main(): Promise<void> {
  const { pack, offline } = parseArgs(process.argv.slice(2));
  const curation = CURATIONS[pack];
  if (!curation) throw new Error(`no curation for pack "${pack}" — add scripts/marvelcdb/curation/${pack}.ts and register it`);
  const cache = await loadRaw(pack, offline);
  const normalized = normalizePack(cache.cards, curation);
  const outDir = join(PKG_ROOT, curation.outDir);
  await mkdir(outDir, { recursive: true });
  for (const [file, source] of Object.entries(modules(normalized, curation, cache))) {
    await writeFile(join(outDir, file), source);
  }
  const byType = new Map<string, number>();
  for (const c of normalized.cards) byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
  console.log(
    `${pack}: ${normalized.cards.length} cards (${[...byType].map(([t, n]) => `${t} ${n}`).join(", ")}), ` +
      `${normalized.encounterSets.length} encounter sets, ${normalized.scenarios.length} scenarios, ` +
      `${normalized.starterDecks.length} starter decks, ${normalized.dropped.length} dropped aggregates → ${relative(PKG_ROOT, outDir)}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
