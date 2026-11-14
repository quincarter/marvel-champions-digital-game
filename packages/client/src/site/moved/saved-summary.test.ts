import type { SaveFileSummary } from "../../save-data/save-file.js";
import { PAGE_LANGUAGES } from "../page-language.js";
import { translator } from "../site-dom.js";
import { SHARED_TEXT } from "../site-text.js";
import { LANDING_TEXT } from "../landing/landing-text.js";
import { MOVED_TEXT } from "./moved-text.js";
import { describeSaved, hasSaves } from "./saved-summary.js";

const summary = (over: Partial<SaveFileSummary>): SaveFileSummary => ({
  exportedAt: 0,
  appVersion: "0.44.0",
  games: 0,
  decks: 0,
  campaigns: 0,
  unlocks: false,
  settings: false,
  ...over,
});

const en = translator(MOVED_TEXT.en, SHARED_TEXT.en);
const es = translator(MOVED_TEXT.es, SHARED_TEXT.es);

describe("describeSaved", () => {
  it("lists what the browser holds, with and before the last", () => {
    expect(describeSaved(summary({ games: 3, decks: 1, settings: true }), en)).toBe(
      "3 saved games, 1 deck and settings",
    );
    expect(describeSaved(summary({ games: 1, campaigns: 2 }), es)).toBe("1 partida guardada y 2 campañas");
  });

  it("names a lone item without a joiner", () => {
    expect(describeSaved(summary({ unlocks: true }), en)).toBe("unlocks and points");
  });
});

describe("hasSaves", () => {
  it("is false for an empty browser and true once anything, settings included, is there", () => {
    expect(hasSaves(summary({}))).toBe(false);
    expect(hasSaves(summary({ settings: true }))).toBe(true);
    expect(hasSaves(summary({ decks: 1 }))).toBe(true);
  });
});

describe("the site text", () => {
  it("gives every key in every language, with English's placeholders", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const catalogs of [MOVED_TEXT, LANDING_TEXT, SHARED_TEXT]) {
      for (const lang of PAGE_LANGUAGES) {
        expect(Object.keys(catalogs[lang]).sort()).toEqual(Object.keys(catalogs.en).sort());
        for (const [key, text] of Object.entries(catalogs.en)) {
          expect(placeholders((catalogs[lang] as Record<string, string>)[key]!), `${lang} ${key}`).toEqual(
            placeholders(text),
          );
        }
      }
    }
  });
});
