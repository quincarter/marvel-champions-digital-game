/**
 * Deck titles and hero names in the player's language (Quin, 2026-11-27): a precon's title is built from translatable
 * parts, its hero named by the Spanish card text table, and a deck the player named keeps its name.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { Deck } from "@mc/content";
import { CARD_TEXT_ES } from "../content/card-text-es.js";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { loadCardText, resetCardTextForTest, type LocalizedFace } from "./card-text.js";
import { preconDecks } from "./deck-list-model.js";
import { deckDisplayName, deckNameIn, identityLabelOf, localHeroName } from "./deck-names.js";

const TABLE: Readonly<Record<string, LocalizedFace>> = CARD_TEXT_ES;
const loadSpanish = (): Promise<boolean> => loadCardText("es", () => Promise.resolve(TABLE));

afterEach(() => {
  useEnglish();
  resetCardTextForTest();
});

const precon = (name: string): Deck => {
  const found = preconDecks().find((deck) => deck.name === name);
  if (!found) throw new Error(`no precon named ${name}`);
  return found;
};

describe("a precon's title in English", () => {
  it("keeps the printed words and drops the aspect its stamp already shows", () => {
    expect(deckDisplayName(precon("Spider-Man (Justice) — Core Set starter deck"), "en")).toBe(
      "Spider-Man — Core Set starter deck",
    );
    expect(deckDisplayName(precon("Captain Marvel (Aggression) — Core Set tutorial deck"), "en")).toBe(
      "Captain Marvel — Core Set tutorial deck",
    );
    expect(deckDisplayName(precon("Hawkeye (Leadership) — starter deck"), "en")).toBe("Hawkeye — starter deck");
    expect(deckDisplayName(precon("Ant-Man (Leadership) — Hero Pack starter deck"), "en")).toBe(
      "Ant-Man — Hero Pack starter deck",
    );
    expect(deckDisplayName(precon("Daredevil (Justice) — Fear No Evil starter deck"), "en")).toBe(
      "Daredevil — Fear No Evil starter deck",
    );
  });
});

describe("a precon's title in Spanish", () => {
  it("builds the product from the box and set names and the hero from the Spanish card names", async () => {
    await loadSpanish();
    useSpanish();
    expect(deckDisplayName(precon("Spider-Man (Justice) — Core Set starter deck"), "es")).toBe(
      "Spiderman — mazo inicial de la Caja básica",
    );
    expect(deckDisplayName(precon("Captain Marvel (Aggression) — Core Set tutorial deck"), "es")).toBe(
      "Capitana Marvel — tutorial de la Caja básica",
    );
    expect(deckDisplayName(precon("Hawkeye (Leadership) — starter deck"), "es")).toBe("Ojo de Halcón — mazo inicial");
    expect(deckDisplayName(precon("Ant-Man (Leadership) — Hero Pack starter deck"), "es")).toBe(
      "Hombre Hormiga — mazo inicial del pack de héroe",
    );
    expect(deckDisplayName(precon("Daredevil (Justice) — Fear No Evil starter deck"), "es")).toBe(
      "Daredevil — mazo inicial de No temeré ningún mal",
    );
  });

  it("leaves no English product wording in any precon's title", async () => {
    await loadSpanish();
    const left = preconDecks()
      .map((deck) => deckDisplayName(deck, "es"))
      .filter((title) =>
        /starter deck|tutorial deck|Hero Pack|Core Set|Leadership|Aggression|Protection|Justice/.test(title),
      );
    expect(left).toEqual([]);
  });

  it("names the heroes as the Spanish card names do, and keeps one whose name is the same", async () => {
    await loadSpanish();
    const names = new Map<string, string>();
    for (const deck of preconDecks()) {
      names.set(
        deck.name.split(" (")[0]!.split(" / ")[0]!,
        deckDisplayName(deck, "es").split(" — ")[0]!.split(" / ")[0]!,
      );
    }
    expect(names.get("Captain Marvel")).toBe("Capitana Marvel");
    expect(names.get("She-Hulk")).toBe("Hulka");
    expect(names.get("Hawkeye")).toBe("Ojo de Halcón");
    expect(names.get("Wasp")).toBe("Avispa");
    expect(names.get("Quicksilver")).toBe("Mercurio");
    expect(names.get("Scarlet Witch")).toBe("Bruja Escarlata");
    expect(names.get("Iron Man")).toBe("Iron Man");
  });

  it("keeps an alter-ego qualifier and the other shape's aspect, in Spanish", async () => {
    await loadSpanish();
    expect(localHeroName("51001a", "Black Panther (Shuri)", "es")).toBe("Pantera Negra (Shuri)");
    expect(deckNameIn("Spider-Man (Miles Morales) / Justice", "27030a", ["justice"], "es")).toBe(
      "Spiderman (Miles Morales) / Justicia",
    );
  });

  it("answers in English until the text table is in", () => {
    expect(deckDisplayName(precon("Spider-Man (Justice) — Core Set starter deck"), "es")).toBe(
      "Spider-Man — mazo inicial de la Caja básica",
    );
  });
});

describe("a deck the player named", () => {
  it("keeps its name in both languages, even when it looks like a precon's", async () => {
    await loadSpanish();
    const mine: Deck = {
      ...precon("Spider-Man (Justice) — Core Set starter deck"),
      source: { kind: "userBuilt", createdAt: "2026-01-01T00:00:00Z" },
    };
    const named: Deck = { ...mine, name: "Spider-Man (Justice) — Core Set starter deck" };
    expect(deckDisplayName(named, "es")).toBe(named.name);
    expect(deckDisplayName({ ...mine, name: "Web heavy v2" }, "es")).toBe("Web heavy v2");
  });
});

describe("a shared deck's name", () => {
  it("localizes a precon's printed name a peer sent and leaves any other as sent", async () => {
    await loadSpanish();
    expect(deckNameIn("She-Hulk (Aggression) — Core Set starter deck", "01019a", ["aggression"], "es")).toBe(
      "Hulka — mazo inicial de la Caja básica",
    );
    expect(deckNameIn("Hulk smash", "01019a", ["aggression"], "es")).toBe("Hulk smash");
  });
});

describe("identityLabelOf", () => {
  it("names the identity in Spanish, or nothing when the engine named none", async () => {
    await loadSpanish();
    useSpanish();
    const deck = { identityCardId: "01010a" } as unknown as Deck;
    expect(identityLabelOf({ identityName: "Captain Marvel", deck })).toBe("Capitana Marvel");
    expect(identityLabelOf({ identityName: null, deck })).toBeNull();
  });
});
