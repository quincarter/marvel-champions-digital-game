import { afterEach, describe, expect, it, vi } from "vitest";
import { POOL_CARDS } from "../content/pool-cards.js";
import { CARD_BACKS, artFor, artLanguageNow, artPathOf, onArtLanguageChange, setArtLanguage } from "./art-source.js";

/** Core's Spider-Man: a card with a face scan of its own. */
const spiderMan = POOL_CARDS.find((card) => card.id === ("01001a" as never)) ?? POOL_CARDS[0]!;

describe("card art language (issue #337)", () => {
  afterEach(() => {
    setArtLanguage("en");
    vi.unstubAllGlobals();
  });

  it("draws faces from the language's own folder under their own texture keys, on the same path", () => {
    vi.stubGlobal("__CARD_LANGS__", "en,es");
    const english = artFor(spiderMan, { kind: "hero" })!;
    setArtLanguage("es");
    const spanish = artFor(spiderMan, { kind: "hero" })!;
    expect(spanish.url).toBe(english.url.replace("/card-art/", "/card-art-es/"));
    expect(spanish.key).not.toBe(english.key);
    expect(artPathOf(spanish)).toBe(artPathOf(english));
  });

  it("keeps card backs on the build language's route, whatever the language", () => {
    vi.stubGlobal("__CARD_LANGS__", "en,es");
    setArtLanguage("es");
    expect(artFor(undefined, { kind: "back", back: "player" })).toBe(CARD_BACKS.player);
  });

  it("tells listeners once per real change", () => {
    vi.stubGlobal("__CARD_LANGS__", "en,es");
    const heard = vi.fn();
    const stop = onArtLanguageChange(heard);
    setArtLanguage("es");
    setArtLanguage("es");
    setArtLanguage("en");
    stop();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("stays on the build language when the bundle doesn't carry the one asked for (a native install)", () => {
    setArtLanguage("es");
    expect(artLanguageNow()).toBe("en");
  });
});
