/**
 * Guards against reintroducing the WebGL no-op mask bug: `GameObject.setMask(
 * shape.createGeometryMask())` silently does nothing under WebGL in Phaser 4
 * (`Components.Mask#setMask` only logs a warning and returns — `GeometryMask`
 * became Canvas-only in v4). `ui/rex.ts`'s `setMask`/`clearMask` are the one
 * place allowed to touch either API; every other caller must go through them.
 *
 * A plain source scan rather than a runtime check: the bug is invisible at
 * runtime without a WebGL renderer (which Vitest has none of) — it just draws
 * nothing wrong until a real browser shows an unclipped list — so the only
 * reliable guard is "this pattern doesn't appear outside the one file that's
 * allowed to use it".
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
/** The only file allowed to name these APIs — everything else must go through its `setMask`/`clearMask` wrappers. */
const ALLOWED_FILE = join(SRC_DIR, "ui", "rex.ts");

function tsFilesUnder(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...tsFilesUnder(full));
    else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !full.endsWith(".test.ts"))
      files.push(full);
  }
  return files;
}

describe("no WebGL no-op masks outside ui/rex.ts", () => {
  const offenders: { file: string; line: number; text: string }[] = [];
  for (const file of tsFilesUnder(SRC_DIR)) {
    if (file === ALLOWED_FILE) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, index) => {
      // `.setMask(` on a Phaser GameObject (the built-in, WebGL-broken one) or
      // `.createGeometryMask(` (Canvas-only, so pointless to even build one
      // outside the one helper that branches on render mode). The app's own
      // `setMask`/`clearMask` (lowercase, imported by name from `ui/rex.ts`)
      // are fine anywhere — this only flags the raw Phaser APIs.
      if (/\.setMask\s*\(/.test(text) || /\.createGeometryMask\s*\(/.test(text)) {
        offenders.push({ file, line: index + 1, text: text.trim() });
      }
    });
  }

  test("every source file other than ui/rex.ts is clean", () => {
    expect(offenders, offenders.map((o) => `${o.file}:${o.line}: ${o.text}`).join("\n")).toEqual([]);
  });

  test("the guard itself finds a real violation when one exists (doesn't just always pass)", () => {
    const fakeText = "this.#rowLayer.setMask(this.#maskShape.createGeometryMask());";
    expect(/\.setMask\s*\(/.test(fakeText) || /\.createGeometryMask\s*\(/.test(fakeText)).toBe(true);
  });
});
