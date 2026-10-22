/**
 * Boot: load the fonts before any text is drawn, then hand off to Title.
 *
 * The design system's type rules are load-bearing — Bangers carries every
 * number the player reads at a glance — so drawing a screen in a fallback face
 * and swapping later would reflow the table. Phaser 4 can load a web font
 * directly, so the wait happens here and nowhere else.
 */

import Phaser from "phaser";
import { ensureFirstPlayerTokenTexture } from "../ui/first-player-token.js";
import { surface, typeRole, WEB_FONTS } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { refreshUnlocks } from "../progression/progression.js";
import { SCENES } from "./keys.js";
import { goToScreen } from "../ui/transitions.js";
import type { SeatsData } from "./seats.js";
import type { SetCardsData } from "./set-cards.js";
import type { devScreenJump as DevScreenJump } from "./boot-dev-jump.js";

/**
 * Dev-only screenshot entry point: `?screen=…` jumps straight past Title (`boot-dev-jump.ts`, which has the full list
 * and each jump's data). A production build never loads that module and always boots to Title.
 */
async function devScreenJump(): ReturnType<typeof DevScreenJump> {
  if (!import.meta.env.DEV) return null;
  return (await import("./boot-dev-jump.js")).devScreenJump();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    const { width, height } = this.scale.gameSize;
    this.add.text(width / 2, height / 2, "LOADING", textStyle(typeRole.label, surface.paper.hex, 0.6)).setOrigin(0.5);

    this.scene.launch(SCENES.music);
    // The first player token's art, rasterized now so Set the table and the board have it on first draw.
    ensureFirstPlayerTokenTexture(this);

    // Progress is read before Title so no screen draws a hero or scenario locked that the player has earned.
    void Promise.all([this.#awaitFonts(), refreshUnlocks().catch(() => false)])
      .then(() => devScreenJump())
      .then((jump) => {
        // The Report button (#176), from here on: it draws in the top bar of each screen that leaves it a slot.
        this.scene.launch(SCENES.reportButton);
        // The music button (#191), beside it.
        this.scene.launch(SCENES.musicButton);
        // The power saving notice (`scenes/power-saving-notice.ts`), hidden until the mode turns on or off.
        this.scene.launch(SCENES.powerSavingNotice);
        // The "Achievement unlocked" popup (`scenes/achievement-toast.ts`), hidden until one is earned.
        this.scene.launch(SCENES.achievementToast);
        // Device sync's watcher (`scenes/sync-prompt.ts`): the conflict prompt and "Checking your other devices…".
        this.scene.launch(SCENES.syncPrompt);
        if (!jump) {
          // Boot's own normal hand-off (no `?screen=` dev jump): a plain fade, same as every other
          // screen-to-screen move. The dev jumps below stay hard cuts — they're QA/screenshot entry
          // points (`scripts/shoot-app.mjs`), where landing on the target screen instantly matters
          // more than a fade "reads as a page turning".
          //
          // Always Title. The first-run "New to the fight?" chooser comes after the player presses New game
          // (`scenes/title.ts#newGame`, `docs/guided-mode.md` §3.9), never before Title.
          goToScreen(this, SCENES.title);
          return;
        }
        // `pause`'s own screenshot needs the Board running underneath it,
        // exactly like a real pause — `scene.launch`, never `scene.start`,
        // so Board keeps drawing (`scenes/pause.ts`'s own doc comment: "the
        // board keeps running underneath, exactly like every other overlay").
        if (jump.key === SCENES.nameConflict) {
          const { backdrop, ...sheet } = jump.data as { backdrop: SeatsData } & Record<string, unknown>;
          this.scene.start(SCENES.seats, backdrop);
          this.scene.launch(SCENES.nameConflict, { ...sheet, from: SCENES.seats });
        } else if (jump.key === SCENES.rules || jump.key === SCENES.settings || jump.key === SCENES.inspect) {
          this.scene.start(SCENES.board);
          this.scene.launch(jump.key, jump.data);
        } else {
          this.scene.start(jump.key, jump.data);
        }
        const params = new URLSearchParams(location.search);
        // `?screen=set-cards[&set=<encounter set id>]`: Table setup (Rhino) with the set-cards sheet open over it.
        if (params.get("screen") === "set-cards") {
          this.scene.launch(SCENES.setCards, {
            setId: params.get("set") ?? "bomb_scare",
            action: { label: "Add this set", enabled: true },
            from: SCENES.setup,
          } satisfies SetCardsData);
          this.scene.bringToTop(SCENES.setCards);
        }
        if (params.get("screen") === "pause") this.scene.launch(SCENES.pause);
        if (params.get("screen") === "board" && params.get("guidedemo") === "1") {
          this.scene.launch(SCENES.guideSpotlightDemo);
        }
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
