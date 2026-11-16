/**
 * Every release GitHub has for the game, for the download stats: the landing build counts them
 * (`vite.site.config.ts`) and the scheduled deploy's check reads them (`scripts/download-stats-changed.mjs`).
 */
import type { GitHubRelease } from "./download-stats.js";

const RELEASES_API = "https://api.github.com/repos/quincarter/marvel-champions-digital-game/releases";

/** Every release, a page of 100 at a time (the API's most); throws if GitHub can't be read. */
export async function fetchAllReleases(token?: string): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(`${RELEASES_API}?per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const batch = (await response.json()) as GitHubRelease[];
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return releases;
}
