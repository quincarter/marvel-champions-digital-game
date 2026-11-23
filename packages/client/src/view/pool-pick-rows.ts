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
 * The picks that still mean something: those `choices` still offer, in their order. A pick the other filters have
 * since emptied is dropped when the player changes the list, so it never hides cards they can't see to untick.
 */
export function offeredPicks(chosen: readonly string[], choices: readonly FilterChoice[]): readonly string[] {
  const picked = new Set(chosen);
  return choices.filter((choice) => picked.has(choice.id)).map((choice) => choice.id);
}
