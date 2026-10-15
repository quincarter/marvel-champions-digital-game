/**
 * What Table setup says about the Standard and Expert set choice (the "Standard set I / II / III" chips): which
 * encounter set each chip stands for, the line under the chips naming where each comes from, and the sentence the
 * set's Cards sheet opens with. A newcomer reading "II" had no way to know what it was (#161 follow-up).
 */
import type { SetupOptionRow } from "./setup-options.js";

export type DifficultySetKind = "standard" | "expert";

/** The encounter set a Standard/Expert chip action stands for: `standardSet:default` is the Core Set's own set. */
export function difficultySetIdOfAction(action: string): string | null {
  const match = /^(standard|expert)Set:(.+)$/.exec(action);
  if (!match) return null;
  return match[2] === "default" ? match[1]! : match[2]!;
}

/** The set the row has chosen now (the selected chip's), or the row's own default. */
export function chosenDifficultySetId(row: SetupOptionRow): string | null {
  if (row.control.kind !== "groups") return null;
  const chips = row.control.groups[0]?.chips ?? [];
  const chip = chips.find((c) => c.selected) ?? chips[0];
  return chip ? difficultySetIdOfAction(chip.action) : null;
}

export const kindOfRow = (row: SetupOptionRow): DifficultySetKind => (row.id === "expertSet" ? "expert" : "standard");

/** The line under the chips: what the set is, in a few words (its Cards sheet says where each version comes from). */
export function difficultySetLine(row: SetupOptionRow): string {
  return kindOfRow(row) === "expert" ? "Added on top in Expert mode." : "Encounter cards shuffled into every game.";
}

/** One section of the Standard/Expert sets sheet (`scenes/set-cards.ts`'s `SetCardsSection`). */
export interface DifficultySetSection {
  readonly setId: string;
  readonly heading: string;
  readonly note: string;
  readonly chosen: boolean;
}

/**
 * The sheet's sections: every set the rows offer (Standard I, II, III; in Expert mode the Expert sets after them), each
 * headed by its chip's name ("Standard II"), marked when it is the chosen one, and noting where it comes from and how many cards it has.
 */
export function difficultySetSections(
  rows: readonly SetupOptionRow[],
  productOf: (setId: string) => string,
  cardCountOf: (setId: string) => number,
): readonly DifficultySetSection[] {
  return rows.flatMap((row) => {
    if (row.control.kind !== "groups") return [];
    const kind = kindOfRow(row) === "expert" ? "Expert" : "Standard";
    return (row.control.groups[0]?.chips ?? []).flatMap((chip) => {
      const setId = difficultySetIdOfAction(chip.action);
      if (!setId) return [];
      return [
        {
          setId,
          heading: `${kind} ${chip.label}${chip.selected ? " · chosen" : ""}`,
          note: `From ${productOf(setId)} · ${cardCountOf(setId)} cards`,
          chosen: chip.selected,
        },
      ];
    });
  });
}

/** The sheet's line under its title: what these sets are and how to choose one. */
export function difficultySetsSubtitle(rows: readonly SetupOptionRow[]): string {
  const expert = rows.some((row) => kindOfRow(row) === "expert");
  return expert
    ? "Every game shuffles one Standard set into the encounter deck, and Expert mode adds one Expert set on top. Pick each with its I / II / III buttons."
    : "Every game shuffles one Standard set into the encounter deck. Pick which with the I / II / III buttons.";
}
