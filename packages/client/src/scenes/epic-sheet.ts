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
 * The list scrolls inside a masked region and every control passes its clip and drag, so a swipe never presses one
 * (the "no tap on finger lift" rule, issue #227).
 */
import Phaser from "phaser";
import { gameCardsById } from "../content/game-deps.js";
import { currentDeps, currentPool, POOL_VERSION } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
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
import { appSession, deckStorage } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { textStyle } from "../ui/theme.js";
import { McButton, McTextInput } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { cardOf } from "@mc/engine";
import { difficultyOf, planOf, statusKey, withTableName, type EpicPlan } from "../view/epic-lobby-model.js";
import { reachRows, remotePowerCommand } from "../view/epic-reach.js";
import type { Rect } from "../view/layout.js";
import { seatableDeckOptionsOf } from "../view/seatable-decks.js";
import { seatLabelOf, seatSpecWithHero } from "../view/seat-label.js";
import type { DeckOption } from "../view/deck-list-model.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { setCompetitive } from "../platform/room.js";
import {
  tieBreaksOn,
  withSeatHero as withTeamSeatHero,
  type CompetitivePlan,
} from "../view/competitive-lobby-model.js";
import type { BoardScene } from "./board.js";
import { askToConfirm } from "./end-turn-confirm.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export type EpicSheetData =
  | { readonly kind: "tables"; readonly preview?: RoomState }
  | { readonly kind: "rename"; readonly table: string; readonly preview?: RoomState }
  | { readonly kind: "host"; readonly table: string; readonly preview?: RoomState }
  /** Civil War Competitive (#883): the host picks a seat's hero; `plan` is the seats as the lobby shows them. */
  | {
      readonly kind: "teamHero";
      readonly seat: string;
      readonly plan: CompetitivePlan;
      readonly preview?: RoomState;
    };

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;
const small = { ...typeRole.label, size: 12 };

/** The dev preview records calls instead of sending them (the e2e specs read `__mcRoomCalls`). */
const record = (call: string): void => {
  ((globalThis as { __mcRoomCalls?: string[] }).__mcRoomCalls ??= []).push(call);
};

export class EpicSheetOverlay extends Phaser.Scene {
  #data: EpicSheetData = { kind: "tables" };
  #state: RoomState = roomState();
  #buttons: McButton[] = [];
  #regions: McScrollRegion[] = [];
  #scroll = new VariableListScroll();
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #faces: { readonly cardId: string; readonly rect: Rect; readonly view: Rect }[] = [];
  #input: McTextInput | null = null;
  #decks: readonly DeckOption[] | null = null;
  #value = "";
  #note: string | null = null;
  #order: string[] = [];
  #stops = new Map<string, FocusStop>();
  #off: (() => void) | null = null;

  constructor() {
    super(SCENES.epicSheet);
  }

  init(data: EpicSheetData): void {
    this.#data = data;
    this.#state = data.preview ?? roomState();
    this.#note = null;
    this.#scroll = new VariableListScroll();
    if (data.kind === "rename") {
      this.#value = this.#state.epic?.tables.find((x) => x.id === data.table)?.name ?? "";
    }
  }

  get #preview(): boolean {
    return this.#data.preview !== undefined;
  }

  create(): void {
    this.#route = new FocusRoute(this, {
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => this.scene.stop(),
      primary: () => (this.#stops.has("done") ? "done" : null),
    });
    bindTextFieldEscape(this, () => this.#input);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    const redraw = (): void => this.#draw();
    // A scan that was still loading arrives: draw again to show it.
    const offArt = cardArt(this).onArrived(() => {
      if (this.sys.isActive()) this.#draw();
    });
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
      offArt();
      this.#hover?.destroy();
      this.#hover = null;
      this.#clear();
      this.#input?.destroy();
      this.#input = null;
    });
    if (this.#data.kind === "teamHero") {
      void deckStorage()
        .list()
        .then((decks) => {
          if (!this.sys.isActive()) return;
          this.#decks = seatableDeckOptionsOf(decks, currentPool(), POOL_VERSION, currentDeps());
          this.#draw();
        });
    }
    this.#draw();
    this.#input?.focus();
  }

  #hoverIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    this.#faces.forEach(({ cardId, rect, view }, index) => {
      const shown = clipHoverRect({ ...rect, y: rect.y - this.#scroll.offsetPx }, view);
      if (shown) found.set(hoverSlotOf(cardId, `reach${index}`), { ...shown, cardId, through: true });
    });
    return found;
  }

  #clear(): void {
    for (const b of this.#buttons) b.destroy();
    this.#buttons = [];
    for (const r of this.#regions) r.destroy();
    this.#regions = [];
  }

  #button(options: ConstructorParameters<typeof McButton>[1]): McButton {
    const b = new McButton(this, options);
    this.#buttons.push(b);
    return b;
  }

  #text(
    x: number,
    y: number,
    text: string,
    size: number,
    width: number,
    bold = false,
    alpha = 1,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, textStyle(bold ? typeRole.rowTitle : typeRole.body, INK, alpha))
      .setFontSize(size)
      .setWordWrapWidth(width, true);
  }

  /** The organizer's plan changes: the whole new plan goes to the room (or is recorded in a preview). */
  #send(plan: EpicPlan): void {
    if (this.#preview) record(`setEpic(${plan.tables.length}t,${plan.seats.length}s)`);
    else setEpic(plan.tables, plan.pods, plan.seats);
  }

  #draw(): void {
    this.#clear();
    const kept = this.#input ? this.#input.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#faces = [];
    this.#order = [];
    this.#stops = new Map();
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const boxW = Math.min(560, width - 16);
    const boxH = Math.min(height - 16, 640);
    const box: Rect = { x: (width - boxW) / 2, y: (height - boxH) / 2, width: boxW, height: boxH };
    const g = this.add.graphics();
    g.fillStyle(PAPER, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(4, INK, 1).strokeRect(box.x, box.y, box.width, box.height);
    const title = this.add
      .text(box.x + 16, box.y + 12, this.#title(), textStyle(typeRole.barTitle, INK))
      .setWordWrapWidth(box.width - 32, true);
    const closeRect: Rect = {
      x: box.x + 16,
      y: box.y + box.height - 12 - hit.target,
      width: box.width - 32,
      height: hit.target,
    };
    const closeLabel = this.#data.kind === "rename" ? t("room.on") : t("epic.sheet.close");
    const done = (): void => {
      if (this.#data.kind === "rename") this.#applyRename();
      this.scene.stop();
    };
    this.#button({
      kind: "primary",
      label: this.#data.kind === "rename" ? "OK" : closeLabel,
      type: small,
      rect: closeRect,
      onClick: done,
    });
    this.#stops.set("done", { rect: closeRect, activate: done });
    this.#order.push("done");
    const top = title.y + title.height + 8;
    const inner: Rect = {
      x: box.x + 12,
      y: top,
      width: box.width - 24,
      height: closeRect.y - 8 - top,
    };
    if (this.#data.kind === "rename") this.#drawRename(inner);
    else this.#list(inner);
    this.#route?.set(this.#order, this.#stops);
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
      case "teamHero":
        return t("epic.hero.title");
    }
  }

  #applyRename(): void {
    const data = this.#data;
    if (data.kind !== "rename") return;
    const plan = planOf(this.#state);
    if (plan) this.#send(withTableName(plan, data.table, this.#input?.value ?? this.#value));
  }

  #drawRename(inner: Rect): void {
    if (!this.#input) {
      this.#input = new McTextInput(this, {
        rect: { x: inner.x, y: inner.y + 8, width: inner.width, height: hit.target },
        value: this.#value,
        maxLength: 40,
        onChange: (v: string) => {
          this.#value = v;
        },
      } as never);
    }
  }

  /** A scrolling list in `inner`: `fill` draws at the list's own coordinates and returns its height. */
  #list(inner: Rect): void {
    const region = new McScrollRegion(this, {
      rect: inner,
      heights: [inner.height],
      scroll: this.#scroll,
      clipInteractive: true,
    });
    this.#regions.push(region);
    const before = this.children.list.length;
    const guard = {
      clip: (): Rect => inner,
      suppress: (): boolean => region.isDragSuppressingClick,
    };
    this.#fill(inner.x, inner.y, inner.width - 12, guard);
    const added = this.children.list.slice(before).filter((n) => n !== region.root);
    if (added.length > 0) region.content.add(added);
    region.refresh();
  }

  #fill(x: number, top: number, w: number, guard: { clip: () => Rect; suppress: () => boolean }): number {
    let y = top + 2;
    const inner: Rect = guard.clip();
    const row = (
      label: string,
      run: () => void,
      kind: "primary" | "secondary" = "secondary",
      enabled = true,
      at?: number,
    ): number => {
      const pos = at ?? y;
      const r: Rect = { x, y: pos, width: w, height: hit.target };
      this.#button({
        kind,
        label,
        type: small,
        rect: r,
        enabled,
        onClick: run,
        clip: guard.clip,
        suppressClick: guard.suppress,
        wrap: true,
      });
      const key = `row${this.#order.length}`;
      this.#stops.set(key, { rect: () => ({ ...r, y: r.y - this.#scroll.offsetPx }), activate: run, view: inner });
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
      if (people.size === 0) y += this.#text(x, y, t("epic.table.hostNobody"), 13, w).height + 8;
      for (const [id, name] of people) {
        row(name, () => this.#hostIs(data.table, id), table?.host === id ? "primary" : "secondary");
      }
      if (table?.host) row(t("epic.table.hostTake"), () => this.#hostIs(data.table, null));
      return y - top;
    }
    if (data.kind === "teamHero") {
      const decks = this.#decks;
      if (!decks) return 30;
      if (decks.length === 0) y += this.#text(x, y, t("epic.hero.none"), 13, w).height;
      for (const option of decks.filter((o) => o.seatable)) {
        const label = seatLabelOf(option.identityName, option.deck.name);
        const cardId = option.deck.identityCardId as string;
        const full = seatSpecWithHero(data.seat, label, cardId).label as string;
        row(label, () => this.#teamHeroIs(data.plan, data.seat, full));
      }
      return y - top;
    }
    if (data.kind !== "tables" || !epic) return 0;
    y = this.#fillReach(x, y, w, guard, row);
    for (const table of epic.tables) {
      const lines = [
        `${table.name} · ${t(statusKey(table.status))}${table.round > 0 ? ` · ${t("epic.sheet.round", { round: table.round })}` : ""}`,
        `${epic.pods.find((p) => p.id === table.pod)?.name ?? table.pod} · ${t(`epic.difficulty.${difficultyOf(table.difficulty)}`)}` +
          (table.watching > 0 ? ` · ${t("epic.sheet.watchers", { count: table.watching })}` : ""),
      ];
      const name = this.#text(x, y, lines[0]!, 14, w, true);
      const info = this.#text(x, y + name.height + 2, lines[1]!, 12, w, false, 0.8);
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
    if (this.#note) y += this.#text(x, y, this.#note, 13, w, true).height + 6;
    return y - top;
  }

  #fillReach(
    x: number,
    y0: number,
    w: number,
    guard: { clip: () => Rect; suppress: () => boolean },
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
    const head = this.add.text(x, y, t("epic.sheet.reach").toUpperCase(), textStyle(typeRole.rowTitle, INK));
    y += head.height + 6;
    if (rows.length === 0) y += this.#text(x, y, t("epic.sheet.reachNone"), 13, w, false, 0.85).height + 10;
    for (const r of rows) {
      const art: Rect = { x, y, width: 56, height: 78 };
      this.add.graphics().fillStyle(surface.parchment.hex, 1).fillRect(art.x, art.y, art.width, art.height);
      const card = gameCardsById().get(r.cardId);
      const key = card ? cardArt(this).request(this, artFor(card, { kind: "front" })) : null;
      if (!drawArt(this, key, art, { fit: "contain" })) {
        this.add
          .text(art.x + art.width / 2, art.y + art.height / 2, r.name, textStyle(typeRole.label, INK))
          .setOrigin(0.5)
          .setWordWrapWidth(art.width - 6, true)
          .setAlign("center");
      }
      this.#faces.push({ cardId: r.cardId, rect: art, view: guard.clip() });
      const nameText = this.#text(x + 66, y, `${r.name} (${r.left})`, 15, w - 66, true);
      this.#text(x + 66, y + nameText.height + 2, r.tableName, 12, w - 66, false, 0.85);
      y += Math.max(art.height, 50) + 8;
      const target = epic.remoteTargets.find((tt) => `${tt.table}:${tt.card.instanceId}` === r.key);
      if (r.characters.length === 0) {
        y += this.#text(x, y, t("epic.sheet.noHero"), 12, w, false, 0.8).height + 8;
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
    if (ok) this.scene.stop();
    else {
      this.#note = store.state.error ?? t("room.refusal.generic");
      this.#draw();
    }
  }

  #hostIs(table: string, participant: string | null): void {
    if (this.#preview) record(`assignTableHost(${table},${participant})`);
    else assignTableHost(table, participant);
    this.scene.stop();
  }

  #teamHeroIs(plan: CompetitivePlan, seat: string, label: string): void {
    const next = withTeamSeatHero(plan, seat, label);
    if (this.#preview) record(`setCompetitive(hero ${seat})`);
    else setCompetitive(next, tieBreaksOn(this.#state));
    this.scene.stop();
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
