/**
 * `destroyChildren` itself, plus a source scan that keeps `children.removeAll(`
 * out of the client: on a scene's display list that call destroys nothing
 * (see `destroy-children.ts`), and the leak it causes is invisible under
 * Vitest, which has no renderer to run out of textures.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { destroyChildren } from "./destroy-children.js";

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

function tsFilesUnder(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...tsFilesUnder(full));
    else if (entry.isFile() && full.endsWith(".ts") && !full.endsWith(".test.ts")) files.push(full);
  }
  return files;
}

describe("destroyChildren", () => {
  test("destroys every child, including ones a sibling's destroy already removed from the list", () => {
    const destroyed: string[] = [];
    const list: { name: string; destroy(): void }[] = [];
    const make = (name: string, alsoRemoves?: string) => ({
      name,
      destroy() {
        destroyed.push(name);
        for (const gone of [name, alsoRemoves]) {
          const index = list.findIndex((node) => node.name === gone);
          if (index >= 0) list.splice(index, 1);
        }
      },
    });
    list.push(make("sizer", "label"), make("label"), make("panel"));
    destroyChildren({ children: { list } });
    expect(destroyed).toEqual(["sizer", "label", "panel"]);
    expect(list).toEqual([]);
  });
});

describe("no scene clears its display list with children.removeAll(", () => {
  const offenders: string[] = [];
  for (const file of tsFilesUnder(SRC_DIR)) {
    readFileSync(file, "utf8").split("\n").forEach((text, index) => {
      const code = text.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
      if (/\bchildren\.removeAll\(/.test(code)) offenders.push(`${file.slice(SRC_DIR.length + 1)}:${index + 1}`);
    });
  }
  test("use destroyChildren(scene) instead", () => expect(offenders).toEqual([]));
});
