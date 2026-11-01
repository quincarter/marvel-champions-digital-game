/** The image types a normal scan may have, most common first. */
const SCAN_EXTENSIONS = [".png", ".webp", ".jpg", ".jpeg", ".avif"] as const;

/**
 * The normal scans a Balanced scan stands in for, in the order to try them: `bundles/cards/16106a-balanced-nokree.png`
 * gives `bundles/cards/16106a.png`, then the other image types, because a normal scan need not be a PNG. Empty for any
 * other path. Plain and import-free: `vite-card-art.ts` runs it in the build's Node process.
 */
export function normalScansFor(relative: string): readonly string[] {
  const match = /^(.*)-balanced(?:-[a-z]+)?\.[a-z]+$/.exec(relative);
  if (!match) return [];
  return SCAN_EXTENSIONS.map((extension) => `${match[1]}${extension}`);
}
