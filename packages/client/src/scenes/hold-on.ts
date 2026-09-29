/**
 * The "Hold on!" overlay (guided mode G9b, `docs/guided-mode.md` §4, tiles P06/T03): launched over the Board
 * whenever `BoardController` finds `guide-hints.ts#hintsFor` has something to say before End turn, Flip or a
 * payment confirm actually goes out. Modeled on `scenes/end-turn-confirm.ts`'s scrim-and-box shape, with a
 * caution-yellow GUIDE header (`ui/guide-callout.ts`'s own hue), a facts panel, and a "Don't warn me" checkbox.
 *
 * **Never a trap** (§3.10): Escape or a click on the scrim closes this with no command sent at all — the player
 * simply returns to their turn. The safe action and "do it anyway" are the only two ways anything gets dispatched,
 * and both close the overlay first.
 */
import Phaser from "phaser";
import { border, hit, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { McTermText } from "../ui/term-text.js";
import { McTooltip } from "../ui/tooltip.js";
import { tooltipContentOf, type TermTextTerm } from "../view/term-text-model.js";
import { holdOnContentOf, holdOnLayoutOf, type HoldOnContent } from "../view/hold-on-model.js";
import type { Hint } from "../view/guide-hints.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { RulesSceneData } from "./rules.js";

const STAMP_TYPE = { ...typeRole.label, size: 10 };
const STAMP_PAD = 8;
const BUTTON_TYPE = { ...typeRole.label, size: 13 };
const BOX_PAD = 20;
const CHECKBOX_SIZE = 18;

export interface HoldOnData {
  readonly hint: Hint;
  /** The scene that asked: its pointer input is off while this is up — `end-turn-confirm.ts`'s own convention. */
  readonly from: string;
  /** The live main scheme's own on-screen rect this draw, or null — `hold-on-model.ts#holdOnLayoutOf`'s input. */
  readonly schemeRect: Rect | null;
  /** The safe action, when the hint offered one (`hint.safeAction`) — never called if it's null (no button draws). */
  readonly onSafe: () => void;
  /** "Do it anyway" — the original command the safety net intercepted. */
  readonly onAnyway: () => void;
  /** Called once, whichever button closes the overlay, when "Don't warn me about this again" was checked. */
  readonly onSilence: () => void;
}

export class HoldOnOverlay extends Phaser.Scene {
  #data!: HoldOnData;
  #buttons: McButton[] = [];
  #body: McTermText | null = null;
  #tooltip: McTooltip | null = null;
  #route: FocusRoute | null = null;
  #checked = false;
  #checkboxZone: Phaser.GameObjects.Zone | null = null;

  constructor() {
    super(SCENES.holdOn);
  }

  create(data: HoldOnData): void {
    this.#data = data;
    this.#checked = false;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    this.#tooltip = new McTooltip(this);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#close(null) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  /** Closes the overlay and runs `action`, if any — never both a safe/anyway action *and* a silent dismissal. */
  #close(action: (() => void) | null): void {
    const { onSilence } = this.#data;
    const checked = this.#checked;
    this.scene.stop();
    if (checked && action) onSilence();
    action?.();
  }

  #toggleCheckbox(): void {
    this.#checked = !this.#checked;
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#tooltip?.hide();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const viewport: Rect = { x: 0, y: 0, width, height };
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    // A click on the scrim itself (not the card) is the same as Escape: dismiss with nothing sent.
    this.input.once("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.#pointInBox(pointer.x, pointer.y)) this.#close(null);
    });

    const content = holdOnContentOf(this.#data.hint);
    const boxWidth = Math.min(400, width - 32);
    const innerWidth = boxWidth - BOX_PAD * 2;
    this.#boxRect = this.#measureAndDraw(content, boxWidth, innerWidth, viewport);
  }

  #boxRect: Rect | null = null;

  #pointInBox(x: number, y: number): boolean {
    const box = this.#boxRect;
    if (!box) return false;
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  }

  #measureAndDraw(content: HoldOnContent, boxWidth: number, innerWidth: number, viewport: Rect): Rect {
    // The card's own ground, and the stamp's ink backing, have to be the very first things added — Phaser draws
    // in add-order, and every text object below sits *on* one of these, so both must land before the text does,
    // not after (their actual `fillStyle`/`fillRect` calls come later, once the box/stamp width are known — the
    // add-order is what matters, not the paint-order).
    const ground = this.add.graphics();
    const stampGraphic = this.add.graphics();

    // --- Header: ink GUIDE stamp + "HOLD ON!" Bangers title. ---
    const stampLabel = this.add.text(0, 0, "GUIDE", textStyle(STAMP_TYPE, surface.paper.hex)).setOrigin(0, 0.5);
    const stampWidth = stampLabel.width + STAMP_PAD * 2;
    const stampHeight = 20;
    const title = this.add
      .text(0, 0, "HOLD ON!", textStyle(typeRole.barTitle, surface.ink.hex))
      .setWordWrapWidth(innerWidth, true);

    // --- Subtitle (the heuristic's own title) + body (McTermText markup). ---
    const subtitle = this.add
      .text(0, 0, content.subtitle, { ...textStyle(typeRole.emphasis, surface.ink.hex) })
      .setWordWrapWidth(innerWidth, true);
    const body = new McTermText(this, {
      x: 0,
      y: 0,
      width: innerWidth,
      text: content.body,
      color: surface.ink.hex,
      onTermOpen: (term, rect) => this.#openTooltip(term, rect, viewport),
      onTermClose: () => this.#tooltip?.hide(),
    });
    this.#body = body;

    // --- Facts panel: two label/value rows on an ink-bordered strip. ---
    const factRowHeight = 22;
    const factsHeight = content.facts.length > 0 ? content.facts.length * factRowHeight + 16 : 0;

    // --- Buttons: safe (ink/primary) first, anyway (outline/secondary) second. ---
    const buttonHeight = hit.primary;
    const hasSafe = content.safeLabel !== null;

    // --- Checkbox row. ---
    const checkboxHeight = hit.target;

    const buttonRows = hasSafe ? 2 : 1;

    let y = BOX_PAD;
    y += stampHeight + 10; // header
    y += title.height + 10;
    y += subtitle.height + 6;
    y += body.height + 14;
    if (factsHeight > 0) y += factsHeight + 14;
    y += buttonRows * buttonHeight + (buttonRows - 1) * 10 + 14;
    y += checkboxHeight;
    y += BOX_PAD;
    const boxHeight = y;

    const layout = holdOnLayoutOf({ viewport, boxWidth, boxHeight, schemeRect: this.#data.schemeRect });
    const box = layout.box;

    ground.fillStyle(signal.caution.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(border.object, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    if (layout.leader) {
      const { from, to } = layout.leader;
      ground.lineStyle(3, signal.caution.hex, 1).lineBetween(from.x, from.y, to.x, to.y);
      ground.lineStyle(1.5, surface.ink.hex, 0.5).lineBetween(from.x, from.y, to.x, to.y);
    }

    let cy = box.y + BOX_PAD;
    stampGraphic.fillStyle(surface.ink.hex, 1).fillRect(box.x + BOX_PAD, cy, stampWidth, stampHeight);
    stampLabel.setPosition(box.x + BOX_PAD + STAMP_PAD, cy + stampHeight / 2);
    title.setPosition(box.x + BOX_PAD + stampWidth + 10, cy - 2);
    cy += stampHeight + 10;

    subtitle.setPosition(box.x + BOX_PAD, cy);
    cy += subtitle.height + 6;

    body.container.setPosition(box.x + BOX_PAD, cy);
    cy += body.height + 14;

    const factsGraphics: Phaser.GameObjects.GameObject[] = [];
    if (factsHeight > 0) {
      const factsBox = this.add.graphics();
      factsBox
        .fillStyle(surface.paper.hex, 1)
        .fillRect(box.x + BOX_PAD, cy, innerWidth, factsHeight)
        .lineStyle(1.5, surface.ink.hex, 0.6)
        .strokeRect(box.x + BOX_PAD, cy, innerWidth, factsHeight);
      factsGraphics.push(factsBox);
      let fy = cy + 8;
      for (const fact of content.facts) {
        const label = this.add.text(
          box.x + BOX_PAD + 10,
          fy,
          fact.label.toUpperCase(),
          textStyle(STAMP_TYPE, surface.ink.hex, 0.7),
        );
        const value = this.add
          .text(box.x + BOX_PAD + innerWidth - 10, fy, fact.value, {
            ...textStyle(typeRole.stat, surface.ink.hex),
            fontSize: "14px",
          })
          .setOrigin(1, 0);
        factsGraphics.push(label, value);
        fy += factRowHeight;
      }
      cy += factsHeight + 14;
    }

    // --- Buttons, stacked full-width (P06/T03's own order): safe first, as ink; anyway second, as an outline. ---
    const focusOrder: string[] = [];
    const stops = new Map<string, { rect: Rect; activate: () => void }>();
    if (hasSafe && content.safeLabel) {
      const safeRect: Rect = { x: box.x + BOX_PAD, y: cy, width: innerWidth, height: buttonHeight };
      const anywayRect: Rect = {
        x: box.x + BOX_PAD,
        y: cy + buttonHeight + 10,
        width: innerWidth,
        height: buttonHeight,
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: content.safeLabel,
          type: BUTTON_TYPE,
          rect: safeRect,
          onClick: () => this.#close(this.#data.onSafe),
        }),
        new McButton(this, {
          kind: "secondary",
          label: content.anywayLabel,
          type: BUTTON_TYPE,
          rect: anywayRect,
          onClick: () => this.#close(this.#data.onAnyway),
        }),
      );
      stops.set("safe", { rect: safeRect, activate: () => this.#close(this.#data.onSafe) });
      stops.set("anyway", { rect: anywayRect, activate: () => this.#close(this.#data.onAnyway) });
      focusOrder.push("safe", "anyway");
    } else {
      const anywayRect: Rect = { x: box.x + BOX_PAD, y: cy, width: innerWidth, height: buttonHeight };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: content.anywayLabel,
          type: BUTTON_TYPE,
          rect: anywayRect,
          onClick: () => this.#close(this.#data.onAnyway),
        }),
      );
      stops.set("anyway", { rect: anywayRect, activate: () => this.#close(this.#data.onAnyway) });
      focusOrder.push("anyway");
    }
    cy += buttonRows * buttonHeight + (buttonRows - 1) * 10 + 14;

    // --- "Don't warn me about this again" checkbox. ---
    const checkboxGraphics = this.add.graphics();
    const checkboxRect: Rect = { x: box.x + BOX_PAD, y: cy, width: CHECKBOX_SIZE, height: CHECKBOX_SIZE };
    checkboxGraphics
      .lineStyle(2, surface.ink.hex, 1)
      .strokeRect(checkboxRect.x, checkboxRect.y, CHECKBOX_SIZE, CHECKBOX_SIZE);
    if (this.#checked) {
      checkboxGraphics
        .fillStyle(surface.ink.hex, 1)
        .fillRect(checkboxRect.x + 3, checkboxRect.y + 3, CHECKBOX_SIZE - 6, CHECKBOX_SIZE - 6);
    }
    const checkboxLabel = this.add
      .text(checkboxRect.x + CHECKBOX_SIZE + 10, checkboxRect.y + CHECKBOX_SIZE / 2, content.checkboxLabel, {
        ...textStyle(typeRole.body, surface.ink.hex),
      })
      .setOrigin(0, 0.5);
    const checkboxHit: Rect = {
      x: checkboxRect.x,
      y: checkboxRect.y - (hit.target - CHECKBOX_SIZE) / 2,
      width: CHECKBOX_SIZE + 10 + checkboxLabel.width,
      height: hit.target,
    };
    this.#checkboxZone?.destroy();
    this.#checkboxZone = this.add
      .zone(checkboxHit.x, checkboxHit.y, checkboxHit.width, checkboxHit.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.#checkboxZone.on("pointerup", () => this.#toggleCheckbox());
    stops.set("checkbox", { rect: checkboxHit, activate: () => this.#toggleCheckbox() });
    focusOrder.push("checkbox");

    this.#route?.set(focusOrder, stops);

    // Headless click-through hook only (never referenced by product code) — mirrors `end-turn-confirm.ts`'s own
    // `__mcEndTurnConfirmDebug`.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcHoldOnDebug?: unknown }).__mcHoldOnDebug = {
        box: () => box,
        safeRect: () => stops.get("safe")?.rect ?? null,
        anywayRect: () => stops.get("anyway")?.rect ?? null,
        checkboxRect: () => checkboxHit,
        checked: () => this.#checked,
      };
    }

    return box;
  }

  #openTooltip(term: TermTextTerm, anchorRect: Rect, viewport: Rect): void {
    const content = tooltipContentOf(term);
    if (!content || !this.#tooltip) return;
    this.#body?.setTermsEnabled((id) => id === term.id);
    this.#tooltip.show(
      anchorRect,
      content,
      viewport,
      () =>
        this.scene.launch(SCENES.rules, {
          initialTab: "glossary",
          initialQuery: content.title,
        } satisfies RulesSceneData),
      () => this.#body?.setTermsEnabled(() => true),
    );
  }
}

/** Shows the "Hold on!" overlay over `scene` for `hint`. Calls exactly one of `onSafe`/`onAnyway` if the player
 * picks that action; calls neither on Escape or an outside click. `onSilence` runs once whichever button closes
 * it, if "Don't warn me about this again" was checked. */
export function showHoldOn(scene: Phaser.Scene, data: Omit<HoldOnData, "from">): void {
  if (scene.scene.isActive(SCENES.holdOn)) return;
  scene.scene.launch(SCENES.holdOn, { ...data, from: scene.scene.key } satisfies HoldOnData);
}
