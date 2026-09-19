/**
 * Dry-run normalization over some/all raw packs, with no emission.
 *
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning \
 *     scripts/marvelcdb/survey.ts [--pack <code> ...] [--json <path>]
 *
 * With no `--pack`, every `raw/marvelcdb/<code>.json` is surveyed. A pack
 * registered in `ingest-marvelcdb.ts`'s `CURATIONS` is normalized with its
 * real curation (so Core's survey result reflects the actual hand-verified
 * pipeline); every other pack is normalized with `bareCuration` — no
 * corrections, no errata, no scripting/card notes, no scenarios, no starter
 * decks — which is deliberately the *most* forgiving curation ingestion can
 * offer, so a failure under it is a real gap rather than a missing hand-entry
 * this survey could have supplied itself.
 *
 * Output: one aggregated error list per pack (`normalizePack` collects
 * everything it can before throwing) or a top-level exception message for a
 * crash that happens before it gets that far (e.g. an HTML icon class
 * `toPlainText` doesn't recognize). Every line is matched against `CATEGORIES`
 * below and rolled into a pack-and-total gap matrix; anything that matches
 * nothing lands in `uncategorized`, which is the part of the report most
 * likely to contain a shape nobody has named yet.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawCard } from "./raw-types.ts";
import { normalizePack } from "./normalize.ts";
import { bareCuration } from "./curation/empty.ts";
import { CORE_CURATION } from "./curation/core.ts";
import { GOB_CURATION } from "./curation/gob.ts";
import { TWC_CURATION } from "./curation/twc.ts";
import { CAP_CURATION } from "./curation/cap.ts";
import { MSM_CURATION } from "./curation/msm.ts";
import { THOR_CURATION } from "./curation/thor.ts";
import { BKW_CURATION } from "./curation/bkw.ts";
import { DRS_CURATION } from "./curation/drs.ts";
import { HLK_CURATION } from "./curation/hlk.ts";
import { SCW_CURATION } from "./curation/scw.ts";
import { ANT_CURATION } from "./curation/ant.ts";
import { WSP_CURATION } from "./curation/wsp.ts";
import { TRORS_CURATION } from "./curation/trors.ts";
import { QSV_CURATION } from "./curation/qsv.ts";
import { TOAFK_CURATION } from "./curation/toafk.ts";
import { BP_CURATION } from "./curation/bp.ts";
import { CYCLOPS_CURATION } from "./curation/cyclops.ts";
import { GAMBIT_CURATION } from "./curation/gambit.ts";
import { DRAX_CURATION } from "./curation/drax.ts";
import { GAM_CURATION } from "./curation/gam.ts";
import { STLD_CURATION } from "./curation/stld.ts";
import { VNM_CURATION } from "./curation/vnm.ts";
import { NEBU_CURATION } from "./curation/nebu.ts";
import { WARM_CURATION } from "./curation/warm.ts";
import { VISION_CURATION } from "./curation/vision.ts";
import { NCRAWLER_CURATION } from "./curation/ncrawler.ts";
import { MAGNETO_CURATION } from "./curation/magneto.ts";
import { WINTER_CURATION } from "./curation/winter.ts";
import { FALCON_CURATION } from "./curation/falcon.ts";
import { RON_CURATION } from "./curation/ron.ts";
import { SPDR_CURATION } from "./curation/spdr.ts";
import { NOVA_CURATION } from "./curation/nova.ts";
import { SILK_CURATION } from "./curation/silk.ts";
import { PHOENIX_CURATION } from "./curation/phoenix.ts";
import { ROGUE_CURATION } from "./curation/rogue.ts";
import { WOLV_CURATION } from "./curation/wolv.ts";
import { HOOD_CURATION } from "./curation/hood.ts";
import type { PackCuration } from "./curation/types.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RAW_DIR = join(PKG_ROOT, "raw", "marvelcdb");

/** Packs with a real, hand-verified curation. Every other pack surveys "bare". */
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
  qsv: QSV_CURATION,
  toafk: TOAFK_CURATION,
  bp: BP_CURATION,
  cyclops: CYCLOPS_CURATION,
  gambit: GAMBIT_CURATION,
  drax: DRAX_CURATION,
  gam: GAM_CURATION,
  stld: STLD_CURATION,
  vnm: VNM_CURATION,
  nebu: NEBU_CURATION,
  warm: WARM_CURATION,
  vision: VISION_CURATION,
  ncrawler: NCRAWLER_CURATION,
  magneto: MAGNETO_CURATION,
  winter: WINTER_CURATION,
  falcon: FALCON_CURATION,
  ron: RON_CURATION,
  spdr: SPDR_CURATION,
  nova: NOVA_CURATION,
  silk: SILK_CURATION,
  phoenix: PHOENIX_CURATION,
  rogue: ROGUE_CURATION,
  wolv: WOLV_CURATION,
  hood: HOOD_CURATION,
};

interface RawCache {
  readonly source: string;
  readonly fetchedAt: string;
  readonly pack: string;
  readonly cards: RawCard[];
}

interface Category {
  readonly label: string;
  readonly re: RegExp;
}

// Order matters: first match wins. Kept in the same order as the gap-matrix
// write-up so the two stay easy to cross-check.
const CATEGORIES: readonly Category[] = [
  { label: "unhandled MarvelCDB type_code", re: /: unhandled type (\w+)/ },
  { label: "hero without a linked alter-ego (extra hero face / dangling link)", re: /hero without a linked alter-ego/ },
  { label: "hero/alter-ego hit points differ", re: /hero\/alter-ego hit points differ/ },
  { label: "hero card in a set with no identity (kit card outside its hero's card_set_code)", re: /hero card in set .* with no identity/ },
  { label: "unknown faction_code (not hero/encounter/a CoreAspect)", re: /unknown faction/ },
  { label: "obligation count != 1 for a hero set", re: /expected exactly one obligation/ },
  { label: "no nemesis encounter set for a hero", re: /no nemesis set/ },
  { label: "villain stage label is not a roman numeral", re: /villain stage .* is not a roman numeral/ },
  { label: "villain without hit points", re: /villain without hit points/ },
  { label: "villain set: stage names differ", re: /stage names differ/ },
  { label: "non-printed field present (needs ignoreFields correction)", re: /not a printed field on this card type/ },
  { label: "main scheme record not an A/B pair", re: /main scheme record is not an A side/ },
  { label: "main scheme stage not an NA\\/NB pair", re: /not an NA\/NB pair/ },
  { label: "main scheme missing starting/target/acceleration threat", re: /missing (starting threat|target threat|acceleration)/ },
  { label: "keywords on a main scheme A side", re: /keywords on a main scheme A side/ },
  { label: "aggregate record mismatch (possible MarvelCDB data error, cf. Core's swapped A/B)", re: /aggregate .* does not match its B side|aggregate .* quantity .* != variants/ },
  { label: "ally missing atk/thw (printed dash — needs cardNotes)", re: /ally has no (attack|thwart)/ },
  { label: "minion ATK is X or invalid (needs cardNotes)", re: /printed ATK is X|minion ATK .* invalid/ },
  { label: "deck_limit missing/invalid", re: /deck_limit .* invalid/ },
  { label: "Max N per deck text vs deck_limit mismatch", re: /Max .* per deck but deck_limit/ },
  { label: "attach rule shape not recognized by the parser", re: /(second attach rule|unrecognized attach rule|attach rule on a|attachment without an attach rule|player card attaches to a villain by name|attaches to a villain by name is not this set's villain)/ },
  { label: "ifAble attach host: one side didn't parse", re: /ifAble attach host: could not parse/ },
  { label: "Requirement keyword needs more than one resource icon (schema gap)", re: /Requirement keyword needs more than one resource icon/ },
  { label: "Discount keyword needs a target-trait qualifier (schema gap)", re: /Discount keyword needs a target-trait qualifier/ },
  { label: "play/deck restriction text on a non-player card", re: /play\/deck restriction on a non-player card/ },
  { label: "campaign-specific obligation (schema gap — ObligationCard has no specificTo)", re: /obligation with faction campaign/ },
  { label: "unknown text token (icon/markup the text normalizer doesn't map)", re: /unknown text token/ },
  { label: "boost_star flag vs Boost ability text mismatch", re: /boost_star=.* but text/ },
  { label: "MarvelCDB record never turned into a card (falls out of every code path)", re: /was not turned into any card/ },
  { label: "no artwork reference for a printed face", re: /no artwork reference/ },
  { label: "duplicate MarvelCDB code", re: /duplicate MarvelCDB code/ },
  { label: "resource/event/support/upgrade cost shape", re: /(without a cost|resource with a cost)/ },
  { label: "player side scheme without starting threat", re: /player side scheme without starting threat/ },
  { label: "side scheme without starting threat", re: /side scheme without starting threat/ },
];

function categorize(line: string): string {
  for (const c of CATEGORIES) if (c.re.test(line)) return c.label;
  return "uncategorized";
}

interface PackResult {
  readonly pack: string;
  readonly cardCount: number;
  readonly ok: boolean;
  /** Set when normalization throws *before* it can collect a line list (e.g. a hard crash). */
  readonly crash?: string;
  readonly errorLines: string[];
}

async function surveyPack(pack: string): Promise<PackResult> {
  const cachePath = join(RAW_DIR, `${pack}.json`);
  const cache = JSON.parse(await readFile(cachePath, "utf8")) as RawCache;
  const curation = REGISTERED_CURATIONS[pack] ?? bareCuration(pack, cache.cards[0]);
  try {
    normalizePack(cache.cards, curation);
    return { pack, cardCount: cache.cards.length, ok: true, errorLines: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const prefix = `Normalization of pack "${pack}" failed:\n  - `;
    if (message.startsWith(prefix)) {
      const lines = message.slice(prefix.length).split("\n  - ");
      return { pack, cardCount: cache.cards.length, ok: false, errorLines: lines };
    }
    // A crash before the aggregated-error path (e.g. an unmapped icon class,
    // or a genuine bug) — one line, tagged so it's visibly not from the
    // curated error-collection path.
    return { pack, cardCount: cache.cards.length, ok: false, crash: message, errorLines: [`CRASH: ${message}`] };
  }
}

interface Args {
  readonly packs?: string[];
  readonly jsonOut?: string;
}

function parseArgs(argv: readonly string[]): Args {
  const packs: string[] = [];
  let jsonOut: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pack") packs.push(argv[++i] as string);
    else if (a === "--json") jsonOut = argv[++i];
    else if (a === "--") continue;
    else throw new Error(`unknown argument ${String(a)}`);
  }
  return { ...(packs.length > 0 ? { packs } : {}), ...(jsonOut ? { jsonOut } : {}) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const packs = args.packs ?? (await readdir(RAW_DIR)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length)).sort();

  const results: PackResult[] = [];
  for (const pack of packs) results.push(await surveyPack(pack));

  const byCategory = new Map<string, { count: number; examples: string[]; packs: Set<string> }>();
  for (const r of results) {
    for (const line of r.errorLines) {
      const cat = categorize(line);
      const entry = byCategory.get(cat) ?? { count: 0, examples: [], packs: new Set<string>() };
      entry.count++;
      entry.packs.add(r.pack);
      if (entry.examples.length < 5) entry.examples.push(`${r.pack}: ${line}`);
      byCategory.set(cat, entry);
    }
  }

  const clean = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log(`Surveyed ${results.length} packs — ${clean.length} normalize cleanly under their registered/bare curation, ${failed.length} do not.\n`);
  if (clean.length > 0) console.log(`Clean: ${clean.map((r) => r.pack).join(", ")}\n`);

  console.log("Per-pack error counts:");
  for (const r of [...results].sort((a, b) => b.errorLines.length - a.errorLines.length)) {
    if (r.errorLines.length > 0) console.log(`  ${r.pack} (${r.cardCount} cards): ${r.errorLines.length} issues${r.crash ? " [CRASH]" : ""}`);
  }

  console.log("\nGap matrix (category → count across packs, packs affected):");
  const sorted = [...byCategory.entries()].sort(([, a], [, b]) => b.count - a.count);
  for (const [cat, { count, packs: ps }] of sorted) {
    console.log(`  [${count}] ${cat} — ${ps.size} pack(s): ${[...ps].sort().slice(0, 10).join(", ")}${ps.size > 10 ? ", ..." : ""}`);
  }

  if (args.jsonOut) {
    const json = {
      surveyedAt: new Date().toISOString(),
      packCount: results.length,
      cleanPacks: clean.map((r) => r.pack),
      results: results.map((r) => ({ pack: r.pack, cardCount: r.cardCount, ok: r.ok, ...(r.crash ? { crash: r.crash } : {}), errorLines: r.errorLines })),
      gapMatrix: sorted.map(([category, { count, examples, packs: ps }]) => ({ category, count, packs: [...ps].sort(), examples })),
    };
    await writeFile(args.jsonOut, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`\nWrote full detail → ${args.jsonOut}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
