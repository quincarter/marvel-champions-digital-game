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
    .replace(/\[([a-z]+)\]/g, (whole, key: string) => ICON_WORDS[key] ?? whole)
    .replace(/\b([A-Z][a-z]+)_([A-Z][a-z]+)\b/g, "$1 $2")
    .replace(/ {2,}/g, " ");
}
