/**
 * The coach card: Guided mode's steps, game tips, and the first-run "New to Marvel Champions?", drawn over
 * whichever screen asked for them.
 *
 * **Non-modal.** Only the card itself takes input; everything else on screen stays live underneath, so a player
 * can do what a step describes while reading it. The part of the screen the card is about gets an outline, never
 * a dimmed screen.
 *
 * **Screens never touch this scene.** A screen calls `presentCoach(this, card)` (or `null`); this overlay reads
 * `ui/coach-state.ts` every frame and redraws only when the card changes. It hides itself while a sheet or menu
 * covers the screen (`COVERING`), and comes back when that closes. Registered last in `main.ts`, so it draws above
 * every screen and overlay it isn't hiding for.
 */
import Phaser from "phaser";
import { accent, ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { clearCoachFor, coachPresentation, setCoachPresentation, type CoachCard } from "../ui/coach-state.js";
import { coachCardRect, coachCardWidth } from "../view/guide/coach-layout.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { SCENES } from "./keys.js";

/** Sheets and menus that cover a screen: the card waits behind them rather than floating on top. */
const COVERING = [
  SCENES.choice,
  SCENES.inspect,
  SCENES.villainPhase,
  SCENES.pause,
  SCENES.rules,
  SCENES.settings,
  SCENES.unlocks,
  SCENES.unlockConfirm,
  SCENES.endTurnConfirm,
  SCENES.campaignBeat,
  SCENES.tableHelp,
] as const;

const PAD = 14;
const BUTTON_HEIGHT = 32;

let launching = false;

/**
 * Shows `card` for `owner`, or clears it with null. Safe to call every frame: it only launches the overlay once, and
 * the overlay redraws only when the card's `key` changes. The owner's card is cleared when the owner shuts down.
 */
export function presentCoach(owner: Phaser.Scene, card: CoachCard | null): void {
  const key = owner.sys.settings.key;
  if (!card) {
    clearCoachFor(key);
    return;
  }
  const previous = coachPresentation();
  setCoachPresentation({ owner: key, card });
  if (previous?.owner !== key) {
    owner.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearCoachFor(key));
  }
  const manager = owner.scene.manager;
  if (!launching && !manager.isActive(SCENES.coach)) {
    launching = true;
    owner.scene.launch(SCENES.coach);
  }
}

export class CoachOverlay extends Phaser.Scene {
  #drawn: CoachCard | null = null;
  #hidden = false;
  #buttons: McButton[] = [];
  #objects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENES.coach);
  }

  create(): void {
    launching = false;
    this.#drawn = null;
    const onResize = (): void => this.#draw(coachPresentation()?.card ?? null);
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#clear();
      launching = false;
    });
  }

  override update(): void {
    const card = coachPresentation()?.card ?? null;
    const covered = COVERING.some((key) => this.scene.isActive(key));
    if (covered !== this.#hidden) {
      this.#hidden = covered;
      for (const object of this.#objects) (object as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(!covered);
      for (const button of this.#buttons) button.container.setVisible(!covered);
      this.input.enabled = !covered;
    }
    if (card !== this.#drawn) this.#draw(card);
  }

  #clear(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
  }

  #draw(card: CoachCard | null): void {
    this.#clear();
    this.#drawn = card;
    if (!card) return;
    const { width, height } = this.scale.gameSize;
    const viewport: Rect = { x: 0, y: 0, width, height };
    const cardWidth = coachCardWidth(viewport);
    const textWidth = cardWidth - PAD * 2;
    const desktop = formFactorFor(width, height) === "desktop";

    // Text first, off to the side, so the card's height is measured rather than guessed.
    const eyebrow = this.add.text(0, 0, caseOf(typeRole.label, card.eyebrow), textStyle(typeRole.label, accent.heroRed.hex));
    const title = this.add
      .text(0, 0, caseOf(typeRole.sectionHeader, card.title), textStyle(typeRole.sectionHeader, surface.ink.hex))
      .setWordWrapWidth(textWidth);
    const body = this.add
      .text(0, 0, card.body, { ...textStyle(typeRole.body, surface.ink.hex), fontSize: desktop ? "13px" : "12px" })
      .setWordWrapWidth(textWidth)
      .setLineSpacing(3);
    const warning = card.warning
      ? this.add
          .text(0, 0, `⚠ ${card.warning}`, { ...textStyle(typeRole.emphasis, surface.ink.hex), fontSize: "12px" })
          .setWordWrapWidth(textWidth - 16)
          .setLineSpacing(2)
      : null;
    const cite = card.cite ? this.add.text(0, 0, card.cite, textStyle(typeRole.label, surface.ink.hex, ink.meta)) : null;
    const hint =
      card.hint && desktop ? this.add.text(0, 0, card.hint, textStyle(typeRole.label, surface.ink.hex, ink.meta)) : null;

    let contentHeight = eyebrow.height + 4 + title.height + 6 + body.height;
    if (warning) contentHeight += 10 + warning.height + 12;
    if (cite) contentHeight += 6 + cite.height;
    const actionsHeight = card.actions.length > 0 ? 12 + BUTTON_HEIGHT : 0;
    const hintHeight = hint ? 8 + hint.height : 0;
    const cardHeight = PAD + contentHeight + actionsHeight + hintHeight + PAD;
    const rect = coachCardRect(viewport, cardHeight, card.anchor ?? null, card.corner);

    if (card.anchor) {
      const outline = this.add.graphics();
      const a = card.anchor;
      outline.lineStyle(6, signal.caution.hex, 0.35).strokeRect(a.x - 3, a.y - 3, a.width + 6, a.height + 6);
      outline.lineStyle(3, signal.caution.hex, 1).strokeRect(a.x - 1, a.y - 1, a.width + 2, a.height + 2);
      this.#objects.push(outline);
    }

    const panel = this.add.graphics();
    panel.fillStyle(surface.void.hex, 0.35).fillRect(rect.x + 5, rect.y + 5, rect.width, rect.height);
    panel.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    panel.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    panel.fillStyle(signal.caution.hex, 1).fillRect(rect.x, rect.y, 6, rect.height);
    // The card's own face swallows taps, so a tap on its blank space never reaches the table underneath.
    const blocker = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();
    this.#objects.push(panel, blocker);

    let y = rect.y + PAD;
    const x = rect.x + PAD;
    for (const text of [eyebrow, title, body]) {
      text.setPosition(x, y).setDepth(1);
      y += text.height + (text === eyebrow ? 4 : 6);
    }
    y -= 6;
    if (warning) {
      y += 10;
      const box = this.add.graphics();
      box.fillStyle(signal.caution.hex, 0.25).fillRect(x, y, textWidth, warning.height + 12);
      box.lineStyle(2, signal.caution.hex, 1).strokeRect(x, y, textWidth, warning.height + 12);
      warning.setPosition(x + 8, y + 6).setDepth(1);
      this.#objects.push(box);
      y += warning.height + 12;
    }
    if (cite) {
      y += 6;
      cite.setPosition(x, y).setDepth(1);
      y += cite.height;
    }
    this.#objects.push(eyebrow, title, body, ...(warning ? [warning] : []), ...(cite ? [cite] : []));

    if (card.actions.length > 0) {
      y += 12;
      this.#drawActions(card, { x, y, width: textWidth, height: BUTTON_HEIGHT });
      y += BUTTON_HEIGHT;
    }
    if (hint) {
      hint.setPosition(x, y + 8).setDepth(1);
      this.#objects.push(hint);
    }
    if (this.#hidden) {
      for (const object of this.#objects) (object as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(false);
      for (const button of this.#buttons) button.container.setVisible(false);
    }
  }

  /** Secondary actions share the left, sized to their labels; the forward one takes the right. */
  #drawActions(card: CoachCard, row: Rect): void {
    const gap = 8;
    const labelWidth = (text: string): number => Math.max(64, text.length * 7 + 24);
    const forward = card.actions.find((action) => action.forward);
    const others = card.actions.filter((action) => !action.forward);
    let right = row.x + row.width;
    if (forward) {
      const w = labelWidth(forward.label);
      right -= w;
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: forward.label,
          type: typeRole.label,
          rect: { x: right, y: row.y, width: w, height: row.height },
          selected: true,
          onClick: forward.onClick,
        }),
      );
      right -= gap;
    }
    let left = row.x;
    for (const action of others) {
      const w = Math.min(labelWidth(action.label), right - left);
      if (w < 48) break;
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: action.label,
          type: typeRole.label,
          rect: { x: left, y: row.y, width: w, height: row.height },
          onClick: action.onClick,
        }),
      );
      left += w + gap;
    }
  }
}
