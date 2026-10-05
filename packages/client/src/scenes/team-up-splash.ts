/**
 * The Team-Up splash: the pair's full picture, shown once over the Board the first time that Team-Up becomes active
 * (`view/team-up-model.ts#observeTeamUps` decides when; `scenes/board.ts` launches this).
 *
 * Static and brief. It takes the whole table's input for its short life (a tap, click, Enter, Space or Escape
 * dismisses it) and closes itself about 2.5 s after the picture is on screen, so it can never keep a player from a
 * pending choice longer than that. Under reduced motion it neither fades nor moves, and keeps the same timing.
 * While it is up the Board and the choice sheet take neither pointer nor keys, so the Enter or Escape that dismisses
 * it is never also an answer to the sheet underneath.
 */
import Phaser from "phaser";
import { ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { afterWallMs } from "../ui/wall-timer.js";
import { OverlayMotion } from "../ui/transitions.js";
import { splashLayout } from "../view/team-up-layout.js";
import { SCENES } from "./keys.js";

/** Dev-only record of each splash (`window.__mcTeamUpSplashLog`, e2e): the splash is on screen for a moment, a record is not. */
interface SplashLogEntry {
  readonly label: string;
  /** The title and picture have been drawn (the picture had loaded). */
  drawn: boolean;
  closed: boolean;
}

/**
 * How long the picture stays up once it is showing. Measured on the wall clock, not the scene's: Phaser smooths the
 * frame delta and replaces any frame longer than 200 ms (under 5 fps) with the last ordinary one, so on a device that
 * slow a scene timer's 2.5 s takes a minute or more, and this overlay holds the whole table's input for all of it.
 */
export const TEAM_UP_SPLASH_MS = 2500;
/** If the picture never loads, the overlay still leaves rather than sit empty over the table (wall clock, as above). */
const LOAD_GIVE_UP_MS = 6000;

export interface TeamUpSplashData {
  /** "Gambit and Rogue". */
  readonly label: string;
  readonly picture: Picture;
}

/** The scenes this overlay switches off while it is up: the table, and the decision sheet over it. */
const COVERED = [SCENES.board, SCENES.choice] as const;

export class TeamUpSplashOverlay extends Phaser.Scene {
  #data!: TeamUpSplashData;
  #motion = new OverlayMotion();
  #cancelTimer: (() => void) | null = null;
  #cancelGiveUp: (() => void) | null = null;

  #logEntry: SplashLogEntry | null = null;

  constructor() {
    super(SCENES.teamUpSplash);
  }

  create(data: TeamUpSplashData): void {
    this.#data = data;
    if (import.meta.env.DEV) {
      const w = window as unknown as { __mcTeamUpSplashLog?: SplashLogEntry[] };
      const log = (w.__mcTeamUpSplashLog ??= []);
      this.#logEntry = { label: data.label, drawn: false, closed: false };
      log.push(this.#logEntry);
    }
    this.#motion = new OverlayMotion();
    this.#cancelTimer = null;
    const covered = COVERED.flatMap((key) => {
      const scene = this.scene.get(key);
      return scene && this.scene.isActive(key) ? [scene] : [];
    });
    for (const scene of covered) {
      scene.input.enabled = false;
      if (scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
    const dismiss = (): void => this.#close();
    const keyboard = this.input.keyboard;
    keyboard?.on("keydown-ENTER", dismiss);
    keyboard?.on("keydown-ESC", dismiss);
    keyboard?.on("keydown-SPACE", dismiss);
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#draw, this);
      keyboard?.off("keydown-ENTER", dismiss);
      keyboard?.off("keydown-ESC", dismiss);
      keyboard?.off("keydown-SPACE", dismiss);
      this.#cancelTimer?.();
      this.#cancelGiveUp?.();
      this.#cancelTimer = null;
      this.#cancelGiveUp = null;
      for (const scene of covered) {
        scene.input.enabled = true;
        if (scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
    });
    this.#cancelGiveUp = afterWallMs(LOAD_GIVE_UP_MS, dismiss);
    this.#draw();
  }

  #close(): void {
    if (this.#logEntry) this.#logEntry.closed = true;
    this.#motion.exit(this, () => this.scene.stop());
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    destroyChildren(this);
    const { width, height } = this.scale.gameSize;

    const scrim = this.add.rectangle(0, 0, width, height, surface.void.hex, 0.82).setOrigin(0, 0);
    // The whole screen is one tap target.
    this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.#close());

    const key = ensurePictureLoaded(this, this.#data.picture, () => this.#draw());
    if (!key) {
      this.#motion.enter(this, { scrim: [scrim], panels: [] });
      return;
    }
    const source = this.textures.get(key).getSourceImage() as { width: number; height: number };
    const layout = splashLayout({ width, height }, source);

    const banner = this.add.graphics();
    banner
      .fillStyle(surface.ink.hex, 1)
      .fillRect(layout.title.x, layout.title.y, layout.title.width, layout.title.height)
      .lineStyle(3, surface.paper.hex, 1)
      .strokeRect(layout.title.x, layout.title.y, layout.title.width, layout.title.height);
    const title = this.add
      .text(
        layout.title.x + layout.title.width / 2,
        layout.title.y + layout.title.height / 2,
        `TEAM-UP: ${this.#data.label}`.toUpperCase(),
        textStyle(typeRole.barTitle, surface.paper.hex),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(layout.title.width - 16)
      .setAlign("center");
    const { picture } = layout;
    const frame = this.add.graphics();
    frame
      .lineStyle(4, surface.paper.hex, 1)
      .strokeRect(picture.x - 2, picture.y - 2, picture.width + 4, picture.height + 4);
    const image = this.add
      .image(picture.x, picture.y, key)
      .setOrigin(0, 0)
      .setDisplaySize(picture.width, picture.height);
    this.#motion.enter(this, { scrim: [scrim], panels: [banner, title, frame, image] });
    if (this.#logEntry) this.#logEntry.drawn = true;

    // The clock starts when the picture is actually on screen, not when the overlay opened.
    if (!this.#cancelTimer) {
      this.#cancelGiveUp?.();
      this.#cancelGiveUp = null;
      this.#cancelTimer = afterWallMs(TEAM_UP_SPLASH_MS, () => this.#close());
    }

    if (import.meta.env.DEV) {
      (window as unknown as { __mcTeamUpSplashDebug?: unknown }).__mcTeamUpSplashDebug = {
        picture: () => picture,
        title: () => layout.title,
      };
    }
  }
}
