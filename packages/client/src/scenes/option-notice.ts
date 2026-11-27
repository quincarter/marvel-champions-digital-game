/**
 * "Only one option" (#412): launched over the Board when a "choose one" took its only option without asking, listing
 * every option on the card, the one taken marked and each other one disabled with why it was not offered
 * (`view/option-notice.ts`). Nothing is decided here: it is read and dismissed. Modeled on `scenes/end-turn-confirm.ts`
 * (scrim and box, the scenes underneath take no input while it is up). A choice the same command opened (Work-Life
 * Balance's pick of which ally) waits under it.
 *
 * The box is a Lit panel over the canvas (`dom/popup-sheet.ts`); the scene keeps the press shield, the focus route (ring
 * in the panel layer) and the answers.
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
import type { OptionNotice } from "../view/option-notice.js";
import { layoutNotice, noticeButtonKey, noticeButtonOf, noticeTextKey } from "../view/option-notice-layout.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { anyPadButtonHeld } from "./press-guard.js";
import { appSession } from "../session.js";

const buttonType = { ...typeRole.label, size: 13 };

export interface OptionNoticeData {
  readonly notices: readonly OptionNotice[];
}

/** The scenes under the notice whose pointer input it turns off while it is up. */
const BENEATH = [SCENES.board, SCENES.choice, SCENES.online] as const;

/**
 * Turns the scenes' input back on, but not while a pad button is down. Their pad plugins did not poll while input was
 * off, so a button pressed to close the notice (Start, A, B) still reads as a fresh press to them the moment they poll
 * again: Start would open Pause, A would press what the Board has focused. Waiting for the release makes that press
 * the notice's alone. A click, or a key, has nothing held and gives the input back at once.
 */
export function giveBack(scenes: readonly Phaser.Scene[]): void {
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
  /** A stable identity per notice, so a button's DOM key says which notice it belongs to. */
  readonly #ids = new WeakMap<OptionNotice, number>();
  #nextId = 1;
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;

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
    this.#panel = new PopupSheet(
      this,
      (key) => {
        // A key of another notice (a press begun on the one just dismissed) answers nothing.
        const current = this.#notices[0];
        const button = current ? noticeButtonOf(key, this.#idOf(current)) : null;
        if (button === "ok") this.#dismiss();
        else if (button === "never") {
          if (current?.action) this.#runAction();
          else this.#optOut();
        }
      },
      undefined,
      {
        // A swipe takes the notice away as Esc does; with more waiting, the next one is drawn in its place.
        onDismiss: () => {
          const more = this.#notices.length > 1;
          this.#dismiss();
          if (more) this.#panel.springBack();
        },
      },
    );
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    // A (or Enter) presses the focused OK, Start presses it from anywhere, B / Esc dismisses. A pad button still down
    // when it opens fires nothing here: Phaser builds a held Button as pressed.
    // X (G / H on the keyboard) presses "Don't show again" on a notice that offers it.
    this.#route = new FocusRoute(this, {
      blocked: () => this.#panel.leaving,
      ring: domFocusRing,
      // OK's and "Don't show again"'s glyphs depend on which has the ring: the ring moved, so read them again.
      onFocusChange: () => this.#glyphs.refresh(),
      onCancel: () => this.#dismiss(),
      primary: () => "ok",
      // The right stick scrolls the text when it is taller than the screen.
      onScroll: (_dx, dy) => {
        const current = this.#notices[0];
        const text = current ? this.#panel.element?.elementOf(noticeTextKey(this.#idOf(current))) : undefined;
        if (text) text.scrollTop += dy;
      },
      onToggle: () => {
        if (this.#notices[0]?.optOut && !this.#notices[0].action) this.#optOut();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
      giveBack(paused);
    });
    this.#draw();
  }

  #idOf(notice: OptionNotice): number {
    let id = this.#ids.get(notice);
    if (id === undefined) {
      id = this.#nextId++;
      this.#ids.set(notice, id);
    }
    return id;
  }

  /** More notices, from a later command while this one is still up: shown after the ones waiting. */
  queueNotices(notices: readonly OptionNotice[]): void {
    const pending = this.#panel.cancelExit();
    this.#notices = [...this.#notices, ...notices];
    this.#draw();
    pending?.();
  }

  /**
   * "Don't show again" (#431): turns the not-offered notices off in Settings (`notOfferedNotices`, where they can be
   * turned back on), and drops the ones waiting; the rest are shown as before.
   */
  #optOut(): void {
    const session = appSession();
    session.settings = { ...session.settings, notOfferedNotices: false };
    this.#notices = [this.#notices[0]!, ...this.#notices.slice(1).filter((notice) => !notice.optOut)];
    this.#dismiss();
  }

  /** The notice's own action (it is dismissed first, so the screen under it is the one the action leaves). */
  #runAction(): void {
    const action = this.#notices[0]?.action;
    this.#dismiss(() => action?.run());
  }

  /** The next notice, or close when this was the last. */
  #dismiss(after?: () => void): void {
    this.#notices = this.#notices.slice(1);
    if (this.#notices.length === 0) {
      // A notice that arrives while this plays its exit takes it back (`queueNotices`), so the exit's end only
      // runs the answer.
      this.#panel.close(() => after?.());
      return;
    }
    this.#draw();
    after?.();
  }

  #draw(): void {
    destroyChildren(this);
    this.#glyphs.reset();
    const notice = this.#notices[0];
    if (!notice) return;

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);

    const textWidth = Math.min(560, width - 32) - 40;
    const titleSpec = typeRole.barTitle;
    const bodySpec = typeRole.body;
    const titleSize = b.measure(notice.title, titleSpec, { wrapWidth: textWidth });
    const leadText = notice.lead ?? t("notice.onlyOne.lead");
    const leadSize = b.measure(leadText, bodySpec, { wrapWidth: textWidth });
    const rowOptions = { wrapWidth: textWidth - 24, lineSpacing: 2 };
    const rows = notice.rows.map((row) => {
      const text =
        row.kind === "taken"
          ? t("notice.row.taken", { label: row.label })
          : t("notice.row.unavailable", { label: row.label, why: row.why });
      return { row, text, size: b.measure(text, bodySpec, rowOptions) };
    });
    const buttonHeight = hit.primary;
    // A notice with an action stacks it above OK, full width: its label is long ("Continue in single player") and a half row clips it.
    const stacked = notice.action !== undefined;
    const layout = layoutNotice({
      width,
      height,
      titleHeight: titleSize.height,
      leadHeight: leadSize.height,
      rowTextHeights: rows.map(({ size }) => size.height),
      stacked,
      buttonHeight,
    });
    const { box } = layout;
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    // The text and the option rows scroll in a region bounded to the box; the buttons below it are always on screen.
    b.scroll(noticeTextKey(this.#idOf(notice)), layout.scroll, layout.contentHeight, (sb) => {
      const x = box.x + 20;
      sb.text(x, layout.titleY, notice.title, titleSpec, { color: surface.ink.hex, wrapWidth: textWidth });
      sb.text(x, layout.leadY, leadText, bodySpec, { color: surface.ink.hex, alpha: 0.9, wrapWidth: textWidth });
      // Each option in a frame: the taken one drawn solid, the others faded, as the choice sheet draws a disabled row.
      rows.forEach(({ row, text }, n) => {
        const f = layout.rowFrames[n]!;
        const frame: Rect = { x, y: f.y, width: textWidth, height: f.height };
        const taken = row.kind === "taken";
        sb.box(frame, { stroke: surface.ink.hex, strokeWidth: taken ? 3 : 2, alpha: taken ? 1 : 0.35 });
        sb.text(frame.x + 12, frame.y + 8, text, bodySpec, {
          ...rowOptions,
          color: surface.ink.hex,
          alpha: taken ? 1 : 0.55,
        });
      });
    });

    const buttonY = layout.buttonY;
    const id = this.#idOf(notice);
    const okKey = noticeButtonKey("ok", id, false);
    const neverKey = noticeButtonKey("never", id, notice.action !== undefined);
    // A notice that offers "Don't show again" splits the row: it on the left, OK on the right (`end-turn-confirm.ts`).
    const half = (textWidth - 12) / 2;
    const sideLabel = notice.action ? notice.action.label : notice.optOut ? t("notice.dontShowAgain") : null;
    const neverRect: Rect | null = sideLabel
      ? stacked
        ? { x: box.x + 20, y: buttonY - buttonHeight - 10, width: textWidth, height: buttonHeight }
        : { x: box.x + 20, y: buttonY, width: half, height: buttonHeight }
      : null;
    const okRect: Rect =
      neverRect && !stacked
        ? { x: neverRect.x + half + 12, y: buttonY, width: half, height: buttonHeight }
        : { x: box.x + 20, y: buttonY, width: textWidth, height: buttonHeight };
    // Glyphs are for desktop and tablet landscape (`glyphsFitFormFactor`), as every other pop-up.
    const glyphsFit = glyphsFitFormFactor(formFactorFor(width, height));
    // A on the focused OK; on a pad, Start too (it presses OK from anywhere).
    this.#glyphs.button(b, {
      key: okKey,
      rect: okRect,
      label: this.#notices.length > 1 ? t("notice.next") : (notice.okLabel ?? t("notice.ok")),
      look: "primary",
      type: buttonType,
      ids: glyphsFit ? ["activate"] : [],
      ground: "ink",
      idsNow: (set) =>
        !glyphsFit
          ? null
          : this.#route?.focused !== "ok"
            ? set === "pad"
              ? ["pause"]
              : null
            : set === "pad"
              ? ["activate", "pause"]
              : ["activate"],
    });
    const stops = new Map([["ok", { rect: okRect, activate: () => this.#dismiss() }]]);
    if (neverRect) {
      // X (G / H) presses "Don't show again" from anywhere; A when it has the ring. An action has A only.
      this.#glyphs.button(b, {
        key: neverKey,
        rect: neverRect,
        label: sideLabel!,
        look: "secondary",
        type: buttonType,
        ids: glyphsFit ? [notice.action ? "activate" : "guide"] : [],
        ground: "paper",
        idsNow: () =>
          !glyphsFit ? null : this.#route?.focused === "never" ? ["activate"] : notice.action ? [] : ["guide"],
      });
      stops.set("never", { rect: neverRect, activate: () => (notice.action ? this.#runAction() : this.#optOut()) });
    }
    this.#panel.mount(b, width, height);
    this.#route?.set(neverRect ? ["never", "ok"] : ["ok"], stops);
    // Opening (and each next notice) puts the ring on OK, so A answers at once.
    this.#route?.focusKey("ok");
  }
}
