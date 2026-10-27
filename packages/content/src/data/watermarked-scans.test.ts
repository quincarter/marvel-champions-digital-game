// Guards the bundled card scans against a watermarked scan coming back after it was replaced. Eros (22011) and ten
// more Nebula precon scans were replaced with the owner's own scans on 2026-10-23, but only on a branch that never
// merged, so main kept showing the FFG preview diamond. The audit in scripts/fetch_card_art.py scores these 900px
// scans as clean (its template fits the smaller MTS previews), so this checks the exact files instead.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const artDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "assets", "card-art");
const cardsDir = join(artDir, "bundles", "cards");

/** The git blob id of a file's bytes, the id `git rev-parse <rev>:<path>` prints. */
function blobId(bytes: Buffer): string {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

const watermarked = new Map(
  readFileSync(join(artDir, "watermarked-scans.tsv"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [blob, file] = line.split("\t");
      return [blob, file] as const;
    }),
);

describe("bundled card scans", () => {
  it("lists only well-formed blob ids", () => {
    expect(watermarked.size).toBeGreaterThan(0);
    for (const blob of watermarked.keys()) expect(blob).toMatch(/^[0-9a-f]{40}$/);
  });

  it("carry none of the scans replaced for an FFG watermark", () => {
    const found: string[] = [];
    for (const name of readdirSync(cardsDir)) {
      const was = watermarked.get(blobId(readFileSync(join(cardsDir, name))));
      if (was) found.push(`${name} is the watermarked scan once at ${was}`);
    }
    expect(found).toEqual([]);
  }, 120_000); // reads every bundled scan; a cold disk took 18 s here
});
