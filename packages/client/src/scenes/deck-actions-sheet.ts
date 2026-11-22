/**
 * A deck's options (GitHub #958): what a tap on a deck in Decks & Collection opens on a phone or tablet. The deck's
 * picture, name and status, then one button per action (`view/deck-actions.ts`): Play (or Add, for a community deck),
 * Edit, View cards, Stats, Check, Duplicate and Delete, and Back.
 *
 * It decides nothing and changes nothing itself: the Decks screen words the header and is asked again on every draw
 * (`current`), and a press closes the sheet and hands the action back to the code the stats rail's own buttons run.
 * The one thing kept here is Delete's second press, so a deck is never deleted by a single tap. The layout steps down
 * to more columns and smaller buttons on a short screen (`deckActionsPlan`), so every action and Back stay reachable
 * on a phone held sideways. Like the other sheets it switches off the screen under it while up.
 */
import type { PictureFocus } from "../art/focus.js";
import Phaser from "phaser";
import { accent, ink, surface, typeRole } from "../tokens.js";
import { cardFaces } from "../art/card-face-baker.js";
import { textStyle } from "../ui/theme.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { McButton, clampLines, fitText, fitWrapped } from "../ui/widgets.js";
import { onTap } from "../ui/tap.js";
import { hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import {
  DECK_ACTIONS_GAP,
  DECK_ACTIONS_PAD,
  deckActionsCandidates,
  deckActionsHeight,
  deckActionsOf,
  deckActionsPlan,
  deckActionsTextWidths,
  type DeckActionId,
  type DeckActionsInput,
  type DeckActionsMeasured,
  type DeckActionsTextWidths,
} from "../view/deck-actions.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { renderArtThumb } from "./roster-panel.js";
import { SCENES } from "./keys.js";

/** What the sheet shows for its deck now: read on every draw, so a status or an unlock that lands while it is up shows. */
export interface DeckActionsNow {
  readonly title: string;
  /** The deck's hero, aspects and card count, in one line. */
  readonly meta: string;
  /** The deck's status chip words ("Legal", "Illegal"…), and whether they are a problem. */
  readonly status: { readonly text: string; readonly problem: boolean };
  readonly actions: Omit<DeckActionsInput, "deleteArmed">;
}

export interface DeckActionsSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  /** The hero's identity card, which the picture's hover popover shows. */
  readonly identityCardId: string;
  readonly artUrl: string | null;
  readonly artFocus?: PictureFocus;
  /** The deck as the Decks screen knows it now, or null once it is gone (the sheet closes). */
  readonly current: () => DeckActionsNow | null;
  /** The player chose an action: the sheet is already closed. */
  readonly onAction: (id: DeckActionId) => void;
}

const BUTTON_TYPE = { ...typeRole.label, size: 14 };
const NOTE_SIZE = 13;

export class DeckActionsSheet extends Phaser.Scene {
  #data!: DeckActionsSheetData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #hints!: GlyphHints;
  #thumb: Rect | null = null;
  #box: Rect | null = null;
  #deleteArmed = false;
  /** Delete's "can't be undone" warning as last drawn, shown for as long as Delete is armed. */
  #warning: string | null = null;
  /** Why the last press on an unavailable button did nothing (a touch has no hover to say it). */
  #note: string | null = null;

  constructor() {
    super(SCENES.deckActions);
  }

  create(data: DeckActionsSheetData): void {
    this.#data = data;
    this.#deleteArmed = false;
    this.#warning = null;
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
    // Dev e2e hook (never referenced by product code): the notes on show and whether Delete is armed.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcDeckActionsDebug?: unknown }).__mcDeckActionsDebug = {
        warning: () => this.#warning,
        note: () => this.#note,
        armed: () => this.#deleteArmed,
        actions: () => {
          const now = this.#data.current();
          return now ? deckActionsOf({ ...now.actions, deleteArmed: this.#deleteArmed }) : [];
        },
      };
    }
    this.#draw();
  }

  /** The Decks screen redrew (a status arrived, an unlock, a saved deck): show the deck as it is now. */
  refresh(): void {
    if (this.sys.isActive()) this.#draw();
  }

  #close(): void {
    this.scene.stop();
  }

  #press(id: DeckActionId): void {
    if (id === "delete" && !this.#deleteArmed) {
      this.#deleteArmed = true;
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
    const now = this.#data.current();
    if (!now) {
      this.#close();
      return;
    }

    const { width, height } = this.scale.gameSize;
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

    const actions = deckActionsOf({ ...now.actions, deleteArmed: this.#deleteArmed });
    const primary = actions.filter((a) => a.primary);
    const rest = actions.filter((a) => !a.primary);

    const ground = this.add.graphics();
    const title = this.add.text(0, 0, now.title, textStyle(typeRole.barTitle, surface.ink.hex));
    const meta = this.add
      .text(0, 0, now.meta, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setFontSize(NOTE_SIZE);
    const status = this.add.text(
      0,
      0,
      `${now.status.problem ? "✕" : "✓"} ${now.status.text}`,
      textStyle(typeRole.label, now.status.problem ? accent.heroRed.hex : surface.ink.hex, 1),
    );
    // The notes: Delete's warning for as long as it is armed, and why the last press did nothing. On a screen too
    // short for them in full, the warning drops the deck's name (it is in the header) and the reason keeps two lines.
    let notes: Phaser.GameObjects.Text[] = [];
    let short = false;
    const makeNotes = (): void => {
      for (const note of notes) note.destroy();
      const warning = !this.#deleteArmed
        ? null
        : short
          ? "Press Confirm delete again to delete this deck. This can't be undone."
          : `Press Confirm delete to remove “${now.title}”. This can't be undone.`;
      this.#warning = warning;
      notes = [warning, this.#note]
        .filter((text): text is string => text !== null)
        .map((text) => this.add.text(0, 0, text, textStyle(typeRole.body, accent.heroRed.hex)).setFontSize(NOTE_SIZE));
    };
    makeNotes();
    const measure = (widths: DeckActionsTextWidths): DeckActionsMeasured => {
      title.setWordWrapWidth(widths.header, true);
      fitWrapped(title, widths.header, 2, typeRole.barTitle.size);
      meta.setWordWrapWidth(widths.header, true);
      fitWrapped(meta, widths.header, 2, NOTE_SIZE);
      fitText(status, widths.header, typeRole.label.size);
      notes.forEach((note, at) => {
        note.setWordWrapWidth(widths.notes, true);
        // The warning is never cut; the reason is, to two lines, when space is short.
        if (short && at === notes.length - 1 && this.#note !== null) clampLines(note, 2);
      });
      return {
        header: title.height + 4 + meta.height + 6 + status.height,
        notes: notes.reduce((sum, note, at) => sum + note.height + (at > 0 ? 4 : 0), 0),
      };
    };
    const planInput = { width, height, gridCount: rest.length, measure };
    let plan = deckActionsPlan(planInput);
    if (plan === null && notes.length > 0) {
      short = true;
      makeNotes();
      plan = deckActionsPlan(planInput);
    }
    const chosen = plan ?? deckActionsCandidates(width, height).at(-1)!;
    const fitted = measure(deckActionsTextWidths(chosen));
    const side = chosen.sideWidth;
    const boxX = Math.round((width - chosen.boxWidth) / 2);
    const left = boxX + DECK_ACTIONS_PAD;
    // The buttons' column: the whole box, or the right-hand part beside the header on a short, wide screen.
    const buttonsX = side === null ? left : left + side + DECK_ACTIONS_PAD;
    const innerWidth = boxX + chosen.boxWidth - DECK_ACTIONS_PAD - buttonsX;
    const textX = side === null ? left + chosen.thumb.width + 12 : left;
    const boxHeight = Math.min(height - chosen.margin * 2, deckActionsHeight(chosen, rest.length, fitted));
    const box: Rect = { x: boxX, y: Math.round((height - boxHeight) / 2), width: chosen.boxWidth, height: boxHeight };
    this.#box = box;
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);

    const top = box.y + DECK_ACTIONS_PAD;
    this.#thumb = { x: left, y: top, ...chosen.thumb };
    renderArtThumb(this, this.#thumb, this.#data.artUrl, 0.2, this.#data.artFocus);
    title.setPosition(textX, side === null ? top : top + chosen.thumb.height + DECK_ACTIONS_GAP);
    meta.setPosition(textX, title.y + title.height + 4);
    status.setPosition(textX, meta.y + meta.height + 6);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const row = chosen.row;
    const gap = DECK_ACTIONS_GAP;
    let y = side === null ? top + Math.max(chosen.thumb.height, fitted.header) + DECK_ACTIONS_PAD : top;
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
      const rect: Rect = { x: buttonsX, y, width: innerWidth, height: row };
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
      y += row + gap;
    }
    const cellWidth = (innerWidth - gap * (chosen.columns - 1)) / chosen.columns;
    const gridTop = y;
    // The grid's last button takes the rest of its row, so a short last row never leaves a hole beside it.
    const cells = rest.length + (chosen.backInGrid ? 1 : 0);
    const cellAt = (index: number): Rect => {
      const column = index % chosen.columns;
      const last = index === cells - 1;
      return {
        x: buttonsX + column * (cellWidth + gap),
        y: gridTop + Math.floor(index / chosen.columns) * (row + gap),
        width: last ? innerWidth - column * (cellWidth + gap) : cellWidth,
        height: row,
      };
    };
    rest.forEach((action, index) => {
      const rect = cellAt(index);
      add(
        `action:${action.id}`,
        new McButton(this, {
          kind: "secondary",
          selected: action.id === "delete" && this.#deleteArmed,
          label: action.label,
          type: BUTTON_TYPE,
          rect,
          onClick: () => this.#press(action.id),
        }),
        rect,
        () => this.#press(action.id),
      );
    });
    y = gridTop + Math.ceil((rest.length + (chosen.backInGrid ? 1 : 0)) / chosen.columns) * (row + gap);
    for (const note of notes) {
      note.setPosition(buttonsX, y);
      y += note.height + 4;
    }
    if (notes.length > 0) y += gap - 4;
    const backRect: Rect = chosen.backInGrid ? cellAt(rest.length) : { x: buttonsX, y, width: innerWidth, height: row };
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
