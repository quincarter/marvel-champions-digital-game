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
import { ensurePadGlyphTextures } from "../ui/pad-glyph-textures.js";
import { surface, typeRole, WEB_FONT_SAMPLE, WEB_FONTS } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { refreshUnlocks } from "../progression/progression.js";
import { SCENES } from "./keys.js";
import { goToScreen } from "../ui/transitions.js";
import type { SeatsData } from "./seats.js";
import type { SetCardsData } from "./set-cards.js";
import type { devScreenJump as DevScreenJump } from "./boot-dev-jump.js";
import { takeReplayLink } from "../replay/replay-link.js";
import { loadSharedReplay, type SharedReplayResult } from "../replay/shared-replay.js";
import type { ReplayVersusData } from "./replay-versus.js";
import { appReplayLinkOf, launchAppLink, offersDesktopApp } from "../platform/app-links.js";
import { SharedReplayLoading } from "../ui/replay-link-loading.js";
import { sceneLoader } from "./scene-loader.js";
import { needed } from "./scene-order.js";
import { bootWaitingOn, settledWithin } from "../ui/startup-watchdog.js";

/** How long Boot waits on the progress read before going on to Title without it (#871). */
const BOOT_PROGRESS_WAIT_MS = 6000;

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
    // Opened from a shared replay's link (issues #693, #858): read (and cleared) once, here rather than on Title, so the
    // link shows its own loading screen and goes straight to the board instead of passing through the title menu.
    const replayLink = takeReplayLink();
    // On the web version on a desktop, the replay can open in the installed app instead (#862).
    const openInApp =
      replayLink && replayLink !== "invalid" && offersDesktopApp()
        ? () => launchAppLink(appReplayLinkOf(replayLink))
        : null;
    const replayScreen = replayLink
      ? new SharedReplayLoading(this, () => goToScreen(this, SCENES.title), openInApp)
      : null;
    const replay = replayLink ? loadSharedReplay(replayLink, undefined, () => replayScreen?.loadingMods()) : null;
    if (replayLink && replayLink !== "invalid") this.#preloadBoard();
    if (!replayScreen) {
      this.add.text(width / 2, height / 2, "LOADING", textStyle(typeRole.label, surface.paper.hex, 0.6)).setOrigin(0.5);
    }

    this.scene.launch(SCENES.music);
    // The first player token's art, rasterized now so Set the table and the board have it on first draw.
    ensureFirstPlayerTokenTexture(this);
    // The controller button pictures, so a pad's first hints are drawn as pictures rather than swapped in a moment later.
    ensurePadGlyphTextures(this.textures);

    // Progress is read before Title (for up to six seconds, #871) so no screen draws a hero or scenario locked that the
    // player has earned.
    void Promise.all([this.#awaitFonts(), this.#awaitProgress()])
      .then(() => devScreenJump())
      .then((jump) => {
        // The Report button (#176), from here on: it draws in the top bar of each screen that leaves it a slot.
        this.scene.launch(SCENES.reportButton);
        // The music button (#191), beside it.
        this.scene.launch(SCENES.musicButton);
        // The card language button (#337), beside that.
        this.scene.launch(SCENES.languageButton);
        // The dark mode toggle (#459), at the top of every screen.
        this.scene.launch(SCENES.themeButton);
        // The power saving notice (`scenes/power-saving-notice.ts`), hidden until the mode turns on or off.
        this.scene.launch(SCENES.powerSavingNotice);
        // The "Achievement unlocked" popup (`scenes/achievement-toast.ts`), hidden until one is earned.
        this.scene.launch(SCENES.achievementToast);
        // Device sync's watcher (`scenes/sync-prompt.ts`): the conflict prompt and "Checking your other devices…".
        this.scene.launch(SCENES.syncPrompt);
        if (replay && replayScreen && !jump) {
          // Drawn again now that the fonts are in, with its button: Title can start from here.
          replayScreen.ready();
          void this.#openSharedReplay(replay, replayScreen);
          return;
        }
        // A `?screen=` dev jump wins over a replay link: close the replay if it opens.
        void replay?.then((result) => (result.ok ? result.host.dispose() : undefined));
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

  /** The shared replay, onto the board once it is open; the loading screen says why when it can't be. */
  async #openSharedReplay(replay: Promise<SharedReplayResult>, screen: SharedReplayLoading): Promise<void> {
    const result = await replay;
    if (screen.left || !this.sys.isActive()) {
      if (result.ok) result.host.dispose();
      return;
    }
    if (!result.ok) return screen.fail(result.message);
    // On the web version on a desktop, "Open in the desktop app" gets its moment even when the replay loaded fast.
    await screen.appOfferShown();
    if (screen.left || !this.sys.isActive()) return result.host.dispose();
    // On to the matchup, which puts the replay on the board (`scenes/replay-versus.ts`). Its code first: a chunk that
    // didn't arrive would otherwise leave this screen up with no way off it.
    screen.lock();
    try {
      await sceneLoader()?.load(SCENES.replayVersus);
    } catch {
      result.host.dispose();
      if (this.sys.isActive()) screen.fail("replay.link.offline");
      return;
    }
    if (!this.sys.isActive()) return result.host.dispose();
    goToScreen(this, SCENES.replayVersus, { host: result.host } satisfies ReplayVersusData);
  }

  /** The versus screen's and the Board's code, fetched while the replay is, so neither waits on a download after. */
  #preloadBoard(): void {
    const loader = sceneLoader();
    if (!loader) return;
    for (const key of [SCENES.replayVersus, ...needed(SCENES.board)]) void loader.load(key).catch(() => undefined);
  }

  /**
   * Waits for the player's progress, but never for long (#871): on iOS an IndexedDB open can stay pending for good, with
   * no error, right after the system killed and reloaded the tab, and Boot waiting on it left the player on LOADING.
   * Title reads progress again itself (its wait is capped), so a late read still reaches the menu.
   */
  async #awaitProgress(): Promise<void> {
    bootWaitingOn("saved progress");
    await settledWithin(
      refreshUnlocks().catch(() => false),
      BOOT_PROGRESS_WAIT_MS,
    );
    bootWaitingOn(null);
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
        Promise.all(WEB_FONTS.map((face) => fonts.load(face, WEB_FONT_SAMPLE))),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // A missing face is a cosmetic problem, not a reason not to start.
    }
  }
}
