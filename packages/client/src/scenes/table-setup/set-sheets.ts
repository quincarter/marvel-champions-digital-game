/** The "cards in this set" sheets Set up the table opens over itself (`set-cards.ts`), one set's or every set a row offers. */
import type Phaser from "phaser";
import { currentCardsById, currentEncounterSets, packNameOf, POOL_ENCOUNTER_SETS } from "../../content/pool.js";
import { t } from "../../i18n/translate.js";
import { setSheetFor } from "../../view/civil-war-builder-model.js";
import { difficultySetSections, difficultySetsSubtitle } from "../../view/difficulty-sets.js";
import { SCENES } from "../keys.js";
import type { SetCardsData } from "../set-cards.js";
import type { TableModel } from "./model.js";

/** The product a Standard or Expert set comes from ("Core Set", "The Hood"), by the set's own pack. */
const setProductName = (setId: string): string => {
  const code = POOL_ENCOUNTER_SETS.find((set) => (set.id as string) === setId)?.packCodes[0];
  return code ? packNameOf(code as string) : setId;
};

/** One set's cards, with "Add this set" / "Remove this set" at the sheet's foot. */
export function openSetCards(scene: Phaser.Scene, model: TableModel | null, setId: string): void {
  const option = model?.modularOptions.find((o) => o.id === setId);
  if (!option) return;
  scene.scene.launch(SCENES.setCards, {
    setId,
    action: {
      label: t(option.selected ? "tableSetup.removeSet" : "tableSetup.addSet"),
      enabled: !(option.disabledReason !== null && !option.selected),
    },
    from: SCENES.setup,
  } satisfies SetCardsData);
  scene.scene.bringToTop(SCENES.setCards);
}

/** "Cards" on a Standard/Expert set row: one sheet with every set the rows offer, each under where it comes from. */
export function openSetsSheet(scene: Phaser.Scene, model: TableModel | null): void {
  const rows = model?.setChoices ?? [];
  const ctx = { cards: currentCardsById(), encounterSets: currentEncounterSets() };
  const sections = difficultySetSections(rows, setProductName, (id) => setSheetFor(ctx, id).totalCards);
  if (sections.length === 0) return;
  scene.scene.launch(SCENES.setCards, {
    setId: sections[0]!.setId,
    title: t(rows.length > 1 ? "tableSetup.setsBoth" : "tableSetup.setsStandard"),
    subtitle: difficultySetsSubtitle(rows),
    sections,
    from: SCENES.setup,
  } satisfies SetCardsData);
  scene.scene.bringToTop(SCENES.setCards);
}
