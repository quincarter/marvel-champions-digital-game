/**
 * Regenerates packages/client/src/content/card-text-es.ts: the Spanish name, rules text and flavor text of every printed
 * card face, by MarvelCDB code, that the Spanish build shows beside a card in place of the English (issue #391).
 *
 *   pnpm --filter @mc/content card-text-es [--check]
 *
 * Reads the committed MarvelCDB caches, no network: the English `raw/marvelcdb/<pack>.json` and the Spanish
 * `raw/marvelcdb/es/<pack>.json` (`pnpm --filter @mc/content ingest -- --all --locale es` refreshes those from
 * es.marvelcdb.com's published API, one request per pack). Keeps the codes the pool prints (every `marvelcdbCodes` entry and card id under
 * packages/content/src/data) and, for each, only the fields MarvelCDB's Spanish site translates: a field that reads the
 * same as the English one (a pack not yet translated) is left out, so the client falls back to its English data.
 * The text is normalized the way ingestion normalizes the English (`toPlainText`): icons stay bracket tokens, which the
 * client words in Spanish. `--check` writes nothing and exits 1 when the file is out of date.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toPlainText } from "./marvelcdb/text.ts";

interface RawCard {
  readonly code: string;
  readonly name?: string | null;
  readonly text?: string | null;
  readonly flavor?: string | null;
  readonly traits?: string | null;
  readonly real_text?: string | null;
  /** A pack's list nests a card's other side (an identity's alter ego, a scheme's B side) here. */
  readonly linked_card?: RawCard;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(root, "packages/client/src/content/card-text-es.ts");
const DATA = path.join(root, "packages/content/src/data");
const check = process.argv.includes("--check");

const RAW = path.join(root, "packages/content/raw/marvelcdb");

/** Every record of the committed MarvelCDB caches in one folder (`raw/marvelcdb/*.json`, or a language's subfolder). */
const readCards = (dir: string): Map<string, RawCard> => {
  const cards = new Map<string, RawCard>();
  for (const file of fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort())
    for (const card of (JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as { cards: RawCard[] }).cards)
      for (let face: RawCard | undefined = card; face; face = face.linked_card) cards.set(face.code, face);
  return cards;
};

/** Every MarvelCDB code a pool card prints: its id and each code its provenance lists (an identity's `b` side). */
const poolCodes = new Set<string>();
const walk = (dir: string): void => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/^\s*id: cardId\("([^"]+)"\)/gm)) poolCodes.add(match[1]!);
      for (const match of source.matchAll(/marvelcdbCodes: \[([^\]]*)\]/g))
        for (const code of match[1]!.matchAll(/"([^"]+)"/g)) poolCodes.add(code[1]!);
    }
  }
};
walk(DATA);

// MarvelCDB's `text` is HTML with `<span class="icon-x">` icons; every icon becomes its bracket token first, so a class
// the English ingestion has never met (it reads `real_text`) cannot stop the run.
const plain = (html: string | null | undefined): string =>
  toPlainText(
    (html ?? "").replace(
      /<span class="icon-([\w-]+)"[^>]*>\s*<\/span>/g,
      (_m, icon: string) => `[${icon.replace(/-/g, "_")}]`,
    ),
  );

/**
 * A fingerprint of the English rules text a Spanish face translates: FNV-1a over its letters and digits, lowercased, in
 * base 36. The client fingerprints the face it shows the same way (`view/card-text.ts`, `textFingerprint`) and uses the
 * Spanish text only when the two agree, so a scan whose file name is not its own face's code (Core's main schemes) or
 * a face whose English the data corrected never shows another face's or an outdated translation.
 */
const fingerprint = (text: string): string => {
  let hash = 0x811c9dc5;
  for (const char of text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/**
 * Whether a translation states the same numbers as the English it translates (each number, as often). A translation that
 * does not is a different card's text or misses a correction (Vulture 27099 carries Electro's "discard 7"; Honorary
 * Avenger 03025 lacks its errata's "max 1"), so the face keeps its English. Spanish writes some numbers as words, which
 * this check also turns away: a face shows English rather than risk a wrong number.
 */
const sameNumbers = (spanish: string, english: string): boolean => {
  const numbers = (text: string): string => (text.match(/\d+/g) ?? []).sort().join(",");
  return numbers(spanish) === numbers(english);
};

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Faces whose English the curation corrected (a MarvelCDB transcription slip, not errata) where MarvelCDB's Spanish
 * already translates the printed card. Their `e` fingerprints the corrected English the card data prints, so the
 * Spanish still shows; every other corrected face keeps the raw English fingerprint and falls back to English. Add a
 * code only after reading the Spanish against the scan.
 * - 12028 Size Increase: the English drops "size" from "Uses (3 size counters)"; the Spanish has "Usos (3 contadores
 *   de Tamaño)" (issue #897).
 */
const SPANISH_MATCHES_CORRECTED_ENGLISH = new Set(["12028"]);

/**
 * The data's printed English for `code`: the card's own top-level `text.printed` (4-space indent), searched only within
 * its own record (up to the next `id: cardId(`), so a nested ability's `printed` or the next card's is never read. A
 * double-sided card's other face is not looked up: list single-face cards only.
 */
const correctedEnglish = (code: string): string => {
  const start = `id: cardId("${code}"),`;
  const files = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? files(path.join(dir, entry.name))
          : entry.name === "cards.ts"
            ? [path.join(dir, entry.name)]
            : [],
      );
  for (const file of files(DATA)) {
    const source = fs.readFileSync(file, "utf8");
    const at = source.indexOf(start);
    if (at < 0) continue;
    const next = source.indexOf("id: cardId(", at + start.length);
    const record = source.slice(at, next < 0 ? undefined : next);
    const match = /\n {4}text: \{\s*printed: ("(?:[^"\\]|\\.)*")/.exec(record);
    if (match) return JSON.parse(match[1]!) as string;
  }
  throw new Error(`${code}: no printed text in the card data for SPANISH_MATCHES_CORRECTED_ENGLISH`);
};

const es = readCards(path.join(RAW, "es"));
const en = readCards(RAW);
const entries: [string, Record<string, string>][] = [];
for (const [code, card] of es) {
  if (!poolCodes.has(code)) continue;
  // A face the English cache lacks (Fear No Evil's records transcribed from scans, not in raw/marvelcdb/fne.json) has
  // nothing to compare with: every Spanish field is kept, and one MarvelCDB left in English only repeats the English.
  const english: RawCard = en.get(code) ?? { code };
  const fields: Record<string, string> = {};
  const name = (card.name ?? "").trim();
  if (name && !same(name, english.name ?? "")) fields.n = name;
  const text = plain(card.text);
  const englishText = plain(english.real_text ?? english.text);
  // A translation whose numbers disagree may be another card's text, flavor and all: the face keeps only its name.
  const wrong = text !== "" && englishText !== "" && !sameNumbers(text, englishText);
  if (text && englishText && !same(text, plain(english.text)) && !wrong) fields.t = text;
  // Flavor needs an English record to check against (a face's flavor shows only where its fingerprint matches).
  const flavor = plain(card.flavor);
  const englishFlavor = plain(english.flavor);
  if (flavor && englishFlavor && !wrong && !same(flavor, englishFlavor)) fields.f = flavor;
  // What the client checks the face against: the English rules text, or for a face with none, the English flavor.
  if (fields.t !== undefined || fields.f !== undefined) {
    if (englishText)
      fields.e = fingerprint(SPANISH_MATCHES_CORRECTED_ENGLISH.has(code) ? correctedEnglish(code) : englishText);
    else fields.g = fingerprint(englishFlavor);
  }
  if (Object.keys(fields).length > 0) entries.push([code, fields]);
}
entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const lines = [
  "/**",
  " * Spanish card text, by MarvelCDB code of the printed face: `n` the name, `t` the rules text, `f` the flavor text,",
  " * `e` a fingerprint of the face's English rules text (`g` its English flavor, for a face with none): `t` and `f` show only on a face that matches. Each only where MarvelCDB's Spanish site translates it (issue #391). Display text only: the rules engine reads the",
  " * English card data. GENERATED by packages/content/scripts/card-text-es.ts (raw/marvelcdb/es against raw/marvelcdb);",
  " * do not hand-edit, rerun it. Loaded only when the card language is Spanish (`view/card-text.ts`).",
  " */",
  "export const CARD_TEXT_ES: Readonly<Record<string, { readonly n?: string; readonly t?: string; readonly e?: string; readonly g?: string; readonly f?: string }>> = {",
  ...entries.map(([code, fields]) => `  ${JSON.stringify(code)}: ${JSON.stringify(fields)},`),
  "};",
  "",
];
const out = lines.join("\n");
if (check) {
  const current = fs.existsSync(OUT) && fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") === out;
  console.log(
    current ? "card-text-es.ts is up to date." : "card-text-es.ts is out of date: run the card-text-es script.",
  );
  process.exit(current ? 0 : 1);
}
fs.writeFileSync(OUT, out);
console.log(`Wrote ${entries.length} faces to ${path.relative(root, OUT)} (${Math.round(out.length / 1024)} KiB).`);
