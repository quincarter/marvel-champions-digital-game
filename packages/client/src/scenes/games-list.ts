/**
 * "In-progress games" as a full-screen overlay over the Title (device sync, #276): the phone has no spare height for
 * the art-panel list a desktop Title draws, so its "In-progress games (N)" menu row opens this instead. Same list,
 * same rows (`ui/games-list.ts`): tap a game to resume it, Remove (after a question) to retire it. The close button and
 * Escape (or B) go back to the Title; Escape while the question is up answers "Keep it" first.
 *
 * The Title owns resuming, so a tapped row hands the save back through `onResume` after this closes.
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, paintDotGrid } from "../ui/widgets.js";
import { drawGamesList } from "../ui/games-list.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { dotGrid } from "../tokens.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { appSession } from "../session.js";
import { onSyncApplied } from "../sync/sync-events.js";
import { GAME_LABEL_NAMES } from "../view/game-label-names.js";
import { gameRowsOf, type GameRow } from "../view/games-list-model.js";
import type { Rect } from "../view/layout.js";
import { gamesListFocusOrder } from "../view/screen-focus.js";
import { setupMetrics } from "../view/setup-metrics.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface GamesListOverlayData {
  /** The scene that opened this: its pointer input is off while this is up. */
  readonly from: string;
  readonly saves: readonly SaveMeta[];
  /** A row was tapped: this has closed, the Title resumes the game. */
  readonly onResume: (save: SaveMeta) => void;
  /** The list changed (a game was removed): the Title refreshes what it shows. */
  readonly onChanged: () => void;
}

export class GamesListOverlay extends Phaser.Scene {
  #data!: GamesListOverlayData;
  #saves: readonly SaveMeta[] = [];
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #scroll = new VariableListScroll();
  #confirming: string | null = null;
  #busy = false;
  #error: string | null = null;

  constructor() {
    super(SCENES.gamesList);
  }

  create(data: GamesListOverlayData): void {
    this.#data = data;
    this.#saves = data.saves;
    this.#confirming = null;
    this.#busy = false;
    this.#scroll = new VariableListScroll();
    const from = this.scene.get(data.from);
    if (from) from.input.enabled = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#cancel() });
    // Games a device sync brought in or took away while the list is open.
    const unsubscribeSync = onSyncApplied(() => {
      if (!this.sys.isActive()) return;
      void appSession()
        .store.activeSaves()
        .then((saves) => {
          if (!this.sys.isActive()) return;
          this.#saves = saves;
          if (this.#confirming !== null && !saves.some((save) => save.id === this.#confirming)) this.#confirming = null;
          this.#draw();
        });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeSync();
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) from.input.enabled = true;
    });
    this.#draw();
  }

  #cancel(): void {
    if (this.#confirming !== null) {
      this.#confirming = null;
      this.#error = null;
      this.#draw();
      return;
    }
    this.scene.stop();
  }

  #rows(): readonly GameRow[] {
    return gameRowsOf(this.#saves, GAME_LABEL_NAMES, Date.now());
  }

  async #remove(row: GameRow): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    this.#error = null;
    this.#draw();
    try {
      await appSession().store.retireSave(row.id);
      this.#confirming = null;
    } catch (cause) {
      this.#error = `Could not remove it: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    this.#busy = false;
    this.#saves = await appSession().store.activeSaves();
    this.#data.onChanged();
    if (this.sys.isActive()) this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const { pad } = setupMetrics(width, height);
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    const stops = new Map<string, FocusStop>();
    const rows = this.#rows();
    const paper = surface.paper.hex;
    this.add.text(pad, pad + 4, `IN-PROGRESS GAMES (${rows.length})`, textStyle(typeRole.pageTitle, paper));
    const closeRect: Rect = { x: width - pad - hit.target, y: pad, width: hit.target, height: hit.target };
    const close = (): void => void this.scene.stop();
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "✕",
        type: typeRole.menuButton,
        rect: closeRect,
        onClick: close,
      }),
    );
    stops.set("close", { rect: closeRect, activate: close });

    const top = pad + hit.target + 12;
    const columnWidth = Math.min(width - pad * 2, 560);
    const area: Rect = { x: (width - columnWidth) / 2, y: top, width: columnWidth, height: height - top - pad };
    const confirming = this.#confirming === null ? null : (rows.find((row) => row.id === this.#confirming) ?? null);
    if (rows.length === 0) {
      this.add.text(area.x, area.y + 8, "No games in progress.", textStyle(typeRole.body, paper, 0.8)).setFontSize(16);
    } else {
      const confirmArea = confirming ? { ...area, height: Math.min(area.height, 240) } : area;
      const drawn = drawGamesList(this, {
        area: confirmArea,
        rows,
        scroll: this.#scroll,
        confirming,
        enabled: !this.#busy,
        error: this.#error,
        onResume: (row) => {
          this.scene.stop();
          this.#data.onResume(row.save);
        },
        onAskRemove: (row) => {
          this.#confirming = row.id;
          this.#draw();
        },
        onKeep: () => this.#cancel(),
        onRemove: (row) => void this.#remove(row),
      });
      this.#buttons.push(...drawn.buttons);
      for (const [key, stop] of drawn.stops) stops.set(key, stop);
    }
    this.#route?.set(
      [
        ...(confirming ? [] : ["close"]),
        ...gamesListFocusOrder(
          rows.map((row) => row.id),
          confirming !== null,
        ),
      ],
      stops,
    );
  }
}
