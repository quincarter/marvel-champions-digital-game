/**
 * The Decks screen (PLAN.md Phase 9): every precon, plus every saved or
 * imported deck, each with its legality/playability status; import by paste
 * (works everywhere) and by MarvelCDB URL/id (dev/preview only, behind the
 * same-origin route `vite-marvelcdb-import.ts` adds); save, delete, and a
 * link into the builder to make or edit one.
 *
 * The deck list is a long, potentially-growing list, so it follows the game
 * log's redraw-safe virtualized pattern (`view/log-view.ts` /
 * `scenes/board/log.ts`, generalized for uniform rows in
 * `view/list-scroll.ts`): this scene clears and rebuilds its whole display
 * list on every change (the Title/Game Over pattern), so the scroll position
 * lives in a `ListScroll` field that survives the sweep, and only the rows
 * currently on screen ever become live game objects or focus stops.
 *
 * Every legality/playability fact shown here is `@mc/engine`'s own
 * (`view/deck-list-model.ts`'s `deckOptionsOf`, `view/deck-status.ts` for the
 * chip's words) — this scene never decides whether a deck is legal.
 */

import Phaser from "phaser";
import { CORE_DEPS } from "@mc/cards";
import { CORE_CARDS, CORE_POOL_VERSION, parseMarvelCdbReference, type AnyCard, type Deck, type DeckId } from "@mc/content";
import { cardArt } from "../art/card-art.js";
import { importFromMarvelCdbResponseText, importFromPasteText, type ImportEnv, type ImportOutcome } from "../view/deck-import-model.js";
import { deckOptionsOf, type DeckOption } from "../view/deck-list-model.js";
import { deckStatusOf, type DeckStatusTone } from "../view/deck-status.js";
import { decksFocusOrder } from "../view/screen-focus.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { ListScroll, thumbOf } from "../view/list-scroll.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, McMultilineInput, McTextInput, fitText, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { deckStorage } from "../session.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** What a caller (Title, on an `illegal_deck` refusal) hands over on launch. */
export interface DecksSceneData {
  /** Scrolled into view and named in `message` — the deck `createGame` just refused. */
  readonly focusDeckId?: string | null;
  readonly message?: string | null;
}

const ROW_HEIGHT = 60;
const CARDS_BY_ID = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id as string, card]));

export class DecksScene extends Phaser.Scene {
  #savedDecks: readonly Deck[] = [];
  #scroll = new ListScroll();
  #data: DecksSceneData = {};
  /** The banner under the title. A success and a failure look different: an import that worked was drawn in error red. */
  #status: { readonly text: string; readonly tone: "success" | "error" } | null = null;
  #busy = false;
  #pasteText = "";
  #marvelcdbText = "";
  #pasteInput: McMultilineInput | null = null;
  #marvelcdbInput: McTextInput | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #listRect: Rect | null = null;
  #focusedOnce = false;

  constructor() {
    super(SCENES.decks);
  }

  create(data: DecksSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#data = data;
    // Title only sends a message here when a deck could not be seated.
    this.#status = data.message ? { text: data.message, tone: "error" } : null;
    this.#savedDecks = [];
    this.#scroll = new ListScroll();
    this.#busy = false;
    this.#pasteText = "";
    this.#marvelcdbText = "";
    this.#focusedOnce = false;

    const onResize = (): void => this.#rebuild();
    this.scale.on("resize", onResize, this);
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    this.input.on("wheel", this.#onWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      artOff();
      this.input.off("wheel", this.#onWheel, this);
      this.#pasteInput?.destroy();
      this.#pasteInput = null;
      this.#marvelcdbInput?.destroy();
      this.#marvelcdbInput = null;
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#pasteInput?.focused ?? false) || (this.#marvelcdbInput?.focused ?? false),
    });

    this.#rebuild();
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#savedDecks = decks;
        this.#rebuild();
      });
  }

  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(this.#savedDecks, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();

    // The two text fields survive the sweep: every object they draw with is
    // detached first and handed back after, in the same order. The paste field
    // is a rexUI sizer with children of its own in the display list, so its
    // root alone is not enough (`McMultilineInput.gameObjects`).
    const kept = [...(this.#pasteInput?.gameObjects ?? []), ...(this.#marvelcdbInput ? [this.#marvelcdbInput.gameObject] : [])];
    for (const node of kept) this.children.remove(node);
    this.children.removeAll(true);
    for (const node of kept) this.children.add(node);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const pad = phone ? 16 : 40;
    const column = Math.min(width - pad * 2, 720);
    const left = (width - column) / 2;
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    let y = pad;
    this.add.text(left, y, "DECKS", { ...textStyle(typeRole.screenTitle, surface.ink.hex), fontSize: phone ? "32px" : "44px" }).setLetterSpacing(2);
    const backRect: Rect = { x: left + column - 100, y: y + 4, width: 100, height: hit.target };
    const goBack = (): void => {
      this.scene.start(SCENES.title);
    };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "Back", type: typeRole.rowTitle, rect: backRect, onClick: goBack }));
    this.#stops.set("back", { rect: backRect, activate: goBack });
    y += (phone ? 32 : 44) + 16;

    if (this.#status) {
      const banner = this.add
        .text(left, y, this.#status.text, textStyle(typeRole.body, this.#status.tone === "error" ? accent.redDeep.hex : signal.heal.hex))
        .setWordWrapWidth(column);
      y += banner.height + 12;
    }

    // Import: paste always works; MarvelCDB by URL/id only where the
    // dev/preview same-origin route exists (PLAN.md Phase 9, "Decided
    // 2026-09-13" — a production build has no such route).
    label(this, left, y, "paste a decklist", typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const pasteRect: Rect = { x: left, y, width: column - 116, height: 110 };
    if (this.#pasteInput) this.#pasteInput.layout(pasteRect);
    else {
      this.#pasteInput = new McMultilineInput(this, {
        rect: pasteRect,
        value: this.#pasteText,
        placeholder: "Hero: Spider-Man\nAspect: Justice\n2x Web-Shooter\n...",
        onChange: (value) => {
          this.#pasteText = value;
        },
      });
    }
    this.#stops.set("paste-field", { rect: pasteRect, activate: () => this.#pasteInput?.focus() });
    const pasteImportRect: Rect = { x: left + column - 106, y, width: 106, height: hit.target };
    const doPasteImport = (): void => void this.#importPaste();
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: this.#busy ? "Importing…" : "Import", type: typeRole.rowTitle, rect: pasteImportRect, enabled: !this.#busy, onClick: doPasteImport }),
    );
    this.#stops.set("paste-import", { rect: pasteImportRect, activate: doPasteImport });
    y += 110 + 16;

    // Always shown, not gated on `import.meta.env.DEV`: `vite preview` serves
    // the same production bundle a real deploy would, so nothing at runtime
    // can tell the two apart, and the route exists in both dev and preview
    // (`vite-marvelcdb-import.ts`'s `configureServer`/`configurePreviewServer`).
    // A genuine production deploy 404s instead — the designed fallback, shown
    // as a message rather than by hiding the field ahead of time.
    const showMarvelCdbImport = true;
    if (showMarvelCdbImport) {
      label(this, left, y, "import from marvelcdb (by url or id)", typeRole.label, surface.ink.hex, ink.label);
      y += 16;
      const mcdbFieldRect: Rect = { x: left, y, width: column - 116, height: hit.target };
      if (this.#marvelcdbInput) this.#marvelcdbInput.layout(mcdbFieldRect);
      else {
        this.#marvelcdbInput = new McTextInput(this, {
          rect: mcdbFieldRect,
          value: this.#marvelcdbText,
          type: typeRole.mono,
          placeholder: "marvelcdb.com/decklist/view/1234/... or a bare id",
          onChange: (value) => {
            this.#marvelcdbText = value;
          },
        });
      }
      this.#stops.set("marvelcdb-field", { rect: mcdbFieldRect, activate: () => this.#marvelcdbInput?.focus() });
      const mcdbImportRect: Rect = { x: left + column - 106, y, width: 106, height: hit.target };
      const doMcdbImport = (): void => void this.#importMarvelCdb();
      this.#buttons.push(
        new McButton(this, { kind: "secondary", label: this.#busy ? "Importing…" : "Import", type: typeRole.rowTitle, rect: mcdbImportRect, enabled: !this.#busy, onClick: doMcdbImport }),
      );
      this.#stops.set("marvelcdb-import", { rect: mcdbImportRect, activate: doMcdbImport });
      y += hit.target + 16;
    }

    // Not the primary red: this is a management screen with no single forward
    // action ("one red per screen" — Title's "Start game" already owns it).
    const newDeckRect: Rect = { x: left, y, width: column, height: hit.target };
    const openBuilder = (): void => {
      this.scene.start(SCENES.deckBuilder, {} satisfies DeckBuilderSceneData);
    };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "New deck…", type: typeRole.rowTitle, rect: newDeckRect, onClick: openBuilder }));
    this.#stops.set("new-deck", { rect: newDeckRect, activate: openBuilder });
    y += hit.target + 20;

    // The deck list, virtualized: only the rows in `window` become game
    // objects or focus stops (see the module doc comment).
    const options = this.#deckOptions();
    if (!this.#focusedOnce && this.#data.focusDeckId) {
      const index = options.findIndex((option) => (option.deck.id as string) === this.#data.focusDeckId);
      if (index >= 0) this.#scroll.scrollBy(index, options.length, 1);
      this.#focusedOnce = true;
    }
    label(this, left, y, `decks — ${options.length}`, typeRole.label, surface.ink.hex, ink.label);
    y += 16;
    const listTop = y;
    const listHeight = Math.max(ROW_HEIGHT, height - listTop - pad);
    const listRect: Rect = { x: left, y: listTop, width: column, height: listHeight };
    this.#listRect = listRect;
    const rail = this.add.graphics();
    paintPanel(rail, listRect, "rail", "rest");

    const rowsVisible = Math.max(1, Math.floor((listRect.height - 8) / ROW_HEIGHT));
    const win = this.#scroll.windowFor(options.length, rowsVisible);
    const editableIds = new Set(options.filter((o) => o.deck.source.kind !== "precon").map((o) => o.deck.id as string));

    if (options.length === 0) {
      this.add.text(listRect.x + 10, listRect.y + 10, "No decks yet — import one above or build one.", textStyle(typeRole.body, surface.ink.hex, ink.meta));
    }

    let rowY = listRect.y + 4;
    for (let i = win.start; i < win.end; i++) {
      const option = options[i]!;
      this.#drawRow(left, rowY, column, option, editableIds.has(option.deck.id as string), this.#data.focusDeckId === (option.deck.id as string));
      rowY += ROW_HEIGHT;
    }

    const thumb = thumbOf(win, options.length);
    if (thumb) {
      const track: Rect = { x: listRect.x + listRect.width - 6, y: listRect.y, width: 3, height: listRect.height };
      const tg = this.add.graphics();
      tg.fillStyle(surface.ink.hex, 0.12).fillRect(track.x, track.y, track.width, track.height);
      tg.fillStyle(surface.ink.hex, 0.6).fillRect(track.x, track.y + thumb.top * track.height, track.width, Math.max(10, thumb.size * track.height));
    }

    const canScrollUp = win.start > 0;
    const canScrollDown = win.end < options.length;
    if (canScrollUp) {
      const upRect: Rect = { x: listRect.x, y: listRect.y - 2, width: listRect.width, height: 0 };
      this.#stops.set("scroll-up", { rect: { ...upRect, height: 4 }, activate: () => this.#scrollBy(-3, options.length, rowsVisible) });
    }
    if (canScrollDown) {
      const downRect: Rect = { x: listRect.x, y: listRect.y + listRect.height - 2, width: listRect.width, height: 4 };
      this.#stops.set("scroll-down", { rect: downRect, activate: () => this.#scrollBy(3, options.length, rowsVisible) });
    }

    this.#route?.set(
      decksFocusOrder({
        showMarvelCdbImport,
        visibleDeckIds: options.slice(win.start, win.end).map((o) => o.deck.id as string),
        editableDeckIds: editableIds,
        canScrollUp,
        canScrollDown,
      }),
      this.#stops,
    );
  }

  #drawRow(x: number, y: number, width: number, option: DeckOption, editable: boolean, focused: boolean): void {
    const rect: Rect = { x: x + 4, y, width: width - 8, height: ROW_HEIGHT - 6 };
    const g = this.add.graphics();
    paintPanel(g, rect, "card", focused ? "selected" : "rest");

    const status = deckStatusOf(option);
    const tone: Record<DeckStatusTone, number> = {
      legal: signal.heal.hex,
      illegal: accent.heroRed.hex,
      unscripted: signal.caution.hex,
      poolChanged: signal.cost.hex,
    };
    const name = this.add.text(rect.x + 10, rect.y + 6, option.deck.name, textStyle(typeRole.rowTitle, surface.ink.hex));
    fitText(name, rect.width - 160);
    const sourceText = option.deck.source.kind === "precon" ? "Precon" : option.deck.source.kind === "imported" ? "Imported" : "Built";
    this.add.text(rect.x + 10, rect.y + 6 + name.height + 2, `${sourceText} · ${option.identityName ?? "unknown identity"}`, textStyle(typeRole.label, surface.ink.hex, ink.meta));

    const chipText = label(this, 0, 0, status.text, typeRole.label, surface.paper.hex, 1);
    const chipWidth = Math.ceil(chipText.width) + 12;
    // A saved deck's Edit and Delete buttons take the row's right edge, so its
    // chip sits left of them — drawn at the edge, it was hidden under Edit.
    const chipRight = editable ? rect.x + rect.width - 130 - 8 : rect.x + rect.width - 10;
    const chipG = this.add.graphics();
    chipG.fillStyle(tone[status.tone], 1).fillRect(chipRight - chipWidth, rect.y + 8, chipWidth, 18);
    chipText.setPosition(chipRight - chipWidth + 6, rect.y + 17).setOrigin(0, 0.5);
    // Created before the chip so it could be measured, which left it under the
    // chip's fill: a status shown as colour alone. Above it, the words carry it.
    this.children.bringToTop(chipText);

    const openEdit = (): void => {
      this.scene.start(SCENES.deckBuilder, { deck: option.deck } satisfies DeckBuilderSceneData);
    };
    // Every row — precon included — gets a stop, so its identity can be read
    // with `I` even though a precon offers no Edit/Delete (the same "still
    // takes focus, still readable" rule Title gives a blocked hero seat).
    this.#stops.set(`deck:${option.deck.id as string}`, {
      rect,
      activate: editable ? openEdit : () => this.#inspect(option),
      inspect: () => this.#inspect(option),
    });
    if (!editable) return;

    const editRect: Rect = { x: rect.x + rect.width - 130, y: rect.y + rect.height - hit.target - 2, width: 60, height: hit.target };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "Edit", type: typeRole.label, rect: editRect, onClick: openEdit }));
    this.#stops.set(`deck:${option.deck.id as string}:edit`, { rect: editRect, activate: openEdit });

    const deleteRect: Rect = { x: rect.x + rect.width - 66, y: editRect.y, width: 60, height: hit.target };
    const doDelete = (): void => void this.#delete(option.deck.id);
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "Delete", type: typeRole.label, rect: deleteRect, onClick: doDelete }));
    this.#stops.set(`deck:${option.deck.id as string}:delete`, { rect: deleteRect, activate: doDelete });
  }

  #inspect(option: DeckOption): void {
    const card = CARDS_BY_ID.get(option.deck.identityCardId as string);
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    this.scene.launch(SCENES.inspect, {
      card: { cardId: option.deck.identityCardId, face },
      ...(option.blockedReason ? { note: option.blockedReason } : {}),
    });
  }

  #scrollBy(rows: number, count: number, rowsVisible: number): void {
    if (this.#scroll.scrollBy(rows, count, rowsVisible)) this.#rebuild();
  }

  #onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void {
    const rect = this.#listRect;
    if (!rect || pointer.x < rect.x || pointer.x > rect.x + rect.width || pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    const options = this.#deckOptions();
    const rowsVisible = Math.max(1, Math.floor((rect.height - 8) / ROW_HEIGHT));
    const lines = Math.trunc(dy / 40);
    if (lines !== 0) this.#scrollBy(lines, options.length, rowsVisible);
  }

  async #delete(id: DeckId): Promise<void> {
    await deckStorage().remove(id);
    this.#savedDecks = await deckStorage().list();
    this.#rebuild();
  }

  async #importPaste(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    this.#rebuild();
    const outcome = importFromPasteText(this.#pasteText, this.#importEnv());
    await this.#applyImport(outcome);
  }

  async #importMarvelCdb(): Promise<void> {
    if (this.#busy) return;
    const ref = parseMarvelCdbReference(this.#marvelcdbText);
    if (!ref) {
      this.#status = { text: "That doesn't look like a MarvelCDB deck link or id.", tone: "error" };
      this.#rebuild();
      return;
    }
    this.#busy = true;
    this.#rebuild();
    try {
      // The literal path has to match `MARVELCDB_IMPORT_ROUTE` in
      // `vite-marvelcdb-import.ts` (a root-level Vite plugin file, not part of
      // this `src/` bundle, so its constant isn't imported here) — a 404 on a
      // production build is the designed fallback, not a bug (see that file).
      const response = await fetch(`/api/marvelcdb-import/${ref.kind}/${ref.id}`);
      const text = await response.text();
      if (!response.ok) {
        // A production deploy has no `vite-marvelcdb-import.ts` route at all
        // (dev/preview only) and 404s here with no JSON body — the one case
        // this build genuinely cannot tell apart from "MarvelCDB has nothing
        // at that id", so it gets its own message naming the real cause.
        let message =
          response.status === 404
            ? "MarvelCDB import by link isn't available in this deployment (or MarvelCDB has nothing at that id). Paste the decklist instead."
            : `MarvelCDB import failed (HTTP ${response.status}).`;
        try {
          const body = JSON.parse(text) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* the fallback message above already covers a non-JSON error body */
        }
        this.#status = { text: message, tone: "error" };
        this.#busy = false;
        this.#rebuild();
        return;
      }
      const outcome = importFromMarvelCdbResponseText(text, ref, `https://marvelcdb.com/${ref.kind}/view/${ref.id}`, this.#importEnv());
      await this.#applyImport(outcome);
    } catch (cause) {
      this.#status = { text: cause instanceof Error ? cause.message : String(cause), tone: "error" };
      this.#busy = false;
      this.#rebuild();
    }
  }

  #importEnv(): ImportEnv {
    return { pool: CORE_CARDS, poolVersion: CORE_POOL_VERSION, now: () => new Date().toISOString(), newId: () => crypto.randomUUID() };
  }

  async #applyImport(outcome: ImportOutcome): Promise<void> {
    if (!outcome.ok) {
      this.#status = { text: outcome.problems.map((problem) => problem.message).join(" "), tone: "error" };
      this.#busy = false;
      this.#rebuild();
      return;
    }
    await deckStorage().put(outcome.deck);
    this.#pasteText = "";
    this.#pasteInput?.setValue("");
    this.#marvelcdbText = "";
    this.#marvelcdbInput?.setValue("");
    this.#status = { text: `Imported "${outcome.deck.name}".`, tone: "success" };
    this.#savedDecks = await deckStorage().list();
    this.#busy = false;
    this.#rebuild();
  }
}
