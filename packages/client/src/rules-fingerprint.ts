import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * The rules fingerprint (`RoomBuild.rules`): a short stable hash over the source that decides how a game plays out,
 * `packages/{engine,cards,content}/src`. Live rooms are host-authoritative and a guest replays the host's log, so two
 * builds with the same version strings but different rules code desync. The versions cannot tell them apart (a Netlify
 * preview and a release share one); this can.
 *
 * Tests, docs and anything that is not source or card data are left out, and CRLF is read as LF, so a Windows and a
 * Linux checkout of the same commit agree. Native wrappers bundle the same web build, so they carry the same value.
 */

/**
 * Where that source lives, relative to `packages/`. Besides the three rules packages: the mod SDK, and the client code
 * that turns a session config into a game (the engine host, the card pool and its deps, pack compilation). UI, scenes
 * and views stay out, so a UI-only change does not split players.
 */
export const RULES_ROOTS: readonly string[] = [
  "engine/src",
  "cards/src",
  "content/src",
  "mod-sdk/src",
  "client/src/engine",
  "client/src/content",
  "client/src/packs",
];

/** Source that decides game behavior: TypeScript and the card data JSON; not tests, not docs. */
export function isRulesSource(path: string): boolean {
  const name = path.replaceAll("\\", "/");
  if (/\.(test|spec)\.tsx?$/.test(name)) return false;
  return /\.(ts|json)$/.test(name) && !name.endsWith(".d.ts");
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && isRulesSource(full)) out.push(full);
  }
}

/** The fingerprint of the files under each of `roots`: 16 hex characters of a sha-256. */
export function rulesFingerprintOf(roots: readonly string[]): string {
  const hash = createHash("sha256");
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const files: string[] = [];
    walk(root, files);
    const keyed = files.map((f) => ({ f, key: relative(root, f).split(sep).join("/") }));
    // Code-unit order, not locale order, so the result does not depend on the machine.
    keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (const { f, key } of keyed) {
      hash.update(`${key}\0`);
      hash.update(readFileSync(f, "utf8").replaceAll("\r\n", "\n"));
      hash.update("\0");
    }
    hash.update("|");
  }
  return hash.digest("hex").slice(0, 16);
}
