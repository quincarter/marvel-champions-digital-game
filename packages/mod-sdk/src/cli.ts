/**
 * The `mc-pack` command line (docs/custom-content-packs.md §11.2): `validate`, `build`, `test` and
 * `import-marvelcdb`. `runCli` does the work and returns the exit code; `bin.ts` is the executable that calls it.
 *
 * Exit codes: 0 success, 1 the pack has a problem (invalid, fails to load, a smoke game failed, an import the
 * normalizer rejected), 2 a usage error (unknown command, missing argument).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PackBuildError, assemblePack, buildPack, loadPackSource } from "./build.js";
import { formatImportReport, importMarvelCdbPack } from "./import-marvelcdb.js";
import { packModuleImporter } from "./loader.js";
import { SMOKE_BASE_DECK, SMOKE_SCENARIOS, smokeTestPack, type SmokeGame } from "./smoke.js";
import { readPackInput, splitIssues, validatePack, type PackInput, type PackIssue } from "./validate.js";

export const EXIT_OK = 0;
export const EXIT_PACK_PROBLEM = 1;
export const EXIT_USAGE = 2;

export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const consoleIo: CliIo = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

const USAGE = `mc-pack: build, check and test Marvel Champions Digital content packs

Usage:
  mc-pack validate <dir> [--allow-unscripted]
      Check the pack source in <dir>. --allow-unscripted passes a pack whose only problems are abilities
      that are not scripted yet (an imported pack being worked on); build and test never allow them.
  mc-pack build <dir> --out <dir>
      Validate, then write the built pack, pack.json and the deterministic <id>-<version>.zip.
  mc-pack test <dir> [--games <n>] [--scenario <${SMOKE_SCENARIOS.join("|")}>] [--max-commands <n>]
      Play <n> (default 3) headless games of each of the pack's decks against a Core scenario (default rhino).
      Fails on an engine error or a stuck game.
  mc-pack import-marvelcdb <src> [--out <dir>] [--id <pack-id>] [--app <range>]
      Convert a MarvelCDB-shaped community pack folder into a pack source folder. Without --out, a dry run.
  mc-pack --version | --help

Exit codes: 0 success, 1 the pack has a problem, 2 usage error.`;

class UsageError extends Error {}

interface Parsed {
  readonly positional: readonly string[];
  readonly flags: ReadonlyMap<string, string | true>;
}

const VALUE_FLAGS = new Set(["out", "games", "scenario", "max-commands", "id", "app"]);
const BOOLEAN_FLAGS = new Set(["allow-unscripted", "help", "version"]);

function parseArgs(argv: readonly string[]): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h") flags.set("help", true);
    else if (arg === "-v") flags.set("version", true);
    else if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = eq < 0 ? arg.slice(2) : arg.slice(2, eq);
      if (BOOLEAN_FLAGS.has(name)) {
        if (eq >= 0) throw new UsageError(`--${name} takes no value`);
        flags.set(name, true);
      } else if (VALUE_FLAGS.has(name)) {
        const value = eq >= 0 ? arg.slice(eq + 1) : argv[++i];
        if (value === undefined || value === "") throw new UsageError(`--${name} needs a value`);
        flags.set(name, value);
      } else throw new UsageError(`unknown option --${name}`);
    } else positional.push(arg);
  }
  return { positional, flags };
}

const value = (parsed: Parsed, name: string): string | undefined => {
  const v = parsed.flags.get(name);
  return typeof v === "string" ? v : undefined;
};

function positiveInt(parsed: Parsed, name: string): number | undefined {
  const raw = value(parsed, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`--${name} must be a whole number of at least 1`);
  return n;
}

function packDir(parsed: Parsed, command: string): string {
  const [dir, ...extra] = parsed.positional;
  if (dir === undefined) throw new UsageError(`${command} needs a folder`);
  if (extra.length > 0) throw new UsageError(`${command} takes one folder, got ${parsed.positional.length}`);
  const full = resolve(dir);
  if (!existsSync(full)) throw new UsageError(`${dir}: no such folder`);
  return full;
}

function allowOnly(parsed: Parsed, command: string, allowed: readonly string[]): void {
  for (const name of parsed.flags.keys()) {
    if (!allowed.includes(name)) throw new UsageError(`${command} does not take --${name}`);
  }
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Loads and assembles the pack, then reads it back as a client reads the shipped bytes. */
async function loadBuilt(dir: string): Promise<PackInput> {
  const pack = assemblePack(await loadPackSource(dir, { importModule: packModuleImporter() }));
  return readPackInput(pack.manifest, pack.files);
}

/** The issues as lines, real defects first, then the abilities still to script as their own group. */
export function formatIssues(issues: readonly PackIssue[]): string[] {
  const { defects, unscripted } = splitIssues(issues);
  const lines: string[] = [];
  if (defects.length > 0) {
    lines.push(`${defects.length} problem${defects.length === 1 ? "" : "s"}:`);
    for (const issue of defects) lines.push(`  ${issue.path}: ${issue.message}`);
  }
  if (unscripted.length > 0) {
    lines.push(
      `${unscripted.length} unscripted abilit${unscripted.length === 1 ? "y" : "ies"} (write them in abilities/):`,
    );
    for (const issue of unscripted) lines.push(`  ${issue.path}: ${issue.message}`);
  }
  return lines;
}

async function validateCommand(parsed: Parsed, io: CliIo): Promise<number> {
  allowOnly(parsed, "validate", ["allow-unscripted"]);
  const dir = packDir(parsed, "validate");
  const pack = await loadBuilt(dir);
  const issues = validatePack(pack);
  const { defects, unscripted } = splitIssues(issues);
  const name = `${pack.manifest.id}@${pack.manifest.version}`;
  if (issues.length === 0) {
    io.out(`${name}: valid (${pack.cards.length} cards, ${Object.keys(pack.abilities).length} abilities)`);
    return EXIT_OK;
  }
  const lines = formatIssues(issues);
  if (defects.length === 0 && parsed.flags.has("allow-unscripted")) {
    io.out(`${name}: valid, ${unscripted.length} abilit${unscripted.length === 1 ? "y" : "ies"} to script`);
    for (const line of lines) io.out(line);
    return EXIT_OK;
  }
  io.err(`${name}: invalid`);
  for (const line of lines) io.err(line);
  return EXIT_PACK_PROBLEM;
}

async function buildCommand(parsed: Parsed, io: CliIo): Promise<number> {
  allowOnly(parsed, "build", ["out"]);
  const dir = packDir(parsed, "build");
  const out = value(parsed, "out");
  if (out === undefined) throw new UsageError("build needs --out <dir>");
  try {
    const result = await buildPack(dir, resolve(out), { importModule: packModuleImporter() });
    const { manifest } = result;
    io.out(`${manifest.id}@${manifest.version}: built ${result.zipPath}`);
    io.out(`  ${result.zipBytes} bytes, sha256 ${result.zipSha256}`);
    io.out(`  ${manifest.files.length} files, ${manifest.totalBytes} bytes unzipped`);
    io.out(
      `  requires app ${manifest.requires.app}; DSL features: ${manifest.requires.dslFeatures.join(", ") || "none"}`,
    );
    return EXIT_OK;
  } catch (error) {
    if (!(error instanceof PackBuildError)) throw error;
    io.err("build failed: the pack is invalid");
    for (const line of formatIssues(error.issues)) io.err(line);
    return EXIT_PACK_PROBLEM;
  }
}

const describeGame = (game: SmokeGame): string => {
  // A pack hero's precon plays the Core scenario; a base precon is there to play the pack's scenario or modular set.
  const where =
    game.deck === SMOKE_BASE_DECK
      ? ` at ${game.campaign ? `${game.campaign}/${game.node} (${game.scenario})` : game.scenario}${game.modularSet ? ` with ${game.modularSet}` : ""}${game.difficulty ? `, ${game.difficulty}` : ""}`
      : "";
  const head = `  ${game.deck}${where} seed ${game.seed}: `;
  if (!game.ok) return `${head}FAILED: ${game.error ?? "unknown error"}`;
  const played =
    game.packCardsPlayed.length > 0 ? `; pack cards played or revealed: ${game.packCardsPlayed.join(", ")}` : "";
  return `${head}${game.outcome ?? "ended"} in round ${game.rounds} (${game.commands} commands)${played}`;
};

async function testCommand(parsed: Parsed, io: CliIo): Promise<number> {
  allowOnly(parsed, "test", ["games", "scenario", "max-commands"]);
  const dir = packDir(parsed, "test");
  const scenario = value(parsed, "scenario") ?? "rhino";
  if (!SMOKE_SCENARIOS.includes(scenario))
    throw new UsageError(`--scenario must be one of ${SMOKE_SCENARIOS.join(", ")}`);
  const games = positiveInt(parsed, "games") ?? 3;
  const maxCommands = positiveInt(parsed, "max-commands");
  const pack = await loadBuilt(dir);
  // A pack that does not validate is not played: its failures would only restate the validation issues.
  const issues = validatePack(pack);
  if (issues.length > 0) {
    io.err(`${pack.manifest.id}: not tested, the pack is invalid (run mc-pack validate)`);
    for (const line of formatIssues(issues)) io.err(line);
    return EXIT_PACK_PROBLEM;
  }
  io.out(
    `${pack.manifest.id}@${pack.manifest.version}: ${games} game(s) per deck, scenario and modular set (Core scenario: ${scenario})`,
  );
  const result = smokeTestPack(pack, {
    games,
    scenario,
    ...(maxCommands !== undefined ? { maxCommands } : {}),
    onGame: (game) => (game.ok ? io.out : io.err)(describeGame(game)),
  });
  for (const note of result.notes) io.out(`note: ${note}`);
  const failed = result.games.filter((g) => !g.ok).length;
  if (failed > 0) {
    io.err(`${failed} of ${result.games.length} game(s) failed`);
    return EXIT_PACK_PROBLEM;
  }
  io.out(`all ${result.games.length} game(s) passed`);
  return EXIT_OK;
}

async function importCommand(parsed: Parsed, io: CliIo): Promise<number> {
  allowOnly(parsed, "import-marvelcdb", ["out", "id", "app"]);
  const src = packDir(parsed, "import-marvelcdb");
  const out = value(parsed, "out");
  const packId = value(parsed, "id");
  const app = value(parsed, "app");
  const report = await importMarvelCdbPack(src, {
    ...(out !== undefined ? { outDir: resolve(out) } : {}),
    ...(packId !== undefined ? { packId } : {}),
    ...(app !== undefined ? { app } : {}),
  });
  const text = formatImportReport(report);
  if (!report.normalized || report.validationIssues.length > 0) {
    io.err(text);
    return EXIT_PACK_PROBLEM;
  }
  io.out(text);
  if (report.unscriptedIssues.length > 0) {
    io.out(`${report.unscriptedIssues.length} abilities to script, listed in abilities/index.ts:`);
    for (const issue of report.unscriptedIssues) io.out(`  ${issue.path}: ${issue.message}`);
  }
  io.out(report.outDir ? `written to ${report.outDir}` : "dry run: nothing written (pass --out <dir>)");
  return EXIT_OK;
}

const COMMANDS: Record<string, (parsed: Parsed, io: CliIo) => Promise<number>> = {
  validate: validateCommand,
  build: buildCommand,
  test: testCommand,
  "import-marvelcdb": importCommand,
};

/** Runs `mc-pack` with `argv` (the arguments after the program name). Never throws; returns the exit code. */
export async function runCli(argv: readonly string[], io: CliIo = consoleIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === undefined || command === "--help" || command === "-h" || command === "help") {
      io.out(USAGE);
      return command === undefined ? EXIT_USAGE : EXIT_OK;
    }
    if (command === "--version" || command === "-v") {
      io.out(process.env.MC_SDK_VERSION ?? "dev");
      return EXIT_OK;
    }
    const run = COMMANDS[command];
    if (!run) throw new UsageError(`unknown command "${command}"`);
    const parsed = parseArgs(rest);
    if (parsed.flags.has("help")) {
      io.out(USAGE);
      return EXIT_OK;
    }
    return await run(parsed, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`mc-pack: ${error.message}`);
      io.err("run mc-pack --help for usage");
      return EXIT_USAGE;
    }
    // Anything else is the pack failing to load: bad JSON, an abilities module that throws (definePackAbilities
    // rejects a broken ability), a missing pack.json.
    io.err(`mc-pack ${command}: ${errorText(error)}`);
    return EXIT_PACK_PROBLEM;
  }
}
