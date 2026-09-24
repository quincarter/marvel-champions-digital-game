/**
 * "Unlock this by hand?": the one confirm every screen asks before spending champion points
 * (`progression/unlocks.ts`). Settings ▸ Unlocks, Scenario select, Seats and the Saga shelf all launch it over
 * themselves, so the wording (cost, no refunds, how to earn it free, from `view/unlocks-model.ts`'s `confirmOf`)
 * and the charge itself are the same wherever a player unlocks something.
 *
 * It switches off pointer input on the screen that launched it while it's up: those screens' shelves and lists
 * take taps through scene-level pointer events, which a blocker zone here can't stop. Confirming saves the new
 * preferences, then calls `onUnlocked` so the caller can redraw (and, in Seats, seat the hero just unlocked).
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { confirmOf } from "../view/unlocks-model.js";
import { unlockByHand, type UnlockTarget } from "../progression/unlocks.js";
import { setUnlockPrefs, unlocks } from "../progression/progression.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";

export interface UnlockConfirmData {
  readonly target: UnlockTarget;
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly onUnlocked?: () => void;
}

export class UnlockConfirmOverlay extends Phaser.Scene {
  #data!: UnlockConfirmData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.unlockConfirm);
  }

  create(data: UnlockConfirmData): void {
    this.#data = data;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#answer(false) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  #answer(confirmed: boolean): void {
    const { target, onUnlocked } = this.#data;
    if (confirmed) setUnlockPrefs(unlockByHand(unlocks(), target));
    this.scene.stop();
    if (confirmed) onUnlocked?.();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const confirm = confirmOf(unlocks(), this.#data.target);
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const boxWidth = Math.min(440, width - 32);
    const textWidth = boxWidth - 40;
    const ground = this.add.graphics();
    const title = this.add
      .text(0, 0, confirm.title, textStyle(typeRole.sectionHeader, surface.ink.hex))
      .setWordWrapWidth(textWidth);
    const body = this.add
      .text(0, 0, confirm.body, textStyle(typeRole.body, surface.ink.hex, 0.9))
      .setFontSize(13)
      .setWordWrapWidth(textWidth)
      .setLineSpacing(3);
    const buttonHeight = hit.target;
    const boxHeight = 20 + title.height + 12 + body.height + 20 + buttonHeight + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    title.setPosition(box.x + 20, box.y + 20);
    body.setPosition(box.x + 20, title.y + title.height + 12);

    const buttonWidth = (textWidth - 12) / 2;
    const buttonY = box.y + box.height - 20 - buttonHeight;
    const cancelRect: Rect = { x: box.x + 20, y: buttonY, width: buttonWidth, height: buttonHeight };
    const okRect: Rect = { x: cancelRect.x + buttonWidth + 12, y: buttonY, width: buttonWidth, height: buttonHeight };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Keep playing",
        type: typeRole.label,
        rect: cancelRect,
        onClick: () => this.#answer(false),
      }),
      new McButton(this, {
        kind: "primary",
        label: confirm.confirmLabel,
        type: typeRole.label,
        rect: okRect,
        onClick: () => this.#answer(true),
      }),
    );
    this.#route?.set(
      ["cancel", "ok"],
      new Map([
        ["cancel", { rect: cancelRect, activate: () => this.#answer(false) }],
        ["ok", { rect: okRect, activate: () => this.#answer(true) }],
      ]),
    );
  }
}

/** Asks before spending points on `target`, over `scene`, and calls `onUnlocked` once it's been paid for. */
export function askToUnlock(scene: Phaser.Scene, target: UnlockTarget, onUnlocked?: () => void): void {
  if (scene.scene.isActive(SCENES.unlockConfirm)) return;
  scene.scene.launch(SCENES.unlockConfirm, {
    target,
    from: scene.scene.key,
    ...(onUnlocked ? { onUnlocked } : {}),
  } satisfies UnlockConfirmData);
}

/**
 * Unlocks `target` from wherever the player found it locked: straight away when it costs nothing (already paid
 * for once), otherwise through the confirm.
 */
export function unlockOrAsk(scene: Phaser.Scene, target: UnlockTarget, onUnlocked: () => void): void {
  const current = unlocks();
  if (current.chargesFor(target).length === 0) {
    setUnlockPrefs(unlockByHand(current, target));
    onUnlocked();
    return;
  }
  askToUnlock(scene, target, onUnlocked);
}

/** The points `target` would cost right now, for a button's label. */
export const unlockCostOf = (target: UnlockTarget): number =>
  unlocks()
    .chargesFor(target)
    .reduce((sum, charge) => sum + charge.points, 0);
