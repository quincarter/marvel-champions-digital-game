/**
 * The versus screen every replay opens on (issue #858): before the board, the villain on one side and the heroes on
 * the other with VERSUS between them, like an old fighting game's match intro, so a replay reads as a replay and not a
 * table in play. It holds for a moment (`VERSUS_HOLD_MS`) while the replay is put on the session, then the board comes
 * up; a tap, click, Enter, Space or A ends the hold early (the board still waits for the replay to be ready).
 *
 * Reached from Boot's loading screen for a shared replay's link (`ui/replay-link-loading.ts`), and from every other
 * Watch through `introReplay` (`scenes/replay-entry.ts`). If the replay can't be put on the board, the screen it was
 * opened from comes back (Title says why).
 */
import Phaser from "phaser";
import type { MessageKey } from "../i18n/translate.js";
import { t } from "../i18n/translate.js";
import type { ReplayHost } from "../replay/replay-host.js";
import { replayErrorKey } from "../replay/replay-files.js";
import { heroFocusOf, heroPictureOf, villainPictureOf } from "../art/matchup-pictures.js";
import type { PictureFocus } from "../art/focus.js";
import { cardFaces } from "../art/card-face-baker.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { appSession } from "../session.js";
import { accent, signal, surface } from "../tokens.js";
import { bangers } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { afterWallMs } from "../ui/wall-timer.js";
import type { Rect } from "../view/layout.js";
import { PAST_GAME_NAMES } from "../view/game-label-names.js";
import { replayMatchupOf, versusLayout, type ReplayMatchup } from "../view/replay-matchup.js";
import { renderLiveArtThumb, type LiveArtThumb } from "./roster-panel.js";
import { watchReplay } from "./replay-entry.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";
import { needed } from "./scene-order.js";
import type { TitleSceneData } from "./title.js";

/** How long the matchup stays up at least (wall clock), unless a press ends it early. */
export const VERSUS_HOLD_MS = 3000;

/** Width over height of the hero and villain pictures (751 x 1063 and the like). */
const PORTRAIT_ASPECT = 0.71;
/** In a wide tile, at least this much of a picture's height stays in view, from its top (heads are mostly up there). */
const MIN_VISIBLE_HEIGHT = 0.6;

export interface ReplayVersusData {
  /** The opened replay. This screen owns it from here: the board takes it, or it is closed. */
  readonly host?: ReplayHost;
  /** The screen the replay's Exit (and a failure here) goes back to. Title when left out (a shared replay's link). */
  readonly returnTo?: string;
}

export class ReplayVersusScene extends Phaser.Scene {
  #matchup: ReplayMatchup | null = null;
  #packs: readonly PackRuntime[] | undefined = undefined;
  #thumbs: LiveArtThumb[] = [];
  #intro = true;
  /** Shut down: nothing more to draw. (`sys.isActive()` is still false while `create` runs.) */
  #gone = false;
  /** What #draw put up last, for the exit: the villain's side, the heroes', VERSUS, and which way they split. */
  #shown: {
    readonly villain: readonly Phaser.GameObjects.GameObject[];
    readonly heroes: readonly Phaser.GameObjects.GameObject[];
    readonly versus: Phaser.GameObjects.Text;
    readonly wide: boolean;
  } | null = null;
  /** The exit is playing: no redraw. */
  #leaving = false;

  constructor() {
    super(SCENES.replayVersus);
  }

  create(data: ReplayVersusData = {}): void {
    const host = data.host;
    const config = host?.info?.config;
    // A setup that names no hero this build knows has nothing to put on the heroes' side: say the replay is damaged.
    if (!host || !config || replayMatchupOf(config, PAST_GAME_NAMES).heroes.length === 0) {
      host?.dispose();
      this.#fail(data.returnTo ?? SCENES.title, "replay.error.damaged");
      return;
    }
    this.#gone = false;
    this.#leaving = false;
    this.#shown = null;
    this.#matchup = replayMatchupOf(config, PAST_GAME_NAMES);
    this.#packs = config.packs as readonly PackRuntime[] | undefined;
    this.#intro = !appSession().settings.reducedMotion;
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    this.scale.on("resize", this.#draw, this);
    const offBaked = cardFaces(this).onBaked(() => {
      for (const thumb of this.#thumbs) thumb.refresh();
    });
    let skip: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      const cancel = afterWallMs(VERSUS_HOLD_MS, resolve);
      skip = () => {
        cancel();
        resolve();
      };
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => skip());
    for (const key of ["keydown-ENTER", "keydown-SPACE", "keydown-ESC"]) this.input.keyboard?.on(key, () => skip());
    this.input.gamepad?.on("down", () => skip());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#gone = true;
      this.scale.off("resize", this.#draw, this);
      offBaked();
      skip();
      this.#thumbs = [];
    });
    this.#draw();
    fadeScreenIn(this);
    // The whoosh peaks as the two sides arrive.
    appSession().music?.playEffect("versus-whoosh");
    void this.#toBoard(host, hold, data.returnTo ?? SCENES.title);
  }

  /**
   * The board's code first (its chunk and companions): if it can't load, the replay never goes on the session and
   * Title says why, rather than this screen fading into a board that never starts. Then the replay, then the board.
   */
  async #toBoard(host: ReplayHost, hold: Promise<void>, returnTo: string): Promise<void> {
    const loader = sceneLoader();
    try {
      if (loader) await Promise.all(needed(SCENES.board).map((key) => loader.load(key)));
    } catch {
      host.dispose();
      if (this.sys.isActive()) this.#fail(returnTo, "replay.link.offline");
      return;
    }
    if (!this.sys.isActive()) return host.dispose();
    try {
      await watchReplay(this, host, returnTo, hold, () => this.#reveal());
    } catch (cause) {
      if (!this.sys.isActive()) return;
      const replayProblem: MessageKey = replayErrorKey(cause);
      this.#fail(returnTo, replayProblem);
    }
  }

  /**
   * The way out is the way in, reversed: the board starts underneath, the two sides spread apart off their own edges,
   * VERSUS flies up and away, and the whoosh plays again. Under reduced motion the board just replaces it.
   */
  #reveal(): void {
    const shown = this.#shown;
    this.#leaving = true;
    this.scene.launch(SCENES.board, {});
    // Over the board and the replay bar it brings, until it has gone.
    this.scene.bringToTop();
    this.input.enabled = false;
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    if (!shown || appSession().settings.reducedMotion) {
      this.scene.stop();
      return;
    }
    appSession().music?.playEffect("versus-whoosh");
    const { width, height } = this.scale.gameSize;
    const away = (objects: readonly Phaser.GameObjects.GameObject[], dx: number, dy: number): void => {
      for (const object of objects as (Phaser.GameObjects.GameObject & { x: number; y: number })[]) {
        this.tweens.add({ targets: object, x: object.x + dx, y: object.y + dy, duration: 480, ease: "Cubic.easeIn" });
      }
    };
    away(shown.villain, shown.wide ? -width : 0, shown.wide ? 0 : -height);
    away(shown.heroes, shown.wide ? width : 0, shown.wide ? 0 : height);
    this.tweens.add({
      targets: shown.versus,
      y: -shown.versus.height,
      alpha: 0,
      duration: 420,
      ease: "Back.easeIn",
    });
    afterWallMs(520, () => {
      if (!this.#gone) this.scene.stop();
    });
  }

  /** Back where the replay was opened from. Title says why; the other screens get no word (rare: the file opened). */
  #fail(returnTo: string, replayProblem: MessageKey): void {
    if (returnTo === SCENES.title) goToScreen(this, SCENES.title, { replayProblem } satisfies TitleSceneData);
    else goToScreen(this, returnTo, {});
  }

  #draw(): void {
    const matchup = this.#matchup;
    if (!matchup || this.#gone || this.#leaving) return;
    this.tweens.killAll();
    destroyChildren(this);
    this.#thumbs = [];
    const { width, height } = this.scale.gameSize;
    const layout = versusLayout(width, height, matchup.heroes.length);
    const intro = this.#intro;
    this.#intro = false;

    const villainUrl = villainPictureOf(matchup.scenarioId, matchup.villain.cardId, this.#packs);
    const villain = this.#side(
      layout.villain,
      villainUrl,
      matchup.villain.name,
      accent.heroRed.hex,
      layout.villainNameLift,
    );
    const heroes = matchup.heroes.map((hero, index) =>
      this.#side(
        layout.heroes[index]!,
        heroPictureOf(hero.cardId ?? "", this.#packs),
        hero.name,
        signal.cost.hex,
        layout.heroNameLifts[index] ?? 0,
        layout.heroArtDrops[index] ?? 0,
        0.15,
        hero.cardId ? heroFocusOf(hero.cardId) : null,
      ),
    );

    const versus = this.add
      .text(layout.versus.x, layout.versus.y, t("replay.versus"), {
        ...textStyle(bangers(layout.versusSize), signal.caution.hex),
        stroke: cssOf(surface.ink.hex),
        strokeThickness: Math.max(6, Math.round(layout.versusSize / 9)),
      })
      .setOrigin(0.5)
      .setAngle(-8)
      .setDepth(10);
    this.#shown = { villain, heroes: heroes.flat(), versus, wide: layout.wide };

    if (!intro) return;
    // The two sides slide in from their own edges, then VERSUS lands on the seam.
    const from = (objects: readonly Phaser.GameObjects.GameObject[], dx: number, dy: number): void => {
      for (const object of objects as (Phaser.GameObjects.GameObject & { x: number; y: number })[]) {
        const { x, y } = object;
        object.x = x + dx;
        object.y = y + dy;
        this.tweens.add({ targets: object, x, y, duration: 420, ease: "Cubic.easeOut" });
      }
    };
    from(villain, layout.wide ? -width / 2 : 0, layout.wide ? 0 : -height / 2);
    from(heroes.flat(), layout.wide ? width / 2 : 0, layout.wide ? 0 : height / 2);
    versus.setScale(3).setAlpha(0);
    this.tweens.add({ targets: versus, scale: 1, alpha: 1, delay: 380, duration: 260, ease: "Back.easeOut" });
  }

  /** One side's picture, darkened at the foot under its name, with a colored edge. Returns what it drew. */
  #side(
    rect: Rect,
    url: string | null,
    name: string,
    edge: number,
    inset = 0,
    artDrop = 0,
    focusY = 0.15,
    focus: PictureFocus | null = null,
  ): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const back = this.add.graphics();
    back.fillStyle(signal.spent.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    objects.push(back);
    // The name sits on its own plate under the picture, never over it. Up to two lines (a long name such as
    // "Spider-Man (Peter Parker)"), sized to the tile and shrinking until it fits.
    let size = Math.round(Math.max(12, Math.min(28, rect.width / 10, rect.height / 9)));
    const label = this.add
      .text(0, 0, name.toUpperCase(), textStyle(bangers(size), surface.paper.hex))
      .setOrigin(0.5, 1)
      .setAlign("center")
      .setWordWrapWidth(rect.width - 16, true);
    while (size > 11 && (label.height > size * 2.2 || label.width > rect.width - 16)) {
      size -= 2;
      label.setFontSize(size);
    }
    const plateHeight = Math.round(label.height + 12);
    // `inset` lifts the plate clear of VERSUS on the seam below it; that strip stays dark.
    const plateTop = rect.y + rect.height - inset - plateHeight;
    label.setPosition(rect.x + rect.width / 2, plateTop + plateHeight - 6);
    if (url) {
      // A picture whose top would sit under VERSUS starts below it (`heroArtDrops`), and it ends at the plate.
      const art: Rect = { ...rect, y: rect.y + artDrop, height: plateTop - rect.y - artDrop };
      if (focus) {
        // The art says where the hero is (`focus.json`): fill the tile, centered there.
        const thumb = renderLiveArtThumb(this, art, url, focusY, "cover", focus);
        this.#thumbs.push(thumb);
        objects.push(thumb.object);
      } else if (art.width > art.height) {
        // A wide tile would crop a tall picture to a thin band that can miss the hero's head (it isn't always at the
        // top): zoom in only so far that most of the picture's height still shows (`MIN_VISIBLE_HEIGHT`), from its top,
        // over a dimmed copy of itself that fills whatever the tile has left at the sides.
        const backdrop = renderLiveArtThumb(this, art, url, focusY);
        (backdrop.object as Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject).setAlpha(0.3);
        const wholeWidth = Math.min(art.width, Math.round((art.height * PORTRAIT_ASPECT) / MIN_VISIBLE_HEIGHT));
        const slot: Rect = { ...art, x: Math.round(art.x + (art.width - wholeWidth) / 2), width: wholeWidth };
        const whole = renderLiveArtThumb(this, slot, url, 0.1);
        this.#thumbs.push(backdrop, whole);
        objects.push(backdrop.object, whole.object);
      } else {
        const thumb = renderLiveArtThumb(this, art, url, focusY);
        this.#thumbs.push(thumb);
        objects.push(thumb.object);
      }
    }
    const plate = this.add.graphics();
    plate.fillStyle(surface.ink.hex, 1).fillRect(rect.x, plateTop, rect.width, rect.y + rect.height - plateTop);
    plate.lineStyle(6, edge, 1).strokeRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6);
    objects.push(plate);
    // Above the picture, which was added after it.
    this.children.bringToTop(label);
    objects.push(label);
    return objects;
  }
}
