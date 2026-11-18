/**
 * Spanish card text beside a card (issue #391): the Inspect sheet and the deck list rows read MarvelCDB's Spanish name,
 * rules text and flavor for the face on show, and fall back to the English card data for anything the table lacks.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { printedFaceCodeOf } from "../art/art-source.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { cardTextDisplayEs } from "./card-text-display.js";
import {
  loadCardText,
  localizedFaceOf,
  localizedLabelOf,
  resetCardTextForTest,
  type LocalizedFace,
} from "./card-text.js";
import { cardInspectModel } from "./inspect-model.js";

const card = (id: string): AnyCard => CARDS_BY_ID.get(id as never)!;

const TABLE: Readonly<Record<string, LocalizedFace>> = {
  "01001a": {
    n: "Spiderman",
    t: "Sentido arácnido — Interrupción: cuando el Villano inicie un ataque contra ti, roba 1 carta.",
  },
  "01001b": { t: "Científico — Recurso: Genera un recurso [mental]. (Límite de una vez por ronda.)" },
  "01003": {
    n: "Voltereta hacia atrás",
    t: "Interrupción (defensa): cuando vayas a sufrir cualquier cantidad de Daño provocado por un ataque, evita todo ese Daño.",
    f: '"¿Has estado entrenándote?"',
  },
};
const loadSpanish = (): Promise<boolean> => loadCardText("es", () => Promise.resolve(TABLE));

afterEach(() => {
  useEnglish();
  resetCardTextForTest();
});

describe("the Spanish text table", () => {
  it("answers once loaded, never for English", async () => {
    expect(localizedFaceOf("01003", "es")).toBeNull();
    expect(await loadSpanish()).toBe(true);
    expect(localizedFaceOf("01003", "es")?.n).toBe("Voltereta hacia atrás");
    expect(localizedFaceOf("01003", "en")).toBeNull();
    expect(localizedFaceOf("99999", "es")).toBeNull();
  });

  it("retries a failed load", async () => {
    expect(await loadCardText("es", () => Promise.reject(new Error("offline")))).toBe(false);
    expect(await loadSpanish()).toBe(true);
  });
});

describe("the face a sheet shows is keyed by its scan's code", () => {
  it("names each side of a hero identity by its own code", () => {
    expect(printedFaceCodeOf(card("01001a"), { kind: "hero" })).toBe("01001a");
    expect(printedFaceCodeOf(card("01001a"), { kind: "alterEgo" })).toBe("01001b");
    expect(printedFaceCodeOf(card("01003"), { kind: "front" })).toBe("01003");
    expect(printedFaceCodeOf(card("01003"), { kind: "back", back: "player" })).toBeNull();
  });
});

describe("the Inspect sheet in Spanish", () => {
  it("prints the Spanish name, rules text and flavor", async () => {
    useSpanish();
    await loadSpanish();
    const sheet = cardInspectModel(card("01003"), { kind: "front" });
    expect(sheet.name).toBe("Voltereta hacia atrás");
    expect(sheet.rulesText).toMatch(/^Interrupción \(defensa\)/);
    expect(sheet.flavor).toBe('"¿Has estado entrenándote?"');
  });

  it("keeps a hero's qualifier and words icons in Spanish", async () => {
    useSpanish();
    await loadSpanish();
    expect(cardInspectModel(card("01001a"), { kind: "hero" }).name).toBe("Spiderman (Peter Parker)");
    const alterEgo = cardInspectModel(card("01001a"), { kind: "alterEgo" });
    expect(alterEgo.name).toBe("Peter Parker");
    expect(alterEgo.rulesText).toBe("Científico — Recurso: Genera un recurso mental. (Límite de una vez por ronda.)");
  });

  it("falls back to English for a face the table lacks, and in an English session", async () => {
    await loadSpanish();
    expect(cardInspectModel(card("01003"), { kind: "front" }).name).toBe("Backflip");
    useSpanish();
    expect(cardInspectModel(card("01004"), { kind: "front" }).name).toBe("Enhanced Spider-Sense");
  });
});

describe("deck list labels", () => {
  it("swap the title and keep the qualifier", async () => {
    await loadSpanish();
    expect(localizedLabelOf(card("01003"), "es")).toBe("Voltereta hacia atrás");
    expect(localizedLabelOf(card("01003"), "en")).toBe("Backflip");
    expect(localizedLabelOf(card("01004"), "es")).toBe("Enhanced Spider-Sense");
  });
});

describe("Spanish icon words", () => {
  it("words each token, and drops the brackets of one it has no word for", () => {
    expect(cardTextDisplayEs("Coloca 1[per_hero] de Amenaza. Gasta un recurso [energy] [star] ([rasgos])")).toBe(
      "Coloca 1 por héroe de Amenaza. Gasta un recurso de energía ★ (rasgos)",
    );
  });
});
