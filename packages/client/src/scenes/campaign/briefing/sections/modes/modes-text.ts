/**
 * The modes' words. The models (`campaign-modes-model.ts`, `play-mode-options.ts`) write each row's name, its line of state and
 * its chips' labels in English; the row's id and the chip's own label say which, so they are said here in the player's
 * language. A label this does not know (a Roman stage numeral, "−", "+", a level) is shown as the model wrote it.
 */
import { t } from "../../../../../i18n/translate.js";
import type { IssueModeRow } from "../../../../../view/campaign-modes-model.js";
import type { ModeRowText } from "./modes.types.js";

const CHIP_LABELS: Readonly<Record<string, string>> = {
  Standard: "briefing.modes.standard",
  Expert: "briefing.modes.expert",
  Off: "briefing.modes.off",
  On: "briefing.modes.on",
};

const chipTextIn = (label: string): string => {
  const key = CHIP_LABELS[label];
  return key ? t(key as Parameters<typeof t>[0]) : label;
};

/** The heroic level the stepper's value chip shows ("Off" is 0). */
const levelOf = (row: IssueModeRow): number => {
  const value = row.chips.find((chip) => chip.action === "")?.label ?? "Off";
  return Number(value) || 0;
};

function metaIn(row: IssueModeRow): string {
  if (row.id === "expert")
    return t(row.meta.startsWith("Expert") ? "briefing.modes.meta.expert" : "briefing.modes.meta.standard");
  if (row.id === "heroic") {
    const level = levelOf(row);
    return level > 0
      ? t(level === 1 ? "briefing.modes.meta.heroic_one" : "briefing.modes.meta.heroic_other", { level })
      : t("briefing.modes.off");
  }
  if (row.id === "skirmish") {
    if (row.meta.startsWith("Only stage "))
      return t("briefing.modes.meta.stage", { stage: row.meta.slice("Only stage ".length) });
    return row.meta.startsWith("On") ? t("briefing.modes.meta.skirmishOn") : t("briefing.modes.off");
  }
  return row.meta;
}

const nameIn = (row: IssueModeRow): string =>
  row.id === "expert"
    ? t("briefing.modes.difficulty")
    : row.id === "heroic"
      ? t("briefing.modes.heroic")
      : row.id === "skirmish"
        ? t("briefing.modes.skirmish")
        : row.name;

export const modeRowTextIn = (row: IssueModeRow): ModeRowText => ({
  name: nameIn(row),
  meta: metaIn(row),
  chips: row.chips.map((chip) => ({ ...chip, text: chipTextIn(chip.label) })),
});
