/**
 * The room's deck picker (issue #880; Quin, 2026-11-20: every player brings their own hero and deck): the decks on THIS
 * device, saved, imported and precon, as rows with the hero's picture, searched with the shared fuzzy match
 * (`view/room-deck-picker-model.ts`). A seated player picks one for their seat ("Choose your deck"); the host picks one
 * for any seat ("Set deck", sent as a preset the holder may replace). Back returns to the lobby, which is still joined.
 *
 * The picker only chooses: whether a deck may be seated is the engine's verdict on each `DeckOption`, and the host's
 * engine judges the deck again at Start. The list scrolls inside a masked region (`ui/scroll-region.ts`), so every
 * button in it takes the region's clip and drag: a swipe that ends over Pick fires nothing (issue #227).
 */
import Phaser from "phaser";
import { currentCardsById, currentDeps, currentPool, POOL_VERSION } from "../content/pool.js";
import { t, tPlural } from "../i18n/translate.js";
import { chooseDeck, onRoomState, presetDeck, roomState, type RoomState } from "../platform/room.js";
import { deckStorage } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { campaignFrame, drawTopBar } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { drawHeroAvatar, SEAT_AVATAR_READY } from "../ui/seat-avatar.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McButton, McTextInput, fitText } from "../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import type { DeckOption } from "../view/deck-list-model.js";
import type { Rect } from "../view/layout.js";
import { pickerRows, type PickerRow } from "../view/room-deck-picker-model.js";
import { seatNameOf } from "../view/room-lobby-model.js";
import { seatableDeckOptionsOf } from "../view/seatable-decks.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

const PAPER = surface.paper.hex;
const INK = surface.ink.hex;
const PARCHMENT = surface.parchment.hex;
/** How long a note about what the room refused stays above the list. */
const NOTE_MS = 6000;

export interface RoomDeckPickerData {
  /** The seat the deck goes to. */
  readonly seat: string;
  /** The host presetting a deck for the seat (it may hold another's); false: my own seat. */
  readonly preset: boolean;
  /** Dev only: a made-up room (`view/room-lobby-fixture.ts`) instead of the live one; nothing is sent. */
  readonly preview?: RoomState;
}

export class RoomDeckPickerScene extends Phaser.Scene {
  #seat = "";
  #preset = false;
  #preview = false;
  #state: RoomState = roomState();
  #options: readonly DeckOption[] | null = null;
  #query = "";
  #input: McTextInput | null = null;
  #buttons: McButton[] = [];
  #region: McScrollRegion | null = null;
  readonly #scroll = new VariableListScroll();
  #hover: HoverPreview | null = null;
  #hoverFaces: { readonly cardId: string; readonly rect: Rect; readonly view: Rect }[] = [];
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];
  #alive = false;
  #leaving = false;
  #avatarRedrawQueued = false;
  #off: (() => void) | null = null;
  #note: { readonly text: string; readonly until: number } | null = null;

  constructor() {
    super(SCENES.roomDeckPicker);
  }

  init(data: RoomDeckPickerData): void {
    this.#seat = data.seat;
    this.#preset = data.preset;
    this.#preview = import.meta.env.DEV && data.preview !== undefined;
    this.#state = this.#preview ? data.preview! : roomState();
    this.#options = null;
    this.#query = "";
    this.#note = null;
    this.#leaving = false;
    this.#scroll.reset?.();
  }

  create(): void {
    this.#alive = true;
    this.cameras.main.setBackgroundColor(cssOf(PAPER));
    this.#hints = new GlyphHints(this);
    bindTextFieldEscape(this, () => this.#input);
    this.#route = new FocusRoute(this, {
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => this.#back(),
      primary: () => null,
    });
    this.scale.on("resize", this.#draw, this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.events.on(SEAT_AVATAR_READY, this.#avatarReady, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#off?.();
      this.#off = null;
      this.#hints.dispose();
      this.scale.off("resize", this.#draw, this);
      this.events.off(SEAT_AVATAR_READY, this.#avatarReady, this);
      this.#hover?.destroy();
      this.#hover = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#region?.destroy();
      this.#region = null;
      this.#input?.destroy();
      this.#input = null;
    });
    if (!this.#preview) {
      this.#off = onRoomState((state) => {
        if (!this.#alive) return;
        this.#state = state;
        // The seat is no longer mine (taken back, released), or the room ended: nothing to choose for.
        if (this.#gone()) this.#back();
      });
    }
    this.#draw();
    fadeScreenIn(this);
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.#alive) return;
        this.#options = seatableDeckOptionsOf(decks, currentPool(), POOL_VERSION, currentDeps());
        this.#draw();
      });
  }

  /** The seat cannot take a deck from this device now. */
  #gone(): boolean {
    const state = this.#state;
    if (state.role === "none" || state.connection === "ended") return true;
    const seat = state.seats.find((s) => s.id === this.#seat);
    if (!seat) return true;
    return this.#preset ? state.role !== "host" : !seat.mine;
  }

  #back(): void {
    if (this.#leaving) return;
    this.#leaving = true;
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.roomLobby);
  }

  #say(text: string): void {
    this.#note = { text, until: this.time.now + NOTE_MS };
    this.time.delayedCall(NOTE_MS + 50, () => {
      if (this.#alive && this.#note && this.time.now >= this.#note.until) {
        this.#note = null;
        this.#draw();
      }
    });
  }

  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    this.#hoverFaces.forEach(({ cardId, rect, view }, index) => {
      const shown = clipHoverRect({ ...rect, y: rect.y - this.#scroll.offsetPx }, view);
      if (shown) found.set(hoverSlotOf(cardId, `deck${index}`), { ...shown, cardId, through: true });
    });
    return found;
  }

  async #pick(row: PickerRow): Promise<void> {
    if (!row.seatable) {
      this.#say(t("room.picker.notReady", { reason: row.blockedReason ?? "" }));
      this.#draw();
      return;
    }
    if (this.#preview) {
      const calls = ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []);
      calls.push(`${this.#preset ? "presetDeck" : "chooseDeck"}(${this.#seat},${row.id})`);
      this.#back();
      return;
    }
    const result = await (this.#preset ? presetDeck : chooseDeck)(this.#seat, row.option);
    if (!this.#alive) return;
    if (result.ok) {
      this.#back();
      return;
    }
    const seat = this.#state.seats.find((s) => s.id === this.#seat);
    const heldDeck = this.#preset && seat?.holder != null && seat.deck != null && seat.deck.preset !== true;
    this.#say(
      t(
        result.reason === "too-large"
          ? "room.picker.tooLarge"
          : result.reason === "not-seatable"
            ? "room.picker.refused"
            : result.reason === "no-worker"
              ? "room.picker.noWorker"
              : result.reason === "not-allowed" && heldDeck
                ? "room.deck.takeBackFirst"
                : "room.picker.gone",
      ),
    );
    this.#draw();
  }

  #addStop(key: string, rect: Rect | (() => Rect), activate: () => void, extra: Partial<FocusStop> = {}): void {
    this.#stops.set(key, { rect, activate, ...extra });
    this.#order.push(key);
  }

  /**
   * A hero picture finished loading. A list of every deck loads dozens of them at once, and a full redraw per picture
   * (each redraw rebuilding every row) froze the page for minutes on a phone, so the pictures that land together
   * share one redraw.
   */
  #avatarReady = (): void => {
    if (this.#avatarRedrawQueued || !this.#alive) return;
    this.#avatarRedrawQueued = true;
    this.time.delayedCall(80, () => {
      this.#avatarRedrawQueued = false;
      if (this.#alive) this.#draw();
    });
  };

  #draw(): void {
    if (!this.#alive) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#region?.destroy();
    this.#region = null;
    const kept = this.#input ? this.#input.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#hints.reset();
    this.#hoverFaces = [];
    this.#stops = new Map();
    this.#order = [];

    const frame = campaignFrame(this);
    const { width, height, phone, gutter } = frame;
    this.add.rectangle(0, 0, width, height, PAPER).setOrigin(0, 0);
    const seats = this.#state.seats;
    const index = seats.findIndex((s) => s.id === this.#seat);
    const seatName = index >= 0 && seats[index] ? seatNameOf(seats[index]!, index) : this.#seat;
    const bar = drawTopBar(this, {
      backLabel: phone ? "◂" : `◂ ${t("room.leave").toUpperCase().replace(/.*/, t("room.picker.back").toUpperCase())}`,
      onBack: () => this.#back(),
      hints: phone ? null : this.#hints,
      title: this.#preset ? t("room.picker.titleFor", { seat: seatName }) : t("room.picker.title"),
      right: this.#preset ? t("room.deck.preset") : seatName,
      reserveRight: phone ? 80 : 0,
    });
    if (bar.back) this.#buttons.push(bar.back);
    if (bar.backRect) this.#addStop("back", bar.backRect, () => this.#back());

    // The search field, then the list.
    const fieldRect: Rect = { x: gutter, y: bar.height + 12, width: width - gutter * 2, height: hit.primary };
    if (!this.#input) {
      this.#input = new McTextInput(this, {
        rect: fieldRect,
        value: this.#query,
        type: typeRole.body,
        placeholder: t("room.picker.search"),
        maxLength: 80,
        onChange: (value) => {
          this.#query = value;
          this.#scroll.reset?.();
          this.#draw();
        },
      });
      this.children.bringToTop(this.#input.gameObject);
    } else {
      this.#input.layout(fieldRect);
      this.#input.setPlaceholder(t("room.picker.search"));
    }
    this.#input.setVisible(true);
    this.#addStop("search", fieldRect, () => this.#input?.focus());

    let top = fieldRect.y + fieldRect.height + 8;
    const note = this.#note && this.time.now < this.#note.until ? this.#note.text : null;
    if (note) {
      const line = this.add
        .text(gutter, top, note, textStyle(typeRole.rowTitle, surface.inkOnHue.hex))
        .setFontSize(13)
        .setBackgroundColor("#f2b01e")
        .setPadding(6, 3, 6, 3);
      fitText(line, width - gutter * 2, 13);
      top += line.height + 8;
    }
    const listRect: Rect = { x: gutter, y: top, width: width - gutter * 2, height: Math.max(0, height - top - gutter) };
    this.#drawList(listRect);
    this.#route?.set(this.#order, this.#stops);
  }

  #drawList(rect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(PARCHMENT, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, INK, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const inner: Rect = { x: rect.x + 10, y: rect.y + 8, width: rect.width - 20, height: rect.height - 16 };
    const heights = [inner.height];
    const region = new McScrollRegion(this, { rect: inner, heights, scroll: this.#scroll, clipInteractive: true });
    this.#region = region;
    const before = this.children.list.length;
    const guard = {
      clip: (): Rect => inner,
      suppress: (): boolean => region.isDragSuppressingClick,
    };
    const used = this.#drawRows(inner, guard, region);
    heights[0] = Math.max(inner.height, used);
    const added = this.children.list.slice(before).filter((node) => node !== region.root);
    if (added.length > 0) region.content.add(added);
    region.refresh();
  }

  #drawRows(inner: Rect, guard: { clip: () => Rect; suppress: () => boolean }, region: McScrollRegion): number {
    const x = inner.x;
    const w = inner.width - 12;
    let y = inner.y + 2;
    const options = this.#options;
    if (options === null) {
      const wait = this.add.text(x, y, t("room.state.connecting"), textStyle(typeRole.body, INK, 0.7)).setFontSize(14);
      return wait.height + 8;
    }
    const seat = this.#state.seats.find((s) => s.id === this.#seat);
    const current = seat?.deck ? { hero: seat.deck.hero, name: seat.deck.name } : null;
    const rows = pickerRows(options, this.#query, current);
    if (rows.length === 0) {
      const text = options.length === 0 ? t("room.picker.noDecks") : t("room.picker.empty");
      const none = this.add
        .text(x, y, text, textStyle(typeRole.body, INK, 0.85))
        .setFontSize(14)
        .setWordWrapWidth(w, true);
      return none.height + 8;
    }
    const pad = 10;
    const art = 56;
    const buttonWidth = 92;
    const tx = x + pad + art + 10;
    const textWidth = w - (tx - x) - pad - buttonWidth - 8;
    for (const row of rows) {
      const bg = this.add.graphics();
      let ty = y + 8;
      const name = this.add
        .text(tx, ty, row.name, textStyle(typeRole.rowTitle, INK))
        .setFontSize(15)
        .setWordWrapWidth(textWidth, true);
      ty += name.height + 1;
      const detail = [row.heroName, row.aspects, tPlural("room.deck.cards", row.cards)]
        .filter((p) => p !== "")
        .join(" · ");
      const line = this.add
        .text(tx, ty, detail, textStyle(typeRole.body, INK, 0.85))
        .setFontSize(12)
        .setWordWrapWidth(textWidth, true);
      ty += line.height + 2;
      // Why it cannot be picked, or that it is in the seat now: always words, never a colour.
      const status = !row.seatable
        ? t("room.picker.notReady", { reason: row.blockedReason ?? "" })
        : row.current
          ? t("room.picker.current")
          : null;
      if (status) {
        const s = this.add
          .text(tx, ty, status, textStyle(typeRole.body, INK, row.seatable ? 1 : 0.8))
          .setFontSize(12)
          .setWordWrapWidth(textWidth, true);
        if (row.seatable) s.setFontStyle("bold");
        ty += s.height + 2;
      }
      const height = Math.max(ty + 8 - y, 10 + art + 10, 10 + hit.target + 10);
      const artRect: Rect = { x: x + pad, y: y + 10, width: art, height: art };
      drawHeroAvatar(this, artRect, currentCardsById().get(row.cardId), INK);
      this.#hoverFaces.push({ cardId: row.cardId, rect: artRect, view: guard.clip() });
      const buttonRect: Rect = {
        x: x + w - pad - buttonWidth,
        y: y + (height - hit.target) / 2,
        width: buttonWidth,
        height: hit.target,
      };
      const go = (): void => void this.#pick(row);
      const button = new McButton(this, {
        kind: row.seatable ? "primary" : "secondary",
        label: t("room.picker.choose"),
        type: { ...typeRole.label, size: 13 },
        rect: buttonRect,
        enabled: row.seatable,
        ...(row.blockedReason ? { reason: row.blockedReason } : {}),
        onUnavailablePress: go,
        onClick: go,
        clip: guard.clip,
        suppressClick: guard.suppress,
      });
      this.#buttons.push(button);
      const top = y;
      this.#addStop(`deck:${row.id}`, () => ({ ...buttonRect, y: buttonRect.y - this.#scroll.offsetPx }), go, {
        ensureVisible: () => {
          const rel = top - inner.y - this.#scroll.offsetPx;
          const over = rel + height - inner.height;
          if (rel < 0) region.scrollByPx(rel);
          else if (over > 0) region.scrollByPx(over);
        },
        view: inner,
      });
      bg.fillStyle(PAPER, 1).fillRect(x, y, w, height);
      bg.lineStyle(row.current ? 4 : 2, INK, 1).strokeRect(x + 1, y + 1, w - 2, height - 2);
      y += height + 8;
    }
    return y - inner.y + 4;
  }
}
