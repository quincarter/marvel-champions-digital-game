/** Slices the view model into what each section of the page shows, and gathers the pictures they draw. */
import type { PackLeases } from "../../art/pack-art.js";
import type { ControlGlyphs } from "../../dom/control-glyphs.js";
import { difficultyLabelOf } from "../../view/difficulty-label.js";
import { roomSetupActive } from "../../view/room-table-setup.js";
import { towerDefenseSetupDamagePerHero } from "../../view/setup-draft.js";
import { draftModes } from "../../view/setup-options.js";
import type { TableSetupPageInput } from "../../views/table-setup/mc-table-setup-page/mc-table-setup-page.types.js";
import type { TableModel } from "./model.js";
import { footerLineOf } from "./footer-line.js";
import { setPicturesOf, seatPicturesOf, villainOf } from "./pictures.js";
import { padGlyphsShown } from "../seats/seats-paging.js";
import { lt } from "./text/lt.js";

/** What the screen itself holds beyond the draft: the seed field's text, the watch choice, which phone groups are open. */
export interface PageState {
  readonly seedText: string;
  readonly watchable: boolean;
  readonly starting: boolean;
  readonly status: string;
  readonly openGroups: ReadonlyMap<string, boolean>;
  /** Where the dark mode tab leaves the top bar's title room. */
  readonly title: { readonly drop: number; readonly max: number };
}

/** The Back and Deal buttons' control heights, for the glyphs hung on them. */
const BACK_HEIGHT = 44;
const DEAL_HEIGHT = 56;

export function pageInputOf(
  m: TableModel,
  s: PageState,
  leases: PackLeases,
  glyphs: ControlGlyphs,
  wide: boolean,
): TableSetupPageInput {
  const { draft } = m;
  const modes = draftModes(draft);
  const difficulty = difficultyLabelOf({ difficulty: draft.difficulty, ...(modes ? { modes } : {}) });
  const room = roomSetupActive();
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
      pictures: setPicturesOf(m.modularOptions, leases),
    },
    seating: { seats: m.seats, room, pictures: seatPicturesOf(m.seats, leases) },
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
      room,
      villain: m.cw ? null : villainOf(m.scenario, m.villainName, leases),
    },
    deal: {
      starting: s.starting,
      room,
      blocked: m.dealBlocked,
      status: s.status || (m.dealBlocked ?? ""),
      // Start deals, so the pad shows its glyph on Deal; the keyboard has no key for it.
      glyph: padGlyphsShown(glyphs.snapshot) ? glyphs.glyph("deal", ["pause"], "ink", DEAL_HEIGHT) : undefined,
      footerLine: footerLineOf({
        villainName: m.villainName,
        stage: m.preview?.villainStageLabel ?? null,
        difficulty: lt(difficulty ?? ""),
        heroes: m.players.length,
        modulars: m.pickedCount,
        blocked: m.dealBlocked,
      }),
    },
    // A phone's Back is a plain arrow with no room for a glyph, as it always was.
    backGlyph: wide ? glyphs.glyph("back", ["cancel"], "ink", BACK_HEIGHT) : undefined,
    titleDrop: s.title.drop,
    titleMax: s.title.max,
  };
}
