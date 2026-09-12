/**
 * Game over. The design's overlay-sheet shape as a full screen: what happened,
 * the round it happened in, and one red forward action back to setup.
 */

import Phaser from "phaser";
import { dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, label, paintDotGrid } from "../ui/widgets.js";
import { formFactorFor } from "../view/layout.js";
import { appSession } from "../session.js";
import { SCENES } from "./keys.js";

const REASONS: Record<string, string> = {
  villainDefeated: "The villain is defeated.",
  mainSchemeCompleted: "The main scheme completed.",
  allPlayersDefeated: "Every hero is defeated.",
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.gameOver);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    const state = appSession().store.state;
    const outcome = state.game?.outcome;
    const won = outcome?.result === "win";

    const titleSize = phone ? 48 : 92;
    this.add
      .text(width / 2, height / 2 - titleSize, won ? "VICTORY" : "DEFEAT", {
        ...textStyle(typeRole.screenTitle, won ? signal.heal.hex : surface.ink.hex),
        fontSize: `${titleSize}px`,
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);

    this.add
      .text(width / 2, height / 2, outcome ? (REASONS[outcome.reason] ?? outcome.reason) : "", textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0.5);
    label(this, width / 2, height / 2 + 22, `round ${state.game?.round ?? 0} · ${state.version} commands`, typeRole.mono, surface.ink.hex, ink.meta)
      .setOrigin(0.5);

    const buttonWidth = Math.min(width - 40, 320);
    new McButton(this, {
      kind: "primary",
      label: "New game",
      type: typeRole.barTitle,
      rect: { x: (width - buttonWidth) / 2, y: height / 2 + 60, width: buttonWidth, height: hit.primary },
      onClick: () => this.scene.start(SCENES.title),
    });
  }
}
