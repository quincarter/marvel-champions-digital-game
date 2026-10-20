/**
 * The "Achievement unlocked" popup (docs/achievements.md, "Unlock popup"): a gold trophy badge pops in over whatever
 * screen is up, a bar opens out of it with the achievement's name and what it earned, holds, and folds away, with the
 * achievement sound. Several queue and show one after another; a large batch comes as one summary
 * (`view/achievement-toast.ts`).
 *
 * It looks for newly earned achievements once a second, from what the last `refreshUnlocks()` read (Game over and
 * the Title refresh as a game ends), and remembers what it announced (`platform/achievements-seen.ts`). The first look
 * on a device with nothing stored only records what is already earned.
 *
 * Settings ▸ More ▸ Achievements sets how long it stays up (or turns it off) and where it shows; picking either shows
 * a sample. It runs for the whole session from Boot, hidden except while a popup shows, and takes no input, so a tap
 * lands on whatever it covers (`CHROME_SCENES`).
 */
import Phaser from "phaser";
import { font, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { fitText } from "../ui/widgets.js";
import { appSession } from "../session.js";
import { achievementPopupHoldMs } from "../settings.js";
import { ACHIEVEMENTS } from "../progression/achievements.js";
import { earnedAchievementIds } from "../progression/progression.js";
import { achievementsSeen, rememberAchievementsSeen } from "../platform/achievements-seen.js";
import {
  achievementToastRect,
  achievementToastsOf,
  newAchievementsOf,
  sampleAchievementToast,
  toastFrameAt,
  toastShapeAt,
  type AchievementToast,
} from "../view/achievement-toast.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { SCENES } from "./keys.js";

/** How often it looks for something newly earned. */
const CHECK_MS = 1000;

interface Showing {
  readonly toast: AchievementToast;
  readonly rect: Rect;
  readonly totalMs: number;
  readonly startedAt: number;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly texts: readonly Phaser.GameObjects.Text[];
  readonly monogram: Phaser.GameObjects.Text;
}

export class AchievementToastScene extends Phaser.Scene {
  #queue: AchievementToast[] = [];
  #showing: Showing | null = null;
  #lastCheck = Number.NEGATIVE_INFINITY;
  /** Every toast shown this session, newest last: read by the e2e specs. */
  #shownCount = 0;

  constructor() {
    super(SCENES.achievementToast);
  }

  create(): void {
    this.sys.setVisible(false);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.#onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.#onResize, this),
    );
  }

  /** Read by the debug snapshot (`ui/debug-dump.ts`) and the e2e specs. */
  debugState(): Record<string, unknown> {
    return {
      showing: this.#showing?.toast ?? null,
      rect: this.#showing?.rect ?? null,
      queued: this.#queue.length,
      shown: this.#shownCount,
      place: appSession().settings.achievementPopupPlace,
    };
  }

  /** Settings' sample: shown at once in place of whatever is up, so a new time or position is seen right away. */
  preview(): void {
    const ms = achievementPopupHoldMs(appSession().settings.achievementPopupTime);
    this.#clear();
    this.#queue = [];
    if (ms === 0) return;
    this.#start(sampleAchievementToast(ms / 1000));
  }

  /** Queues popups for these achievement ids (the ones newly earned), unless the popup is turned off. */
  announce(ids: readonly string[]): void {
    if (ids.length === 0 || achievementPopupHoldMs(appSession().settings.achievementPopupTime) === 0) return;
    const sources = ids.flatMap((id) => {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      return def ? [def] : [];
    });
    this.#queue.push(...achievementToastsOf(sources));
  }

  override update(time: number): void {
    if (time - this.#lastCheck >= CHECK_MS) {
      this.#lastCheck = time;
      this.#check();
    }
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
    const rect = achievementToastRect(settings.achievementPopupPlace, width, height, phone);
    const slim = rect.height < 60;
    const textX = rect.x + rect.height + 12;
    const textWidth = rect.x + rect.width - 14 - textX;
    const heading = this.add.text(
      textX,
      rect.y + (slim ? 7 : 14),
      toast.heading.toUpperCase(),
      textStyle(typeRole.label, signal.caution.hex),
    );
    const title = this.add
      .text(textX, rect.y + (slim ? 20 : 30), toast.title, textStyle(typeRole.menuButton, surface.paper.hex))
      .setFontSize(slim ? 15 : phone ? 16 : 18);
    const reward = this.add
      .text(
        rect.x + rect.width - 14,
        rect.y + (slim ? 7 : 14),
        toast.reward,
        textStyle(typeRole.label, surface.paper.hex),
      )
      .setOrigin(1, 0);
    fitText(heading, Math.max(40, textWidth - reward.width - 12), typeRole.label.size);
    fitText(title, textWidth, slim ? 15 : phone ? 16 : 18);
    const monogram = this.add
      .text(0, 0, "MC", {
        ...textStyle(typeRole.stat, signal.caution.hex),
        fontFamily: font.display,
        fontSize: `${Math.round(rect.height * 0.22)}px`,
      })
      .setOrigin(0.5);
    // The words over the bar, the monogram over the badge.
    const graphics = this.add.graphics().setDepth(2);
    for (const text of [heading, title, reward]) text.setDepth(3);
    monogram.setDepth(4);
    this.#showing = {
      toast,
      rect,
      totalMs,
      startedAt: resumeFrom?.startedAt ?? this.time.now,
      graphics,
      texts: [heading, title, reward],
      monogram,
    };
    this.sys.setVisible(true);
    const still = settings.reducedMotion ? 1 : 0;
    this.#paint(this.#showing, still, still, still);
    if (resumeFrom) return;
    this.#shownCount += 1;
    appSession().music?.playEffect("achievement-unlocked");
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
      drawTrophy(g, badge.cx, badge.cy, radius * 1.5, surface.ink.hex, alpha);
    }
    showing.monogram
      .setPosition(badge.cx, badge.cy - radius * 0.16)
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
    for (const text of showing.texts) text.destroy();
    this.#showing = null;
    if (this.#queue.length === 0) this.sys.setVisible(false);
  }

  /** A popup up when the screen changes size is redrawn for the new size, keeping its place in the animation. */
  #onResize(): void {
    const showing = this.#showing;
    if (!showing) return;
    const { toast, startedAt, totalMs } = showing;
    this.#clear();
    this.#start(toast, { startedAt, totalMs });
  }
}

/** A trophy cup `size` px tall, centred on (`cx`, `cy`): cup, two handles, stem and foot, leaving room for the monogram. */
function drawTrophy(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha: number,
): void {
  const s = size / 2;
  const cupTop = cy - s * 0.55;
  const cupW = s * 0.95;
  g.fillStyle(color, alpha);
  // The cup: a bowl narrowing to the stem.
  g.fillPoints(
    [
      new Phaser.Math.Vector2(cx - cupW / 2, cupTop),
      new Phaser.Math.Vector2(cx + cupW / 2, cupTop),
      new Phaser.Math.Vector2(cx + cupW * 0.36, cy + s * 0.12),
      new Phaser.Math.Vector2(cx + cupW * 0.12, cy + s * 0.25),
      new Phaser.Math.Vector2(cx - cupW * 0.12, cy + s * 0.25),
      new Phaser.Math.Vector2(cx - cupW * 0.36, cy + s * 0.12),
    ],
    true,
  );
  // Handles: a half ring on each side of the bowl.
  const handleR = s * 0.2;
  const handleY = cupTop + s * 0.24;
  g.lineStyle(Math.max(2, s * 0.1), color, alpha);
  g.beginPath();
  g.arc(cx - cupW * 0.46, handleY, handleR, Math.PI / 2, (Math.PI * 3) / 2);
  g.strokePath();
  g.beginPath();
  g.arc(cx + cupW * 0.46, handleY, handleR, -Math.PI / 2, Math.PI / 2);
  g.strokePath();
  // Stem and foot.
  g.fillRect(cx - s * 0.07, cy + s * 0.25, s * 0.14, s * 0.2);
  g.fillRect(cx - s * 0.32, cy + s * 0.45, s * 0.64, s * 0.12);
}
