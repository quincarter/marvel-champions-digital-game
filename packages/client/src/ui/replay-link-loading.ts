/**
 * The shared replay loading screen (issue #858): what Boot shows in place of the title menu when the game is opened
 * from a `#replay=` link, until the replay is on the board. While it loads: a spinner, "Loading the shared replay…" and
 * Cancel. If it can't be opened: why, and Main menu. Both buttons go to Title; Enter / A and Escape / B press them.
 */
import Phaser from "phaser";
import { t, type MessageKey } from "../i18n/translate.js";
import { accent, hit, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "./theme.js";
import { McButton } from "./widgets.js";
import { TITLE_ART, coverFit, pickTitleArtFor, titleArtSizeOf, type TitleArt } from "../art/title-art.js";
import { ensurePictureLoaded } from "../art/pictures.js";
import { drawnDensity } from "../platform/screen-settings.js";
import { appSession } from "../session.js";
import { FocusRoute } from "../scenes/focus-route.js";
import { REPLAY_LINK_SPINNER_RADIUS, replayLinkBodyWidth, replayLinkScreenLayout } from "../view/replay-link-screen.js";

const BUTTON_TYPE = { ...typeRole.label, size: 13 };
const ACTION_ID = "replay-link-action";
/** How strongly the title art shows through behind the panel. */
const ART_ALPHA = 0.35;

export class SharedReplayLoading {
  readonly #scene: Phaser.Scene;
  readonly #toMenu: () => void;
  readonly #objects: Phaser.GameObjects.GameObject[] = [];
  readonly #route: FocusRoute;
  #button: McButton | null = null;
  #failure: MessageKey | null = null;
  #left = false;
  /** The replay is open and going onto the board: leaving now would race that. */
  #locked = false;
  /** Waiting on the installed mod packs (`loadingMods`). */
  #mods = false;
  /** Boot has the fonts and the player's progress: Title can start, so the button can show. */
  #ready = false;
  /** Boot has shut down: nothing more to draw. (`sys.isActive()` is still false while `create` runs.) */
  #gone = false;
  /** One of the title screen's pictures, drawn faded behind the panel once it has loaded. */
  readonly #art: TitleArt | null;

  /** `toMenu` leaves for Title: Cancel while loading, Main menu after a failure. */
  constructor(scene: Phaser.Scene, toMenu: () => void) {
    this.#scene = scene;
    this.#toMenu = toMenu;
    this.#route = new FocusRoute(scene, { onCancel: () => this.#leave(), primary: () => ACTION_ID });
    const { width, height } = scene.scale.gameSize;
    this.#art = pickTitleArtFor(TITLE_ART, titleArtSizeOf, { width, height }, drawnDensity());
    // Through the shared loader, as Title does: Title may load the same picture next.
    if (this.#art) ensurePictureLoaded(scene, this.#art, () => this.draw());
    scene.scale.on("resize", this.draw, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#gone = true;
      scene.scale.off("resize", this.draw, this);
      this.#clear();
    });
    this.draw();
  }

  /** True once the player chose to leave (Cancel or Main menu): a replay that arrives after is not opened. */
  get left(): boolean {
    return this.#left;
  }

  /** Boot is ready for Title to start (fonts in, progress read): the button shows from here. */
  ready(): void {
    this.#ready = true;
    this.draw();
  }

  /** The file is in and the installed mod packs are still loading: the line says so (#858). */
  loadingMods(): void {
    if (this.#failure !== null || this.#locked) return;
    this.#mods = true;
    this.draw();
  }

  /** The replay is open and on its way to the board: Cancel goes, and the line says it is opening. */
  lock(): void {
    this.#locked = true;
    this.draw();
  }

  /** The replay couldn't be opened: say why, in place of the spinner. */
  fail(message: MessageKey): void {
    this.#locked = false;
    this.#failure = message;
    this.draw();
  }

  #leave(): void {
    if (this.#left || this.#locked || !this.#ready) return;
    this.#left = true;
    this.#toMenu();
  }

  #clear(): void {
    this.#button?.destroy();
    this.#button = null;
    for (const object of this.#objects) {
      this.#scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.#objects.length = 0;
  }

  /** Cancel while loading (once Boot is ready), Main menu after a failure; none while the replay is opening. */
  get #hasButton(): boolean {
    return this.#ready && (this.#failure !== null || !this.#locked);
  }

  /** Draws the screen for the current state and size (again after a resize, or once the fonts have arrived). */
  draw(): void {
    const scene = this.#scene;
    if (this.#gone) return;
    this.#clear();
    const { width, height } = scene.scale.gameSize;
    const failed = this.#failure !== null;
    // The title screen's own art, faded into the dark behind the panel (a plain dark ground until it has loaded).
    scene.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    const art = this.#art;
    if (art && scene.textures.exists(art.key)) {
      const frame = scene.textures.get(art.key).getSourceImage() as { width: number; height: number };
      const fit = coverFit(frame, { width, height });
      this.#objects.push(
        scene.add
          .image(width / 2, height / 2, art.key)
          .setScale(fit.scale)
          .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight)
          .setAlpha(ART_ALPHA),
      );
    }

    const headingText = t(failed ? "replay.link.failedHeading" : "replay.link.heading");
    const heading = scene.add
      .text(0, 0, caseOf(typeRole.barTitle, headingText), textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0.5, 0)
      .setAlign("center")
      .setWordWrapWidth(replayLinkBodyWidth(width));
    const body = scene.add
      .text(
        0,
        0,
        t(
          this.#failure ??
            (this.#locked ? "replay.link.opening" : this.#mods ? "replay.link.mods" : "replay.link.loading"),
        ),
        textStyle(typeRole.body, surface.paper.hex, 0.9),
      )
      .setFontSize(14)
      .setLineSpacing(3)
      .setOrigin(0.5, 0)
      .setAlign("center")
      .setWordWrapWidth(replayLinkBodyWidth(width));
    const layout = replayLinkScreenLayout({
      width,
      height,
      spinner: !failed,
      headingHeight: heading.height,
      bodyHeight: body.height,
      buttonHeight: this.#hasButton ? hit.primary : 0,
    });

    const ground = scene.add.graphics();
    const { panel } = layout;
    ground.fillStyle(surface.ink.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    ground.lineStyle(4, failed ? surface.paper.hex : accent.heroRed.hex, 1);
    ground.strokeRect(panel.x, panel.y, panel.width, panel.height);
    this.#objects.push(ground, heading, body);
    heading.setPosition(layout.heading.x, layout.heading.y).setDepth(1);
    body.setPosition(layout.body.x, layout.body.y).setDepth(1);

    if (layout.spinner) {
      const spinner = scene.add.graphics({ x: layout.spinner.x, y: layout.spinner.y });
      spinner.lineStyle(5, surface.paper.hex, 0.2).strokeCircle(0, 0, REPLAY_LINK_SPINNER_RADIUS);
      spinner.lineStyle(5, accent.heroRed.hex, 1);
      spinner.beginPath();
      spinner.arc(0, 0, REPLAY_LINK_SPINNER_RADIUS, 0, Math.PI * 0.6);
      spinner.strokePath();
      spinner.setDepth(1);
      this.#objects.push(spinner);
      // Reduced motion: the ring stays still; the line under it still says it is loading.
      if (!appSession().settings.reducedMotion) {
        scene.tweens.add({ targets: spinner, angle: 360, duration: 900, repeat: -1 });
      }
    }

    if (!this.#hasButton) {
      this.#route.set([], new Map());
      return;
    }
    const rect = layout.button;
    const activate = (): void => this.#leave();
    this.#button = new McButton(scene, {
      kind: failed ? "primary" : "secondary",
      label: t(failed ? "replay.link.mainMenu" : "replay.link.cancel"),
      type: BUTTON_TYPE,
      rect,
      onClick: activate,
    });
    this.#route.set([ACTION_ID], new Map([[ACTION_ID, { rect, activate }]]));
  }
}
