/**
 * The "Achievement unlocked" popup (docs/achievements.md, "Unlock popup"): a gold trophy badge pops in over whatever
 * screen is up, a bar opens out of it with the achievement's name and what it earned, holds, and folds away, with the
 * achievement sound. Two or more at once stack into one counted popup; a tap opens it into a list of them all, with
 * Collapse (back to the popup) and Dismiss. What opens in Extras (`scenes/music-button.ts` finds it) comes in the same
 * popup on its own beat, after the achievements', with the Extras sting (the owner, 2026-10-20;
 * `view/achievement-toast.ts`).
 *
 * It looks for newly earned achievements once a second, from what the last `refreshUnlocks()` read (Game over and
 * the Title refresh as a game ends), and remembers what it announced (`platform/achievements-seen.ts`). The first look
 * on a device with nothing stored only records what is already earned.
 *
 * Settings ▸ More ▸ Achievements sets how long it stays up (or turns it off) and where it shows; picking either shows
 * a sample; Off silences achievements only, never the Extras news. It runs for the whole session from Boot, hidden
 * except while a popup shows. A single popup takes no input, so a tap lands on whatever it covers (`CHROME_SCENES`); a
 * stack takes a tap on itself only (`onTap`), and its open list holds every other screen's input until it closes.
 */
import Phaser from "phaser";
import { font, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { onTap } from "../ui/tap.js";
import { appSession } from "../session.js";
import { achievementPopupHoldMs, achievementPopupScale } from "../settings.js";
import { ACHIEVEMENTS } from "../progression/achievements.js";
import { earnedAchievementIds, refreshUnlocks } from "../progression/progression.js";
import { onGuidePrefsChange } from "../guide/guide-store.js";
import { achievementsSeen, rememberAchievementsSeen } from "../platform/achievements-seen.js";
import {
  achievementToastRect,
  achievementToastsOf,
  extrasToastsOf,
  newAchievementsOf,
  toastListLayout,
  TOAST_OPEN_MS,
  TOAST_POP_MS,
  type ExtrasToastSource,
  sampleAchievementToast,
  toastFrameAt,
  toastShapeAt,
  type AchievementToast,
} from "../view/achievement-toast.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { CHROME_SCENES, SCENES } from "./keys.js";

/** How often it looks for something newly earned. */
const CHECK_MS = 1000;
/**
 * How long news waits for more before it shows: achievements and Extras are found by two scenes a second apart, and a
 * game's result opens both at once, so they gather into their two popups rather than trickling in.
 */
const GATHER_MS = 1200;

interface Showing {
  readonly toast: AchievementToast;
  readonly rect: Rect;
  readonly totalMs: number;
  startedAt: number;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly texts: readonly Phaser.GameObjects.Text[];
  readonly monogram: Phaser.GameObjects.Text;
  /** A stack's tap target over the popup; null for a single popup, which takes no input. */
  readonly zone: Phaser.GameObjects.Zone | null;
}

/** An opened stack's list, and the screens whose input it holds while it is open. */
interface OpenList {
  readonly objects: readonly Phaser.GameObjects.GameObject[];
  readonly buttons: readonly McButton[];
  readonly held: readonly { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[];
  readonly collapse: Rect;
  readonly dismiss: Rect;
}

export class AchievementToastScene extends Phaser.Scene {
  #queue: AchievementToast[] = [];
  #showing: Showing | null = null;
  #list: OpenList | null = null;
  /** News gathered for the next popups, and when the last of it came. */
  #gathered: { achievements: string[]; extras: ExtrasToastSource[]; at: number } | null = null;
  #lastCheck = Number.NEGATIVE_INFINITY;
  /** Every toast shown this session, newest last: read by the e2e specs. */
  #shownCount = 0;

  constructor() {
    super(SCENES.achievementToast);
  }

  create(): void {
    this.sys.setVisible(false);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.#onResize, this);
    // A How to Play lesson finished changes no save, so its achievement is read again here.
    const unsubscribe = onGuidePrefsChange(() => void refreshUnlocks().catch(() => false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.#onResize, this),
    );
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.#list) this.collapse();
    });
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`) and the e2e specs. */
  debugState(): Record<string, unknown> {
    return {
      showing: this.#showing?.toast ?? null,
      rect: this.#showing?.rect ?? null,
      queued: this.#queue.length,
      shown: this.#shownCount,
      place: appSession().settings.achievementPopupPlace,
      expanded: this.#list !== null,
      collapseRect: this.#list?.collapse ?? null,
      dismissRect: this.#list?.dismiss ?? null,
    };
  }

  /** Settings' sample: shown at once in place of whatever is up, so a new time or position is seen right away. */
  preview(): void {
    const ms = achievementPopupHoldMs(appSession().settings.achievementPopupTime);
    this.#closeList();
    this.#clear();
    this.#queue = [];
    if (ms === 0) return;
    this.#start(sampleAchievementToast(ms / 1000));
  }

  /** Gathers these newly earned achievement ids for the next popup, unless the popup is turned off. */
  announce(ids: readonly string[]): void {
    if (ids.length === 0 || achievementPopupHoldMs(appSession().settings.achievementPopupTime) === 0) return;
    this.#gather().achievements.push(...ids);
  }

  /** Gathers what just opened in Extras for the popup after the achievements' (`scenes/music-button.ts`). */
  announceExtras(items: readonly ExtrasToastSource[]): void {
    if (items.length === 0) return;
    this.#gather().extras.push(...items);
  }

  #gather(): { achievements: string[]; extras: ExtrasToastSource[]; at: number } {
    this.#gathered ??= { achievements: [], extras: [], at: 0 };
    this.#gathered.at = this.time.now;
    return this.#gathered;
  }

  /** Achievements first, stacked when several, then Extras on their own beat. */
  #flush(): void {
    const gathered = this.#gathered;
    this.#gathered = null;
    if (!gathered) return;
    const sources = gathered.achievements.flatMap((id) => {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      return def ? [def] : [];
    });
    this.#queue.push(...achievementToastsOf(sources), ...extrasToastsOf(gathered.extras));
  }

  override update(time: number): void {
    if (time - this.#lastCheck >= CHECK_MS) {
      this.#lastCheck = time;
      this.#check();
    }
    if (this.#gathered && time - this.#gathered.at >= GATHER_MS) this.#flush();
    // An open list holds the popup where it is until it closes.
    if (this.#list) return;
    const showing = this.#showing;
    if (showing) {
      const frame = toastFrameAt(time - showing.startedAt, showing.totalMs, appSession().settings.reducedMotion);
      if (frame.done) this.#clear();
      else this.#paint(showing, frame.badgeScale, frame.open, frame.alpha);
    }
    if (!this.#showing && this.#queue.length > 0) this.#start(this.#queue.shift()!);
  }

  #check(): void {
    const earned = earnedAchievementIds();
    if (earned === null) return;
    const seen = achievementsSeen();
    const { fresh, remember } = newAchievementsOf(seen, earned);
    if (seen !== null && fresh.length === 0) return;
    rememberAchievementsSeen(remember);
    this.announce(fresh);
  }

  /** Shows `toast`; `resumeFrom` keeps a redrawn popup's place in its animation (a resize). */
  #start(toast: AchievementToast, resumeFrom?: { readonly startedAt: number; readonly totalMs: number }): void {
    const settings = appSession().settings;
    const totalMs = resumeFrom?.totalMs ?? (achievementPopupHoldMs(settings.achievementPopupTime) || 5000);
    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    const scale = achievementPopupScale(settings.achievementPopupSize);
    const rect = achievementToastRect(settings.achievementPopupPlace, width, height, phone, scale);
    const slim = settings.achievementPopupPlace === "titleBar";
    // Every offset and size below is the medium popup's, times the Settings scale.
    const k = (n: number): number => Math.round(n * scale);
    const labelSize = Math.max(8, k(typeRole.label.size));
    const titleSize = k(slim ? 15 : phone ? 16 : 18);
    const textX = rect.x + rect.height + k(12);
    const textWidth = rect.x + rect.width - k(14) - textX;
    const heading = this.add
      .text(
        textX,
        rect.y + k(slim ? 7 : 14),
        toast.heading.toUpperCase(),
        textStyle(typeRole.label, signal.caution.hex),
      )
      .setFontSize(labelSize);
    const title = this.add
      .text(textX, rect.y + k(slim ? 20 : 30), toast.title, textStyle(typeRole.menuButton, surface.paper.hex))
      .setFontSize(titleSize);
    const reward = this.add
      .text(
        rect.x + rect.width - k(14),
        rect.y + k(slim ? 7 : 14),
        toast.reward,
        textStyle(typeRole.label, surface.paper.hex),
      )
      .setFontSize(labelSize)
      .setOrigin(1, 0);
    fitText(heading, Math.max(40, textWidth - reward.width - 12), labelSize);
    fitText(title, textWidth, titleSize);
    // The game's monogram, sized to sit inside the trophy's bowl (`trophyBowlOf`).
    const bowl = trophyBowlOf(rect.height / 2);
    // Bangers' capitals stand about three quarters of the font size.
    const monogramSize = Math.max(8, Math.floor(bowl.height / 0.75));
    const monogram = this.add
      .text(0, 0, "MC", {
        ...textStyle(typeRole.stat, signal.caution.hex),
        fontFamily: font.display,
        fontSize: `${monogramSize}px`,
        letterSpacing: 0,
      })
      .setOrigin(0.5);
    // Shrunk (never cut, as `fitText` would) when the bowl is narrower than the letters.
    if (monogram.width > bowl.width) {
      monogram.setFontSize(Math.max(6, Math.floor((monogramSize * bowl.width) / monogram.width)));
    }
    // The words over the bar, the monogram over the badge.
    const graphics = this.add.graphics().setDepth(2);
    for (const text of [heading, title, reward]) text.setDepth(3);
    monogram.setDepth(4);
    // A stack opens on a tap anywhere on it; a single popup takes no input at all.
    let zone: Phaser.GameObjects.Zone | null = null;
    if (toast.items.length > 0) {
      zone = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setDepth(5).setInteractive();
      onTap(zone, () => this.expand(), "achievement-toast:stack");
    }
    this.#showing = {
      toast,
      rect,
      totalMs,
      startedAt: resumeFrom?.startedAt ?? this.time.now,
      graphics,
      texts: [heading, title, reward],
      monogram,
      zone,
    };
    this.sys.setVisible(true);
    const still = settings.reducedMotion ? 1 : 0;
    this.#paint(this.#showing, still, still, still);
    if (resumeFrom) return;
    this.#shownCount += 1;
    appSession().music?.playEffect(toast.kind === "extra" ? "extras-unlocked" : "achievement-unlocked");
  }

  #paint(showing: Showing, badgeScale: number, open: number, alpha: number): void {
    const { bar, badge } = toastShapeAt(showing.rect, open);
    const g = showing.graphics.clear();
    // The bar: ink, a gold rule along its foot, rounded at the right end.
    if (open > 0) {
      const r = bar.height / 2;
      g.fillStyle(surface.ink.hex, alpha).fillRoundedRect(bar.x, bar.y, bar.width, bar.height, r);
      g.lineStyle(2, signal.caution.hex, alpha).strokeRoundedRect(
        bar.x + 1,
        bar.y + 1,
        bar.width - 2,
        bar.height - 2,
        r - 1,
      );
    }
    // The badge: a gold disc with an ink trophy and the game's monogram.
    const radius = badge.r * badgeScale;
    if (radius > 0.5) {
      g.fillStyle(signal.caution.hex, alpha).fillCircle(badge.cx, badge.cy, radius);
      g.lineStyle(3, surface.ink.hex, alpha).strokeCircle(badge.cx, badge.cy, radius - 1.5);
      drawTrophy(g, badge.cx, badge.cy, radius, surface.ink.hex, alpha);
    }
    showing.monogram
      .setPosition(badge.cx, badge.cy + trophyBowlOf(radius).dy)
      .setScale(badgeScale)
      .setAlpha(alpha)
      .setVisible(radius > 4);
    // The words show once the bar has (nearly) opened under them.
    const textAlpha = alpha * Math.min(1, Math.max(0, (open - 0.8) / 0.2));
    for (const text of showing.texts) text.setAlpha(textAlpha);
  }

  #clear(): void {
    const showing = this.#showing;
    if (!showing) return;
    showing.graphics.destroy();
    showing.monogram.destroy();
    showing.zone?.destroy();
    for (const text of showing.texts) text.destroy();
    this.#showing = null;
    if (this.#queue.length === 0) this.sys.setVisible(false);
  }

  /** A popup up when the screen changes size is redrawn for the new size, keeping its place in the animation. */
  #onResize(): void {
    const showing = this.#showing;
    if (!showing) return;
    const open = this.#list !== null;
    this.#closeList();
    const { toast, startedAt, totalMs } = showing;
    this.#clear();
    this.#start(toast, { startedAt, totalMs });
    if (open) this.expand();
  }

  /**
   * Opens the stack on screen into its list: every line, Collapse and Dismiss, in place of the popup. The popup's clock
   * stops, and every screen under it stops taking input (as the music player does) until the list closes.
   */
  expand(): void {
    const showing = this.#showing;
    if (!showing || showing.toast.items.length === 0 || this.#list) return;
    const held = this.scene.manager
      .getScenes(true)
      .filter((scene) => scene !== this && !CHROME_SCENES.has(scene.scene.key) && scene.input)
      .map((scene) => ({ scene, pointer: scene.input.enabled, keyboard: scene.input.keyboard?.enabled === true }));
    for (const { scene, pointer, keyboard } of held) {
      if (pointer) scene.input.enabled = false;
      if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
    this.#setPopupVisible(showing, false);
    const { width, height } = this.scale.gameSize;
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    const { toast } = showing;
    const layout = toastListLayout(toast.items.length, width, height, phone);
    // Drawn after the popup's own pieces, so in front of them; the popup hides while the list is open.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.6).fillRect(0, 0, width, height);
    // A tap on the dimmed screen outside the list collapses it, like Collapse.
    const scrimZone = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    onTap(scrimZone, () => this.collapse(), "achievement-toast:scrim");
    const panel = this.add.graphics();
    const { x, y, width: w, height: h } = layout.panel;
    panel.fillStyle(surface.ink.hex, 1).fillRect(x, y, w, h);
    panel.lineStyle(2, signal.caution.hex, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
    // The panel swallows its own taps, so one between its rows never reaches the scrim.
    const panelZone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
    onTap(panelZone, () => undefined, "achievement-toast:panel");
    const objects: Phaser.GameObjects.GameObject[] = [scrim, scrimZone, panel, panelZone];
    const headingText = this.add.text(
      layout.heading.x,
      layout.heading.y,
      toast.heading.toUpperCase(),
      textStyle(typeRole.barTitle, signal.caution.hex),
    );
    fitText(headingText, layout.heading.width, typeRole.barTitle.size);
    objects.push(headingText);
    layout.rows.forEach((row, i) => {
      const line = toast.items[i]!;
      panel.lineStyle(1, surface.paper.hex, 0.18).lineBetween(row.x, row.y, row.x + row.width, row.y);
      const detail = this.add
        .text(row.x + row.width, row.y + row.height / 2, line.detail, textStyle(typeRole.label, signal.caution.hex))
        .setOrigin(1, 0.5);
      const name = this.add
        .text(row.x, row.y + row.height / 2, line.title, textStyle(typeRole.menuButton, surface.paper.hex))
        .setOrigin(0, 0.5)
        .setFontSize(15);
      fitText(name, row.width - detail.width - 16, 15);
      objects.push(detail, name);
    });
    if (layout.moreRow) {
      const where = toast.kind === "extra" ? "in Extras" : "in the Trophy Room";
      objects.push(
        this.add
          .text(
            layout.moreRow.x,
            layout.moreRow.y + layout.moreRow.height / 2,
            `and ${layout.more} more ${where}`,
            textStyle(typeRole.emphasis, surface.paper.hex, 0.75),
          )
          .setOrigin(0, 0.5),
      );
    }
    const buttons = [
      new McButton(this, {
        kind: "secondary",
        label: "Collapse",
        type: typeRole.rowTitle,
        rect: layout.collapse,
        onClick: () => this.collapse(),
      }),
      new McButton(this, {
        kind: "primary",
        label: "Dismiss",
        type: typeRole.rowTitle,
        rect: layout.dismiss,
        onClick: () => this.dismiss(),
      }),
    ];
    this.#list = { objects, buttons, held, collapse: layout.collapse, dismiss: layout.dismiss };
  }

  /** Closes the list back into the popup, which then holds open for its full time again. */
  collapse(): void {
    if (!this.#list) return;
    this.#closeList();
    const showing = this.#showing;
    if (!showing) return;
    this.#setPopupVisible(showing, true);
    // Fully open, at the start of its hold.
    showing.startedAt = this.time.now - (appSession().settings.reducedMotion ? 0 : TOAST_POP_MS + TOAST_OPEN_MS);
  }

  /** Closes the list and the popup with it; the next one queued, if any, follows. */
  dismiss(): void {
    this.#closeList();
    this.#clear();
  }

  #setPopupVisible(showing: Showing, visible: boolean): void {
    showing.graphics.setVisible(visible);
    showing.monogram.setVisible(visible);
    for (const text of showing.texts) text.setVisible(visible);
    if (showing.zone) {
      if (visible) showing.zone.setInteractive();
      else showing.zone.disableInteractive();
    }
  }

  #closeList(): void {
    const list = this.#list;
    if (!list) return;
    this.#list = null;
    for (const object of list.objects) object.destroy();
    for (const button of list.buttons) button.destroy();
    for (const { scene, pointer, keyboard } of list.held) {
      if (!scene.sys.isActive()) continue;
      if (pointer) scene.input.enabled = true;
      if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
    }
  }
}

/**
 * The trophy's bowl inside a badge of radius `r`: the space the monogram sits in, as a width, a height and its centre's
 * offset below the badge's centre (negative: above it). The whole trophy keeps inside the badge's ring.
 */
function trophyBowlOf(r: number): { readonly width: number; readonly height: number; readonly dy: number } {
  return { width: 0.64 * r, height: 0.3 * r, dy: -0.21 * r };
}

/** An ink trophy filling a badge of radius `r` centred on (`cx`, `cy`): bowl, two handles, stem and foot. */
function drawTrophy(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  color: number,
  alpha: number,
): void {
  const at = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(cx + x * r, cy + y * r);
  g.fillStyle(color, alpha);
  // The bowl: straight sides that round in to the stem, wide enough at the top for the monogram.
  g.fillPoints(
    [
      at(-0.32, -0.36),
      at(0.32, -0.36),
      at(0.32, -0.08),
      at(0.22, 0.08),
      at(0.08, 0.16),
      at(-0.08, 0.16),
      at(-0.22, 0.08),
      at(-0.32, -0.08),
    ],
    true,
  );
  // Handles: a half ring on each side of the bowl.
  g.lineStyle(Math.max(2, r * 0.06), color, alpha);
  g.beginPath();
  g.arc(cx - 0.32 * r, cy - 0.22 * r, 0.11 * r, Math.PI / 2, (Math.PI * 3) / 2);
  g.strokePath();
  g.beginPath();
  g.arc(cx + 0.32 * r, cy - 0.22 * r, 0.11 * r, -Math.PI / 2, Math.PI / 2);
  g.strokePath();
  // Stem and foot.
  g.fillRect(cx - 0.05 * r, cy + 0.15 * r, 0.1 * r, 0.12 * r);
  g.fillRect(cx - 0.2 * r, cy + 0.26 * r, 0.4 * r, 0.1 * r);
}
