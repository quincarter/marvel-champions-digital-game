/**
 * `McTipToast` (guided mode G10e part 2, `docs/guided-mode.md` §4 G10e): the small yellow surface an
 * opportunistic tip (`view/guide-tips.ts#tipsFor`, paced by `view/tip-schedule.ts`) shows on the board — a `TIP`
 * stamp, a Bangers title, an `McTermText` body sharing one `McTooltip`, a "Turn tips off" link and a "Got it"
 * primary button, plus a top-right close ×. Unlike `McGuideCallout` (the scripted-lesson surface) this never
 * anchors to a board thing and never gates input — §3.10's "never locked in" rules are a lesson-run concept; an
 * opportunistic tip is not a lesson, it's a note, so it draws with no dim, no spotlight and no soft gate
 * (`docs/guided-mode.md` §4 G10e "It never blocks input").
 *
 * **Auto-hides on the player's next action**, per the brief — this widget doesn't know what "the player acted"
 * means (that's `scenes/board/tip-mount.ts`'s own job, reading the same store update the rest of the board
 * redraws from); it only ever draws for as long as its host keeps calling `update()`, and disappears the instant
 * the host stops constructing it (the same "every widget here is rebuilt fresh, nothing survives a board redraw"
 * discipline `scenes/board/guide-mount.ts`'s own header documents for the lesson surfaces).
 *
 * **Layout is a full rebuild**, same reasoning as `McGuideCallout#update`: a tip changes rarely enough (once per
 * player turn at most, per the scheduler) that redrawing from scratch is simpler than diffing.
 */
import Phaser from "phaser";
import { border, hit, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { tipToastRectOf } from "../view/tip-toast-model.js";
import { tooltipContentOf, type TermTextTerm } from "../view/term-text-model.js";
import { McButton } from "./widgets.js";
import { McTermText } from "./term-text.js";
import { McTooltip } from "./tooltip.js";
import { textStyle } from "./theme.js";

const PAD = 16;
const MAX_WIDTH = 340;
/** Tabbed (phone, tablet portrait) draws narrower and with less padding — it sits over the current tab's own
 * content instead of the board's dead corner, so a smaller footprint per the fix brief. */
const TABBED_PAD = 12;
const TABBED_MAX_WIDTH = 280;
const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };
const STAMP_TYPE: TypeSpec = { ...typeRole.label, size: 10 };
const TITLE_TYPE: TypeSpec = { ...typeRole.barTitle, size: 18 };
const STAMP_PAD = 8;

export interface McTipToastContent {
  readonly title: string;
  /** `McTermText` markup — see `view/term-text-model.ts`'s header for `[[id]]` / `[[id|label]]`. */
  readonly body: string;
  /** A small line above "Turn tips off"/"Got it" — `BoardTipMount` fills it with the guide's own focus-region
   * key hint (docs/guided-mode.md §3.10 fix) whenever keyboard focus isn't already on this toast. Omit/null to
   * hide it. */
  readonly hint?: string | null;
}

export interface McTipToastOptions {
  /** "Got it" — dismisses this one tip. */
  readonly onGotIt: () => void;
  /** The top-right ×, same effect as "Got it" but with no confirmation copy. */
  readonly onClose: () => void;
  /** "Turn tips off" — a deliberate choice, so the caller saves it (`setGuidePrefs(withLevel(prefs, "hints"))`). */
  readonly onTurnOff: () => void;
  readonly onOpenGlossary?: (query: string) => void;
}

/** The small yellow opportunistic-tip toast. */
export class McTipToast {
  readonly container: Phaser.GameObjects.Container;
  readonly #scene: Phaser.Scene;
  readonly #options: McTipToastOptions;
  readonly #tooltip: McTooltip;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #body: McTermText | null = null;
  #focusables: { readonly rect: Rect; readonly activate: () => void }[] = [];
  #focusIndex = -1;
  readonly #focusRing: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, options: McTipToastOptions) {
    this.#scene = scene;
    this.#options = options;
    this.container = scene.add.container(0, 0);
    this.#tooltip = new McTooltip(scene);
    this.#focusRing = scene.add.graphics();
  }

  /**
   * Redraws the toast for `content` at its fixed placement (`view/tip-toast-model.ts#tipToastRectOf`). `handRect`
   * is the board's own hand zone this frame (always present); `playAreaRect` is the board's own play area zone,
   * read only when `tabbed` is false. Tabbed draws narrower and with less padding (this module's own header).
   */
  update(content: McTipToastContent, viewport: Rect, tabbed: boolean, handRect: Rect, playAreaRect: Rect | null): void {
    this.#tooltip.hide();
    this.#teardown();

    const scene = this.#scene;
    const pad = tabbed ? TABBED_PAD : PAD;
    const maxWidth = tabbed ? TABBED_MAX_WIDTH : MAX_WIDTH;
    const width = Math.min(maxWidth, viewport.width - 32);
    const innerWidth = width - pad * 2;
    const objects: Phaser.GameObjects.GameObject[] = [];

    const stampHeight = 18;
    const stamp = scene.add.graphics();
    const stampLabel = scene.add.text(0, 0, "TIP", textStyle(STAMP_TYPE, surface.paper.hex)).setOrigin(0, 0.5);
    const stampWidth = stampLabel.width + STAMP_PAD * 2;

    const closeLabel = scene.add
      .text(0, 0, "×", { ...textStyle(TITLE_TYPE, surface.ink.hex), fontSize: "20px" })
      .setOrigin(0.5, 0.5);

    const title = scene.add
      .text(0, 0, content.title.toUpperCase(), textStyle(TITLE_TYPE, surface.ink.hex))
      .setWordWrapWidth(innerWidth, true);

    const body = new McTermText(scene, {
      x: 0,
      y: 0,
      width: innerWidth,
      text: content.body,
      color: surface.ink.hex,
      onTermOpen: (term, rect) => this.#openTooltip(term, rect, viewport),
      onTermClose: () => this.#tooltip.hide(),
    });
    this.#body = body;

    const turnOffLabel = scene.add.text(0, 0, "TURN TIPS OFF", textStyle(STAMP_TYPE, surface.ink.hex, 0.75));
    const turnOffUnderline = scene.add.graphics();

    // A small hint line above the button row (`McTipToastContent.hint`'s own doc comment) — same styling as
    // `McGuideCallout`'s own `nudge` line, which this mirrors.
    const hintText = content.hint
      ? scene.add
          .text(0, 0, content.hint, { ...textStyle({ ...typeRole.body, size: 11 }, surface.ink.hex, 0.7) })
          .setWordWrapWidth(innerWidth, true)
      : null;
    const hintHeight = hintText ? hintText.height + 8 : 0;

    // --- Measure total height. ---
    let y = pad;
    y += stampHeight + 8;
    y += title.height + 8;
    y += body.height + 14;
    y += hintHeight;
    y += hit.target;
    y += pad;
    const height = y;

    const rect = tipToastRectOf({ viewport, tabbed, handRect, playAreaRect, width, height });

    const panel = scene.add.graphics();
    panel.fillStyle(signal.caution.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    panel.lineStyle(border.object, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    objects.push(panel);

    let cy = rect.y + pad;
    stamp.fillStyle(surface.ink.hex, 1).fillRect(rect.x + pad, cy - stampHeight / 2, stampWidth, stampHeight);
    stampLabel.setPosition(rect.x + pad + STAMP_PAD, cy);
    objects.push(stamp, stampLabel);

    closeLabel.setPosition(rect.x + rect.width - pad - 8, cy);
    const closeZone = makeLinkZone(scene, closeLabel, () => this.#options.onClose());
    objects.push(closeLabel, closeZone);
    const focusables: { readonly rect: Rect; readonly activate: () => void }[] = [
      {
        rect: { x: closeLabel.x - 12, y: closeLabel.y - 12, width: 24, height: 24 },
        activate: () => this.#options.onClose(),
      },
    ];
    cy += stampHeight + 8;

    title.setPosition(rect.x + pad, cy);
    objects.push(title);
    cy += title.height + 8;

    body.container.setPosition(rect.x + pad, cy);
    objects.push(body.container);
    cy += body.height + 14;

    if (hintText) {
      hintText.setPosition(rect.x + pad, cy);
      objects.push(hintText);
      cy += hintText.height + 8;
    }

    turnOffLabel.setPosition(rect.x + pad, cy + hit.target / 2 - turnOffLabel.height / 2);
    turnOffUnderline
      .lineStyle(1, surface.ink.hex, 0.75)
      .lineBetween(
        turnOffLabel.x,
        turnOffLabel.y + turnOffLabel.height,
        turnOffLabel.x + turnOffLabel.width,
        turnOffLabel.y + turnOffLabel.height,
      );
    const turnOffZone = makeLinkZone(scene, turnOffLabel, () => this.#options.onTurnOff());
    objects.push(turnOffLabel, turnOffUnderline, turnOffZone);
    focusables.push({
      rect: { x: turnOffLabel.x, y: cy, width: turnOffLabel.width, height: hit.target },
      activate: () => this.#options.onTurnOff(),
    });

    const gotItWidth = Math.min(innerWidth - turnOffLabel.width - 12, 120);
    const gotItRect: Rect = { x: rect.x + rect.width - pad - gotItWidth, y: cy, width: gotItWidth, height: hit.target };
    const gotIt = new McButton(this.#scene, {
      kind: "primary",
      label: "Got it",
      type: BUTTON_TYPE,
      rect: gotItRect,
      tint: { fill: surface.ink.hex, ink: surface.paper.hex },
      onClick: () => this.#options.onGotIt(),
    });
    objects.push(gotIt.container);
    focusables.push({ rect: gotItRect, activate: () => this.#options.onGotIt() });

    this.#focusables = focusables;
    this.#focusIndex = -1;
    this.#focusRing.clear();
    this.#objects = objects;
    this.container.add(objects);
    this.container.add(this.#focusRing);
    this.#scene.children.bringToTop(this.container);
  }

  #openTooltip(term: TermTextTerm, anchorRect: Rect, viewport: Rect): void {
    const content = tooltipContentOf(term);
    if (!content) return;
    this.#body?.setTermsEnabled((id) => id === term.id);
    this.#tooltip.show(
      anchorRect,
      content,
      viewport,
      () => this.#options.onOpenGlossary?.(content.title),
      () => this.#body?.setTermsEnabled(() => true),
    );
  }

  /** Every focusable control's own on-screen rect — a headless click-through's only way to find canvas-drawn
   * controls (mirrors `McGuideCallout#debugRects`). */
  debugRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } {
    return { focusables: this.#focusables.map((f) => f.rect), tooltipLink: this.#tooltip.linkRect };
  }

  /** Escape closes an open tooltip first, then acts the same as "Got it" — mirrors `McGuideCallout`'s own Escape
   * contract (`docs/guided-mode.md` §7's key-ordering gotcha applies the same way here). */
  handleEscape(): boolean {
    if (this.#tooltip.handleEscape()) return true;
    this.#options.onGotIt();
    return true;
  }

  /** Tab-cycles the toast's own controls (×, "Turn tips off", "Got it") — mirrors `McGuideCallout#focusNext`. */
  focusNext(direction: 1 | -1 = 1): boolean {
    if (this.#focusables.length === 0) return false;
    this.#focusIndex = (this.#focusIndex + direction + this.#focusables.length) % this.#focusables.length;
    this.#drawFocusRing();
    return true;
  }

  /** Activates whichever control keyboard focus (`focusNext`/`focusAt`) is currently on, if any. */
  activateFocused(): void {
    this.#focusables[this.#focusIndex]?.activate();
  }

  /** Sets keyboard focus directly to `index` — mirrors `McGuidePanel#focusAt`'s own doc comment: `BoardTipMount`
   * owns the persistent index across board redraws, since this widget is rebuilt fresh every redraw. */
  focusAt(index: number): void {
    if (this.#focusables.length === 0) {
      this.#focusIndex = -1;
    } else {
      this.#focusIndex = Math.min(Math.max(index, 0), this.#focusables.length - 1);
    }
    this.#drawFocusRing();
  }

  /** Clears keyboard focus and its ring. */
  blur(): void {
    this.#focusIndex = -1;
    this.#focusRing.clear();
  }

  #drawFocusRing(): void {
    this.#focusRing.clear();
    const target = this.#focusables[this.#focusIndex];
    if (!target) return;
    this.#focusRing
      .lineStyle(border.control, surface.ink.hex, 1)
      .strokeRect(target.rect.x - 3, target.rect.y - 3, target.rect.width + 6, target.rect.height + 6);
  }

  #teardown(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
    this.#body?.destroy();
    this.#body = null;
  }

  destroy(): void {
    this.#teardown();
    this.#tooltip.destroy();
    this.#focusRing.destroy();
    this.container.destroy(true);
  }
}

/** A zone at least `hit.target` on a side, centered on `label` — mirrors `ui/guide-callout.ts`'s own helper. */
function makeLinkZone(
  scene: Phaser.Scene,
  label: Phaser.GameObjects.Text,
  onClick: () => void,
): Phaser.GameObjects.Zone {
  const w = Math.max(label.width, hit.target);
  const h = Math.max(label.height, hit.target);
  const zone = scene.add
    .zone(label.x + label.width / 2 - w / 2, label.y + label.height / 2 - h / 2, w, h)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerup", onClick);
  return zone;
}
