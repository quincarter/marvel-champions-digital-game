import { difficultyLabelOf } from "../../../view/difficulty-label.js";
import { draftModes } from "../../../view/setup-options.js";
import { towerDefenseSetupDamagePerHero } from "../../../view/setup-draft.js";
import { roomSetupActive } from "../../../view/room-table-setup.js";
import { lt } from "../text/lt.js";
import { footerLineOf } from "../summary/footer-line.js";
import type { TableModel } from "../model.js";
import type { SectionInputs } from "./sections.js";

/** What the screen itself holds beyond the draft: the seed field's text, the watch choice, which phone groups are open. */
export interface PageState {
  readonly seedText: string;
  readonly watchable: boolean;
  readonly starting: boolean;
  readonly status: string;
  readonly openGroups: ReadonlyMap<string, boolean>;
}

/** Slices the view model into what each section shows. */
export function sectionInputsOf(m: TableModel, s: PageState): SectionInputs {
  const { draft } = m;
  const modes = draftModes(draft);
  const difficulty = difficultyLabelOf({ difficulty: draft.difficulty, ...(modes ? { modes } : {}) });
  return {
    difficulty: {
      cards: m.difficultyCards,
      selected: draft.difficulty,
      setChoices: m.setChoices,
      optionRows: m.optionRows,
      towerDefense: {
        offered: m.towerDefense,
        on: draft.towerDefenseSetupDamage,
        perHero: towerDefenseSetupDamagePerHero(draft.difficulty, draft.heroicLevel),
      },
    },
    modulars: {
      cw: m.cw,
      villainName: m.villainName,
      required: m.requiredSets,
      options: m.modularOptions,
      hood: m.hoodOptions,
      randomSets: m.randomSets,
      right: m.modularRight,
      openGroups: s.openGroups,
    },
    seating: { seats: m.seats, room: roomSetupActive() },
    encounter: {
      composition: m.compositionRows,
      whatsInThere: m.whatsInThereRows,
      nemesis: m.nemesis,
      deckSize: m.encounterDeckSize,
    },
    summary: {
      rows: m.summaryRows,
      seedText: s.seedText,
      watchable: s.watchable,
      room: roomSetupActive(),
      scenario: m.scenario,
      villainName: m.villainName,
      showVillain: !m.cw,
      starting: s.starting,
      dealBlocked: m.dealBlocked,
      status: s.status,
      footerLine: footerLineOf({
        villainName: m.villainName,
        stage: m.preview?.villainStageLabel ?? null,
        difficulty: lt(difficulty ?? ""),
        heroes: m.players.length,
        modulars: m.pickedCount,
        blocked: m.dealBlocked,
      }),
    },
  };
}
