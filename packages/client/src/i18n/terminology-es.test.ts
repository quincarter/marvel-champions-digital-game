import { describe, expect, it } from "vitest";
import { GLOSSARY_ES } from "../content/glossary-es.js";
import { MECHANIC_TRYITS_ES } from "../content/mechanic-tryits-es.js";
import { searchHelpRows } from "../view/search-help.js";
import { es } from "./es.js";

/**
 * The Spanish game terms, pinned to the official Spanish rules reference (Asmodee Espana's 2019 "Guia de referencia",
 * `docs/rules/es/mc_guia_de_referencia_es_2019.md`; the line is cited beside each term). A translation that is merely
 * different from the English proves nothing: these are the words the guide prints, so a drift to a literal or invented
 * word fails here.
 *
 * Where the guide has no term (Undo, Skirmish, Each player in the room text) the reviewer's word is pinned instead:
 * Deshacer, Escaramuza, Cada jugador.
 */
const TERMS: readonly (readonly [key: keyof typeof es, expected: string, source: string])[] = [
  ["aspect.aggression", "Agresividad", "guide line 2214"],
  ["aspect.justice", "Justicia", "guide line 2213"],
  ["aspect.leadership", "Liderazgo", "guide line 2214"],
  ["aspect.protection", "Protección", "guide line 2214"],
  ["scenario.mainScheme", "Plan principal", "guide lines 73-74 (Plan principal)"],
  ["refusal.noun.minion", "esbirro", "guide line 76 (Esbirros)"],
  // The deck builder's resource-icon filter: Universal (guide lines 1844 and 1862, "Universal (recurso)").
  ["deckBuilder.icon.wild", "Universal", "guide lines 1844, 1862"],
  ["deckBuilder.icon.physical", "Físico", "guide: recursos Físicos"],
  ["deckBuilder.icon.mental", "Mental", "guide: recursos Mentales"],
  ["deckBuilder.icon.energy", "Energía", "guide line 1844"],
  ["room.undo.title", "Deshacer", "reviewer table: Undo"],
  ["room.undo.own", "Cada jugador", "guide line 66 (Cada jugador)"],
  ["room.table.skirmish", "Escaramuza", "reviewer table: Skirmish"],
  ["trophies.family.hosting", "Espectadores y anfitriones", "review of #1051"],
  // A player-deck side scheme is its own card type: the official Spanish inserts name it in full, apart from the encounter side scheme (Plan secundario, guide line 679).
  ["cardType.sideScheme", "Plan secundario de jugador", "official Spanish Masacre insert, p. 2"],
  ["deckBuilder.type.scheme", "Plan secundario de jugador", "official Spanish Masacre insert, p. 2"],
  ["deckTypes.scheme", "Planes secundarios de jugador", "plural of the above"],
  ["comp.area.sideSchemes", "{count} planes secundarios", "guide line 679 (Cartas de Plan secundario)"],
  ["unlock.name.core", "Caja básica", "guide line 2244 (la caja básica)"],
  ["deckTitle.coreStarter", "{hero} — mazo inicial de la {box}", "box name as above"],
  ["deckList.basicCards", "Cartas básicas", "guide line 2216 (cartas Básicas)"],
];

/** The words the guide never uses for these terms: the literal or invented ones the reviews found. */
const BANNED = /frustr(?:ar|aci[oó]n)|complot|secuaz|comod[ií]n/i;

describe("the Spanish terms follow the official guide", () => {
  it.each(TERMS)("%s is %j (%s)", (key, expected) => {
    expect(es[key]).toBe(expected);
  });

  it("names the glossary's thwart, main scheme and wild resource as the guide does", () => {
    expect(GLOSSARY_ES["thwart"]!.name).toBe("Intervención");
    expect(GLOSSARY_ES["mainScheme"]!.name).toBe("Plan principal");
    expect(GLOSSARY_ES["sideScheme"]!.name).toBe("Plan secundario");
    expect(GLOSSARY_ES["wildResource"]!.name).toBe("Recurso Universal");
  });

  it("the search help says recurso universal and intervención", () => {
    const text = JSON.stringify(searchHelpRows("es"));
    expect(text).toMatch(/recurso universal/i);
    expect(text).toMatch(/intervención/i);
  });

  it("never uses a word the guide does not (frustrar, complot, secuaz, comodin) in the app text, the glossary or the Try-its", () => {
    const strings: [string, string][] = [
      ...Object.entries(es).map(([key, value]): [string, string] => [`es.ts ${key}`, value ?? ""]),
      ...Object.entries(GLOSSARY_ES).flatMap(([id, entry]): [string, string][] => [
        [`glossary ${id} name`, entry.name],
        [`glossary ${id} definition`, entry.definition],
        [`glossary ${id} note`, entry.note ?? ""],
      ]),
      ...Object.entries(MECHANIC_TRYITS_ES).flatMap(([id, entry]): [string, string][] => [
        [`try-it ${id} title`, entry.title],
        [`try-it ${id} tagline`, entry.tagline],
      ]),
    ];
    expect(strings.filter(([, text]) => BANNED.test(text)).map(([where]) => where)).toEqual([]);
  });

  it("the How to win strip says the player draws up to the hand size, as the guide does (lines 1204, 1967)", () => {
    expect(es["howToWin.step.act"]).toMatch(/ROBAS HASTA TU TAMAÑO DE MANO/);
    expect(es["howToWin.step.villain"]).toBe("EL VILLANO ACTÚA");
  });

  it("writes the encounter deck as the guide does: mazo de Encuentros, capital E, plural (line 111)", () => {
    const texts = [
      ...Object.values(es),
      ...Object.values(GLOSSARY_ES).flatMap((entry) => [entry.name, entry.definition, entry.note ?? ""]),
    ];
    const found = texts.flatMap((text) => text?.match(/mazo de encuentros?/gi) ?? []);
    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((phrase) => !/^[Mm]azo de Encuentros$/.test(phrase))).toEqual([]);
  });

  it("leaves nothing of the app text in English: every key the English has, the Spanish has", async () => {
    const { en } = await import("./en.js");
    const missing = Object.keys(en).filter((key) => (es as Record<string, string | undefined>)[key] === undefined);
    expect(missing).toEqual([]);
  });
});
