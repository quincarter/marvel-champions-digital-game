/**
 * "End your turn? You can still: …" — launched over the Board whenever `BoardController.dispatchExample("endTurn")`
 * finds something meaningful still open and Settings ▸ "Confirm before ending turn" is on
 * (`view/end-turn-confirm.ts`'s own doc comment covers what counts). Modeled on `scenes/unlock-confirm.ts`: same
 * scrim-and-box shape, same input-blocking of the scene underneath while it's up.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { t } from "../i18n/translate.js";
import { hit, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";

const buttonType = { ...typeRole.label, size: 13 };

export interface EndTurnConfirmData {
  readonly sentence: string;
  /** "End your turn?" unless given ("Are you sure?" over a small hand size, `view/hand-size-note.ts`). */
  readonly title?: string;
  /** The buttons' labels, "Keep playing" and "End turn" unless given (the adjusted-game warning, issue #791). */
  readonly cancelLabel?: string;
  readonly confirmLabel?: string;
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly onConfirm: () => void;
  /** Called when the player backs out instead (Cancel, Escape). */
  readonly onCancel?: () => void;
}

/**
 * The box is a Lit panel over the canvas (`dom/popup-sheet.ts`), above Pause's when it opens over it. The Phaser scene
 * keeps the press shield, the focus route (ring in the panel layer) and the answers.
 */
export class EndTurnConfirmOverlay extends Phaser.Scene {
  #data!: EndTurnConfirmData;
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;

  constructor() {
    super(SCENES.endTurnConfirm);
  }

  create(data: EndTurnConfirmData): void {
    this.#data = data;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#panel = new PopupSheet(this, (key) => {
      if (key === "ok") this.#answer(true);
      else if (key === "cancel") this.#answer(false);
    });
    // Start is "forward" and ends the turn. Not `primary`: that would let A with nothing focused skip this confirm.
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#answer(false),
      onPause: () => this.#answer(true),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  #answer(confirmed: boolean): void {
    const { onConfirm, onCancel } = this.#data;
    this.scene.stop();
    if (confirmed) onConfirm();
    else onCancel?.();
  }

  #draw(): void {
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);

    const boxWidth = Math.min(560, width - 32);
    const textWidth = boxWidth - 40;
    const titleSpec = typeRole.barTitle;
    const title = this.#data.title ?? t("confirm.title");
    const titleSize = b.measure(title, titleSpec, { wrapWidth: textWidth });
    const bodySpec = typeRole.body;
    const bodyOptions = { size: 16, wrapWidth: textWidth, lineSpacing: 4 };
    const bodySize = b.measure(this.#data.sentence, bodySpec, bodyOptions);
    const buttonHeight = hit.primary;
    const boxHeight = 20 + titleSize.height + 12 + bodySize.height + 20 + buttonHeight + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.text(box.x + 20, box.y + 20, title, titleSpec, { color: surface.ink.hex, wrapWidth: textWidth });
    b.text(box.x + 20, box.y + 20 + titleSize.height + 12, this.#data.sentence, bodySpec, {
      ...bodyOptions,
      color: surface.ink.hex,
      alpha: 0.9,
    });

    const buttonWidth = (textWidth - 12) / 2;
    const buttonY = box.y + box.height - 20 - buttonHeight;
    const keepRect: Rect = { x: box.x + 20, y: buttonY, width: buttonWidth, height: buttonHeight };
    const endRect: Rect = { x: keepRect.x + buttonWidth + 12, y: buttonY, width: buttonWidth, height: buttonHeight };
    b.button({
      key: "cancel",
      rect: keepRect,
      label: this.#data.cancelLabel ?? t("confirm.keepPlaying"),
      look: "secondary",
      type: buttonType,
    });
    b.button({
      key: "ok",
      rect: endRect,
      label: this.#data.confirmLabel ?? t("confirm.endTurn"),
      look: "primary",
      type: buttonType,
    });
    this.#panel.mount(b, width, height);
    const stops = new Map([
      ["cancel", { rect: keepRect, activate: () => this.#answer(false) }],
      ["ok", { rect: endRect, activate: () => this.#answer(true) }],
    ]);
    this.#route?.set(["cancel", "ok"], stops);

    // Headless click-through hook only (never referenced by product code) — mirrors `scenes/board.ts`'s own
    // `__mcBoardDebug`, so a script can find "End turn"'s real screen coordinate instead of re-deriving this
    // box's own centered layout.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcEndTurnConfirmDebug?: unknown }).__mcEndTurnConfirmDebug = {
        endRect: () => endRect,
        keepRect: () => keepRect,
      };
    }
  }
}

/**
 * Warns that stepping outside the rules (an Undo past a reveal, a Manual adjust; issue #791) means this game will no
 * longer count toward stats or achievements, and calls `onConfirm` only if the player acknowledges it. The same box as
 * the End turn confirm, with its own words.
 */
export function askToAdjustGame(
  scene: Phaser.Scene,
  sentence: string,
  confirmLabel: string,
  onConfirm: () => void,
  onCancel: () => void,
): void {
  if (scene.scene.isActive(SCENES.endTurnConfirm)) {
    onCancel();
    return;
  }
  scene.scene.launch(SCENES.endTurnConfirm, {
    sentence: `${sentence}

${t("confirm.wontCountWarning")}`,
    title: t("confirm.wontCountTitle"),
    cancelLabel: t("confirm.cancel"),
    confirmLabel,
    from: scene.scene.key,
    onConfirm,
    onCancel,
  } satisfies EndTurnConfirmData);
}

/**
 * A yes/no box with its own title and words over `scene` (a settings change that turns on a way out of the rules,
 * `cheatUnlockWarningOf`), calling `onConfirm` only if the player says yes. Cancel and Escape change nothing.
 */
export function askToConfirm(
  scene: Phaser.Scene,
  title: string,
  sentence: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  if (scene.scene.isActive(SCENES.endTurnConfirm)) return;
  scene.scene.launch(SCENES.endTurnConfirm, {
    sentence,
    title,
    cancelLabel: t("confirm.cancel"),
    confirmLabel,
    from: scene.scene.key,
    onConfirm,
  } satisfies EndTurnConfirmData);
}

/** Asks "End your turn?" over `scene`, and calls `onConfirm` only if the player says End turn. */
export function askToEndTurn(scene: Phaser.Scene, sentence: string, onConfirm: () => void, title?: string): void {
  if (scene.scene.isActive(SCENES.endTurnConfirm)) return;
  scene.scene.launch(SCENES.endTurnConfirm, {
    sentence,
    ...(title ? { title } : {}),
    from: scene.scene.key,
    onConfirm,
  } satisfies EndTurnConfirmData);
}
