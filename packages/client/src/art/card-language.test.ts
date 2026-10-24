import { describe, expect, it } from "vitest";
import {
  assetLanguage,
  availableCardLanguages,
  cardLanguage,
  isCardLanguage,
  preferredCardLanguage,
} from "./card-language.js";

describe("card language", () => {
  it("is English under Vitest, which runs no build define", () => {
    expect(cardLanguage()).toBe("en");
  });

  it("knows only the languages a build can be made in", () => {
    expect(isCardLanguage("es")).toBe(true);
    expect(isCardLanguage("en")).toBe(true);
    expect(isCardLanguage("fr")).toBe(false);
    expect(isCardLanguage("ES")).toBe(false);
  });

  it("reads a release asset's language from the tag after its version", () => {
    expect(assetLanguage("MarvelChampions-0.37.0-ES-Windows-x64-Setup.exe")).toBe("es");
    expect(assetLanguage("MarvelChampions-0.37.0-ES-Android.apk")).toBe("es");
    expect(assetLanguage("MarvelChampions-0.37.0-EN-Windows-x64-Setup.exe")).toBe("en");
    expect(assetLanguage("MarvelChampions-0.37.0-EN-macOS-Intel-x64.app.tar.gz")).toBe("en");
    // Releases before the language tag.
    expect(assetLanguage("MarvelChampions-0.37.0-Windows-x64-Setup.exe")).toBe("en");
    expect(assetLanguage("MarvelChampions-0.37.0-macOS-AppleSilicon-arm64.dmg")).toBe("en");
    // Tauri's own names from releases before v0.21.0, and the checksum list, have no tag: English.
    expect(assetLanguage("Marvel.Champions_0.20.0_x64-setup.exe")).toBe("en");
    expect(assetLanguage("SHA256SUMS.txt")).toBe("en");
    // A tag for a language this build doesn't know is no language at all, never English.
    expect(assetLanguage("MarvelChampions-0.37.0-FR-Android.apk")).toBeNull();
  });
});

describe("languages this bundle carries", () => {
  it("is the build language alone under Vitest", () => {
    expect(availableCardLanguages()).toEqual(["en"]);
  });

  it("starts a new player in the first browser language the bundle carries", () => {
    expect(preferredCardLanguage(["es-MX", "en-US"], ["en", "es"])).toBe("es");
    expect(preferredCardLanguage(["fr-FR", "es"], ["en", "es"])).toBe("es");
    expect(preferredCardLanguage(["fr-FR"], ["en", "es"])).toBe("en");
    // A native installer carries one language: the browser's never wins over it.
    expect(preferredCardLanguage(["es-ES"], ["en"])).toBe("en");
    expect(preferredCardLanguage([], ["es", "en"])).toBe("es");
  });
});
