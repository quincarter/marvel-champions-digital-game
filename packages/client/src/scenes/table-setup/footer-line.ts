import { t, tPlural } from "../../i18n/translate.js";

export interface FooterFacts {
  readonly villainName: string;
  /** The villain's starting stage ("I"), or null while there is no preview to read it from. */
  readonly stage: string | null;
  readonly difficulty: string;
  readonly heroes: number;
  readonly modulars: number;
  readonly blocked: string | null;
}

/**
 * The phone footer's one line: why the game cannot be dealt yet, or the villain at its stage ("Stage II", never a bare
 * numeral beside the difficulty, which read as the Standard set chip), the difficulty, the heroes and the modular sets.
 */
export function footerLineOf(facts: FooterFacts): string {
  if (facts.blocked) return facts.blocked;
  if (facts.stage === null) return `${facts.villainName} · ${facts.difficulty}`;
  return [
    t("tableSetup.villainStage", { name: facts.villainName, stage: facts.stage }),
    facts.difficulty,
    tPlural("tableSetup.heroes", facts.heroes),
    tPlural("tableSetup.modulars", facts.modulars),
  ].join(" · ");
}
