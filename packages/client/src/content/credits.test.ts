import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CREDITS, creditGaps } from "./credits.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const NOTE = /^(SOURCE|CREDITS)\.md$/i;

function notesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...notesUnder(path));
    else if (NOTE.test(name)) found.push(relative(root, dir).split(sep).join("/"));
  }
  return found;
}

const covered = (folder: string): boolean =>
  CREDITS.some((entry) => entry.folders?.some((f) => folder === f || folder.startsWith(`${f}/`)));

describe("credits cover the art folders", () => {
  it("has an entry for every folder holding a SOURCE.md or CREDITS.md", () => {
    const folders = notesUnder(join(root, "art"));
    expect(folders.length).toBeGreaterThan(0);
    expect(folders.filter((folder) => !covered(folder))).toEqual([]);
  });

  it("has an entry for every top-level art folder, the card scans in every language and the music", () => {
    const tops = readdirSync(join(root, "art"))
      .filter((name) => statSync(join(root, "art", name)).isDirectory())
      .map((name) => `art/${name}`);
    const locales = readdirSync(join(root, "assets/card-art-locales"))
      .filter((name) => statSync(join(root, "assets/card-art-locales", name)).isDirectory())
      .map((name) => `assets/card-art-locales/${name}`);
    expect([...tops, "assets/card-art", ...locales, "music"].filter((folder) => !covered(folder))).toEqual([]);
  });

  it("points only at folders that exist", () => {
    for (const entry of CREDITS) {
      for (const folder of entry.folders ?? []) expect(existsSync(join(root, folder)), folder).toBe(true);
    }
  });

  it("flags the entries whose artist is not recorded", () => {
    expect(creditGaps().length).toBeGreaterThan(0);
    for (const entry of creditGaps()) expect(entry.credit).toMatch(/not recorded|not confirmed|to be confirmed/i);
  });
});
