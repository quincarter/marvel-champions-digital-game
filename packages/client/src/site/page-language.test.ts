import { LANGUAGE_KEY, pickLanguage } from "./page-language.js";

const sources = (search: string, stored: Record<string, string>, browser: string[]) => ({
  search,
  read: (key: string) => stored[key] ?? null,
  browser,
});

describe("pickLanguage", () => {
  it("takes ?lang= first", () => {
    expect(pickLanguage(sources("?lang=es", { [LANGUAGE_KEY]: "en" }, ["en-US"]))).toBe("es");
  });

  it("then the toggle's last choice", () => {
    expect(pickLanguage(sources("", { [LANGUAGE_KEY]: "es" }, ["en-US"]))).toBe("es");
  });

  it("then the game's saved card language", () => {
    expect(pickLanguage(sources("", { "mc-settings": JSON.stringify({ cardLanguage: "es" }) }, ["en-US"]))).toBe("es");
  });

  it("then the first browser language the pages have, region ignored", () => {
    expect(pickLanguage(sources("", {}, ["fr-FR", "es-MX", "en"]))).toBe("es");
  });

  it("falls back to English, and ignores a language it doesn't have or settings it can't read", () => {
    expect(pickLanguage(sources("?lang=de", { "mc-settings": "{not json" }, ["fr"]))).toBe("en");
  });
});
