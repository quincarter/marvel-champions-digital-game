/**
 * The Difficulty section: the difficulty cards (a row on wide, a segment strip on the phone), the Standard / Expert set
 * choices folded into the row's spare slot, the setup-option cards under it and Tower Defense's toggle. It draws what
 * `DifficultyInput` says and raises `DifficultyEvents`; it reads no other section's state.
 */
import type { Rect } from "../../../view/layout.js";
import { ink, surface, typeRole } from "../../../tokens.js";
import {
  COMPACT_DIFFICULTY_ROW_HEIGHT,
  COMPACT_ROW_GAP,
  difficultySlotRect,
} from "../../../view/table-setup-layout.js";
import { isSetChoiceRow } from "../../../view/setup-options.js";
import { t } from "../../../i18n/translate.js";
import { cardFrame, heading, nameText, press, segment, type Frame } from "../shared/frame.js";
import { toggleRow } from "../shared/toggle-row.js";
import type { DifficultyEvents, DifficultyInput } from "./difficulty.types.js";
import { compactSetRow, optionCard, setsCard } from "./option-cards.js";

/** Where the wide and tablet-portrait layouts put the section's parts (`TableSetupLayout`). */
export interface DifficultyLayout {
  readonly wide: boolean;
  readonly header: Rect;
  readonly row: Rect;
  readonly slots: number;
  readonly setsCard: Rect;
  readonly setsInline: boolean;
  readonly optionCards: readonly Rect[];
  readonly towerDefenseRow: Rect;
}

/** Tower Defense's detail line ("Chosen: place N damage..." or "Off: ..."). */
const towerDefenseMeta = (input: DifficultyInput): string =>
  t(input.towerDefense.on ? "tableSetup.td.on" : "tableSetup.td.off", { n: input.towerDefense.perHero });

/** The whole section on a wide screen or a tablet in portrait. */
export function drawDifficulty(
  f: Frame,
  input: DifficultyInput,
  on: DifficultyEvents,
  layout: DifficultyLayout,
  body: number,
): void {
  heading(f.b, layout.header.x, layout.header.y, layout.header.width, t("tableSetup.difficulty"), body);
  input.cards.forEach((card, index) => {
    const r = difficultySlotRect(layout.row, layout.slots, index);
    cardFrame(f.b, r, input.selected === card.id);
    nameText(f.b, r.x + 10, r.y + 8, r.width - 20, card.name, 18);
    f.b.text(r.x + 10, r.y + 30, card.description, typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: r.width - 20,
      maxLines: Math.max(1, Math.floor((r.height - 34) / 14)),
    });
    press(f, `difficulty:${card.id}`, r, () => on.pick(card.id));
  });
  if (input.setChoices.length > 0) setsCard(f, on, layout.setsCard, input.setChoices, layout.setsInline);
  input.optionRows.forEach((row, index) => {
    const rect = layout.optionCards[index];
    if (rect) optionCard(f, on, rect, row, false);
  });
  const td = layout.towerDefenseRow;
  if (layout.wide && input.towerDefense.offered && td.height > 0) {
    cardFrame(f.b, td, input.towerDefense.on);
    nameText(f.b, td.x + 10, td.y + 8, td.width - 20, t("tableSetup.td.name"), 18);
    f.b.text(td.x + 10, td.y + 30, towerDefenseMeta(input), typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.secondary,
    });
    press(f, "towerDefenseSetupDamage", td, on.toggleTowerDefense);
  }
}

/** One of the section's phone rows, by the layout's row id; true when the id was one of its own. */
export function drawCompactDifficulty(
  f: Frame,
  input: DifficultyInput,
  on: DifficultyEvents,
  id: string,
  rect: Rect,
): boolean {
  if (id === "difficulty") {
    const gap = 2;
    const width = (rect.width - gap * (input.cards.length - 1)) / input.cards.length;
    input.cards.forEach((card, i) => {
      const r: Rect = { x: rect.x + i * (width + gap), y: rect.y, width, height: COMPACT_DIFFICULTY_ROW_HEIGHT };
      segment(f.b, r, card.name, input.selected === card.id, 17);
      press(f, `difficulty:${card.id}`, r, () => on.pick(card.id), { scroll: "page" });
    });
    return true;
  }
  if (id.startsWith("option:")) {
    const row = [...input.setChoices, ...input.optionRows].find((r) => r.id === id.slice("option:".length));
    // The row's height includes the gap to the next one; the card itself stops short of it.
    const card: Rect = { ...rect, height: rect.height - COMPACT_ROW_GAP };
    if (row && isSetChoiceRow(row)) compactSetRow(f, on, card, row, "page");
    else if (row) optionCard(f, on, card, row, true, "page");
    return true;
  }
  if (id === "towerDefenseSetupDamage") {
    toggleRow(f, rect, {
      key: id,
      selected: input.towerDefense.on,
      name: t("tableSetup.td.name"),
      meta: towerDefenseMeta(input),
      run: on.toggleTowerDefense,
    });
    return true;
  }
  return false;
}
