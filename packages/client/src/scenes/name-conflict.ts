/**
 * "Cards that can't be played" (owner, 2026-10-03): the sheet both seat screens open when the player presses Play (Take
 * your seats) or Sign (Sign the roster) while a card in a seated deck cannot enter play beside another seat's hero
 * (`view/name-conflicts.ts`). It lists each clash in one short line with two choices:
 *
 *  - **Replace**: opens a picker of legal replacements for that deck (`view/replacement-candidates.ts`), each with the
 *    card's picture, name, cost and aspect badge, the recommended one preselected; Inspect by right-click or hold.
 *  - **Keep as a resource**: acknowledges the card, which stays in the deck and can still be spent to pay.
 *
 * Once every card is answered, Continue carries on to what the player pressed. The sheet decides nothing about the
 * deck itself: it hands each answer back (`onChange`) and the caller applies it as the game (or the campaign roster) is
 * built; the player's saved deck is never modified.
 */
import Phaser from "phaser";
import type { AnyCard, CoreAspect, Deck, HeroIdentityCard } from "@mc/content";
import { unscriptedCards, type TableRules } from "@mc/engine";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardFaces } from "../art/card-face-baker.js";
import { unlocks } from "../progression/progression.js";
import { hit, ink, signal, surface, typeRole } from "../tokens.js";
import { bindHoldTarget } from "../ui/hold-target.js";
import { textStyle } from "../ui/theme.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McVirtualList, type VirtualListRow } from "../ui/virtual-list.js";
import { McButton, clampLines, fitText } from "../ui/widgets.js";
import { aspectStampOf } from "../view/aspect-stamp.js";
import type { Rect } from "../view/layout.js";
import { ListScroll } from "../view/list-scroll.js";
import {
  applyDeckSwaps,
  nameConflictsOf,
  type DeckSwap,
  type KeptConflict,
  type NameConflict,
} from "../view/name-conflicts.js";
import {
  recommendedReplacementOf,
  replacementCandidatesOf,
  type ReplacementCandidate,
} from "../view/replacement-candidates.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { renderArtThumb } from "./roster-panel.js";
import { SCENES } from "./keys.js";

export interface NameConflictSheetData {
  /** The scene that asked: its pointer input is off while this is up. */
  readonly from: string;
  /** The seated decks as the player saved them, in seat order. Never modified. */
  readonly decks: readonly Deck[];
  /** Replacements already made for this table (applied before the conflicts are listed). */
  readonly swaps: readonly DeckSwap[];
  readonly kept: readonly KeptConflict[];
  readonly tableRules: TableRules | undefined;
  /** "Play" or "Sign": what Continue does. */
  readonly continueLabel: string;
  /** After every answer: the caller keeps these and applies them as the game is built. */
  readonly onChange: (swaps: readonly DeckSwap[], kept: readonly KeptConflict[]) => void;
  /** Every card answered and Continue pressed. */
  readonly onContinue: () => void;
}

type Status = "pending" | "replaced" | "kept";

interface Entry {
  readonly conflict: NameConflict;
}

const ROW_PAD = 10;
const SHEET_ROW_HEIGHT = 128;
const PICK_ROW_HEIGHT = 90;
const BUTTON_TYPE = { ...typeRole.label, size: 12 };
const GAP = 8;

/** The picker's own state: which entry is being replaced, the legal cards best first and the one selected. */
interface Picker {
  readonly entry: Entry;
  readonly candidates: readonly ReplacementCandidate[];
  selected: string | null;
}

export class NameConflictOverlay extends Phaser.Scene {
  #data!: NameConflictSheetData;
  #swaps: DeckSwap[] = [];
  #kept: KeptConflict[] = [];
  #entries: Entry[] = [];
  #picker: Picker | null = null;
  #buttons: McButton[] = [];
  #list: McVirtualList | null = null;
  #route: FocusRoute | null = null;
  #sheetScroll = new ListScroll();
  #pickerScroll = new ListScroll();

  constructor() {
    super(SCENES.nameConflict);
  }

  create(data: NameConflictSheetData): void {
    this.#data = data;
    this.#swaps = [...data.swaps];
    this.#kept = [...data.kept];
    this.#picker = null;
    this.#sheetScroll = new ListScroll();
    // The list is taken from the decks as they stand, so every card that still clashes shows, including the ones the
    // player already kept on an earlier visit; a card already replaced is gone from its deck and is not listed.
    this.#entries = nameConflictsOf(this.#effectiveSeats(), CARDS_BY_ID, data.tableRules).map((conflict) => ({
      conflict,
    }));
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    this.input.enabled = true;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => (this.#picker ? this.#closePicker() : this.#close()),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#list?.destroy();
      this.#list = null;
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  /** The seats with every replacement made so far applied. */
  #effectiveSeats(): { readonly deck: Deck }[] {
    return this.#data.decks.map((deck) => ({ deck: applyDeckSwaps(deck, this.#swaps) }));
  }

  #statusOf(entry: Entry): Status {
    const { deckId, cardId } = entry.conflict;
    if (this.#swaps.some((s) => s.deckId === deckId && s.from === cardId)) return "replaced";
    if (this.#kept.some((k) => k.deckId === deckId && k.cardId === cardId)) return "kept";
    return "pending";
  }

  #allAnswered(): boolean {
    return this.#entries.every((entry) => this.#statusOf(entry) !== "pending");
  }

  #changed(): void {
    this.#data.onChange([...this.#swaps], [...this.#kept]);
  }

  #close(): void {
    this.scene.stop();
  }

  #continue(): void {
    if (!this.#allAnswered()) return;
    const { onContinue } = this.#data;
    this.scene.stop();
    onContinue();
  }

  #keep(entry: Entry): void {
    const { deckId, cardId } = entry.conflict;
    this.#swaps = this.#swaps.filter((s) => !(s.deckId === deckId && s.from === cardId));
    if (!this.#kept.some((k) => k.deckId === deckId && k.cardId === cardId)) this.#kept.push({ deckId, cardId });
    this.#changed();
    this.#draw();
  }

  #openPicker(entry: Entry): void {
    const { conflict } = entry;
    const base = this.#data.decks.find((deck) => (deck.id as string) === conflict.deckId);
    if (!base) return;
    // The deck as it stands without this card's own replacement, so choosing again swaps from the original card.
    const others = this.#swaps.filter((s) => !(s.deckId === conflict.deckId && s.from === conflict.cardId));
    const deck = applyDeckSwaps(base, others);
    const seatedDecks = this.#effectiveSeats().map((seat) => seat.deck);
    const heroes = seatedDecks
      .map((d) => CARDS_BY_ID.get(d.identityCardId as string))
      .filter((card): card is HeroIdentityCard => card?.type === "hero_identity");
    const identity = CARDS_BY_ID.get(deck.identityCardId as string);
    if (identity?.type !== "hero_identity") return;
    const unscripted = new Map<string, boolean>();
    const playable = (card: AnyCard): boolean => {
      let known = unscripted.get(card.id as string);
      if (known === undefined) {
        known = unscriptedCards(
          { identityCardId: identity.id, aspects: deck.aspects, cards: [{ cardId: card.id, quantity: 1 }] },
          POOL_CARDS,
          POOL_DEPS,
        ).includes(card.id);
        unscripted.set(card.id as string, known);
      }
      return !known;
    };
    const candidates = replacementCandidatesOf({
      deck,
      fromCardId: conflict.cardId,
      seatedHeroes: heroes,
      identity,
      pool: POOL_CARDS,
      ...(this.#data.tableRules ? { tableRules: this.#data.tableRules } : {}),
      // The packs the player has open: with everything unlocked (`?unlock=all`) this is every card.
      isUnlocked: (card) => unlocks().waveLock(card.cycleId as string | undefined) === null,
      isPlayable: playable,
    });
    this.#picker = { entry, candidates, selected: recommendedReplacementOf(candidates) as string | null };
    this.#pickerScroll = new ListScroll();
    this.#draw();
  }

  #closePicker(): void {
    this.#picker = null;
    this.#draw();
  }

  #confirmPicker(): void {
    const picker = this.#picker;
    if (!picker?.selected) return;
    const { deckId, cardId } = picker.entry.conflict;
    this.#swaps = this.#swaps.filter((s) => !(s.deckId === deckId && s.from === cardId));
    this.#swaps.push({ deckId, from: cardId, to: picker.selected });
    this.#kept = this.#kept.filter((k) => !(k.deckId === deckId && k.cardId === cardId));
    this.#picker = null;
    this.#changed();
    this.#draw();
  }

  #inspect(card: AnyCard): void {
    if (this.scene.isActive(SCENES.inspect)) return;
    this.input.enabled = false;
    this.scene.launch(SCENES.inspect, { card: { cardId: card.id, face: { kind: "front" } } });
    // Inspect is registered before this sheet, so a plain launch would draw it underneath.
    this.scene.bringToTop(SCENES.inspect);
    this.scene.get(SCENES.inspect).events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.enabled = true;
    });
  }

  // ---------------------------------------------------------------------------------------------------------------

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#list?.destroy();
    this.#list = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const phone = width < 600;
    const margin = phone ? 8 : 24;
    const boxWidth = Math.min(680, width - margin * 2);
    const boxX = (width - boxWidth) / 2;
    const innerWidth = boxWidth - 32;
    const picker = this.#picker;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    // The panel's own ground goes down first (so it sits under everything) and is painted once its height is known.
    const ground = this.add.graphics();
    const title = this.add.text(
      boxX + 16,
      0,
      picker ? `Replace ${picker.entry.conflict.cardName}` : "Cards that can't be played",
      textStyle(typeRole.barTitle, surface.ink.hex),
    );
    fitText(title, innerWidth, typeRole.barTitle.size);
    const subtitle = this.add
      .text(
        boxX + 16,
        0,
        picker
          ? `In ${picker.entry.conflict.heroName}'s deck. Right-click or hold a card to inspect it.`
          : "Replace each one, or keep it to spend as a resource.",
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setFontSize(13)
      .setWordWrapWidth(innerWidth);
    clampLines(subtitle, 2);

    // A short sheet is only as tall as its rows; the picker takes the room it has.
    const headerHeight = title.height + 4 + subtitle.height + 12;
    const chrome = 16 + headerHeight + 12 + hit.primary + 16;
    const maxHeight = height - margin * 2;
    const wanted = picker ? maxHeight : chrome + 12 + this.#entries.length * SHEET_ROW_HEIGHT + 8;
    const boxHeight = Math.min(maxHeight, wanted);
    const box: Rect = { x: boxX, y: Math.round((height - boxHeight) / 2), width: boxWidth, height: boxHeight };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    const inner: Rect = { x: box.x + 16, y: box.y + 16, width: innerWidth, height: box.height - 32 };
    title.setPosition(inner.x, inner.y);
    subtitle.setPosition(inner.x, title.y + title.height + 4);

    const footerY = inner.y + inner.height - hit.primary;
    const listTop = subtitle.y + subtitle.height + 12;
    const listRect: Rect = { x: inner.x, y: listTop, width: inner.width, height: footerY - 12 - listTop };

    const left: Rect = { x: inner.x, y: footerY, width: (inner.width - GAP) / 2, height: hit.primary };
    const right: Rect = { ...left, x: left.x + left.width + GAP };

    if (picker) {
      this.#drawPickerList(listRect, picker, stops, order);
      const pick = picker.selected !== null;
      this.#addButton("cancel", left, "Back", "secondary", true, () => this.#closePicker(), stops, order);
      this.#addButton(
        "confirm",
        right,
        "Replace",
        "primary",
        pick,
        () => this.#confirmPicker(),
        stops,
        order,
        pick ? undefined : "Choose a card first",
      );
    } else {
      this.#drawSheetList(listRect, stops, order);
      const ready = this.#allAnswered();
      this.#addButton("back", left, "Back", "secondary", true, () => this.#close(), stops, order);
      this.#addButton(
        "continue",
        right,
        this.#data.continueLabel,
        "primary",
        ready,
        () => this.#continue(),
        stops,
        order,
        ready ? undefined : "Answer every card first",
      );
    }
    this.#route?.set(order, stops);
    this.#publish();
  }

  #addButton(
    key: string,
    rect: Rect,
    text: string,
    kind: "primary" | "secondary",
    enabled: boolean,
    onClick: () => void,
    stops: Map<string, FocusStop>,
    order: string[],
    reason?: string,
  ): void {
    this.#buttons.push(
      new McButton(this, {
        kind,
        label: text,
        type: BUTTON_TYPE,
        rect,
        enabled,
        ...(reason ? { reason } : {}),
        onClick,
      }),
    );
    stops.set(key, { rect, activate: () => (enabled ? onClick() : undefined) });
    order.push(key);
  }

  // --- The sheet -------------------------------------------------------------------------------------------------

  #drawSheetList(listRect: Rect, stops: Map<string, FocusStop>, order: string[]): void {
    const entries = this.#entries;
    const clip = (): Rect | null => this.#list?.rect ?? null;
    const suppressClick = (): boolean => this.#list?.isDragSuppressingClick ?? false;
    const buttonRects = (rect: Rect, rowIsOwnCard: boolean): { replace: Rect; keep: Rect } => {
      const w = (rect.width - ROW_PAD * 2 - GAP) / 2;
      const y = rect.y + SHEET_ROW_HEIGHT - 6 - ROW_PAD - hit.target;
      // A hero's own card cannot be swapped: no Replace at all, one full-width acknowledgment.
      if (rowIsOwnCard) {
        const full = { x: rect.x + ROW_PAD, y, width: rect.width - ROW_PAD * 2, height: hit.target };
        return { replace: full, keep: full };
      }
      return {
        replace: { x: rect.x + ROW_PAD, y, width: w, height: hit.target },
        keep: { x: rect.x + ROW_PAD + w + GAP, y, width: w, height: hit.target },
      };
    };
    const renderRow = (index: number, rect: Rect): VirtualListRow => {
      const entry = entries[index]!;
      const status = this.#statusOf(entry);
      const row: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 12, height: SHEET_ROW_HEIGHT - 6 };
      const objects: Phaser.GameObjects.GameObject[] = [];
      const g = this.add.graphics();
      g.fillStyle(surface.parchment.hex, 1).fillRect(row.x, row.y, row.width, row.height);
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(row.x, row.y, row.width, row.height);
      objects.push(g);
      const textWidth = row.width - ROW_PAD * 2;
      const line = this.add
        .text(row.x + ROW_PAD, row.y + ROW_PAD, entry.conflict.line, textStyle(typeRole.rowTitle, surface.ink.hex))
        .setFontSize(15)
        .setWordWrapWidth(textWidth)
        .setLineSpacing(2);
      // Two lines at most: a long line shrinks to fit rather than being cut.
      for (let size = 15; size > 11 && line.getWrappedText().length > 2; size--) line.setFontSize(size);
      objects.push(line);
      const mark =
        status === "pending" && entry.conflict.identitySpecific
          ? `${entry.conflict.heroName}'s own card · can only be spent as a resource`
          : status === "replaced"
            ? `✓ Replaced with ${this.#replacementNameOf(entry)}`
            : status === "kept"
              ? "✓ Kept as a resource"
              : "Not answered yet";
      const statusText = this.add.text(
        row.x + ROW_PAD,
        row.y + ROW_PAD + 40,
        mark,
        textStyle(
          typeRole.emphasis,
          status === "pending" ? surface.ink.hex : signal.heal.hex,
          status === "pending" ? ink.meta : 1,
        ),
      );
      fitText(statusText, textWidth, typeRole.emphasis.size + 1);
      objects.push(statusText);
      const ownCard = entry.conflict.identitySpecific;
      const rects = buttonRects({ ...row, y: rect.y }, ownCard);
      if (!ownCard) {
        const replace = new McButton(this, {
          kind: status === "replaced" ? "secondary" : "primary",
          label: status === "replaced" ? "Change" : "Replace",
          type: BUTTON_TYPE,
          rect: rects.replace,
          onClick: () => this.#openPicker(entry),
          clip,
          suppressClick,
        });
        objects.push(replace.container);
      }
      const keep = new McButton(this, {
        kind: "secondary",
        label: "Keep as a resource",
        type: BUTTON_TYPE,
        rect: rects.keep,
        selected: status === "kept",
        onClick: () => this.#keep(entry),
        clip,
        suppressClick,
      });
      objects.push(keep.container);
      return { objects };
    };
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: SHEET_ROW_HEIGHT,
      count: entries.length,
      renderRow,
      scroll: this.#sheetScroll,
    });
    const list = this.#list;
    entries.forEach((entry, index) => {
      const replaceKey = `replace:${index}`;
      const keepKey = `keep:${index}`;
      const place = (which: "replace" | "keep") => (): Rect => {
        const row = list.rectFor(index);
        return buttonRects({ ...row, width: row.width - 8 }, entry.conflict.identitySpecific)[which];
      };
      if (!entry.conflict.identitySpecific)
        stops.set(replaceKey, {
          rect: place("replace"),
          activate: () => this.#openPicker(entry),
          ensureVisible: () => list.scrollIntoView(index),
        });
      stops.set(keepKey, {
        rect: place("keep"),
        activate: () => this.#keep(entry),
        ensureVisible: () => list.scrollIntoView(index),
      });
      if (!entry.conflict.identitySpecific) order.push(replaceKey);
      order.push(keepKey);
    });
  }

  #replacementNameOf(entry: Entry): string {
    const swap = this.#swaps.find((s) => s.deckId === entry.conflict.deckId && s.from === entry.conflict.cardId);
    return swap ? (CARDS_BY_ID.get(swap.to)?.name ?? swap.to) : "";
  }

  // --- The picker ------------------------------------------------------------------------------------------------

  #drawPickerList(listRect: Rect, picker: Picker, stops: Map<string, FocusStop>, order: string[]): void {
    const { candidates } = picker;
    if (candidates.length === 0) {
      this.add
        .text(
          listRect.x,
          listRect.y,
          "No legal card can replace it.",
          textStyle(typeRole.body, surface.ink.hex, ink.meta),
        )
        .setFontSize(14);
    }
    const renderRow = (index: number, rect: Rect): VirtualListRow => this.#renderPickRow(rect, picker, index);
    this.#list = new McVirtualList(this, {
      rect: listRect,
      rowHeight: PICK_ROW_HEIGHT,
      count: candidates.length,
      renderRow,
      scroll: this.#pickerScroll,
    });
    const list = this.#list;
    list.onDestroy(cardFaces(this).onBaked(() => list.layout(list.rect)));
    candidates.forEach(({ card }, index) => {
      const key = `pick:${card.id as string}`;
      stops.set(key, {
        rect: () => list.rectFor(index),
        activate: () => this.#select(picker, card.id as string),
        inspect: () => this.#inspect(card),
        ensureVisible: () => list.scrollIntoView(index),
      });
      order.push(key);
    });
  }

  #select(picker: Picker, cardId: string): void {
    if (picker.selected === cardId) return;
    picker.selected = cardId;
    this.#draw();
  }

  #renderPickRow(rect: Rect, picker: Picker, index: number): VirtualListRow {
    const { card } = picker.candidates[index]!;
    const cardId = card.id as string;
    const selected = picker.selected === cardId;
    const row: Rect = { x: rect.x + 4, y: rect.y, width: rect.width - 12, height: PICK_ROW_HEIGHT - 6 };
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(row.x, row.y, row.width, row.height);
    // Selection reads by a heavy border and a check, never by color alone.
    g.lineStyle(selected ? 5 : 2, surface.ink.hex, 1).strokeRect(row.x, row.y, row.width, row.height);
    objects.push(g);

    const thumbWidth = 52;
    objects.push(
      renderArtThumb(
        this,
        { x: row.x + 6, y: row.y + 6, width: thumbWidth, height: row.height - 12 },
        artFor(card, { kind: "front" })?.url ?? null,
        0,
      ),
    );
    const textX = row.x + 6 + thumbWidth + 10;
    const rightWidth = 96;
    const textWidth = row.x + row.width - rightWidth - 8 - textX;
    const name = this.add.text(
      textX,
      row.y + 10,
      `${selected ? "✓ " : ""}${card.name}`,
      textStyle(typeRole.rowTitle, surface.ink.hex),
    );
    fitText(name, textWidth, 15);
    objects.push(name);
    const meta = [card.type.replace(/_/g, " "), index === 0 ? "recommended" : ""].filter(Boolean).join(" · ");
    const metaText = this.add.text(
      textX,
      name.y + name.height + 4,
      meta,
      textStyle(typeRole.label, surface.ink.hex, ink.label),
    );
    fitText(metaText, textWidth, typeRole.label.size);
    objects.push(metaText);

    // Cost and aspect, stacked at the right edge.
    const cost = "cost" in card ? String((card as unknown as { cost: number }).cost) : "—";
    const costText = this.add
      .text(row.x + row.width - 8, row.y + 10, `Cost ${cost}`, textStyle(typeRole.emphasis, signal.cost.hex))
      .setOrigin(1, 0)
      .setFontSize(14);
    objects.push(costText);
    const aspect = "aspect" in card ? String((card as { aspect: string }).aspect) : "";
    const stamp = ["aggression", "justice", "protection", "leadership", "pool", "basic"].includes(aspect)
      ? aspectStampOf(aspect as CoreAspect)
      : null;
    const badge: Rect = {
      x: row.x + row.width - 8 - rightWidth + 6,
      y: row.y + row.height - 34,
      width: rightWidth - 6,
      height: 24,
    };
    const bg = this.add.graphics();
    bg.fillStyle(stamp?.fill ?? surface.paper.hex, 1).fillRect(badge.x, badge.y, badge.width, badge.height);
    bg.lineStyle(2, surface.ink.hex, 1).strokeRect(badge.x, badge.y, badge.width, badge.height);
    objects.push(bg);
    const badgeText = this.add
      .text(
        badge.x + badge.width / 2,
        badge.y + badge.height / 2,
        (stamp?.label ?? "Hero").toUpperCase(),
        textStyle(typeRole.stamp, stamp?.ink ?? surface.ink.hex),
      )
      .setOrigin(0.5);
    fitText(badgeText, badge.width - 8, typeRole.stamp.size - 3);
    objects.push(badgeText);

    // The whole row: tap selects, press-and-hold or right-click inspects (a drag scrolls the list instead).
    const zone = this.add
      .zone(row.x, row.y, row.width, row.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    bindHoldTarget(this, zone, {
      key: cardId,
      onTap: () => {
        const list = this.#list;
        if (!list || list.isDragSuppressingClick) return;
        const pointer = this.input.activePointer;
        const lr = list.rect;
        if (pointer.x < lr.x || pointer.x > lr.x + lr.width || pointer.y < lr.y || pointer.y > lr.y + lr.height) return;
        this.#select(picker, cardId);
      },
      onInspect: () => {
        const list = this.#list;
        const pointer = this.input.activePointer;
        if (list) {
          const lr = list.rect;
          if (pointer.x < lr.x || pointer.x > lr.x + lr.width || pointer.y < lr.y || pointer.y > lr.y + lr.height)
            return;
        }
        this.#inspect(card);
      },
    });
    objects.push(zone);
    return { objects };
  }

  /** Dev-only e2e hook: what the sheet shows right now. Never referenced by product code. */
  #publish(): void {
    if (!import.meta.env.DEV) return;
    const picker = this.#picker;
    (window as unknown as { __mcNameConflictDebug?: unknown }).__mcNameConflictDebug = {
      mode: picker ? "picker" : "sheet",
      entries: () =>
        this.#entries.map((entry) => ({
          line: entry.conflict.line,
          deckId: entry.conflict.deckId,
          cardId: entry.conflict.cardId,
          status: this.#statusOf(entry),
        })),
      unresolved: () => this.#entries.filter((entry) => this.#statusOf(entry) === "pending").length,
      candidates: () => picker?.candidates.map((c) => ({ id: c.card.id, name: c.card.name, tier: c.tier })) ?? [],
      selected: () => picker?.selected ?? null,
    };
  }
}

/** Opens the sheet over `scene` for the seated `decks`; the caller keeps every answer (`onChange`). */
export function openNameConflictSheet(scene: Phaser.Scene, data: Omit<NameConflictSheetData, "from">): void {
  if (scene.scene.isActive(SCENES.nameConflict)) return;
  scene.scene.launch(SCENES.nameConflict, { ...data, from: scene.scene.key } satisfies NameConflictSheetData);
}
