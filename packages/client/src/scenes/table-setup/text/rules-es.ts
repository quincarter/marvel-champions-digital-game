/**
 * Spanish for the words Set up the table's view models print in English (difficulty cards, setup options, the modular
 * labels, the composition rows, the summary). The terms are the official Spanish reference guide's
 * (`docs/rules/es/mc_guia_de_referencia_es_2019.md`): Esbirros, Planes secundarios, Traiciones, Accesorios, Oleada,
 * Obligaciones, Amenaza, Plan principal, Archienemigo, mazo de Encuentros.
 *
 * `translate` in `lt.ts` applies these to one phrase at a time: a phrase that matches an exact entry or a pattern is
 * replaced whole; one that matches none is left as it is (the name tables in `lt.ts` still rename sets and cards in it).
 */

/** Whole phrases. */
export const EXACT_ES: Readonly<Record<string, string>> = {
  Standard: "Estándar",
  Chosen: "Elegido",
  Expert: "Experto",
  Extreme: "Extremo",
  "Standard set": "Conj. estándar",
  "Expert set": "Conj. experto",
  "Encounter cards shuffled into every game.": "Se baraja en todas las partidas.",
  "Added on top in Expert mode.": "Se añade encima en modo Experto.",
  "Heroic level": "Nivel heroico",
  Skirmish: "Escaramuza",
  Off: "No",
  "On · the scenario's own skirmish rule": "Sí · la regla de escaramuza del escenario",
  "Main scheme": "Plan principal",
  Villain: "Villano",
  "Starting threat": "Amenaza inicial",
  "Encounter deck": "Mazo de Encuentros",
  Obligations: "Obligaciones",
  "Obligations (shuffled in)": "Obligaciones (barajadas)",
  "Nemesis sets": "Conjuntos de Archienemigo",
  "Added set": "Conjunto añadido",
  "Set aside": "Apartado",
  Heroes: "Héroes",
  "Table rule": "Regla de mesa",
  "Hero and ally of one name": "Héroe y aliado del mismo nombre",
  Minions: "Esbirros",
  "Side schemes": "Planes secundarios",
  Treacheries: "Traiciones",
  Attachments: "Accesorios",
  "Surge cards": "Cartas de Oleada",
  none: "ninguna",
  "Gene Pool threat": "Amenaza de Gene Pool",
  "Easier start: begin at Apocalypse (I)": "Inicio más fácil: empezar en Apocalypse (I)",
  "On · begins at stage I": "Sí · empieza en la etapa I",
  "Off · begins at stage II": "No · empieza en la etapa II",
  "On · changes official cards this game": "Sí · cambia cartas oficiales en esta partida",
  "Off · cards as printed": "No · cartas como están impresas",
  "Set-aside modular set": "Conjunto modular apartado",
  "Chosen at random": "Elegido al azar",
  Recommended: "Recomendado",
  "Your pick": "Tu elección",
  "Chosen · drawn when the game is dealt": "Elegido · se saca al repartir la partida",
  "Clears your picks": "Borra tus elecciones",
  "Chosen · not counted": "Elegido · no cuenta",
  "Optional · not counted": "Opcional · no cuenta",
  "Chosen · extra": "Elegido · extra",
  "Other side": "Otro bando",
  "Registration sets": "Conjuntos del Registro",
  "Resistance sets": "Conjuntos de la Resistencia",
  "Custom packs": "Packs personalizados",
  Promo: "Promo",
  Other: "Otros",
  "none used": "ninguno usado",
  "one joins at random at setup": "uno se une al azar al preparar",
  "none shuffled in": "ninguno barajado",
  "house rule: add more": "regla de la casa: añadir más",
  minions: "esbirros",
  hidden: "oculto",
};

type Rule = readonly [pattern: RegExp, make: (...groups: string[]) => string];

const numbers = new Intl.NumberFormat("es");
/** A count in Spanish digits (a thousands separator from 10 000 up) with its noun. */
const plural = (n: string, one: string, other: string): string =>
  `${numbers.format(Number(n))} ${n === "1" ? one : other}`;

/** Patterns, tried in order on one phrase. */
export const RULES_ES: readonly Rule[] = [
  [
    /^Standard encounter set only\. Starts at stage (\S+)\.$/,
    (s) => `Solo el conjunto de Encuentros estándar. Empieza en la etapa ${s}.`,
  ],
  [/^Expert set added\. Starts at stage (\S+)\.$/, (s) => `Se añade el conjunto experto. Empieza en la etapa ${s}.`],
  [
    /^Every villain's A and B version in play\. Starts at stage (\S+)\.$/,
    (s) => `Las versiones A y B de cada Villano en juego. Empieza en la etapa ${s}.`,
  ],
  [
    /^(\d+) extra encounter cards? each$/,
    (n) => `${plural(n, "carta de Encuentro extra", "cartas de Encuentro extra")} cada uno`,
  ],
  [/^Only stage (\S+)$/, (s) => `Solo la etapa ${s}`],
  [/^(\d+) per player$/, (n) => `${n} por jugador`],
  [/^Player (\d+)'s main scheme$/, (n) => `Plan principal del jugador ${n}`],
  [/^(\d+) of (\d+)$/, (a, b) => `${a} de ${b}`],
  [/^House pick · (\d+) of (\d+)$/, (a, b) => `Elección de la casa · ${a} de ${b}`],
  [/^Random \((.+)\)$/, (name) => `Al azar (${name})`],
  [/^House rule: (.+)$/, (name) => `Regla de la casa: ${name}`],
  [/^Set-aside modular set (\d+)$/, (n) => `Conjunto modular apartado ${n}`],
  [/^Heroic (\d+)$/, (n) => `Heroico ${n}`],
  [/^Required by (.+) · (\d+) cards?$/, (villain, n) => `Lo exige ${villain} · ${plural(n, "carta", "cartas")}`],
  [/^(\d+) cards?$/, (n) => plural(n, "carta", "cartas")],
  [/^(\d+) sets?$/, (n) => plural(n, "conjunto", "conjuntos")],
  [/^(\d+) required$/, (n) => plural(n, "requerido", "requeridos")],
  [/^(\d+) of (\d+) chosen(?:, or pick Random)?$/, (a, b) => `${a} de ${b} elegidos`],
  [/^(\d+) chosen$/, (n) => plural(n, "elegido", "elegidos")],
  [/^(\d+) random$/, (n) => `${n} al azar`],
  [/^(\d+) set aside at random$/, (n) => `${n} apartados al azar`],
  [/^(\d+) set aside, chosen$/, (n) => `${n} apartados, elegidos`],
  [/^(\d+) chosen, (\d+) needed or pick Random$/, (a, b) => `${a} elegidos, ${b} necesarios o elige Al azar`],
  [/^\+ (\d+) extra \(house rule\)$/, (n) => `+ ${n} extra (regla de la casa)`],
  [/^(\S+) HP across (both|\d+) stages$/, (hp, n) => `${hp} de Vida en ${n === "both" ? "ambas" : n} etapas`],
  [/^(\S+) HP$/, (hp) => `${hp} de Vida`],
  [/^(\S+) threat · accel (\d+)$/, (t, a) => `${t} de Amenaza · acelera ${a}`],
  [/^(\d+) \((\d+) \/ player\)$/, (a, b) => `${a} (${b} / jugador)`],
  [/^(\d+) cards \+ 1 set$/, (n) => `${n} cartas + 1 conjunto`],
  [/^(\d+) shuffled in$/, (n) => `${n} barajadas`],
  [/^(\d+) held back$/, (n) => `${n} apartados`],
  [/^(\d+) villains$/, (n) => `${n} Villanos`],
  [/^(.+) deck \(set apart\)$/, (name) => `Mazo de ${name.toLowerCase()} (aparte)`],
  [/^(.+) deck$/, (name) => `Mazo de ${name.toLowerCase()}`],
  [/^Stage (\S+)$/, (s) => `Etapa ${s}`],
  [
    /^(.+?)(?:'s)? nemesis cards are set aside, not in the deck\.$/,
    (names) => `Las cartas de Archienemigo de ${y(names)} están apartadas, no en el mazo.`,
  ],
  [
    /^(.+?)(?:'s)? nemesis cards stay out of the deck until an obligation pulls them in\.$/,
    (names) =>
      `Las cartas de Archienemigo de ${y(names)} quedan fuera del mazo hasta que una Obligación las incorpore.`,
  ],
  [/^Rhino$/, () => "Rino"],
];

/** "A and B" in Spanish. */
function y(names: string): string {
  return names.replace(/ and /g, " y ");
}
