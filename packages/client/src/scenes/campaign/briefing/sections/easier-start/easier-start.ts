/**
 * The Briefing's easier-start toggle, drawn as the setup screen's option card: one framed card that is the whole button, a
 * Hero Red frame while on, its name and one short line of state (off is a choice, not a dead control: full-strength frame and
 * text, the state in words). It is the calls' option tile, so it presses, focuses and dims as a call's tiles do. The model
 * (`view/campaign-easier-start-model.ts`) decides where it applies; this only draws and reports the press.
 */
import { t } from "../../../../../i18n/translate.js";
import { drawOptionTile } from "../../calls/option-tile.js";
import { drawRuleHeading } from "../../handled.js";
import type { EasierStartEvents, EasierStartInput } from "./easier-start.types.js";

/** A full 44px touch target with 8px around the two lines. */
export const EASIER_START_CARD_HEIGHT = 64;

/** The stop and press key, as the pad's route and the specs know it. */
export const EASIER_START_KEY = "easier-start";

/** Draws the section from `top`; returns its bottom. */
export function drawEasierStart({ b, col, top, easier }: EasierStartInput, events: EasierStartEvents): number {
  const y = drawRuleHeading(b, col.x, top, col.width, t("briefing.easier.heading")) + 2;
  drawOptionTile(b, col, {
    key: EASIER_START_KEY,
    rect: { x: col.x, y, width: col.width, height: EASIER_START_CARD_HEIGHT },
    title: t("briefing.easier.name"),
    body: t(easier.on ? "briefing.easier.on" : "briefing.easier.off"),
    available: true,
    on: easier.on,
    onPick: events.toggle,
  });
  return y + EASIER_START_CARD_HEIGHT;
}
