import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest));
  for (const release of notes) writeFileSync(join(OUT_DIR, `${release.version}.json`), JSON.stringify(release));
}

/** Runs from `config` because the dev server lists `public/` before `buildStart`, and would miss a new file. */
export function releaseHistoryPlugin(): Plugin {
  return { name: "mc-release-history", config: writeReleaseHistory };
}
