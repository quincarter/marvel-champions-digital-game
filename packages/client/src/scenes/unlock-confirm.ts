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
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { glyphsFitFormFactor } from "../view/glyph-placement.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { confirmOf } from "../view/unlocks-model.js";
import { unlockByHand, type UnlockTarget } from "../progression/unlocks.js";
import { setUnlockPrefs, unlocks } from "../progression/progression.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** The popup's button labels, a size up from the 9px `label` role so they read at desk distance. */
const buttonType = { ...typeRole.label, size: 13 };

export interface UnlockConfirmData {
  readonly target: UnlockTarget;
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly onUnlocked?: () => void;
}

/**
 * The box is a Lit panel over the canvas (`dom/popup-sheet.ts`), above the sheet it opens over (Unlocks) which stays
 * shown under its scrim. The scene keeps the press shield, the focus route (ring in the panel layer) and the answer.
 */
export class UnlockConfirmOverlay extends Phaser.Scene {
  #data!: UnlockConfirmData;
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;

  constructor() {
    super(SCENES.unlockConfirm);
  }

  create(data: UnlockConfirmData): void {
    this.#data = data;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#panel = new PopupSheet(
      this,
      (key) => {
        if (key === "ok") this.#answer(true);
        else if (key === "cancel") this.#answer(false);
      },
      undefined,
      { onDismiss: () => this.#answer(false) },
    );
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#panel.leaving,
      onCancel: () => this.#answer(false),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  #answer(confirmed: boolean): void {
    const { target, onUnlocked } = this.#data;
    // Re-checked at the moment of paying: never spend points the player doesn't have.
    const paid = confirmed && unlocks().canAfford(target);
    if (paid) setUnlockPrefs(unlockByHand(unlocks(), target));
    this.#panel.close(() => {
      if (paid) onUnlocked?.();
    });
  }

  #draw(): void {
    destroyChildren(this);
    this.#glyphs.reset();

    const confirm = confirmOf(unlocks(), this.#data.target);
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);

    const boxWidth = Math.min(560, width - 32);
    const textWidth = boxWidth - 40;
    const titleSize = b.measure(confirm.title, typeRole.barTitle, { wrapWidth: textWidth });
    const bodyOptions = { size: 16, wrapWidth: textWidth, lineSpacing: 4 };
    const bodySize = b.measure(confirm.body, typeRole.body, bodyOptions);
    const buttonHeight = hit.primary;
    const boxHeight = 20 + titleSize.height + 12 + bodySize.height + 20 + buttonHeight + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.text(box.x + 20, box.y + 20, confirm.title, typeRole.barTitle, { color: surface.ink.hex, wrapWidth: textWidth });
    b.text(box.x + 20, box.y + 20 + titleSize.height + 12, confirm.body, typeRole.body, {
      ...bodyOptions,
      color: surface.ink.hex,
      alpha: 0.9,
    });

    // Not enough points: nothing to confirm, only the way back.
    const glyphsFit = glyphsFitFormFactor(formFactorFor(width, height));
    const buttonWidth = confirm.affordable ? (textWidth - 12) / 2 : textWidth;
    const buttonY = box.y + box.height - 20 - buttonHeight;
    const cancelRect: Rect = { x: box.x + 20, y: buttonY, width: buttonWidth, height: buttonHeight };
    const okRect: Rect = { x: cancelRect.x + buttonWidth + 12, y: buttonY, width: buttonWidth, height: buttonHeight };
    this.#glyphs.button(b, {
      key: "cancel",
      rect: cancelRect,
      label: t("unlock.keepPlaying"),
      look: confirm.affordable ? "secondary" : "primary",
      type: buttonType,
      ids: glyphsFit ? ["cancel"] : [],
      ground: confirm.affordable ? "paper" : "ink",
    });
    const stops = new Map([["cancel", { rect: cancelRect, activate: () => this.#answer(false) }]]);
    if (confirm.affordable) {
      b.button({ key: "ok", rect: okRect, label: confirm.confirmLabel, look: "primary", type: buttonType });
      stops.set("ok", { rect: okRect, activate: () => this.#answer(true) });
    }
    this.#panel.mount(b, width, height);
    this.#route?.set(confirm.affordable ? ["cancel", "ok"] : ["cancel"], stops);
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
