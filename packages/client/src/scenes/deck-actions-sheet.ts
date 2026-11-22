/**
 * A deck's options (GitHub #958): what a tap on a deck in Decks & Collection opens on a phone or tablet. The deck's
 * picture, name and status, then one button per action (`view/deck-actions.ts`): Play (or Add, for a community deck),
 * Edit, View cards, Stats, Check, Duplicate and Delete, and Back.
 *
 * It decides nothing and changes nothing itself: the Decks screen words the header, and a press closes the sheet and
 * hands the action back to the code the stats rail's own buttons run. The one thing kept here is Delete's second
 * press, so a deck is never deleted by a single tap. Like the other sheets it switches off the screen under it while up.
 */
import type { PictureFocus } from "../art/focus.js";
import Phaser from "phaser";
import { accent, hit, ink, surface, typeRole } from "../tokens.js";
import { cardFaces } from "../art/card-face-baker.js";
import { textStyle } from "../ui/theme.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton, fitText, fitWrapped } from "../ui/widgets.js";
import { onTap } from "../ui/tap.js";
import { hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { deckActionsOf, type DeckActionId, type DeckActionsInput } from "../view/deck-actions.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { renderArtThumb } from "./roster-panel.js";
import { SCENES } from "./keys.js";

export interface DeckActionsSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  readonly title: string;
  /** The deck's hero, aspects and card count, in one line. */
  readonly meta: string;
  /** The deck's status chip words ("Legal", "Illegal"…), and whether they are a problem. */
  readonly status: { readonly text: string; readonly problem: boolean };
  /** The hero's identity card, which the picture's hover popover shows. */
  readonly identityCardId: string;
  readonly artUrl: string | null;
  readonly artFocus?: PictureFocus;
  readonly actions: Omit<DeckActionsInput, "deleteArmed">;
  /** The player chose an action: the sheet is already closed. */
  readonly onAction: (id: DeckActionId) => void;
}

const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 90;
const BUTTON_TYPE = { ...typeRole.label, size: 14 };
const GAP = 8;

export class DeckActionsSheet extends Phaser.Scene {
  #data!: DeckActionsSheetData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #hints!: GlyphHints;
  #thumb: Rect | null = null;
  #box: Rect | null = null;
  #deleteArmed = false;
  /** Why the last press on an unavailable button did nothing (a touch has no hover to say it). */
  #note: string | null = null;

  constructor() {
    super(SCENES.deckActions);
  }

  create(data: DeckActionsSheetData): void {
    this.#data = data;
    this.#deleteArmed = false;
    this.#note = null;
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    this.input.enabled = true;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      area: (pointer) => screenHoverArea(this, pointer, { blocked: () => this.scene.isActive(SCENES.inspect) }),
    });
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#close(),
    });
    // The deck's picture bakes after the first draw.
    const offBaked = cardFaces(this).onBaked(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offBaked();
      this.#hints.dispose();
      this.scale.off("resize", onResize, this);
      this.#hover?.destroy();
      this.#hover = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  #close(): void {
    this.scene.stop();
  }

  #press(id: DeckActionId): void {
    if (id === "delete" && !this.#deleteArmed) {
      this.#deleteArmed = true;
      this.#note = `Press Confirm delete to remove “${this.#data.title}”. This can't be undone.`;
      this.#draw();
      this.#route?.focusKey("action:delete");
      return;
    }
    const { onAction } = this.#data;
    this.scene.stop();
    onAction(id);
  }

  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    if (!this.#thumb) return found;
    const cardId = this.#data.identityCardId;
    found.set(hoverSlotOf(cardId, "deck-actions"), { ...this.#thumb, cardId, face: { kind: "hero" }, through: true });
    return found;
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#hints.reset();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    // Every press outside the box closes it, the way a phone's own menus do; the box itself swallows its own.
    const backdrop = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    // A tap outside the box closes it, as a phone's own menus do. `onTap` needs the press and the release both on the
    // backdrop, so a swipe that ends here never closes it (`ui/tap.ts`); the box's own buttons sit above it.
    onTap(
      backdrop,
      (pointer) => {
        const box = this.#box;
        if (!box) return;
        const inside =
          pointer.x >= box.x && pointer.x <= box.x + box.width && pointer.y >= box.y && pointer.y <= box.y + box.height;
        if (!inside) this.#close();
      },
      "deck-actions-backdrop",
    );
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const phone = width < 600;
    const margin = phone ? 12 : 24;
    const boxWidth = Math.min(520, width - margin * 2);
    const boxX = Math.round((width - boxWidth) / 2);
    const innerWidth = boxWidth - 32;
    const actions = deckActionsOf({ ...this.#data.actions, deleteArmed: this.#deleteArmed });
    const primary = actions.filter((a) => a.primary);
    const rest = actions.filter((a) => !a.primary);
    const columns = 2;
    const restRows = Math.ceil(rest.length / columns);

    const ground = this.add.graphics();
    const textX = boxX + 16 + THUMB_WIDTH + 12;
    const textWidth = boxX + boxWidth - 16 - textX;
    const title = this.add
      .text(textX, 0, this.#data.title, textStyle(typeRole.barTitle, surface.ink.hex))
      .setWordWrapWidth(textWidth, true);
    fitWrapped(title, textWidth, 2, typeRole.barTitle.size);
    const meta = this.add
      .text(textX, 0, this.#data.meta, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setFontSize(13)
      .setWordWrapWidth(textWidth, true);
    fitWrapped(meta, textWidth, 2, 13);
    const status = this.add.text(
      textX,
      0,
      `${this.#data.status.problem ? "✕" : "✓"} ${this.#data.status.text}`,
      textStyle(typeRole.label, this.#data.status.problem ? accent.heroRed.hex : surface.ink.hex, 1),
    );
    fitText(status, textWidth, typeRole.label.size);
    const note = this.#note
      ? this.add
          .text(boxX + 16, 0, this.#note, textStyle(typeRole.body, accent.heroRed.hex))
          .setFontSize(13)
          .setWordWrapWidth(innerWidth, true)
      : null;

    const headerHeight = Math.max(THUMB_HEIGHT, title.height + 4 + meta.height + 6 + status.height);
    const row = hit.primary;
    const bodyHeight =
      primary.length * (row + GAP) + restRows * (row + GAP) + (note ? note.height + GAP : 0) + GAP + row;
    const boxHeight = Math.min(height - margin * 2, 16 + headerHeight + 16 + bodyHeight + 16);
    const box: Rect = { x: boxX, y: Math.round((height - boxHeight) / 2), width: boxWidth, height: boxHeight };
    this.#box = box;
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);

    const top = box.y + 16;
    this.#thumb = { x: box.x + 16, y: top, width: THUMB_WIDTH, height: THUMB_HEIGHT };
    renderArtThumb(this, this.#thumb, this.#data.artUrl, 0.2, this.#data.artFocus);
    title.setPosition(textX, top);
    meta.setPosition(textX, title.y + title.height + 4);
    status.setPosition(textX, meta.y + meta.height + 6);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const left = box.x + 16;
    let y = top + headerHeight + 16;
    const add = (key: string, button: McButton, rect: Rect, activate: () => void): void => {
      this.#buttons.push(button);
      stops.set(key, { rect, activate });
      order.push(key);
    };
    const unavailable = (reason: string | undefined) => (): void => {
      if (!reason) return;
      this.#note = reason;
      this.#draw();
    };
    for (const action of primary) {
      const rect: Rect = { x: left, y, width: innerWidth, height: row };
      const activate = (): void => (action.enabled ? this.#press(action.id) : unavailable(action.reason)());
      add(
        `action:${action.id}`,
        new McButton(this, {
          kind: "primary",
          label: action.label,
          type: typeRole.barTitle,
          rect,
          enabled: action.enabled,
          ...(action.reason ? { reason: action.reason } : {}),
          onUnavailablePress: unavailable(action.reason),
          onClick: () => this.#press(action.id),
        }),
        rect,
        activate,
      );
      y += row + GAP;
    }
    const cellWidth = (innerWidth - GAP * (columns - 1)) / columns;
    rest.forEach((action, index) => {
      const rect: Rect = {
        x: left + (index % columns) * (cellWidth + GAP),
        y: y + Math.floor(index / columns) * (row + GAP),
        width: cellWidth,
        height: row,
      };
      const armed = action.id === "delete" && this.#deleteArmed;
      add(
        `action:${action.id}`,
        new McButton(this, {
          kind: "secondary",
          selected: armed,
          label: action.label,
          type: BUTTON_TYPE,
          rect,
          onClick: () => this.#press(action.id),
        }),
        rect,
        () => this.#press(action.id),
      );
    });
    y += restRows * (row + GAP);
    if (note) {
      note.setPosition(left, y);
      y += note.height + GAP;
    }
    y += GAP;

    const backRect: Rect = { x: left, y, width: innerWidth, height: row };
    const back = new McButton(this, {
      kind: "secondary",
      label: "Back",
      type: BUTTON_TYPE,
      rect: backRect,
      onClick: () => this.#close(),
    });
    this.#hints.button(back, ["cancel"], "paper");
    add("back", back, backRect, () => this.#close());

    this.#route?.set(order, stops);
    this.#hover?.onDraw();
  }
}
