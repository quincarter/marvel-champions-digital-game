/**
 * Boot: load the fonts before any text is drawn, then hand off to Title.
 *
 * The design system's type rules are load-bearing — Bangers carries every
 * number the player reads at a glance — so drawing a screen in a fallback face
 * and swapping later would reflow the table. Phaser 4 can load a web font
 * directly, so the wait happens here and nowhere else.
 */

import Phaser from "phaser";
import { surface, typeRole, WEB_FONTS } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { POOL_SCENARIOS } from "../content/pool.js";
import { preconDecks } from "../view/deck-list-model.js";
import { POOL_VERSION } from "../content/pool.js";
import { initialSetupDraft } from "../view/setup-draft.js";
import { rollSeed } from "../view/seed.js";
import { SCENES } from "./keys.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { SeatsData } from "./seats.js";
import type { TableSetupData } from "./table-setup.js";

/**
 * Dev-only screenshot entry point: `?screen=scenario-select|seats|table-setup`
 * jumps straight past Title with a fresh default `SetupDraft`, for visual QA
 * against the design canvases (docs/design-reference.md) without scripting a
 * click-through of the whole setup flow. Never reachable in a normal session
 * — Title's own "New game" is still the only in-game way to reach these
 * scenes — and harmless if left in a production build (an unrecognized or
 * absent `screen` param falls through to Title as usual).
 */
function devScreenJump(): { readonly key: string; readonly data: object } | null {
  const screen = new URLSearchParams(location.search).get("screen");
  if (!screen) return null;
  const draft = initialSetupDraft({
    scenarioId: POOL_SCENARIOS[0]!.id as string,
    seatDeckId: preconDecks(POOL_VERSION)[0]!.id as string,
    seed: rollSeed(),
  });
  if (screen === "scenario-select") return { key: SCENES.scenarioSelect, data: { draft } satisfies ScenarioSelectData };
  if (screen === "seats") return { key: SCENES.seats, data: { draft } satisfies SeatsData };
  if (screen === "table-setup") return { key: SCENES.setup, data: { draft } satisfies TableSetupData };
  return null;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    const { width, height } = this.scale.gameSize;
    this.add
      .text(width / 2, height / 2, "LOADING", textStyle(typeRole.label, surface.paper.hex, 0.6))
      .setOrigin(0.5)
      .setLetterSpacing(typeRole.label.letterSpacing);

    void this.#awaitFonts().then(() => {
      const jump = devScreenJump();
      if (jump) this.scene.start(jump.key, jump.data);
      else this.scene.start(SCENES.title);
    });
  }

  /**
   * Waits for the three families, but never blocks the game on the network: a
   * font that fails to arrive falls back rather than leaving a dead screen.
   */
  async #awaitFonts(): Promise<void> {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    try {
      await Promise.race([
        Promise.all(WEB_FONTS.map((face) => fonts.load(face))),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // A missing face is a cosmetic problem, not a reason not to start.
    }
  }
}
