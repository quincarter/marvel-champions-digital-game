/**
 * The Briefing's mode section (`view/campaign-modes-model.ts`): a heading and one row per mode, its name and line of state over
 * full-size chips (ink when chosen, the state in words as well as in colour). A chip the model disables is shown and takes no
 * press; a press reports its action and the scene stores the mode and composes the issue again.
 */
import { t } from "../../../../../i18n/translate.js";
import { hit, ink, surface, typeRole } from "../../../../../tokens.js";
import { bangers } from "../../../../../ui/campaign-chrome.js";
import { drawRuleHeading } from "../../handled.js";
import type { ModeRowText, ModesEvents, ModesInput } from "./modes.types.js";
import { modeRowTextIn } from "./modes-text.js";

const ROW_GAP = 10;
const CHIP_GAP = 6;
/** The widest a chip gets, so a two-chip row on a wide column does not read as two banners. */
const CHIP_MAX_WIDTH = 120;
const NAME_HEIGHT = 22;

function drawRow({ b, col, ctx }: ModesInput, y: number, row: ModeRowText, key: string, events: ModesEvents): number {
  const name = b.text(col.x, y, row.name.toLocaleUpperCase(), bangers(16), { color: surface.ink.hex });
  b.text(col.x + name.width + 10, y + 2, row.meta, typeRole.body, {
    color: surface.ink.hex,
    alpha: ink.secondary,
    fitWidth: col.width - name.width - 10,
  });
  const top = y + NAME_HEIGHT;
  const width = Math.min(
    CHIP_MAX_WIDTH,
    (col.width - CHIP_GAP * (row.chips.length - 1)) / Math.max(1, row.chips.length),
  );
  row.chips.forEach((chip, index) => {
    const rect = { x: col.x + index * (width + CHIP_GAP), y: top, width, height: hit.target };
    const id = `mode:${chip.action || `${key}:${index}`}`;
    const live = chip.enabled && chip.action !== "";
    b.button({
      key: id,
      rect,
      label: chip.text,
      look: "rail",
      selected: chip.selected,
      ...(live || chip.selected ? {} : { disabled: true as const }),
      type: typeRole.sectionHeader,
    });
    if (!live) return;
    col.control(id, rect, () => events.choose(chip.action));
    ctx.obstacles.push(rect);
  });
  return top + hit.target + ROW_GAP;
}

/** Draws the section from `top`; returns its bottom. */
export function drawModes(input: ModesInput, events: ModesEvents): number {
  const { b, col, rows } = input;
  let y = drawRuleHeading(b, col.x, input.top, col.width, t("briefing.modes.heading")) + 2;
  for (const row of rows) y = drawRow(input, y, modeRowTextIn(row), row.id, events);
  return y - ROW_GAP;
}
