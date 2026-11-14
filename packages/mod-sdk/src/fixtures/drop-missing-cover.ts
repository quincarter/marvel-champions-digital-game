import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A pack's store cover is git-ignored like its pictures, so a checkout without the art (CI) has a `cover` that names a
 * missing file. Tests that build a community pack from a scratch copy call this on the copy: it drops `cover` from
 * pack.json when the file is not there, as `community-packs.test.ts` and `scripts/lib/stage-pack.mjs` do.
 */
export function dropMissingCover(src: string): void {
  const file = join(src, "pack.json");
  const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  if (typeof manifest.cover !== "string" || existsSync(join(src, ...manifest.cover.split("/")))) return;
  delete manifest.cover;
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}
