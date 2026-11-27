/**
 * Epic Multiplayer's sheet (issue #882, docs/live-game-rooms.md section 10): one overlay with the pickers the lobby and
 * the board need, over whichever screen opened it. Nothing is decided here: each press is a room call (`setEpic`,
 * `assignTableHost`, `watchTable`, `dropTable`) or an ordinary command (`remotePower`), and the room or engine refuses
 * what it will not allow.
 *
 * - `tables` (board): what my table may attack or thwart in other tables of its pod (card art, hover, one button per
 *   character the engine lists the power for), then every table with its status in words, a Watch button for a watcher,
 *   and the organizer's "Drop table" for a table whose host is away.
 * - `rename`: a table's name (the organizer). `host`: who hosts a table (the organizer).
 *
 * The box, the list and its buttons are a Lit pop-up panel over the canvas (`dom/popup-sheet.ts`), so the screen it
 * opened over stays shown under its scrim; the list scrolls natively and every control is a tap (a swipe never presses
 * one: the "no tap on finger lift" rule, issue #227). The rename field stays a Phaser `McTextInput`, seen through a
 * hole, and the card hover popover is seen through another.
 */
import Phaser from "phaser";
import { cardOf } from "@mc/engine";
import { gameCardsById } from "../content/game-deps.js";
import { artFor } from "../art/art-source.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import type { SheetBuilder } from "../dom/sheet-builder.js";
import { t } from "../i18n/translate.js";
import {
  assignTableHost,
  dropTable,
  onRoomState,
  roomState,
  setEpic,
  watchTable,
  type RemoteTarget,
  type RoomState,
} from "../platform/room.js";
import { activeReplay } from "../replay/replay-mode.js";
import { appSession } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { McTextInput } from "../ui/widgets.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { difficultyOf, planOf, statusKey, withTableName, type EpicPlan } from "../view/epic-lobby-model.js";
import { reachRows, remotePowerCommand } from "../view/epic-reach.js";
import type { Rect } from "../view/layout.js";
import type { BoardScene } from "./board.js";
import { askToConfirm } from "./end-turn-confirm.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export type EpicSheetData =
  | { readonly kind: "tables"; readonly preview?: RoomState }
  | { readonly kind: "rename"; readonly table: string; readonly preview?: RoomState }
  | { readonly kind: "host"; readonly table: string; readonly preview?: RoomState };

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;
const small = { ...typeRole.label, size: 12 };
const LIST = "epic-list";

/** The dev preview records calls instead of sending them (the e2e specs read `__mcRoomCalls`). */
const record = (call: string): void => {
  ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []).push(call);
};

export class EpicSheetOverlay extends Phaser.Scene {
  #data: EpicSheetData = { kind: "tables" };
  #state: RoomState = roomState();
  #panel!: PopupSheet;
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #faces: { readonly cardId: string; readonly rect: Rect }[] = [];
  /** Where the list sits on the screen (its box), which a hover rect is clipped to. */
  #listRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #input: McTextInput | null = null;
  #fieldRect: Rect | null = null;
  #value = "";
  #note: string | null = null;
  #order: string[] = [];
  #stops = new Map<string, FocusStop>();
  readonly #actions = new Map<string, () => void>();
  #off: (() => void) | null = null;

  constructor() {
    super(SCENES.epicSheet);
  }

  init(data: EpicSheetData): void {
    this.#data = data;
    this.#state = data.preview ?? roomState();
    this.#note = null;
    if (data.kind === "rename") {
      this.#value = this.#state.epic?.tables.find((x) => x.id === data.table)?.name ?? "";
    }
  }

  get #preview(): boolean {
    return this.#data.preview !== undefined;
  }

  create(): void {
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.(), undefined, {
      onDismiss: () => this.#close(),
      onSlide: (dy) => this.#input?.slide(dy),
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#panel.leaving || (this.#input?.focused ?? false),
      onCancel: () => this.#close(),
      primary: () => (this.#stops.has("done") ? "done" : null),
    });
    bindTextFieldEscape(this, () => this.#input);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    const redraw = (): void => this.#draw();
    this.scale.on("resize", redraw, this);
    if (!this.#preview) {
      this.#off = onRoomState((state) => {
        this.#state = state;
        if (this.sys.isActive()) this.#draw();
      });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      this.#off?.();
      this.#hover?.destroy();
      this.#hover = null;
      this.#input?.destroy();
      this.#input = null;
    });
    this.#draw();
    this.#input?.focus();
  }

  #close(): void {
    this.#panel.close();
  }

  #scroller(): HTMLElement | null {
    return this.#panel.element?.elementOf(LIST) ?? null;
  }

  #hoverIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const scrolled = this.#scroller()?.scrollTop ?? 0;
    this.#faces.forEach(({ cardId, rect }, index) => {
      const shown = clipHoverRect({ ...rect, y: rect.y - scrolled }, this.#listRect);
      if (shown) found.set(hoverSlotOf(cardId, `reach${index}`), { ...shown, cardId, through: true });
    });
    return found;
  }

  /** A text in the list or the box; returns its measured size. */
  #text(b: SheetBuilder, x: number, y: number, text: string, size: number, width: number, bold = false, alpha = 1) {
    return b.text(x, y, text, bold ? typeRole.rowTitle : typeRole.body, {
      size,
      color: INK,
      wrapWidth: width,
      ...(alpha < 1 ? { alpha } : {}),
    });
  }

  /** The organizer's plan changes: the whole new plan goes to the room (or is recorded in a preview). */
  #send(plan: EpicPlan): void {
    if (this.#preview) record(`setEpic(${plan.tables.length}t,${plan.seats.length}s)`);
    else setEpic(plan.tables, plan.pods, plan.seats);
  }

  #draw(): void {
    const kept = this.#input ? this.#input.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#faces = [];
    this.#order = [];
    this.#stops = new Map();
    this.#actions.clear();
    this.#fieldRect = null;
    const { width, height } = this.scale.gameSize;
    // Swallows every press that lands on no control of this pop-up's own.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);
    const boxW = Math.min(560, width - 16);
    const boxH = Math.min(height - 16, 640);
    const box: Rect = { x: (width - boxW) / 2, y: (height - boxH) / 2, width: boxW, height: boxH };
    b.box(box, { fill: PAPER });
    b.box(box, { stroke: INK, strokeWidth: 4 });
    const title = b.text(box.x + 16, box.y + 12, this.#title(), typeRole.barTitle, {
      color: INK,
      wrapWidth: box.width - 32,
    });
    const closeRect: Rect = {
      x: box.x + 16,
      y: box.y + box.height - 12 - hit.target,
      width: box.width - 32,
      height: hit.target,
    };
    const rename = this.#data.kind === "rename";
    const done = (): void => {
      if (rename) this.#applyRename();
      this.#close();
    };
    this.#actions.set("done", done);
    b.button({
      key: "done",
      rect: closeRect,
      label: rename ? "OK" : t("epic.sheet.close"),
      look: "primary",
      type: small,
    });
    this.#stops.set("done", { rect: closeRect, activate: done });
    this.#order.push("done");
    const top = box.y + 12 + title.height + 8;
    const inner: Rect = { x: box.x + 12, y: top, width: box.width - 24, height: closeRect.y - 8 - top };
    if (rename) this.#drawRename(inner);
    else this.#list(b, inner);
    this.#panel.mount(b, width, height, () => {
      const holes: Rect[] = [];
      if (this.#input?.shown && this.#fieldRect) holes.push({ ...this.#fieldRect });
      const popover = this.#hover?.shownRect;
      if (popover) holes.push(popover);
      return holes;
    });
    this.#panel.forwardMouseMoves();
    this.#route?.set(this.#order, this.#stops);
    this.#hover?.onDraw();
  }

  #title(): string {
    const epic = this.#state.epic;
    switch (this.#data.kind) {
      case "tables":
        return t("epic.sheet.title");
      case "rename":
        return t("epic.table.newName");
      case "host": {
        const id = this.#data.table;
        return t("epic.table.hostPickTitle", { table: epic?.tables.find((x) => x.id === id)?.name ?? id });
      }
    }
  }

  #applyRename(): void {
    const data = this.#data;
    if (data.kind !== "rename") return;
    const plan = planOf(this.#state);
    if (plan) this.#send(withTableName(plan, data.table, this.#input?.value ?? this.#value));
  }

  #drawRename(inner: Rect): void {
    const rect: Rect = { x: inner.x, y: inner.y + 8, width: inner.width, height: hit.target };
    this.#fieldRect = rect;
    if (!this.#input) {
      this.#input = new McTextInput(this, {
        rect,
        value: this.#value,
        maxLength: 40,
        onChange: (v: string) => {
          this.#value = v;
        },
      } as never);
    } else this.#input.layout(rect);
  }

  /** A scrolling list in `inner`: a native scroll region of the panel, its parts at the list's own coordinates. */
  #list(b: SheetBuilder, inner: Rect): void {
    this.#listRect = inner;
    const rect: Rect = { x: inner.x, y: inner.y, width: inner.width - 12, height: inner.height };
    b.scrollFit(LIST, rect, (list) => this.#fill(list, rect.x, 0, rect.width, rect.y));
  }

  #fill(b: SheetBuilder, x: number, top: number, w: number, listTop: number): number {
    let y = top + 2;
    const row = (
      label: string,
      run: () => void,
      kind: "primary" | "secondary" = "secondary",
      enabled = true,
      at?: number,
    ): number => {
      const pos = at ?? y;
      const r: Rect = { x, y: pos, width: w, height: hit.target };
      const key = `row${this.#order.length}`;
      this.#actions.set(key, enabled ? run : () => undefined);
      b.button({ key, rect: r, label, look: kind, type: small, ...(enabled ? {} : { disabled: true as const }) });
      // The stop's box is read off the panel, so it follows the scroll; taking focus scrolls it into view.
      this.#stops.set(key, {
        rect: () => this.#boxOf(key, { ...r, y: r.y + listTop }),
        activate: enabled ? run : () => undefined,
        view: () => this.#boxOf(LIST, this.#listRect),
        ensureVisible: () => this.#panel.element?.elementOf(key)?.scrollIntoView({ block: "nearest" }),
      });
      this.#order.push(key);
      if (at === undefined) y += hit.target + 6;
      return pos + hit.target + 6;
    };
    const epic = this.#state.epic;
    const data = this.#data;
    if (data.kind === "host" && epic) {
      const table = epic.tables.find((x) => x.id === data.table);
      const people = new Map<string, string>();
      for (const id of table?.seats ?? []) {
        const seat = this.#state.seats.find((s) => s.id === id);
        if (seat?.holder) people.set(seat.holder, seat.holderName ?? seat.holder);
      }
      const organizer = this.#state.participants.find((p) => p.role === "host");
      if (organizer && !epic.tables.some((x) => x.id !== data.table && x.host === organizer.id)) {
        people.set(organizer.id, organizer.name);
      }
      if (people.size === 0) y += this.#text(b, x, y, t("epic.table.hostNobody"), 13, w).height + 8;
      for (const [id, name] of people) {
        row(name, () => this.#hostIs(data.table, id), table?.host === id ? "primary" : "secondary");
      }
      if (table?.host) row(t("epic.table.hostTake"), () => this.#hostIs(data.table, null));
      return y - top;
    }
    if (data.kind !== "tables" || !epic) return 0;
    y = this.#fillReach(b, x, y, w, listTop, row);
    for (const table of epic.tables) {
      const lines = [
        `${table.name} · ${t(statusKey(table.status))}${table.round > 0 ? ` · ${t("epic.sheet.round", { round: table.round })}` : ""}`,
        `${epic.pods.find((p) => p.id === table.pod)?.name ?? table.pod} · ${t(`epic.difficulty.${difficultyOf(table.difficulty)}`)}` +
          (table.watching > 0 ? ` · ${t("epic.sheet.watchers", { count: table.watching })}` : ""),
      ];
      const name = this.#text(b, x, y, lines[0]!, 14, w, true);
      const info = this.#text(b, x, y + name.height + 2, lines[1]!, 12, w, false, 0.8);
      y += name.height + info.height + 8;
      if (activeReplay() && epic.myTable === null) {
        const following = Array.isArray(epic.following) && epic.following.includes(table.id);
        row(
          following ? t("epic.sheet.watching") : t("epic.sheet.watch"),
          () => void this.#watch(table.id),
          "secondary",
          !following,
        );
      }
      if (epic.organizer && table.status === "waiting") {
        row(t("epic.sheet.drop"), () => this.#askDrop(table.id, table.name, table.hostName ?? ""), "secondary");
      }
      y += 4;
    }
    if (this.#note) y += this.#text(b, x, y, this.#note, 13, w, true).height + 6;
    return y - top;
  }

  /** An element of the panel in game coordinates, or `fallback` while it is not drawn. */
  #boxOf(key: string, fallback: Rect): Rect {
    const found = this.#panel.element?.elementOf(key);
    return (found ? this.#panel.rectOf(found) : null) ?? fallback;
  }

  #fillReach(
    b: SheetBuilder,
    x: number,
    y0: number,
    w: number,
    listTop: number,
    row: (label: string, run: () => void, kind?: "primary" | "secondary", enabled?: boolean, at?: number) => number,
  ): number {
    let y = y0;
    const epic = this.#state.epic;
    if (!epic || epic.myTable === null) return y;
    const store = appSession().store.state;
    const game = store.game;
    const nameOfInstance = (id: string): string => (game ? (cardOf(game, id as never)?.name ?? id) : id);
    const rows = reachRows(
      epic.remoteTargets,
      this.#preview ? null : store.legal,
      (id) => gameCardsById().get(id)?.name ?? id,
      nameOfInstance,
    );
    const head = b.text(x, y, t("epic.sheet.reach").toUpperCase(), typeRole.rowTitle, { color: INK });
    y += head.height + 6;
    if (rows.length === 0) y += this.#text(b, x, y, t("epic.sheet.reachNone"), 13, w, false, 0.85).height + 10;
    for (const r of rows) {
      const art: Rect = { x, y, width: 56, height: 78 };
      const card = gameCardsById().get(r.cardId);
      b.pictureTile(art, {
        key: `reach:${r.key}`,
        src: card ? (artFor(card, { kind: "front" })?.url ?? null) : null,
        fit: "contain",
        frame: 0,
        missing: r.name,
      });
      this.#faces.push({ cardId: r.cardId, rect: { ...art, y: art.y + listTop } });
      const nameText = this.#text(b, x + 66, y, `${r.name} (${r.left})`, 15, w - 66, true);
      this.#text(b, x + 66, y + nameText.height + 2, r.tableName, 12, w - 66, false, 0.85);
      y += Math.max(art.height, 50) + 8;
      const target = epic.remoteTargets.find((tt) => `${tt.table}:${tt.card.instanceId}` === r.key);
      if (r.characters.length === 0) {
        y += this.#text(b, x, y, t("epic.sheet.noHero"), 12, w, false, 0.8).height + 8;
        continue;
      }
      for (const character of r.characters) {
        const label = t(r.power === "attack" ? "epic.sheet.attack" : "epic.sheet.thwart", { hero: character.name });
        y = row(label, () => void this.#remote(r, target, character.instanceId), "primary", true, y);
      }
    }
    return y + 6;
  }

  async #remote(
    r: ReturnType<typeof reachRows>[number],
    target: RemoteTarget | undefined,
    characterId: string,
  ): Promise<void> {
    if (!target || this.#preview) return record(`remotePower(${r.key})`);
    const { store } = appSession();
    const playerId = store.state.legal?.playerId;
    const character = r.characters.find((c) => c.instanceId === characterId);
    if (!playerId || !character) return;
    const ok = await store.dispatch(remotePowerCommand(playerId, r, target, character));
    if (ok) this.#close();
    else {
      this.#note = store.state.error ?? t("room.refusal.generic");
      this.#draw();
    }
  }

  #hostIs(table: string, participant: string | null): void {
    if (this.#preview) record(`assignTableHost(${table},${participant})`);
    else assignTableHost(table, participant);
    this.#close();
  }

  /** Moves the watch to `table`: its game opens as a live watch and replaces the one under the board (no lobby trip). */
  async #watch(table: string): Promise<void> {
    if (this.#preview) return record(`watchTable(${table})`);
    const result = await watchTable(table);
    if (!result.ok) {
      this.#note = t(result.message);
      if (this.sys.isActive()) this.#draw();
      return;
    }
    const board = this.scene.get(SCENES.board) as BoardScene;
    this.scene.stop();
    await board.swapReplay(result.host);
  }

  #askDrop(table: string, name: string, host: string): void {
    askToConfirm(
      this,
      t("epic.sheet.dropTitle", { table: name }),
      t("epic.sheet.dropBody", { table: name, name: host }),
      t("epic.sheet.dropConfirm"),
      () => {
        if (this.#preview) record(`dropTable(${table})`);
        else dropTable(table);
      },
    );
  }
}
