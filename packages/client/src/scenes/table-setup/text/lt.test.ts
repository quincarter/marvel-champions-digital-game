import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useEnglish, useSpanish } from "../../../i18n/test-language.js";
import { loadCardText } from "../../../view/card-text.js";
import { loadSetupNames, lt } from "./lt.js";

afterEach(useEnglish);

describe("lt", () => {
  it("leaves English as it is", () => {
    expect(lt("Standard encounter set only. Starts at stage I.")).toBe(
      "Standard encounter set only. Starts at stage I.",
    );
  });

  describe("in Spanish", () => {
    beforeAll(async () => {
      useSpanish();
      await loadCardText("es");
      await loadSetupNames();
      useEnglish();
    });

    const es = (text: string): string => {
      useSpanish();
      return lt(text);
    };

    it("words the difficulty cards and the set rows with the guide's terms", () => {
      expect(es("Standard")).toBe("Estándar");
      expect(es("Expert")).toBe("Experto");
      expect(es("Standard encounter set only. Starts at stage I.")).toBe(
        "Solo el conjunto de Encuentros estándar. Empieza en la etapa I.",
      );
      expect(es("Expert set added. Starts at stage II.")).toBe("Se añade el conjunto experto. Empieza en la etapa II.");
      expect(es("Standard set")).toBe("Conj. estándar");
      expect(es("Encounter cards shuffled into every game.")).toBe("Se baraja en todas las partidas.");
      expect(es("Heroic level")).toBe("Nivel heroico");
      expect(es("Skirmish")).toBe("Escaramuza");
    });

    it("words the modular labels piece by piece, with the card types as the guide names them", () => {
      expect(es("1 required · 1 chosen")).toBe("1 requerido · 1 elegido");
      expect(es("Required by Rhino · 19 cards")).toBe("Lo exige Rino · 19 cartas");
      expect(es("Chosen · 6 cards · Treacheries")).toBe("Elegido · 6 cartas · Traiciones");
      expect(es("5 cards · Attachments")).toBe("5 cartas · Accesorios");
      expect(es("7 cards · Minions")).toBe("7 cartas · Esbirros");
      expect(es("Recommended")).toBe("Recomendado");
    });

    it("writes counts with Spanish digit grouping", () => {
      expect(es("12000 cards")).toBe("12.000 cartas");
    });

    it("words the composition and what is inside", () => {
      expect(es("Obligations (shuffled in)")).toBe("Obligaciones (barajadas)");
      for (const [en, sp] of [
        ["Minions", "Esbirros"],
        ["Side schemes", "Planes secundarios"],
        ["Treacheries", "Traiciones"],
        ["Attachments", "Accesorios"],
        ["Surge cards", "Cartas de Oleada"],
      ] as const)
        expect(es(en)).toBe(sp);
    });

    it("words the summary labels and values", () => {
      expect(es("Main scheme")).toBe("Plan principal");
      expect(es("Starting threat")).toBe("Amenaza inicial");
      expect(es("Encounter deck")).toBe("Mazo de Encuentros");
      expect(es("Table rule")).toBe("Regla de mesa");
      expect(es("58 HP across both stages")).toBe("58 de Vida en ambas etapas");
      expect(es("14 threat · accel 2")).toBe("14 de Amenaza · acelera 2");
      expect(es("0 (0 / player)")).toBe("0 (0 / jugador)");
      expect(es("30 cards")).toBe("30 cartas");
      expect(es("2 shuffled in")).toBe("2 barajadas");
      expect(es("Hero and ally of one name")).toBe("Héroe y aliado del mismo nombre");
    });

    it("uses the Spanish names the card data has for sets, villains and heroes", () => {
      expect(es("Bomb Scare")).toBe("Amenaza de bomba");
      expect(es("Legions of Hydra")).toBe("Legiones de Hydra");
      expect(es("Masters of Evil")).toBe("Señores del Mal");
      expect(es("The Doomsday Chair")).toBe("La silla del Juicio Final");
      expect(es("Under Attack")).toBe("Civiles en peligro");
      expect(es("Captain Marvel")).toBe("Capitana Marvel");
      expect(es("Rhino I · 58 HP across both stages")).toContain("Rino");
    });

    it("words the nemesis note", () => {
      expect(
        es(
          "Spider-Man (Peter Parker) and Captain Marvel's nemesis cards stay out of the deck until an obligation pulls them in.",
        ),
      ).toBe(
        "Las cartas de Archienemigo de Spiderman (Peter Parker) y Capitana Marvel quedan fuera del mazo hasta que una Obligación las incorpore.",
      );
    });
  });
});
