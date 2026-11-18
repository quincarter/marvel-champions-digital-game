/**
 * Spanish card text beside a card (issue #391): the Inspect sheet and the deck list rows read MarvelCDB's Spanish name,
 * rules text and flavor for the face on show, and fall back to the English card data for anything the table lacks.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import { printedFaceCodeOf } from "../art/art-source.js";
import { CARD_TEXT_ES } from "../content/card-text-es.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import { cardTextDisplayEs } from "./card-text-display.js";
import {
  bringInCardText,
  loadCardText,
  localizedFaceOf,
  localizedLabelOf,
  resetCardTextForTest,
  textFingerprint,
  type LocalizedFace,
} from "./card-text.js";
import { cardInspectModel } from "./inspect-model.js";

const card = (id: string): AnyCard => CARDS_BY_ID.get(id as never)!;

// The generated table itself, so the faces, codes and fingerprints under test are the ones a player gets.
const TABLE: Readonly<Record<string, LocalizedFace>> = CARD_TEXT_ES;
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

describe("bringing the table in", () => {
  it("redraws once it loads, and retries a failed load on its own", async () => {
    let calls = 0;
    const importer = (): Promise<typeof TABLE> =>
      ++calls === 1 ? Promise.reject(new Error("offline")) : Promise.resolve(TABLE);
    const announced: string[] = [];
    const retries: number[] = [];
    let retry: (() => void) | null = null;
    bringInCardText("es", {
      importer,
      announce: () => announced.push("es"),
      schedule: (again, ms) => {
        retries.push(ms);
        retry = again;
      },
    });
    await new Promise((done) => setTimeout(done, 0));
    expect(announced).toEqual([]);
    expect(retries).toEqual([2_000]);
    (retry as unknown as () => void)();
    await new Promise((done) => setTimeout(done, 0));
    expect(announced).toEqual(["es"]);
    expect(localizedFaceOf("01003", "es")?.n).toBe("Voltereta hacia atrás");
  });

  it("does nothing for English", () => {
    const announced: string[] = [];
    bringInCardText("en", { announce: () => announced.push("en") });
    expect(announced).toEqual([]);
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
    expect(sheet.flavor).toMatch(/^"¿Has estado entrenándote\?/);
  });

  it("keeps a hero's qualifier and words icons in Spanish", async () => {
    useSpanish();
    await loadSpanish();
    expect(cardInspectModel(card("01001a"), { kind: "hero" }).name).toBe("Spiderman (Peter Parker)");
    const alterEgo = cardInspectModel(card("01001a"), { kind: "alterEgo" });
    expect(alterEgo.name).toBe("Peter Parker");
    expect(alterEgo.rulesText).toBe("Científico — Recurso: Genera un recurso mental. (Límite de una vez por ronda.)");
  });

  it("keeps the English current text and errata diff on a face with errata (Marked for Death, 04028)", async () => {
    useSpanish();
    await loadSpanish();
    const sheet = cardInspectModel(card("04028"), { kind: "front" });
    expect(sheet.name).toBe(TABLE["04028"]!.n);
    expect(sheet.rulesText).toMatch(/return the tucked Mockingbird/);
    expect(sheet.printedText).toMatch(/return Mockingbird to her owner's hand/);
  });

  it("keeps the English where a code's English is another face's (Rhino's scheme, whose Core scans are crossed)", async () => {
    useSpanish();
    await loadSpanish();
    const setup = cardInspectModel(card("01097a"), { kind: "mainSchemeStage", stageIndex: 0, side: "A" });
    expect(setup.rulesText).toMatch(/^Contents: Rhino/);
  });

  it("falls back to English for a face the table lacks, and in an English session", async () => {
    await loadSpanish();
    expect(cardInspectModel(card("01003"), { kind: "front" }).name).toBe("Backflip");
    useSpanish();
    const untranslated = [...CARDS_BY_ID.values()].find((c) => c.type === "event" && !TABLE[c.id as string])!;
    expect(cardInspectModel(untranslated, { kind: "front" }).name).toBe(untranslated.name);
  });
});

describe("deck list labels", () => {
  it("swap the title and keep the qualifier", async () => {
    await loadSpanish();
    expect(localizedLabelOf(card("01003"), "es")).toBe("Voltereta hacia atrás");
    expect(localizedLabelOf(card("01003"), "en")).toBe("Backflip");
    expect(localizedLabelOf(card("01001a"), "es")).toBe("Spiderman (Peter Parker)");
  });
});

describe("the English fingerprint", () => {
  it("matches the generator's for the same English (Backflip, 01003)", () => {
    expect(textFingerprint((card("01003") as { readonly text: { readonly printed: string } }).text.printed)).toBe(
      "1mx4vn8",
    );
    expect(TABLE["01003"]!.e).toBe("1mx4vn8");
  });
});

describe("Spanish icon words", () => {
  it("words each token, and drops the brackets of one it has no word for", () => {
    expect(cardTextDisplayEs("Coloca 1[per_hero] de Amenaza. Gasta un recurso [energy] [star] ([rasgos])")).toBe(
      "Coloca 1 por héroe de Amenaza. Gasta un recurso de energía ★ (rasgos)",
    );
  });
});
