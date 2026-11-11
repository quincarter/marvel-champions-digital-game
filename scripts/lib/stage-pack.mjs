import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Copies a community pack's folder to a scratch folder and, when its alternate-art pictures are not there (they are
 * git-ignored and fetched separately, so a fresh checkout and CI lack them), drops `altArt` from the copy's pack.json
 * so the build does not fail on unlisted files. Returns the scratch pack folder and the scratch root to delete.
 */
export function stagePackSource(packDir, name) {
  const root = mkdtempSync(join(tmpdir(), `mc-pack-src-${name}-`));
  const src = join(root, name);
  cpSync(packDir, src, { recursive: true });
  if (!existsSync(join(src, "alt-art"))) {
    const file = join(src, "pack.json");
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    delete manifest.altArt;
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return { src, root };
}
