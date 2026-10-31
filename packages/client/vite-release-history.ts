import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { spanishReport } from "./src/view/release-report-spanish.js";
import {
  buildReleaseHistory,
  buildSpanishReleaseHistory,
  SPANISH_REPORT_FILE,
  type ReleaseHighlight,
  type ReleaseHistory,
} from "./src/view/release-history-notes.js";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const PUBLIC_RELEASES = resolve(import.meta.dirname, "public/releases");
const OUT_DIR = join(PUBLIC_RELEASES, "history");
const SPANISH_DIR = join(REPO_ROOT, "docs/releases/es");
const SPANISH_REPORTS_DIR = join(SPANISH_DIR, "reports");

/** Writes each report's `index.es.html` (not in git) from its page and text map, and says which versions have one. */
function writeSpanishReports(): Set<string> {
  const written = new Set<string>();
  for (const name of readdirSync(SPANISH_REPORTS_DIR)) {
    const version = name.replace(/\.json$/, "");
    const texts = JSON.parse(readFileSync(join(SPANISH_REPORTS_DIR, name), "utf8")) as Record<string, string>;
    const page = readFileSync(join(PUBLIC_RELEASES, version, "index.html"), "utf8");
    writeFileSync(join(PUBLIC_RELEASES, version, SPANISH_REPORT_FILE), spanishReport(page, texts));
    written.add(version);
  }
  return written;
}

/** One language's data into `dir`, in place, file by file. */
function writeHistoryFiles(dir: string, { manifest, notes }: ReleaseHistory): void {
  // A running dev server or a second generator (e2e beside a dev server) never sees a gap.
  mkdirSync(dir, { recursive: true });
  const files = new Map<string, unknown>([["manifest.json", manifest]]);
  for (const release of notes) files.set(`${release.version}.json`, release);
  for (const [name, data] of files) {
    const temp = join(dir, `${name}.${process.pid}.tmp`);
    writeFileSync(temp, JSON.stringify(data));
    renameSync(temp, join(dir, name));
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && !entry.name.endsWith(".tmp") && !files.has(entry.name)) rmSync(join(dir, entry.name));
  }
}

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
  const translations: Record<string, string> = {};
  for (const version of versions) {
    const file = join(SPANISH_DIR, `${version}.md`);
    if (existsSync(file)) translations[version] = readFileSync(file, "utf8");
  }
  const sources = {
    changelogs: versions.map((version) => readFileSync(join(changes, `${version}.md`), "utf8")),
    backfill: JSON.parse(readFileSync(join(REPO_ROOT, "docs/releases/history.json"), "utf8")) as Record<
      string,
      ReleaseHighlight
    >,
    headers,
    reports: new Set(versions.filter((version) => existsSync(join(PUBLIC_RELEASES, version, "index.html")))),
    translations,
    spanishReports: writeSpanishReports(),
  };
  writeHistoryFiles(OUT_DIR, buildReleaseHistory(sources));
  writeHistoryFiles(join(OUT_DIR, "es"), buildSpanishReleaseHistory(sources));
}

/** Runs from `config` because the dev server lists `public/` before `buildStart`, and would miss a new file. */
export function releaseHistoryPlugin(): Plugin {
  return { name: "mc-release-history", config: writeReleaseHistory };
}
