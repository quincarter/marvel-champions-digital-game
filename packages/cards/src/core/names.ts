import { CORE_CARDS } from "@mc/content";

/**
 * The exact current printed name of a Core card, by code. Scripts that search
 * for or check "a card named X" use this so the name always matches the data
 * (including errata'd titles such as M.O.D.O.K.).
 */
export function cardName(code: string): string {
  const card = CORE_CARDS.find((c) => c.id === code);
  if (!card) throw new Error(`no Core card ${code}`);
  return card.name;
}
