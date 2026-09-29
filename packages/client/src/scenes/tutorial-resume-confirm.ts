/**
 * "Resume the tutorial at lesson 3: Hero & alter-ego?" (guided mode §3.12, `docs/guided-mode.md`): Title's own
 * Continue launches this over itself when the save it's about to resume was a guided run
 * (`guide/tutorial-resume.ts#tutorialResumeDecisionFor`). Modeled on `scenes/end-turn-confirm.ts`: same
 * scrim-and-box shape, same input-blocking of the scene underneath while it's up — the caller supplies the exact
 * copy and labels, so this scene stays dumb and reusable for both the tutorial's per-lesson wording and an
 * aspect "Try it" save's own.
 *
 * Three outcomes, not two: "Resume tutorial"/"Restart" fast-forwards a fresh guided game
 * (`onResume`); "Continue as a normal game" opens the save as-is, guide off (`onContinuePlain`); Escape cancels
 * the whole Continue back to Title (§3.10) — neither callback fires, so no game starts and nothing about the
 * save changes.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";

const buttonType = { ...typeRole.label, size: 13 };

export interface TutorialResumeConfirmData {
  readonly title: string;
  readonly body: string;
  /** "Resume tutorial" for the scripted tutorial, "Restart <aspect> Try it" for an aspect save. */
  readonly resumeLabel: string;
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly onResume: () => void;
  readonly onContinuePlain: () => void;
}

export class TutorialResumeConfirmOverlay extends Phaser.Scene {
  #data!: TutorialResumeConfirmData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.tutorialResumeConfirm);
  }

  create(data: TutorialResumeConfirmData): void {
    this.#data = data;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    // Escape cancels back to Title (§3.10): neither `onResume` nor `onContinuePlain` fires.
    this.#route = new FocusRoute(this, { onCancel: () => this.scene.stop() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  #choose(outcome: "resume" | "plain"): void {
    const { onResume, onContinuePlain } = this.#data;
    this.scene.stop();
    if (outcome === "resume") onResume();
    else onContinuePlain();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const boxWidth = Math.min(560, width - 32);
    const textWidth = boxWidth - 40;
    const ground = this.add.graphics();
    const title = this.add
      .text(0, 0, this.#data.title, textStyle(typeRole.barTitle, surface.ink.hex))
      .setWordWrapWidth(textWidth);
    const body = this.add
      .text(0, 0, this.#data.body, textStyle(typeRole.body, surface.ink.hex, 0.9))
      .setFontSize(16)
      .setWordWrapWidth(textWidth)
      .setLineSpacing(4);
    const buttonHeight = hit.primary;
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
    const resumeRect: Rect = { x: box.x + 20, y: buttonY, width: buttonWidth, height: buttonHeight };
    const plainRect: Rect = {
      x: resumeRect.x + buttonWidth + 12,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#data.resumeLabel,
        type: buttonType,
        rect: resumeRect,
        onClick: () => this.#choose("resume"),
      }),
      new McButton(this, {
        kind: "secondary",
        label: "Continue as a normal game",
        type: buttonType,
        rect: plainRect,
        onClick: () => this.#choose("plain"),
      }),
    );
    const stops = new Map([
      ["resume", { rect: resumeRect, activate: () => this.#choose("resume") }],
      ["plain", { rect: plainRect, activate: () => this.#choose("plain") }],
    ]);
    this.#route?.set(["resume", "plain"], stops);
  }
}

/** Asks whether to resume guidance or open `data` plainly, over `scene`. Refuses a second launch while one is
 * already up (same guard `askToEndTurn` uses). */
export function askToResumeTutorial(scene: Phaser.Scene, data: Omit<TutorialResumeConfirmData, "from">): void {
  if (scene.scene.isActive(SCENES.tutorialResumeConfirm)) return;
  scene.scene.launch(SCENES.tutorialResumeConfirm, {
    ...data,
    from: scene.scene.key,
  } satisfies TutorialResumeConfirmData);
}
