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
  "aspectTip.leadership.tagline": "Aliados — un tablero más amplio",
  "aspectTip.leadership.tip": "Elígelo cuando tu héroe saca partido de un tablero amplio de aliados.",
  "aspectTip.protection.tagline": "Defensa y curación",
  "aspectTip.protection.tip": "Elígelo cuando el villano golpea fuerte o tu héroe es frágil.",
  "aspectTip.pool.tagline": "Grandes jugadas, a un precio",
  "aspectTip.pool.tip":
    "Elígelo para cartas salvajes y arriesgadas. Añade cartas de enemigo de Dreadpool extra al mazo del villano.",
  "aspectTip.basic.tagline": "Cartas neutrales que cualquier mazo puede usar",
  "aspectTip.basic.tip": "Todos los mazos las usan junto a su aspecto.",
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
