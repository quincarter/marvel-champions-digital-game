/**
 * A character's numbers as one line of words ("HP 12/12 · REC 4"), for a row too short for the stat badges. Words and
 * numbers, never a colour alone; a printed dash stays a dash.
 */
import type { CharacterPanel } from "./board-model.js";

export function statWords(panel: Pick<CharacterPanel, "stats" | "hp">): string {
  const parts: string[] = [];
  if (panel.hp) parts.push(`HP ${panel.hp.current}/${panel.hp.max}`);
  for (const tile of panel.stats) if (tile.label !== "HP") parts.push(`${tile.label} ${tile.value}`);
  return parts.join(" · ");
}
