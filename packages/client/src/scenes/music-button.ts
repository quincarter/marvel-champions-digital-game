/**
 * The music button (#191): a note in the top bar, just left of the Report button, on the screens that leave it a slot
 * (`ui/music-slot.ts`: the table and Title). A tap opens the music player (`scenes/music-player.ts`); a second tap
 * closes it.
 *
 * Each time a new song starts it says so. On a tablet or desktop the button opens out to its left into "Now playing"
 * and the song's title, holds, and folds back into the note. On a phone, where the bar has no room, a notification
 * slides down from the top instead. Either one opens the player when tapped. Reduced motion shows and hides them
 * without the movement.
 *
 * Like the Report button it runs for the whole session from Boot as chrome: kept just under the Report button, above
 * every screen and the music player, never covering a search field (`CHROME_SCENES`).
 */
import Phaser from "phaser";
import type { Track } from "../audio/music-catalog.js";
import { signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { fitText } from "../ui/widgets.js";
import { musicSlots, setShownMusicButton } from "../ui/music-slot.js";
import { drawMusicIcon } from "../ui/music-icon.js";
import { reportButtonSlot } from "../view/report-button.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { lerp } from "../view/motion-math.js";
import {
  NOW_PLAYING_HOLD_MS,
  NOW_PLAYING_LATE_MS,
  NOW_PLAYING_OPEN_MS,
  nowPlayingBanner,
  nowPlayingPill,
  nowPlayingTitleOf,
} from "../view/music-player.js";
import { appSession } from "../session.js";
import { SCENES } from "./keys.js";

/** The scenes that sort themselves above the screens: this one, its player, the Report button and panel, and Music. */
const ABOVE_SCREENS: ReadonlySet<string> = new Set([
  SCENES.musicButton,
  SCENES.musicPlayer,
  SCENES.reportButton,
  SCENES.reportIssue,
  SCENES.music,
]);
/** The widest the pill opens out on a tablet or desktop, so it never runs the length of the bar. */
const PILL_MAX_WIDTH = 360;

interface Announcement {
  readonly track: Track;
  readonly at: number;
}

export class MusicButtonScene extends Phaser.Scene {
  #graphics: Phaser.GameObjects.Graphics | null = null;
  #zone: Phaser.GameObjects.Zone | null = null;
  #rect: Rect | null = null;
  #hovered = false;
  #pressed = false;
  /** A song that started and has not been announced yet. */
  #pending: Announcement | null = null;
  /** The announcement on screen: its pieces, and how far it has opened (0 folded, 1 open). */
  #shown: {
    container: Phaser.GameObjects.Container;
    zone: Phaser.GameObjects.Zone;
    redraw: (p: number) => void;
  } | null = null;
  #progress = 0;
  #tween: Phaser.Tweens.Tween | null = null;
  #holdTimer: Phaser.Time.TimerEvent | null = null;
  #unsubscribe: (() => void) | null = null;
  #playerUp = false;

  constructor() {
    super(SCENES.musicButton);
  }

  create(): void {
    this.#graphics = this.add.graphics().setDepth(2);
    this.#zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(2).setInteractive({ useHandCursor: true });
    this.#zone.on("pointerover", () => this.#setHovered(true));
    this.#zone.on("pointerout", () => {
      this.#pressed = false;
      this.#setHovered(false);
    });
    this.#zone.on("pointerdown", () => {
      this.#pressed = true;
    });
    this.#zone.on("pointerup", () => {
      if (!this.#pressed) return;
      this.#pressed = false;
      this.#setHovered(false);
      this.#togglePlayer();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      setShownMusicButton(null);
    });
    this.#place(null);
  }

  /**
   * Follows the slot every frame, as the Report button does, and stays above every screen (a few bring their own
   * overlay to the top), with the music player above the screens and under this, so the note stays tappable over its
   * own player.
   */
  override update(time: number): void {
    const manager = this.scene.manager;
    const screens = manager.getScenes(true).filter((scene) => !ABOVE_SCREENS.has(scene.scene.key));
    const top = screens.at(-1)?.scene.key;
    const playerUp = manager.isActive(SCENES.musicPlayer);
    if (top && playerUp && manager.getIndex(SCENES.musicPlayer) < manager.getIndex(top)) {
      manager.moveAbove(top, SCENES.musicPlayer);
    }
    const under = playerUp ? SCENES.musicPlayer : top;
    if (under && manager.getIndex(SCENES.musicButton) < manager.getIndex(under)) {
      manager.moveAbove(under, SCENES.musicButton);
    }
    if (playerUp !== this.#playerUp) {
      this.#playerUp = playerUp;
      this.#draw();
    }
    if (!this.#unsubscribe) {
      const music = appSession().music;
      if (music) {
        this.#unsubscribe = music.onTrackStart((track) => {
          this.#pending = { track, at: this.time.now };
        });
      }
    }
    const running = manager
      .getScenes(true)
      .map((scene) => ({ key: scene.scene.key, visible: scene.sys.settings.visible }));
    const slot = reportButtonSlot(running, musicSlots());
    this.#place(slot?.rect ?? null);

    const pending = this.#pending;
    if (pending && this.#rect) {
      this.#pending = null;
      // The player names the song itself, and a song that started long before the button showed is old news.
      if (!manager.isActive(SCENES.musicPlayer) && time - pending.at <= NOW_PLAYING_LATE_MS)
        this.#announce(pending.track);
    } else if (pending && time - pending.at > NOW_PLAYING_LATE_MS) {
      this.#pending = null;
    }
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`) and the e2e specs. */
  debugState(): Record<string, unknown> {
    return { rect: this.#rect, announcing: this.#shown !== null, progress: this.#progress };
  }

  #togglePlayer(): void {
    if (this.scene.isActive(SCENES.musicPlayer)) {
      this.scene.stop(SCENES.musicPlayer);
      return;
    }
    this.#dismiss(true);
    this.scene.launch(SCENES.musicPlayer);
  }

  #place(rect: Rect | null): void {
    const same =
      rect === this.#rect ||
      (rect !== null &&
        this.#rect !== null &&
        rect.x === this.#rect.x &&
        rect.y === this.#rect.y &&
        rect.width === this.#rect.width &&
        rect.height === this.#rect.height);
    if (same) return;
    this.#rect = rect;
    setShownMusicButton(rect);
    // The bar moved or went away: an announcement drawn against the old one would hang in the air.
    this.#dismiss(true);
    this.#draw();
  }

  #setHovered(hovered: boolean): void {
    if (this.#hovered === hovered) return;
    this.#hovered = hovered;
    this.#draw();
  }

  #draw(): void {
    const graphics = this.#graphics;
    const zone = this.#zone;
    if (!graphics || !zone) return;
    graphics.clear();
    const rect = this.#rect;
    if (!rect) {
      zone.disableInteractive();
      return;
    }
    // The same ink chrome button as MENU and Report; filled paper while hovered or while its player is open.
    const lit = this.#hovered || this.scene.isActive(SCENES.musicPlayer);
    const ground = lit ? surface.paper.hex : surface.ink.hex;
    const ink = lit ? surface.ink.hex : surface.paper.hex;
    graphics.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    graphics.lineStyle(2, surface.paper.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    drawMusicIcon(
      graphics,
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      Math.min(rect.width, rect.height) * 0.62,
      ink,
    );
    zone.setPosition(rect.x, rect.y).setSize(rect.width, rect.height);
    zone.setInteractive({ useHandCursor: true });
    zone.input?.hitArea.setTo(0, 0, rect.width, rect.height);
  }

  /** "Now playing": the pill on a tablet or desktop, the notification on a phone. */
  #announce(track: Track): void {
    const icon = this.#rect;
    if (!icon) return;
    this.#dismiss(true);
    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    const title = nowPlayingTitleOf(track);
    const container = this.add.container(0, 0).setDepth(1);
    const ground = this.add.graphics();
    const label = this.add.text(0, 0, "NOW PLAYING", textStyle(typeRole.label, signal.caution.hex));
    const name = this.add
      .text(0, 0, title, textStyle(typeRole.rowTitle, surface.paper.hex))
      .setFontSize(phone ? 15 : 13);
    container.add([ground, label, name]);
    const zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(1).setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => this.#togglePlayer());

    let redraw: (p: number) => void;
    if (phone) {
      const banner = nowPlayingBanner(icon, width);
      const noteSize = 22;
      label.setPosition(banner.x + 14 + noteSize + 14, banner.y + 10);
      name.setPosition(label.x, banner.y + 27);
      fitText(name, banner.x + banner.width - 14 - name.x, 15);
      const note = this.add.graphics();
      container.add(note);
      redraw = (p) => {
        // Slides down from above the screen into place under the bar.
        container.setY(lerp(-(banner.y + banner.height + 8), 0, p));
        container.setAlpha(Math.min(1, p * 1.5));
        ground.clear();
        ground.fillStyle(surface.ink.hex, 0.96).fillRect(banner.x, banner.y, banner.width, banner.height);
        ground
          .lineStyle(2, surface.paper.hex, 1)
          .strokeRect(banner.x + 1, banner.y + 1, banner.width - 2, banner.height - 2);
        note.clear();
        drawMusicIcon(note, banner.x + 14 + noteSize / 2, banner.y + banner.height / 2, noteSize, surface.paper.hex);
        zone.setPosition(banner.x, banner.y + container.y).setSize(banner.width, banner.height);
        zone.input?.hitArea.setTo(0, 0, banner.width, banner.height);
      };
    } else {
      const textWidth = Math.max(label.width, name.width);
      const minX = Math.max(8, icon.x + icon.width - PILL_MAX_WIDTH);
      const pill = nowPlayingPill(icon, textWidth, minX);
      const textX = pill.x + 12;
      const textRoom = pill.width - icon.width - 18;
      label.setPosition(textX, pill.y + pill.height / 2 - label.height + 1);
      name.setPosition(textX, pill.y + pill.height / 2 - 1);
      if (pill.height < 34) {
        // A short bar has room for one line: "NOW PLAYING  Song".
        label.setY(pill.y + (pill.height - label.height) / 2);
        name.setPosition(textX + label.width + 8, pill.y + (pill.height - name.height) / 2);
        fitText(name, Math.max(20, textRoom - label.width - 8), 13);
      } else {
        fitText(name, Math.max(20, textRoom), 13);
      }
      const right = icon.x + icon.width;
      redraw = (p) => {
        // Opens out of the note to its left; the words come up once there is room for them.
        const w = lerp(icon.width, pill.width, p);
        ground.clear();
        ground.fillStyle(surface.ink.hex, 1).fillRect(right - w, pill.y, w, pill.height);
        ground.lineStyle(2, surface.paper.hex, 1).strokeRect(right - w + 1, pill.y + 1, w - 2, pill.height - 2);
        const words = Phaser.Math.Clamp((p - 0.55) / 0.45, 0, 1);
        label.setAlpha(words);
        name.setAlpha(words);
        zone.setPosition(right - w, pill.y).setSize(w, pill.height);
        zone.input?.hitArea.setTo(0, 0, w, pill.height);
      };
    }
    this.#shown = { container, zone, redraw };
    this.#animateTo(1, () => {
      this.#holdTimer = this.time.delayedCall(NOW_PLAYING_HOLD_MS, () => {
        this.#holdTimer = null;
        this.#animateTo(0, () => this.#dismiss(true));
      });
    });
  }

  #animateTo(target: number, done: () => void): void {
    const shown = this.#shown;
    if (!shown) return;
    this.#tween?.stop();
    this.#tween = null;
    if (appSession().settings.reducedMotion) {
      this.#progress = target;
      shown.redraw(target);
      done();
      return;
    }
    const state = { p: this.#progress };
    this.#tween = this.tweens.add({
      targets: state,
      p: target,
      duration: NOW_PLAYING_OPEN_MS * Math.abs(target - this.#progress),
      ease: target > this.#progress ? "Back.easeOut" : "Quad.easeIn",
      onUpdate: () => {
        this.#progress = state.p;
        shown.redraw(state.p);
      },
      onComplete: () => {
        this.#tween = null;
        this.#progress = target;
        shown.redraw(target);
        done();
      },
    });
  }

  /** Takes the announcement down: at once, or folded back first. */
  #dismiss(now: boolean): void {
    if (!this.#shown) return;
    this.#holdTimer?.remove();
    this.#holdTimer = null;
    if (!now) {
      this.#animateTo(0, () => this.#dismiss(true));
      return;
    }
    this.#tween?.stop();
    this.#tween = null;
    this.#shown.container.destroy();
    this.#shown.zone.destroy();
    this.#shown = null;
    this.#progress = 0;
  }
}
