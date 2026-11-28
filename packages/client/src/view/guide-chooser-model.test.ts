import { describe, expect, it } from "vitest";
import { CATALOGS, t } from "../i18n/translate.js";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { GUIDE_CHOOSER_OPTIONS, guideChooserFocusOrder, guideChooserLessonChips } from "./guide-chooser-model.js";

describe("guideChooserLessonChips", () => {
  it("numbers the tutorial's real five lessons in order", () => {
    const chips = guideChooserLessonChips();
    expect(chips).toHaveLength(5);
    expect(chips[0]).toBe("1 · HOW TO WIN");
    expect(chips.every((c, i) => c.startsWith(`${i + 1} · `))).toBe(true);
  });

  it("reads the lesson titles in the app language", () => {
    useSpanish();
    try {
      expect(guideChooserLessonChips()[0]).toBe("1 · CÓMO GANAR");
      expect(guideChooserLessonChips()[4]).toBe("5 · AMENAZA E INTERVENCIÓN");
    } finally {
      useEnglish();
    }
  });
});

describe("GUIDE_CHOOSER_OPTIONS text", () => {
  it("reads in English, and every option has its Spanish title and body", () => {
    expect(t(GUIDE_CHOOSER_OPTIONS[0]!.labelKey, undefined, "en")).toBe("Learn as you play");
    for (const option of GUIDE_CHOOSER_OPTIONS) {
      expect(CATALOGS.es[option.labelKey]).toBeDefined();
      expect(CATALOGS.es[option.bodyKey]).toBeDefined();
    }
    expect(t("guide.suitUp", undefined, "es")).toBe("¡A la acción!");
  });
});

describe("guideChooserFocusOrder", () => {
  it("walks the three options, then Back (wide) or not (narrow), then Suit up", () => {
    expect(guideChooserFocusOrder(false)).toEqual(["option:full", "option:hints", "option:off", "suit-up"]);
    expect(guideChooserFocusOrder(true)).toEqual(["option:full", "option:hints", "option:off", "back", "suit-up"]);
  });
});
