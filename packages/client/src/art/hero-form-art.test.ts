import { describe, expect, test } from "vitest";
import { POOL_CARDS } from "../content/pool-cards.js";
import { artFor, artPathOf, type CardFace } from "./art-source.js";

/**
 * Every hero face of an identity with more than one (Ant-Man and Wasp's Giant forms, Spectrum's energy forms, Angel's
 * Archangel) shows its own picture. Issue #244: Ant-Man's Giant scan (`12001c.png`) was a byte-for-byte copy of his
 * Tiny scan (`12001a.png`), as MarvelCDB serves it, so after a flip to Giant the table and the hover popover still
 * showed Tiny. The scans are read as text, lazily, and only for these identities: identical bytes read the same.
 */
const ART_PREFIX = "../../../../assets/card-art/";
const SCANS = import.meta.glob<string>("../../../../assets/card-art/bundles/cards/*", {
  query: "?raw",
  import: "default",
});

async function scanOf(card: (typeof POOL_CARDS)[number], face: CardFace): Promise<{ path: string; bytes: string }> {
  const art = artFor(card, face);
  if (!art) throw new Error(`${card.id as string} has no picture for ${JSON.stringify(face)}`);
  const path = artPathOf(art);
  const load = SCANS[`${ART_PREFIX}${path}`];
  if (!load) throw new Error(`${path} is not in assets/card-art/`);
  return { path, bytes: await load() };
}

const multiForm = POOL_CARDS.flatMap((card) =>
  card.type === "hero_identity" && (card.additionalHeroForms?.length ?? 0) > 0 ? [card] : [],
);

describe("an identity's hero forms each have their own picture", () => {
  test("the pool has identities with several hero forms", () => {
    expect(multiForm.map((card) => card.id as string)).toContain("12001a");
  });

  test.each(multiForm.map((card) => [card.id as string, card] as const))("%s", async (_id, card) => {
    if (card.type !== "hero_identity") return;
    const faces: CardFace[] = [{ kind: "hero" }];
    card.additionalHeroForms?.forEach((_form, index) => faces.push({ kind: "heroForm", index: index + 1 }));
    const scans = await Promise.all(faces.map((face) => scanOf(card, face)));
    const paths = scans.map((scan) => scan.path);
    expect(new Set(paths).size, `distinct files: ${paths.join(", ")}`).toBe(paths.length);
    const copies = scans.filter((scan, index) => scans.findIndex((other) => other.bytes === scan.bytes) !== index);
    expect(
      copies.map((scan) => scan.path),
      "a form's scan is a copy of another form's",
    ).toEqual([]);
  });
});
