/**
 * Which releases the landing page may show. A release's notes and report land on `main` (and so in the page's build)
 * when its release PR merges, but GitHub only publishes it once the desktop and Android builds are attached. The
 * history page (`public/releases/history.js`) stops its list at GitHub's latest release; the landing page's news and
 * its report screenshots follow the same rule, so neither announces a release before its downloads exist.
 */

/** "v0.45.0" → [0, 45, 0], or null for anything else. */
function partsOf(version: string): readonly number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

/**
 * Whether `version` is GitHub's latest release or older. With no latest tag (GitHub out of reach and none baked in at
 * build time) or one that can't be read, every release counts as published, as the history page does.
 */
export function isPublished(version: string, latestTag: string | null | undefined): boolean {
  const latest = latestTag ? partsOf(latestTag) : null;
  const own = partsOf(version);
  if (!latest || !own) return true;
  for (let i = 0; i < 3; i++) if (own[i] !== latest[i]) return own[i]! < latest[i]!;
  return true;
}

/** The entries that are published, in their own order. */
export function publishedOnly<T extends { readonly version: string }>(
  entries: readonly T[],
  latestTag: string | null | undefined,
): readonly T[] {
  return entries.filter((entry) => isPublished(entry.version, latestTag));
}
