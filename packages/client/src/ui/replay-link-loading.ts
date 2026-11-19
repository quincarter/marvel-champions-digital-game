/**
 * The shared replay loading screen (issue #858): what Boot shows in place of the title menu when the game is opened
 * from a `#replay=` link, until the replay is on the board. While it loads: a spinner, "Loading the shared replay…" and
 * Cancel. If it can't be opened: why, and Main menu. Both buttons go to Title; Enter / A and Escape / B press them.
 */
import Phaser from "phaser";
import { t, type MessageKey } from "../i18n/translate.js";
import { accent, dotGrid, hit, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "./theme.js";
import { McButton, paintDotGrid } from "./widgets.js";
import { appSession } from "../session.js";
import { FocusRoute } from "../scenes/focus-route.js";
import { REPLAY_LINK_SPINNER_RADIUS, replayLinkBodyWidth, replayLinkScreenLayout } from "../view/replay-link-screen.js";

const BUTTON_TYPE = { ...typeRole.label, size: 13 };
const ACTION_ID = "replay-link-action";

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

  /** `toMenu` leaves for Title: Cancel while loading, Main menu after a failure. */
  constructor(scene: Phaser.Scene, toMenu: () => void) {
    this.#scene = scene;
    this.#toMenu = toMenu;
    this.#route = new FocusRoute(scene, { onCancel: () => this.#leave(), primary: () => ACTION_ID });
    scene.scale.on("resize", this.draw, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off("resize", this.draw, this);
      this.#clear();
    });
    this.draw();
  }

  /** True once the player chose to leave (Cancel or Main menu): a replay that arrives after is not opened. */
  get left(): boolean {
    return this.#left;
  }

  /** The replay is open and on its way to the board: Cancel does nothing from here (unless it then fails). */
  lock(): void {
    this.#locked = true;
  }

  /** The replay couldn't be opened: say why, in place of the spinner. */
  fail(message: MessageKey): void {
    this.#locked = false;
    this.#failure = message;
    this.draw();
  }

  #leave(): void {
    if (this.#left || this.#locked) return;
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

  /** Draws the screen for the current state and size (again after a resize, or once the fonts have arrived). */
  draw(): void {
    const scene = this.#scene;
    if (!scene.sys.isActive()) return;
    this.#clear();
    const { width, height } = scene.scale.gameSize;
    const failed = this.#failure !== null;
    scene.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#objects.push(paintDotGrid(scene, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper));

    const headingText = t(failed ? "replay.link.failedHeading" : "replay.link.heading");
    const heading = scene.add
      .text(0, 0, caseOf(typeRole.barTitle, headingText), textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0.5, 0)
      .setAlign("center")
      .setWordWrapWidth(replayLinkBodyWidth(width));
    const body = scene.add
      .text(0, 0, t(this.#failure ?? "replay.link.loading"), textStyle(typeRole.body, surface.paper.hex, 0.9))
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
      buttonHeight: hit.primary,
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
