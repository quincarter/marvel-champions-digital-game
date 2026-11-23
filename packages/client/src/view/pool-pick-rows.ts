/**
 * The rows of the deck builder's pack and wave picker (issue #977, benpap24): every choice as a row that toggles, under
 * a heading each time its group (a pack's wave) changes. Plain data, so the sheet scene only draws it.
 */
import type { FilterChoice } from "./deck-builder-model.js";

export type PoolPickRow =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "choice"; readonly id: string; readonly name: string; readonly selected: boolean };

/** `choices` in order, a heading before each run of one group; choices with no group get none. */
export function poolPickRowsOf(
  choices: readonly FilterChoice[],
  chosen: readonly string[] | null | undefined,
): readonly PoolPickRow[] {
  const picked = new Set(chosen ?? []);
  const rows: PoolPickRow[] = [];
  let group: string | undefined;
  for (const choice of choices) {
    if (choice.group !== undefined && choice.group !== group) rows.push({ kind: "heading", text: choice.group });
    group = choice.group;
    rows.push({ kind: "choice", id: choice.id, name: choice.name, selected: picked.has(choice.id) });
  }
  return rows;
}

/**
 * The picker's choices: what the pool offers, plus any pick it doesn't offer right now (another filter has emptied
 * that pack or wave), placed where it falls in `all`'s release order. A pick is never dropped behind the player's back:
 * it stays listed and ticked until they untick it (PR #980 review).
 */
export function choicesWithPicks(
  offered: readonly FilterChoice[],
  chosen: readonly string[] | null | undefined,
  all: readonly FilterChoice[],
): readonly FilterChoice[] {
  const shown = new Set(offered.map((choice) => choice.id));
  const picked = new Set(chosen ?? []);
  if ([...picked].every((id) => shown.has(id))) return offered;
  return all.filter((choice) => shown.has(choice.id) || picked.has(choice.id));
}
