import { describe, expect, it } from "vitest";
import { es } from "./es.js";

/**
 * The words the pick-one screens (Scenario select, Take your seats, Deck check) once drew in English only, as the Spanish
 * reference guide (`docs/rules/es/mc_guia_de_referencia_es_2019.md`) and the app's own terms word them: Intervención,
 * Plan, Esbirro, Aliado, Aspecto.
 */
const EXPECTED: Readonly<Record<string, string>> = {
  "aspectTip.justice.tagline": "Intervención — mantiene la amenaza lejos del plan",
  "aspectTip.justice.tip": "Elígelo cuando el villano avanza rápido con sus planes. Una primera opción segura.",
  "aspectTip.aggression.tagline": "Ataque y combate",
  "aspectTip.aggression.tip": "Elígelo para acabar los combates rápido o eliminar a muchos esbirros.",
  "aspectTip.leadership.tagline": "Aliados — más fuerza en la mesa",
  "aspectTip.leadership.tip": "Elígelo si tu héroe rinde mejor con muchos aliados en juego.",
  "aspectTip.protection.tagline": "Defensa y curación",
  "aspectTip.protection.tip": "Elígelo cuando el villano golpea fuerte o tu héroe es frágil.",
  "aspectTip.pool.tagline": "Grandes jugadas, a un precio",
  "aspectTip.pool.tip":
    "Elígelo para cartas salvajes y arriesgadas. Si eliges Masacrismo, baraja una copia de Crisis de Masacres infinitos en el mazo de Encuentros. Cuando se muestre, entran en juego Malsacre y su plan secundario, y se barajan las demás cartas del conjunto.",
  "aspectTip.basic.tagline": "Cartas sin aspecto, para cualquier mazo",
  "aspectTip.basic.tip": "Cualquier mazo puede incluirlas junto a las cartas de su aspecto; ninguna es obligatoria.",
  "aspectTip.link": "Aspectos ▸",
  "aspectTip.soon": "Próximamente",
  "scenario.customPacks": "Packs personalizados",
  "scenario.buildYourOwnTitle": "Crea tu propio escenario de Civil War",
  "scenario.buildYourOwnSubtitle":
    "Elige un bando, un líder, dos etapas de plan principal y tres o cuatro conjuntos modulares.",
  "custom.badge": "PACK MOD",
};

describe("the pick-one screens' words in Spanish", () => {
  it.each(Object.entries(EXPECTED))("%s reads as the guide words it", (key, text) => {
    expect((es as Record<string, string | undefined>)[key]).toBe(text);
  });
});

describe("the search placeholders in Spanish", () => {
  it("name their things in lowercase, as a sentence does", () => {
    expect(es["scenario.search"]).toBe("buscar escenarios, villanos, packs…");
    expect(es["seats.search"]).toBe("buscar héroes, aspectos, mazos…");
  });
});
