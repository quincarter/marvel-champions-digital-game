/**
 * Node-only: type-checks a pack's `abilities/` with the TypeScript compiler, for `mc-pack validate` (issue #943).
 *
 * The loader (`./loader.ts`) runs a pack's TypeScript with jiti, which strips the types without checking them, so a
 * call such as `gainsKeyword("guard", …)` (a bare string where the DSL takes a `KeywordInstance`) loaded, validated and
 * then crashed the game. This runs `tsc --noEmit` over the pack's abilities with a generated tsconfig and reports each
 * error in the pack's own files as a validate issue.
 *
 * tsc runs as a child process (TypeScript 7 is a native compiler with no in-process checker API to call). It is found
 * from the SDK's own location first: the published package depends on the TypeScript version its declarations were
 * written by (scripts/build-npm.mjs), so a creator's `npm ci` brings it. The pack's own install is the fallback.
 *
 * The generated tsconfig maps every name the SDK may be imported by (`@mc/mod-sdk`, the published name) to the SDK's
 * own types, as the loader's `virtualModules` do for the code: a pack in the Mod Store registry imports `@mc/mod-sdk`
 * with no package of that name installed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sdkModuleNames } from "./loader.js";
import type { PackIssue } from "./validate.js";

/** tsc could not be found or could not run: the pack was not checked (not a defect in the pack). */
export class TypecheckUnavailableError extends Error {}

export interface TypecheckOptions {
  /** The tsc entry script (`typescript/bin/tsc`) to run with Node. Default: found as described above. */
  readonly tsc?: string;
  /** The `.ts` / `.d.ts` file the SDK's import names resolve to. Default: the SDK package's `types`. */
  readonly sdkTypes?: string;
}

/** The nearest folder at or above `from` with a package.json, and that package.json. */
function nearestPackage(from: string): { readonly dir: string; readonly json: Record<string, unknown> } | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const file = join(dir, "package.json");
    if (existsSync(file)) return { dir, json: JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown> };
    if (dirname(dir) === dir) return undefined;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The SDK's type entry: `types` of the package this module is part of (`./src/index.ts` in this repo,
 * `./types/mod-sdk/src/index.d.ts` in the published package, whose bundle runs from `dist/` or `dist/chunks/`).
 */
export function sdkTypesEntry(): string {
  const pkg = nearestPackage(HERE);
  const types = pkg?.json.types;
  if (!pkg || typeof types !== "string") throw new TypecheckUnavailableError("cannot find the SDK's own type entry");
  const entry = join(pkg.dir, types);
  if (!existsSync(entry)) throw new TypecheckUnavailableError(`the SDK's type entry ${entry} is missing`);
  return entry;
}

/** `typescript/bin/tsc`, resolved from the SDK first, then from the pack's folder. */
export function findTsc(packDir: string): string {
  for (const from of [join(HERE, "package.json"), join(packDir, "package.json")]) {
    try {
      const manifest = createRequire(from).resolve("typescript/package.json");
      const bin = (JSON.parse(readFileSync(manifest, "utf8")) as { bin?: { tsc?: string } }).bin?.tsc;
      if (bin) return join(dirname(manifest), bin);
    } catch {
      // Not installed there; try the next place.
    }
  }
  throw new TypecheckUnavailableError(
    "TypeScript is not installed, so the pack's abilities cannot be type-checked: install the SDK's dependencies " +
      "(npm ci), add typescript to the pack's devDependencies, or pass --skip-typecheck",
  );
}

const hasTypeScript = (dir: string): boolean =>
  readdirSync(dir).some((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? name !== "node_modules" && hasTypeScript(full) : /\.[cm]?ts$/.test(name);
  });

/** One `file(line,col): error TSnnnn: message` from `tsc --pretty false`, with any indented continuation lines. */
const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const GLOBAL_ERROR = /^error (TS\d+): (.*)$/;

/**
 * Type-checks the pack in `packDir` (its `abilities/**\/*.ts`, and what they import) and returns one issue per type
 * error in the pack's own files, at `abilities/<file>:<line>:<col>`. A pack with no `abilities/` folder has nothing to
 * check. Throws `TypecheckUnavailableError` when tsc is missing or fails to run.
 */
export function typecheckPack(packDir: string, options: TypecheckOptions = {}): readonly PackIssue[] {
  const root = resolve(packDir);
  const abilitiesDir = join(root, "abilities");
  if (!existsSync(abilitiesDir) || !hasTypeScript(abilitiesDir)) return [];
  const tsc = options.tsc ?? findTsc(root);
  const sdkTypes = options.sdkTypes ?? sdkTypesEntry();
  const slash = (path: string): string => path.split(sep).join("/");
  // The tsconfig lives outside the pack, so nothing is written into the creator's folder.
  const work = mkdtempSync(join(tmpdir(), "mc-pack-typecheck-"));
  try {
    const config = {
      compilerOptions: {
        target: "es2022",
        module: "preserve",
        moduleResolution: "bundler",
        lib: ["es2023", "dom"],
        strict: true,
        noEmit: true,
        // A pack may import its own files as `./x.ts`, as jiti allows.
        allowImportingTsExtensions: true,
        // The SDK's declarations are checked when they are built; only the pack's code is under test.
        skipLibCheck: true,
        types: [],
        paths: Object.fromEntries(sdkModuleNames().map((name) => [name, [slash(sdkTypes)]])),
      },
      include: [`${slash(abilitiesDir)}/**/*.ts`, `${slash(abilitiesDir)}/**/*.mts`, `${slash(abilitiesDir)}/**/*.cts`],
    };
    const project = join(work, "tsconfig.json");
    writeFileSync(project, JSON.stringify(config, null, 2));
    const run = spawnSync(process.execPath, [tsc, "-p", project, "--pretty", "false"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (run.error) throw new TypecheckUnavailableError(`tsc failed to run: ${run.error.message}`);
    const lines = `${run.stdout ?? ""}${run.stderr ?? ""}`.split(/\r?\n/);
    const issues: PackIssue[] = [];
    const globals: string[] = [];
    // The issue the next indented line continues (a chained message), or -1 after a diagnostic outside the pack.
    let open = -1;
    for (const line of lines) {
      const diagnostic = DIAGNOSTIC.exec(line);
      if (diagnostic) {
        const [, file, row, col, code, message] = diagnostic;
        const rel = relative(root, resolve(root, file!));
        // Only the pack's own files: an error in the SDK is not the pack's to fix.
        const inPack = !rel.startsWith("..") && !isAbsolute(rel) && !rel.split(sep).includes("node_modules");
        open = inPack ? issues.push({ path: `${slash(rel)}:${row}:${col}`, message: `${code}: ${message}` }) - 1 : -1;
        continue;
      }
      const global = GLOBAL_ERROR.exec(line);
      if (global) {
        globals.push(`${global[1]}: ${global[2]}`);
        open = -1;
      } else if (open >= 0 && /^\s+\S/.test(line)) {
        const issue = issues[open]!;
        issues[open] = { ...issue, message: `${issue.message} ${line.trim()}` };
      }
    }
    if (globals.length > 0) throw new TypecheckUnavailableError(`tsc could not check the pack: ${globals.join("; ")}`);
    // A non-zero exit with no diagnostic at all is tsc itself failing, not the pack.
    if (run.status !== 0 && !lines.some((line) => DIAGNOSTIC.test(line))) {
      const head = lines.filter(Boolean).slice(0, 5).join(" ");
      throw new TypecheckUnavailableError(`tsc exited ${run.status ?? run.signal}: ${head || "no output"}`);
    }
    return issues;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
