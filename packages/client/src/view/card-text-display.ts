/**
 * Card rules text as a reader should see it. The data keeps icons as bracket tokens (`[star]`, `[boost]`, `[wild]`,
 * `1[per_hero]`) and traits with underscores (`Alter_Ego`); the Phaser `Text` objects draw strings verbatim, so
 * every surface that prints `rulesText` goes through this one function (the view models call it, scenes never
 * re-implement it). Plain words rather than glyphs the table font may lack.
 */
const ICON_WORDS: Readonly<Record<string, string>> = {
  star: "★",
  boost: "boost icon",
  wild: "wild",
  energy: "energy",
  mental: "mental",
  physical: "physical",
  crisis: "crisis",
  acceleration: "acceleration",
  hazard: "hazard",
  unique: "unique",
  cost: "cost",
};

export function cardTextDisplay(text: string): string {
  return text
    .replace(/\[per_hero\]/g, " per hero")
    .replace(/\[per_group\]/g, " per group")
    .replace(/\[([a-z]+)\]/g, (whole, key: string) => ICON_WORDS[key] ?? whole)
    .replace(/\b([A-Z][a-z]+)_([A-Z][a-z]+)\b/g, "$1 $2")
    .replace(/ {2,}/g, " ");
}

/** `ICON_WORDS` in Spanish, worded to read after the noun MarvelCDB's Spanish text puts first ("un recurso [energy]"). */
const ICON_WORDS_ES: Readonly<Record<string, string>> = {
  star: "★",
  boost: "icono de Aumento",
  wild: "comodín",
  energy: "de energía",
  mental: "mental",
  physical: "físico",
  crisis: "Crisis",
  acceleration: "Aceleración",
  amplify: "Amplificación",
  hazard: "Riesgo",
  unique: "único",
  cost: "coste",
  consequential: "derivado",
};

/**
 * `cardTextDisplay` for Spanish card text (issue #391, from MarvelCDB's Spanish site): the same bracket tokens, worded in
 * Spanish. A token with no word (MarvelCDB's Spanish text has a stray `[rasgos]`) loses its brackets rather than
 * printing them.
 */
/** A resource's own name, for a run of resource icons ("gasta recursos [energy][mental]"). */
const RESOURCE_NAMES_ES: Readonly<Record<string, string>> = {
  energy: "energía",
  mental: "mental",
  physical: "físico",
  wild: "comodín",
};

/** "energía, mental y físico": a run of two or more resource icons, each named, so none runs into the next. */
const resourceRunEs = (run: string): string => {
  const names = [...run.matchAll(/\[(\w+)\]/g)].map((m) => RESOURCE_NAMES_ES[m[1]!] ?? m[1]!);
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
};

export function cardTextDisplayEs(text: string): string {
  return text
    .replace(/(?:\[(?:energy|mental|physical|wild)\]){2,}/g, resourceRunEs)
    .replace(/\[per_hero\]/g, " por héroe")
    .replace(/\[per_group\]/g, " por grupo")
    .replace(/\]\[/g, "] [")
    .replace(/\[([a-z_]+)\]/g, (_whole, key: string) => ICON_WORDS_ES[key] ?? key)
    .replace(/ {2,}/g, " ");
}
