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
import { GlyphHints } from "../ui/glyph-hints.js";
import type { Rect } from "../view/layout.js";
import type { OptionNotice } from "../view/option-notice.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { anyPadButtonHeld } from "./press-guard.js";

const buttonType = { ...typeRole.label, size: 13 };

export interface OptionNoticeData {
  readonly notices: readonly OptionNotice[];
}

/** The scenes under the notice whose pointer input it turns off while it is up. */
const BENEATH = [SCENES.board, SCENES.choice] as const;

/**
 * Turns the scenes' input back on, but not while a pad button is down. Their pad plugins did not poll while input was
 * off, so a button pressed to close the notice (Start, A, B) still reads as a fresh press to them the moment they poll
 * again: Start would open Pause, A would press what the Board has focused. Waiting for the release makes that press
 * the notice's alone. A click, or a key, has nothing held and gives the input back at once.
 */
function giveBack(scenes: readonly Phaser.Scene[]): void {
  const first = scenes[0];
  if (!first) return;
  const enable = (): void => {
    for (const scene of scenes) scene.input.enabled = true;
  };
  if (!anyPadButtonHeld()) {
    enable();
    return;
  }
  const timer = first.time.addEvent({
    delay: 30,
    loop: true,
    callback: () => {
      if (anyPadButtonHeld()) return;
      enable();
      timer.remove(false);
    },
  });
}

export class OptionNoticeOverlay extends Phaser.Scene {
  #notices: readonly OptionNotice[] = [];
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;

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
    this.#hints = new GlyphHints(this);
    // A (or Enter) presses the focused OK, Start presses it from anywhere, B / Esc dismisses. A pad button still down
    // when it opens fires nothing here: Phaser builds a held Button as pressed.
    this.#route = new FocusRoute(this, { onCancel: () => this.#dismiss(), primary: () => "ok" });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#hints.dispose();
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      giveBack(paused);
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
    this.#hints.reset();
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
        notice.lead ?? "The other options could not be chosen, so this one was taken.",
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
    // A on the focused OK; on a pad, Start too (it presses OK from anywhere).
    this.#hints.button(this.#buttons[0]!, ["activate"], "ink", {
      idsNow: (set) => (set === "pad" ? ["activate", "pause"] : ["activate"]),
    });
    this.#route?.set(["ok"], new Map([["ok", { rect: okRect, activate: () => this.#dismiss() }]]));
    // Opening (and each next notice) puts the ring on OK, so A answers at once.
    this.#route?.focusKey("ok");
  }
}
