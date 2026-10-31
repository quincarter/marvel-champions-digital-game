import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { buildReleaseHistory, type ReleaseHighlight } from "./src/view/release-history-notes.js";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const PUBLIC_RELEASES = resolve(import.meta.dirname, "public/releases");
const OUT_DIR = join(PUBLIC_RELEASES, "history");

/** Writes the release history page's data (`public/releases/history/`, not in git) from the changelog. */
export function writeReleaseHistory(): void {
  const changes = join(REPO_ROOT, ".changes");
  const versions = readdirSync(changes)
    .filter((name) => /^v[\d.]+\.md$/.test(name))
    .map((name) => name.replace(/\.md$/, ""));
  const headers: Record<string, string> = {};
  for (const version of versions) {
    const header = join(REPO_ROOT, "docs/screenshots/releases", version, "release-notes-header.md");
    if (existsSync(header)) headers[version] = readFileSync(header, "utf8");
  }
  const { manifest, notes } = buildReleaseHistory({
    changelogs: versions.map((version) => readFileSync(join(changes, `${version}.md`), "utf8")),
    backfill: JSON.parse(readFileSync(join(REPO_ROOT, "docs/releases/history.json"), "utf8")) as Record<
      string,
      ReleaseHighlight
    >,
    headers,
    reports: new Set(versions.filter((version) => existsSync(join(PUBLIC_RELEASES, version, "index.html")))),
  });
  // In place, file by file: a running dev server or a second generator (e2e beside a dev server) never sees a gap.
  mkdirSync(OUT_DIR, { recursive: true });
  const files = new Map<string, unknown>([["manifest.json", manifest]]);
  for (const release of notes) files.set(`${release.version}.json`, release);
  for (const [name, data] of files) {
    const temp = join(OUT_DIR, `${name}.${process.pid}.tmp`);
    writeFileSync(temp, JSON.stringify(data));
    renameSync(temp, join(OUT_DIR, name));
  }
  for (const name of readdirSync(OUT_DIR)) if (!name.endsWith(".tmp") && !files.has(name)) rmSync(join(OUT_DIR, name));
}

/** Runs from `config` because the dev server lists `public/` before `buildStart`, and would miss a new file. */
export function releaseHistoryPlugin(): Plugin {
  return { name: "mc-release-history", config: writeReleaseHistory };
}
