/**
 * "Only one option" (#412): launched over the Board when a "choose one" took its only option without asking, listing
 * every option on the card, the one taken marked and each other one disabled with why it was not offered
 * (`view/option-notice.ts`). Nothing is decided here: it is read and dismissed. Modeled on `scenes/end-turn-confirm.ts`
 * (scrim and box, the scenes underneath take no input while it is up). A choice the same command opened (Work-Life
 * Balance's pick of which ally) waits under it.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { Rect } from "../view/layout.js";
import type { OptionNotice } from "../view/option-notice.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";

const buttonType = { ...typeRole.label, size: 13 };

export interface OptionNoticeData {
  readonly notices: readonly OptionNotice[];
}

/** The scenes under the notice whose pointer input it turns off while it is up. */
const BENEATH = [SCENES.board, SCENES.choice] as const;

export class OptionNoticeOverlay extends Phaser.Scene {
  #notices: readonly OptionNotice[] = [];
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.optionNotice);
  }

  create(data: OptionNoticeData): void {
    this.#notices = data.notices;
    const paused = BENEATH.flatMap((key) => {
      const scene = this.scene.isActive(key) ? this.scene.get(key) : null;
      if (!scene || !scene.input.enabled) return [];
      scene.input.enabled = false;
      return [scene];
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#dismiss() });
    // Enter is OK at once; once Tab has put the ring on OK, the route presses it instead (never both).
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.#route?.focused === null) this.#dismiss();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      for (const scene of paused) scene.input.enabled = true;
    });
    this.#draw();
  }

  /** More notices, from a later command while this one is still up: shown after the ones waiting. */
  queueNotices(notices: readonly OptionNotice[]): void {
    this.#notices = [...this.#notices, ...notices];
    this.#draw();
  }

  /** The next notice, or close when this was the last. */
  #dismiss(): void {
    this.#notices = this.#notices.slice(1);
    if (this.#notices.length === 0) this.scene.stop();
    else this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const notice = this.#notices[0];
    if (!notice) return;

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const boxWidth = Math.min(560, width - 32);
    const textWidth = boxWidth - 40;
    const ground = this.add.graphics();
    const title = this.add
      .text(0, 0, notice.title, textStyle(typeRole.barTitle, surface.ink.hex))
      .setWordWrapWidth(textWidth);
    const lead = this.add
      .text(
        0,
        0,
        "The other options could not be chosen, so this one was taken.",
        textStyle(typeRole.body, surface.ink.hex, 0.9),
      )
      .setWordWrapWidth(textWidth);
    const rows = notice.rows.map((row) =>
      this.add
        .text(
          0,
          0,
          row.kind === "taken" ? `✓ ${row.label} (taken)` : `${row.label}\nNot available: ${row.why}.`,
          textStyle(typeRole.body, surface.ink.hex, row.kind === "taken" ? 1 : 0.55),
        )
        .setWordWrapWidth(textWidth - 24)
        .setLineSpacing(2),
    );
    const rowGap = 10;
    const rowsHeight = rows.reduce((sum, text) => sum + text.height + 16 + rowGap, 0);
    const buttonHeight = hit.primary;
    const boxHeight = 20 + title.height + 8 + lead.height + 14 + rowsHeight + 10 + buttonHeight + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 2),
      width: boxWidth,
      height: boxHeight,
    };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    title.setPosition(box.x + 20, box.y + 20);
    lead.setPosition(box.x + 20, title.y + title.height + 8);
    // Each option in a frame: the taken one drawn solid, the others faded, as the choice sheet draws a disabled row.
    let y = lead.y + lead.height + 14;
    notice.rows.forEach((row, index) => {
      const text = rows[index]!;
      const frame: Rect = { x: box.x + 20, y, width: textWidth, height: text.height + 16 };
      ground.lineStyle(row.kind === "taken" ? 3 : 2, surface.ink.hex, row.kind === "taken" ? 1 : 0.35);
      ground.strokeRect(frame.x, frame.y, frame.width, frame.height);
      text.setPosition(frame.x + 12, frame.y + 8);
      y += frame.height + rowGap;
    });

    const okRect: Rect = {
      x: box.x + 20,
      y: box.y + box.height - 20 - buttonHeight,
      width: textWidth,
      height: buttonHeight,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#notices.length > 1 ? "Next" : "OK",
        type: buttonType,
        rect: okRect,
        onClick: () => this.#dismiss(),
      }),
    );
    this.#route?.set(["ok"], new Map([["ok", { rect: okRect, activate: () => this.#dismiss() }]]));
  }
}
