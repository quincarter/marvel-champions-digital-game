/** The ink top bar: Back, "Set the table" kept clear of the dark mode tab, and the step. `compact` is the phone's smaller bar. */
import type Phaser from "phaser";
import type { Rect } from "../../../view/layout.js";
import { ink, surface, typeRole } from "../../../tokens.js";
import { sheetThemeFor } from "../../../ui/campaign-chrome.js";
import type { SheetGlyphs } from "../../../dom/sheet-glyphs.js";
import { t } from "../../../i18n/translate.js";
import { press, type Frame } from "../shared/frame.js";

export function topBar(
  f: Frame,
  glyphs: SheetGlyphs,
  scene: Phaser.Scene,
  bar: { readonly headerBar: Rect; readonly back: Rect; readonly step: Rect },
  compact: boolean,
  back: () => void,
): void {
  const { b } = f;
  const height = bar.headerBar.height;
  glyphs.button(b, {
    key: "back",
    rect: bar.back,
    label: compact ? "◂" : t("tableSetup.back"),
    look: "onInk",
    type: compact ? { ...typeRole.backLabel, size: 20 } : typeRole.backLabel,
    ids: ["cancel"],
    ground: "ink",
  });
  press(f, "back", bar.back, back, { noTap: true });
  const titleX = bar.back.x + bar.back.width + (compact ? 12 : 16);
  const size = compact ? 22 : 28;
  const room = bar.step.x - titleX - (compact ? 8 : 12);
  // The dark mode tab hangs from the top centre: the shared rule drops the title under it or ends it before it.
  const { drop, maxRight } = sheetThemeFor(scene, {
    width: bar.headerBar.width,
    textLeft: titleX,
    textRight: titleX + room,
    textTop: height / 2 - size / 2,
    textHeight: size,
    barHeight: height,
  });
  b.text(titleX, height / 2 + drop, t("tableSetup.title"), typeRole.pageTitle, {
    color: surface.paper.hex,
    origin: [0, 0.5],
    size,
    fitWidth: maxRight === null ? room : Math.max(40, Math.min(room, maxRight - titleX)),
  });
  b.text(
    bar.step.x + bar.step.width,
    height / 2,
    t(compact ? "tableSetup.stepShort" : "tableSetup.step"),
    typeRole.label,
    {
      color: surface.paper.hex,
      alpha: ink.label,
      origin: [1, 0.5],
    },
  );
}
