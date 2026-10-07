import { describe, expect, it } from "vitest";
import type { CoreAspect } from "@mc/content";
import { rectsOverlap } from "./layout.js";
import { aspectLessonContent, aspectLessonLayout } from "./aspect-lesson-model.js";

const PLAYABLE_ASPECTS: readonly CoreAspect[] = ["justice", "aggression", "leadership", "protection"];

describe("aspectLessonContent", () => {
  it("resolves each playable aspect's signature cards and precon hero from the pool", () => {
    for (const aspect of PLAYABLE_ASPECTS) {
      const content = aspectLessonContent(aspect);
      expect(content, aspect).not.toBeNull();
      expect(content!.signatureCards.length).toBeGreaterThan(0);
      for (const card of content!.signatureCards) {
        expect(card.name.length, `${aspect}: ${card.cardId}`).toBeGreaterThan(0);
      }
      expect(content!.heroName, aspect).not.toBeNull();
      expect(content!.heroCardId, aspect).not.toBeNull();
      expect(content!.preconId, aspect).not.toBeNull();
    }
  });

  it("Justice's Try-it hero is Spider-Man (§5.4)", () => {
    expect(aspectLessonContent("justice")!.heroName).toBe("Spider-Man");
  });

  it("Protection's Try-it hero is Black Panther (§5.4)", () => {
    expect(aspectLessonContent("protection")!.heroName).toBe("Black Panther");
  });

  it("Basic has no precon and no signature cards", () => {
    const content = aspectLessonContent("basic");
    expect(content).not.toBeNull();
    expect(content!.signatureCards).toEqual([]);
    expect(content!.heroName).toBeNull();
    expect(content!.preconId).toBeNull();
  });

  it("'Pool resolves to Deadpool's precon, with signature cards from the Deadpool pack", () => {
    const content = aspectLessonContent("pool")!;
    expect(content.heroName).toBe("Deadpool");
    expect(content.preconId).toBe("deadpool-pool");
    expect(content.signatureCards.map((card) => card.name)).toEqual(["Dogpool", "Barely a Scratch", "Healing Factor"]);
  });

  it("is stable across calls (same pool, same guide data)", () => {
    expect(aspectLessonContent("justice")).toEqual(aspectLessonContent("justice"));
  });
});

describe("aspectLessonLayout", () => {
  const sizes: readonly [number, number][] = [
    [390, 844], // phone
    [1024, 768], // tablet landscape
    [1440, 900], // desktop
  ];

  it("is phone-narrow (stacked) and tablet/desktop-wide (two-column)", () => {
    expect(aspectLessonLayout(390, 844).wide).toBe(false);
    expect(aspectLessonLayout(1024, 768).wide).toBe(true);
    expect(aspectLessonLayout(1440, 900).wide).toBe(true);
  });

  it("narrow: text and cards share the same one-column region", () => {
    const layout = aspectLessonLayout(390, 844);
    expect(layout.text).toEqual(layout.cards);
  });

  it("wide: text and cards are two side-by-side, non-overlapping columns", () => {
    for (const [width, height] of sizes) {
      const layout = aspectLessonLayout(width, height);
      if (!layout.wide) continue;
      expect(rectsOverlap(layout.text, layout.cards), `${width}x${height}`).toBe(false);
      expect(layout.text.x).toBeLessThan(layout.cards.x);
    }
  });

  it("every region has positive size and stays on screen at every size", () => {
    for (const [width, height] of sizes) {
      const layout = aspectLessonLayout(width, height);
      for (const rect of [layout.header, layout.close, layout.text, layout.cards, layout.gotIt]) {
        expect(rect.width, `${width}x${height}`).toBeGreaterThan(0);
        expect(rect.height, `${width}x${height}`).toBeGreaterThan(0);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.01);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.01);
      }
    }
  });

  it("close and gotIt never overlap the body columns", () => {
    for (const [width, height] of sizes) {
      const layout = aspectLessonLayout(width, height);
      expect(rectsOverlap(layout.close, layout.text)).toBe(false);
      expect(rectsOverlap(layout.gotIt, layout.text)).toBe(false);
    }
  });
});
