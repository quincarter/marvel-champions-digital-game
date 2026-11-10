#!/usr/bin/env node
/**
 * Builds the published mod SDK (docs/custom-content-packs.md §11.2) into packages/mod-sdk/dist-npm/:
 *
 *   dist-npm/package/   the npm package: dist/*.js (esbuild bundle carrying the engine, cards and content code, so it
 *                       needs none of this repo's private @mc/* packages), types/ (tsc's declarations with the @mc/*
 *                       specifiers rewritten to relative paths), package.json, README.md, LICENSE
 *   dist-npm/<name>-<version>.tgz   `npm pack` of it
 *
 *   node scripts/build-npm.mjs [--name <npm name>] [--version <x.y.z>] [--no-pack]
 *
 * The name defaults to MC_SDK_PACKAGE_NAME or @champions-digital-game/mod-sdk; the version to MC_SDK_VERSION or the
 * app's version (the root package.json, which the release PR bumps). Prints the tarball's path last.
 */
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const SDK_DIR = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(SDK_DIR, "..", "..");
const OUT = join(SDK_DIR, "dist-npm");
const PKG = join(OUT, "package");
const RAW_TYPES = join(OUT, "types-raw");
const DEFAULT_NAME = "@champions-digital-game/mod-sdk";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const rootPkg = readJson(join(ROOT, "package.json"));
const sdkPkg = readJson(join(SDK_DIR, "package.json"));
const name = arg("name") ?? process.env.MC_SDK_PACKAGE_NAME ?? DEFAULT_NAME;
const version = arg("version") ?? process.env.MC_SDK_VERSION ?? rootPkg.version;
if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) throw new Error(`bad package name ${name}`);
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`bad version ${version}`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(PKG, { recursive: true });

// 1. The JavaScript: one ESM bundle per entry, sharing chunks. jiti stays a real dependency (it loads Babel lazily
// from its own files, which a bundle would break).
const t0 = Date.now();
await build({
  absWorkingDir: SDK_DIR,
  entryPoints: {
    index: "src/index.ts",
    build: "src/build.ts",
    import: "npm/import.ts",
    testing: "npm/testing.ts",
    "mc-pack": "npm/bin.ts",
  },
  outdir: join(PKG, "dist"),
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["jiti"],
  chunkNames: "chunks/[name]-[hash]",
  minifyWhitespace: true,
  minifySyntax: true,
  legalComments: "none",
  define: {
    "process.env.MC_SDK_PACKAGE_NAME": JSON.stringify(name),
    "process.env.MC_SDK_VERSION": JSON.stringify(version),
  },
  logLevel: "warning",
});
console.log(`bundled in ${Date.now() - t0} ms`);

// 2. The types: tsc's declarations for the entries and everything they reach (tsconfig.npm.json maps @mc/* to the
// workspace sources so those are emitted too), then every @mc/* specifier rewritten to a relative path.
const tsc = join(dirname(createRequire(join(ROOT, "package.json")).resolve("typescript/package.json")), "bin", "tsc");
execFileSync(process.execPath, [tsc, "-p", join(SDK_DIR, "tsconfig.npm.json")], { stdio: "inherit" });

const SPECIFIERS = {
  "@mc/content": "content/src/index.js",
  "@mc/engine": "engine/src/index.js",
  "@mc/cards": "cards/src/index.js",
  "@mc/cards/testing": "cards/src/testing/index.js",
};
// What ships: the SDK's own declarations (not the npm/ entries' internals) and the packages they reach. The content
// package's scripts folder is the importer's normalizer, which no public type names.
const SHIPPED = ["mod-sdk/src", "mod-sdk/npm/testing.d.ts", "engine/src", "cards/src", "content/src"];
const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const TYPES = join(PKG, "types");
let typeFiles = 0;
for (const shipped of SHIPPED) {
  const from = join(RAW_TYPES, ...shipped.split("/"));
  const files = shipped.endsWith(".d.ts") ? [from] : walk(from);
  for (const file of files) {
    if (!file.endsWith(".d.ts")) continue;
    const rel = relative(RAW_TYPES, file).split(sep).join("/");
    if (rel === "mod-sdk/src/bin.d.ts") continue;
    const depth = rel.split("/").length - 1;
    const up = depth === 0 ? "./" : "../".repeat(depth);
    const text = readFileSync(file, "utf8")
      .replace(/(from\s+|import\()"(@mc\/[a-z-]+(?:\/[a-z-]+)?)"/g, (match, lead, spec) => {
        const target = SPECIFIERS[spec];
        if (!target) throw new Error(`${rel}: no mapping for ${spec}`);
        return `${lead}"${up}${target}"`;
      })
      // The npm/ entries import their siblings with .ts extensions; a consumer's tsc wants .js.
      .replace(/(from\s+|import\()"(\.{1,2}\/[^"]+)\.ts"/g, '$1"$2.js"');
    const dest = join(TYPES, ...rel.split("/"));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
    typeFiles++;
  }
}
rmSync(RAW_TYPES, { recursive: true, force: true });
console.log(`types: ${typeFiles} declaration files`);

// 3. package.json, README, LICENSE.
const types = (path) => `./types/${path}`;
const manifest = {
  name,
  version,
  description:
    "The mod SDK for Marvel Champions Digital content packs: the pack schema, the ability DSL, and the mc-pack " +
    "validate, build, test and import-marvelcdb tools.",
  keywords: ["card-game", "mod", "sdk", "content-pack"],
  license: "AGPL-3.0-or-later",
  homepage: "https://github.com/quincarter/marvel-champions-digital-game/tree/main/packages/mod-sdk#readme",
  bugs: rootPkg.bugs,
  repository: { ...rootPkg.repository, directory: "packages/mod-sdk" },
  type: "module",
  engines: { node: ">=20.19" },
  bin: { "mc-pack": "./dist/mc-pack.js" },
  main: "./dist/index.js",
  types: types("mod-sdk/src/index.d.ts"),
  exports: {
    ".": { types: types("mod-sdk/src/index.d.ts"), default: "./dist/index.js" },
    "./build": { types: types("mod-sdk/src/build.d.ts"), default: "./dist/build.js" },
    "./import": { types: types("mod-sdk/src/import-marvelcdb.d.ts"), default: "./dist/import.js" },
    "./testing": { types: types("mod-sdk/npm/testing.d.ts"), default: "./dist/testing.js" },
    "./package.json": "./package.json",
  },
  files: ["dist", "types", "README.md", "LICENSE"],
  dependencies: { jiti: sdkPkg.dependencies.jiti },
  publishConfig: { access: "public" },
};
writeFileSync(join(PKG, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const readme = readFileSync(join(SDK_DIR, "npm", "README.md"), "utf8")
  .replaceAll("{{name}}", name)
  .replaceAll("{{version}}", version);
writeFileSync(join(PKG, "README.md"), readme);
copyFileSync(join(ROOT, "LICENSE"), join(PKG, "LICENSE"));

// 4. The tarball.
if (!process.argv.includes("--no-pack")) {
  // Through the shell, so Windows finds npm.cmd; the one argument that varies is a quoted path.
  const out = execSync(`npm pack --json --pack-destination "${OUT}"`, { cwd: PKG, encoding: "utf8" });
  const [packed] = JSON.parse(out);
  const tarball = join(OUT, packed.filename);
  console.log(`packed ${packed.entryCount} files, ${packed.size} bytes (${packed.unpackedSize} unpacked)`);
  console.log(tarball);
}
