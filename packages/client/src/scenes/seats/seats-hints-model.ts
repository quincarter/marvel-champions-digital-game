/**
 * The wide layout's heading and key hints row (`mc-seats-hints`): "Heroes, seat N of 4" and the keys or buttons that pick the
 * seat (LB / RB), clear it (X) and move between the filters and the list (Y). The word after Y says what Y does where focus
 * is now: back to the list from the filters, Inspect on a hero tile, else Filters. With a controller in use the Filters button
 * carries the Y glyph, so it is not repeated here. A hint shows only while a keyboard or pad is in use (the glyph says so).
 */
import type { SeatsHintsModel } from "../../components/seats/seats.types.js";
import type { ControlGlyphs } from "../../dom/control-glyphs.js";
import { t } from "../../i18n/translate.js";
import { areaOf, type FocusAreas } from "../../view/focus-areas.js";
import type { ShortcutId } from "../../view/input-shortcuts.js";
import { MAX_SEATS } from "../../view/seats-layout.js";
import { padGlyphsShown } from "./seats-paging.js";

/** The hint glyphs' control height: `glyphHeightFor` makes it the old 16px glyph. */
const HINT_CONTROL = 28;

/** What the word after the Y glyph says where focus is now. */
export function yWordFor(key: string | null, areas: FocusAreas, padOnFilters: boolean): string {
  if (padOnFilters) return t("seats.hintFilters");
  if (areaOf(key, areas) === "filters") return t("seats.hintList");
  return key !== null && /^hero(-rec)?:/.test(key) ? t("seats.hintInspect") : t("seats.hintFilters");
}

export interface HintsInput {
  readonly glyphs: ControlGlyphs;
  readonly activeSeat: number;
  readonly focused: string | null;
  readonly areas: FocusAreas;
  /** A controller is the input in use (the chips fold behind the Filters button). */
  readonly padMode: boolean;
}

export function hintsModelOf(input: HintsInput): SeatsHintsModel {
  const { glyphs } = input;
  const pad = padGlyphsShown(glyphs.snapshot);
  const hint = (key: string, ids: readonly ShortcutId[], word: string) => ({
    word,
    glyph: glyphs.glyph(key, ids, "paper", HINT_CONTROL) ?? null,
  });
  const y = hint("hint-y", ["inspect"], yWordFor(input.focused, input.areas, pad && input.padMode));
  return {
    heading: t("seats.heroesHeading", { seat: input.activeSeat + 1, max: MAX_SEATS }),
    hints: [
      hint("hint-seat", ["zonePrevious", "zoneNext"], t("seats.hintSeat")),
      hint("hint-clear", ["guide"], t("seats.clearSeat")),
      // With a controller the Filters button carries the Y glyph; the keyboard Inspect key stays.
      pad && input.padMode ? { ...y, glyph: null } : y,
    ],
  };
}
