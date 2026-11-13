#!/usr/bin/env node
/**
 * Smoke test of the published mod SDK tarball (`pnpm --filter @mc/mod-sdk build:dist` first, or pass --build): makes
 * a temp pack repo from content-packs/sample-hero that depends on the tarball the way a creator's repo does, then runs
 * what the registry's CI runs (marvel-champions-mods scripts/build-entry.sh):
 *
 *   npm ci --ignore-scripts
 *   npx --no-install mc-pack validate .
 *   npx --no-install mc-pack test .
 *   npx --no-install mc-pack build . --out <dir>
 *
 * plus `tsc --noEmit` over the pack's abilities (the SDK's types, as a consumer sees them) and an import of each
 * entry point. Needs the npm registry for the SDK's one dependency (jiti). Exits non-zero on the first failure.
 *
 *   node scripts/smoke-npm.mjs [--build] [--keep]
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SDK_DIR = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(SDK_DIR, "..", "..");
const OUT = join(SDK_DIR, "dist-npm");
const SAMPLE = join(ROOT, "content-packs", "sample-hero");

const run = (command, cwd) => {
  console.log(`\n$ ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
};

if (process.argv.includes("--build") || !existsSync(OUT)) run("node scripts/build-npm.mjs", SDK_DIR);
const tarballs = readdirSync(OUT)
  .filter((name) => name.endsWith(".tgz"))
  .map((name) => join(OUT, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
const tarball = tarballs[0];
if (!tarball) throw new Error(`no tarball in ${OUT}: run build:dist first`);
const { name } = JSON.parse(readFileSync(join(OUT, "package", "package.json"), "utf8"));
console.log(`smoke-testing ${tarball} (${name})`);

const repo = mkdtempSync(join(tmpdir(), "mc-mod-sdk-smoke-"));
let ok = false;
try {
  // The pack repo: the sample pack's files at its root, importing the SDK by its published name.
  cpSync(SAMPLE, repo, { recursive: true });
  const abilities = join(repo, "abilities", "index.ts");
  writeFileSync(abilities, readFileSync(abilities, "utf8").replaceAll('from "@mc/mod-sdk"', `from "${name}"`));
  writeFileSync(
    join(repo, "package.json"),
    `${JSON.stringify({ name: "sample-hero-pack", private: true, type: "module" }, null, 2)}\n`,
  );
  writeFileSync(
    join(repo, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "es2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        include: ["abilities/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  run(`npm install --no-audit --no-fund --save-dev "${tarball}"`, repo);
  // What the registry's CI does with the lockfile that install wrote.
  run("npm ci --ignore-scripts --no-audit --no-fund", repo);
  run("npx --no-install mc-pack --version", repo);
  run("npx --no-install mc-pack validate .", repo);
  run("npx --no-install mc-pack test .", repo);
  run("npx --no-install mc-pack build . --out build", repo);
  if (!existsSync(join(repo, "build", "pack.json"))) throw new Error("build wrote no pack.json");

  // The types as a consumer sees them: the pack's abilities typecheck against the installed declarations.
  const tsc = join(dirname(createRequire(join(ROOT, "package.json")).resolve("typescript/package.json")), "bin", "tsc");
  run(`"${process.execPath}" "${tsc}" -p tsconfig.json`, repo);

  // Every entry point loads in plain Node.
  const entries = ["", "/build", "/import", "/testing"].map((sub) => `${name}${sub}`);
  writeFileSync(
    join(repo, "entries.mjs"),
    entries.map((e, i) => `import * as e${i} from "${e}"; console.log("${e}", Object.keys(e${i}).length);`).join("\n"),
  );
  run("node entries.mjs", repo);
  ok = true;
  console.log("\nsmoke test passed");
} finally {
  if (process.argv.includes("--keep") || !ok) console.log(`pack repo left at ${repo}`);
  else rmSync(repo, { recursive: true, force: true });
}
