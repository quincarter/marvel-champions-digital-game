/**
 * The whole-game catalog (`catalog.ts`) against the MarvelCDB cache it was generated from, and the app's own cards
 * against the catalog: every card the app ships must count as some printed card, or the Title footer's "N / M cards
 * live" could run past M.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOG_CARD_COUNT, CATALOG_PACK_COUNT, CATALOG_REPRINTS } from "./catalog.js";
import { catalogOf, printedCodeOf, printedCodesOfCard, type RawCatalogPack } from "./catalog-codes.js";
import { PLAYABLE_CARDS } from "./index.js";

const rawDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "raw", "marvelcdb");
const packs: RawCatalogPack[] = readdirSync(rawDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(join(rawDir, name), "utf8")) as RawCatalogPack);
const catalog = catalogOf(packs);

describe("card catalog", () => {
  it("matches the MarvelCDB cache (re-run `pnpm --filter @mc/content catalog` if not)", () => {
    expect(CATALOG_PACK_COUNT).toBe(catalog.packCount);
    expect(CATALOG_CARD_COUNT).toBe(catalog.cardCount);
    expect(CATALOG_REPRINTS).toEqual(catalog.reprints);
  });

  it("counts a double-sided card once and leaves reprints out", () => {
    const counted = catalogOf([
      {
        cards: [
          { code: "01001a" },
          { code: "01001b" },
          { code: "01002" },
          { code: "04010", duplicate_of_code: "01002" },
        ],
      },
    ]);
    expect(counted.cardCount).toBe(2);
    expect(counted.reprints).toEqual({ "04010": "01002" });
    expect(printedCodeOf("01117a")).toBe("01117");
  });

  it("maps every playable card to printed cards that are in the catalog", () => {
    const outside = PLAYABLE_CARDS.flatMap((card) =>
      [...printedCodesOfCard(card, CATALOG_REPRINTS)]
        .filter((code) => !catalog.codes.has(code))
        .map((code) => `${String(card.id)} → ${code}`),
    );
    expect(outside).toEqual([]);
    for (const card of PLAYABLE_CARDS) expect(printedCodesOfCard(card, CATALOG_REPRINTS).size).toBeGreaterThan(0);
  });

  it("folds a villain's later stages into the villain card that carries their scans", () => {
    const rhino = PLAYABLE_CARDS.find((card) => String(card.id) === "01094");
    expect(rhino).toBeDefined();
    expect([...printedCodesOfCard(rhino!, CATALOG_REPRINTS)]).toEqual(expect.arrayContaining(["01094", "01095"]));
  });
});
