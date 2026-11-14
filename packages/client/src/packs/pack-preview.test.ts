import { describe, expect, it } from "vitest";
import { CORE_CARDS, PACK_PREVIEW_MAX_BYTES } from "@mc/content";
import { parsePackPreview, parsePackPreviewText, previewPictureUrl } from "./pack-preview.js";

const identity = { ...CORE_CARDS.find((card) => card.type === "hero_identity")!, id: "x.demo.01a" };
const event = { ...CORE_CARDS.find((card) => card.type === "event")!, id: "x.demo.02" };

const preview = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: 1,
  packId: "demo",
  version: "1.0.0",
  featured: { cardId: "x.demo.01a", images: ["cards/en/x.demo.01a.webp", "cards/en/gone.webp"] },
  images: ["cards/en/x.demo.01a.webp", "cards/es/x.demo.01a.webp", "not-a-picture.png"],
  languages: { base: "en", available: ["en", "es"] },
  cards: [identity, event],
  decks: [
    { id: "demo-deck", name: "Demo", identityCardId: "x.demo.01a", cards: [{ cardId: "x.demo.02", quantity: 2 }] },
  ],
  ...over,
});

describe("parsePackPreview", () => {
  it("reads a well-formed preview", () => {
    const parsed = parsePackPreview(preview(), "demo")!;
    expect(parsed.cards.map((card) => card.id)).toEqual(["x.demo.01a", "x.demo.02"]);
    expect([...parsed.images]).toEqual(["cards/en/x.demo.01a.webp", "cards/es/x.demo.01a.webp"]);
    expect(parsed.featured).toEqual({ cardId: "x.demo.01a", images: ["cards/en/x.demo.01a.webp"] });
    expect(parsed.decks[0]!.cards).toEqual([{ cardId: "x.demo.02", quantity: 2 }]);
  });

  it("refuses another pack's preview, the wrong schema and non-objects", () => {
    expect(parsePackPreview(preview(), "other")).toBeUndefined();
    expect(parsePackPreview(preview({ schema: 2 }), "demo")).toBeUndefined();
    expect(parsePackPreview(null, "demo")).toBeUndefined();
    expect(parsePackPreview([], "demo")).toBeUndefined();
    expect(parsePackPreview(preview({ cards: "no" }), "demo")).toBeUndefined();
  });

  it("drops cards that are not the pack's own, are duplicated or fail validation, and bad deck entries", () => {
    const parsed = parsePackPreview(
      preview({
        cards: [identity, identity, { ...event, id: "x.other.02" }, { ...event, id: "x.demo.09", type: "nonsense" }, 7],
        decks: [
          {
            id: "d",
            name: "D",
            identityCardId: "x.demo.01a",
            cards: [{ cardId: "a", quantity: 0 }, { cardId: "b", quantity: 1 }, "x"],
          },
          { id: 3 },
        ],
      }),
      "demo",
    )!;
    expect(parsed.cards.map((card) => card.id)).toEqual(["x.demo.01a"]);
    expect(parsed.decks).toHaveLength(1);
    expect(parsed.decks[0]!.cards).toEqual([{ cardId: "b", quantity: 1 }]);
  });

  it("caps its size and survives text that is not JSON", () => {
    expect(parsePackPreviewText("{ nope", "demo")).toBeUndefined();
    expect(parsePackPreviewText(" ".repeat(PACK_PREVIEW_MAX_BYTES + 1), "demo")).toBeUndefined();
    expect(parsePackPreviewText(JSON.stringify(preview()), "demo")?.packId).toBe("demo");
  });
});

describe("previewPictureUrl", () => {
  const parsed = parsePackPreview(preview(), "demo")!;
  it("uses the player's language where the pack has the picture and falls back to its base language", () => {
    expect(previewPictureUrl(parsed, "https://h/p/1/", "x.demo.01a", "es")).toBe(
      "https://h/p/1/cards/es/x.demo.01a.webp",
    );
    expect(previewPictureUrl(parsed, "https://h/p/1/", "x.demo.01a", "fr")).toBe(
      "https://h/p/1/cards/en/x.demo.01a.webp",
    );
  });
  it("is undefined for a card the pack ships no picture for, or a pack with no languages", () => {
    expect(previewPictureUrl(parsed, "https://h/", "x.demo.02", "en")).toBeUndefined();
    expect(previewPictureUrl({ ...parsed, languages: undefined }, "https://h/", "x.demo.01a", "en")).toBeUndefined();
  });
});

describe("parsePackPreview achievements", () => {
  it("keeps the well-formed achievements and drops the rest", () => {
    const parsed = parsePackPreview(
      preview({
        achievements: [
          { id: "ok", name: "Ok", description: "Win.", when: { win: true } },
          { id: "bad", name: "Bad", description: "Nope.", when: { win: true, run: "x" } },
        ],
      }),
      "demo",
    )!;
    expect(parsed.achievements.map((a) => a.id)).toEqual(["ok"]);
    expect(parsePackPreview(preview(), "demo")!.achievements).toEqual([]);
  });
});
