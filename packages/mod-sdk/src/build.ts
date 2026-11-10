/**
 * Node-only: reads a pack's source tree and builds it (docs/custom-content-packs.md §11.2 `mc-pack build`). Kept apart
 * from `validate.ts` so the client can import validation without `node:fs`.
 *
 * `abilities/index.ts` is TypeScript, so the process doing the build must be able to import `.ts` (Vitest does; a CLI
 * wrapper runs under a TS loader such as `tsx`, which the repo does not carry yet, so the build is a callable function
 * for now).
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { Zip, ZipDeflate } from "fflate";
import { PACK_SCHEMA_VERSION, type AnyCard, type PackFile, type PackManifest, type StarterDeck } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { dslFeatures } from "./features.js";
import { sha256Hex } from "./sha256.js";
import { readPackInput, validatePack, type PackInput, type PackIssue, type ValidateOptions } from "./validate.js";

/** The author-written part of `pack.json`. The build fills in everything else. */
export type PackAuthorManifest = Pick<
  PackManifest,
  "id" | "version" | "kind" | "name" | "authors" | "description" | "license" | "pictures"
> & { readonly requires: { readonly app: string; readonly packs?: readonly string[] } };

/** A pack's source tree, loaded. */
export interface PackSource {
  readonly author: PackAuthorManifest;
  readonly cards: readonly AnyCard[];
  readonly abilities: AbilityRegistry;
  readonly decks: readonly StarterDeck[];
  readonly scenarios: readonly unknown[];
  /** Static files to ship, by their path in the pack: `art/**`, `CREDITS.md`, `PERMISSION.md`. */
  readonly assets: ReadonlyMap<string, Uint8Array>;
}

export interface BuildResult {
  readonly manifest: PackManifest;
  readonly zipPath: string;
  readonly zipBytes: number;
  readonly zipSha256: string;
}

/** Thrown when a built pack fails `validatePack`. */
export class PackBuildError extends Error {
  constructor(readonly issues: readonly PackIssue[]) {
    super(`pack is invalid:\n  ${issues.map((i) => `${i.path}: ${i.message}`).join("\n  ")}`);
    this.name = "PackBuildError";
  }
}

const encoder = new TextEncoder();
const json = (value: unknown): Uint8Array => encoder.encode(`${JSON.stringify(value, null, 2)}\n`);

function readJsonFiles(dir: string): unknown[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as unknown);
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

/** Loads the source layout described in the SDK README. Imports `abilities/index.ts` (its default export). */
export async function loadPackSource(srcDir: string): Promise<PackSource> {
  const author = JSON.parse(readFileSync(join(srcDir, "pack.json"), "utf8")) as PackAuthorManifest;
  const cards = readJsonFiles(join(srcDir, "cards")) as AnyCard[];
  const decks = readJsonFiles(join(srcDir, "decks")) as StarterDeck[];
  const scenarios = readJsonFiles(join(srcDir, "scenarios"));
  let abilities: AbilityRegistry = {};
  const abilitiesEntry = join(srcDir, "abilities", "index.ts");
  if (existsSync(abilitiesEntry)) {
    const module = (await import(/* @vite-ignore */ pathToFileURL(abilitiesEntry).href)) as {
      default?: AbilityRegistry;
    };
    if (!module.default) throw new Error("abilities/index.ts must export a default ability registry");
    abilities = module.default;
  }
  const assets = new Map<string, Uint8Array>();
  for (const full of walkFiles(join(srcDir, "art"))) {
    assets.set(relative(srcDir, full).split(sep).join("/"), new Uint8Array(readFileSync(full)));
  }
  for (const name of ["CREDITS.md", "PERMISSION.md"]) {
    const full = join(srcDir, name);
    if (existsSync(full)) assets.set(name, new Uint8Array(readFileSync(full)));
  }
  return { author, cards, abilities, decks, scenarios, assets };
}

const byCode = (a: AnyCard, b: AnyCard): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Assembles the built pack in memory: the data files, the filled-in manifest and the file map. Pure. */
export function assemblePack(source: PackSource): PackInput {
  const files = new Map<string, Uint8Array>();
  const cards = [...source.cards].sort(byCode);
  const abilities = Object.fromEntries(Object.entries(source.abilities).sort(([a], [b]) => (a < b ? -1 : 1)));
  const decks = [...source.decks].sort((a, b) => (a.id < b.id ? -1 : 1));
  files.set("data/cards.json", json(cards));
  if (Object.keys(abilities).length > 0) files.set("data/abilities.json", json(abilities));
  if (decks.length > 0) files.set("data/decks.json", json(decks));
  if (source.scenarios.length > 0) files.set("data/scenarios.json", json(source.scenarios));
  for (const [path, bytes] of source.assets) files.set(path, bytes);
  const sorted = [...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  const listed: PackFile[] = sorted.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256Hex(bytes) }));
  const { author } = source;
  const manifest: PackManifest = {
    schema: PACK_SCHEMA_VERSION,
    id: author.id,
    version: author.version,
    kind: author.kind,
    name: author.name,
    authors: author.authors,
    description: author.description,
    requires: {
      app: author.requires.app,
      dslFeatures: dslFeatures(abilities),
      packs: author.requires.packs ?? [],
    },
    contents: {
      cards: "data/cards.json",
      ...(files.has("data/abilities.json") ? { abilities: "data/abilities.json" } : {}),
      ...(files.has("data/scenarios.json") ? { scenarios: "data/scenarios.json" } : {}),
      ...(files.has("data/decks.json") ? { decks: "data/decks.json" } : {}),
    },
    ...(author.pictures ? { pictures: author.pictures } : {}),
    files: listed,
    totalBytes: listed.reduce((sum, file) => sum + file.bytes, 0),
    license: author.license,
  };
  return { manifest, files, cards, abilities, decks, scenarios: source.scenarios };
}

/**
 * A fixed zip timestamp (1980-01-01 12:00 local time, which is what the zip format stores), so builds are
 * reproducible. Noon keeps the stored date 1980-01-01 in every time zone.
 */
const ZIP_EPOCH = new Date(1980, 0, 1, 12);

/**
 * The pack's deterministic zip: `pack.json` first, then the files sorted by path, a fixed timestamp. Entries go in
 * through fflate's streaming `Zip` in an ordered array, not a `zipSync` object, whose integer-like keys JavaScript
 * would order ahead of `pack.json`.
 */
export function zipPack(manifest: PackManifest, files: ReadonlyMap<string, Uint8Array>): Uint8Array {
  const chunks: Uint8Array[] = [];
  let failure: Error | undefined;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else chunks.push(chunk);
  });
  const entries: [string, Uint8Array][] = [
    ["pack.json", json(manifest)],
    ...[...files.keys()].sort().map((path): [string, Uint8Array] => [path, files.get(path)!]),
  ];
  for (const [path, bytes] of entries) {
    const entry = new ZipDeflate(path, { level: 6 });
    entry.mtime = ZIP_EPOCH;
    zip.add(entry);
    entry.push(bytes, true);
  }
  zip.end();
  if (failure) throw failure;
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Builds the pack in `srcDir` into `outDir`: the data files, copied art, `pack.json` and `<id>-<version>.zip`. Throws
 * `PackBuildError` if the result is invalid. The same source gives the same zip bytes.
 */
export async function buildPack(srcDir: string, outDir: string, options: ValidateOptions = {}): Promise<BuildResult> {
  const source = await loadPackSource(srcDir);
  const pack = assemblePack(source);
  // Validate the bytes that ship: the manifest and data files read back, as a client reads an installed pack. (An
  // ability's flags are plain data, so the JSON round trip loses nothing the validator reads.)
  const issues = validatePack(readPackInput(pack.manifest, pack.files), options);
  if (issues.length > 0) throw new PackBuildError(issues);
  const write = (path: string, bytes: Uint8Array): void => {
    const full = join(outDir, ...path.split("/"));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  };
  for (const [path, bytes] of pack.files) write(path, bytes);
  write("pack.json", json(pack.manifest));
  const zip = zipPack(pack.manifest, pack.files);
  const zipPath = join(outDir, `${pack.manifest.id}-${pack.manifest.version}.zip`);
  write(`${pack.manifest.id}-${pack.manifest.version}.zip`, zip);
  return { manifest: pack.manifest, zipPath, zipBytes: zip.length, zipSha256: sha256Hex(zip) };
}
