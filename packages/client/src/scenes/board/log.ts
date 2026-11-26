/**
 * The game log's large view: the lines of `view/log-lines.ts` in a Lit panel over the canvas (`@mc/ui`'s `mc-game-log`,
 * mounted with `dom/dom-region.ts`), with a close button and a "newer" chip while the player is reading back. It opens
 * from the title bar (`view/log-dock.ts`, issue #550), from the Board beside the table and from the villain phase
 * inside its own panel.
 *
 * The DOM does the list: native scrolling (a wheel, a trackpad, a finger drag), the browser skipping lines far from the
 * view, and following the newest line while the reader is at the bottom. What stays here is what the scene needs of
 * it: the panel's ground, the close button's glyph (`dom/sheet-glyphs.ts`), the close button's rect for the focus
 * route, the right stick's scroll and the focus ring round the panel (drawn in the DOM, since a Phaser ring would sit
 * under it).
 *
 * The log's own sentences (`view/log-lines.ts`) are English for now; the panel's words are translated (`log.*`).
 */

import type Phaser from "phaser";
import "@mc/ui";
import type { GameLogClose, McGameLog } from "@mc/ui";
import { DomRegion, renderNow } from "../../dom/dom-region.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { SheetBuilder } from "../../dom/sheet-builder.js";
import { SheetGlyphs } from "../../dom/sheet-glyphs.js";
import { t } from "../../i18n/translate.js";
import { onLanguageChange } from "../../language-change.js";
import { typeRole } from "../../tokens.js";
import { isDesktopType } from "../../ui/desktop-type.js";
import { addPressShield } from "../../ui/press-shield.js";
import { paintPanel } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { ShortcutId } from "../../view/input-shortcuts.js";
import type { LogType } from "../../view/log-dock.js";
import type { LogLine, LogState } from "../../view/log-lines.js";
import type { FocusRing } from "../focus-route.js";

const HEADER_HEIGHT = 50;
const CLOSE_WIDTH = 150;
const CLOSE_HEIGHT = 38;
const PAD_X = 16;

export interface LogPanelOptions {
  readonly type: LogType;
  /** The header's way out: what it says, and the press. */
  readonly closeLabel: string;
  readonly onClose: () => void;
  /** The shortcuts the close button's glyph shows on a keyboard or pad; null for none (a layout the glyphs don't fit). */
  readonly glyphIds: readonly ShortcutId[] | null;
}

export interface LogPanelConfig {
  /** Scenes drawn over only part of the screen, under which the log stays shown (`DomRegion`'s `shownUnder`). */
  readonly shownUnder?: readonly string[];
  /**
   * The box of the card hover popover while one is up, which a Phaser popover cannot be drawn over the panel for: it is
   * cut out of the panel (`DomRegion#setHoles`), as `scenes/rules.ts` does.
   */
  readonly hoverRect?: () => Rect | null;
}

/**
 * Whether two lists say the same, so an unchanged log does not make the panel render again (the villain phase builds
 * new line objects on every draw).
 */
function sameLines(a: readonly LogLine[], b: readonly LogLine[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((line, index) => {
    const other = b[index]!;
    return (
      line === other ||
      (line.id === other.id &&
        line.ref === other.ref &&
        line.text === other.text &&
        line.voice === other.voice &&
        line.tags.length === other.tags.length &&
        line.tags.every((tag, at) => tag.status === other.tags[at]!.status && tag.spent === other.tags[at]!.spent))
    );
  });
}

export class LogPanel {
  readonly #redraw: () => void;
  readonly #config: LogPanelConfig;
  #region: DomRegion<McGameLog> | null = null;
  #glyphs: SheetGlyphs | null = null;
  #ring: FocusRing | null = null;
  #scene: Phaser.Scene | null = null;
  #offLanguage: (() => void) | null = null;
  /** Where the panel was drawn last, or null while it isn't on screen (another phone tab). */
  #rect: Rect | null = null;
  #onClose: () => void = () => undefined;
  /** What the words and the close button were last set to, so a draw that changes nothing renders nothing. */
  #wordsKey = "";
  #closeKey = "";

  constructor(redraw: () => void, config: LogPanelConfig = {}) {
    this.#redraw = redraw;
    this.#config = config;
  }

  /** A new game: back to following the newest line. */
  reset(): void {
    this.#region?.element.scrollToLatest();
    this.hide();
  }

  /** The layout isn't showing the log this draw. */
  hide(): void {
    this.#rect = null;
    this.#glyphs?.reset();
    this.#region?.setHidden(true);
  }

  /** The right stick while the log has focus: `dy` pixels (positive scrolls toward the newest line). */
  onPadScroll(dy: number): void {
    if (!this.#rect) return;
    this.#region?.element.scroller?.scrollBy({ top: dy });
  }

  /** The controller's activate press on the log: down to the newest line if the chip is showing; false if not. */
  jumpToLatest(): boolean {
    return this.#rect !== null && (this.#region?.element.jumpToLatest() ?? false);
  }

  /**
   * The close button's box in game coordinates, for the focus route, or null while the panel is not shown. Read from
   * the DOM, as the button is drawn there.
   */
  closeRect(): Rect | null {
    const rect = this.#rect;
    const region = this.#region;
    if (!rect || !region) return null;
    renderNow(region.element);
    const button = region.element.closeButton;
    const read = button ? region.rectOf(button) : null;
    return read && read.width > 0 ? read : this.#closeRectOf(rect);
  }

  /** The focus ring round the whole panel (the log has no stop to ring), or none for `null`. */
  showRing(rect: Rect | null): void {
    const scene = this.#scene;
    if (!rect || !scene) {
      this.#ring?.hide();
      return;
    }
    this.#ring ??= domFocusRing(scene, undefined, new Set(this.#config.shownUnder ?? []));
    this.#ring.show(rect, "static", true);
  }

  #closeRectOf(rect: Rect): Rect {
    return {
      x: rect.x + rect.width - PAD_X - CLOSE_WIDTH,
      y: rect.y + (HEADER_HEIGHT - CLOSE_HEIGHT) / 2,
      width: CLOSE_WIDTH,
      height: CLOSE_HEIGHT,
    };
  }

  draw(scene: Phaser.Scene, rect: Rect, log: LogState, options: LogPanelOptions): void {
    this.#rect = rect;
    this.#onClose = options.onClose;
    // The ground stays in Phaser too: while the panel is hidden under a scene's scrim (the decision sheet), the dimmed
    // panel is still there rather than a hole in the table.
    const ground = scene.add.graphics();
    paintPanel(ground, rect, "rail", "rest");
    // Presses on the panel reach Phaser too (its listeners are on the window): nothing under it hears them.
    addPressShield(scene, rect);

    if (this.#scene !== scene) this.#mount(scene, rect);
    const region = this.#region!;
    region.setRect(rect);
    region.setHidden(false);
    // The panel rides the ground's entrance and exit (the villain phase slides its objects out), as an overlay's does.
    region.follow(ground);
    const glyphs = this.#glyphs!;

    const closeRect = this.#closeRectOf(rect);
    glyphs.reset();
    const builder = new SheetBuilder(scene.game, { x: rect.x, y: rect.y }, isDesktopType);
    if (options.glyphIds) {
      glyphs.button(builder, {
        key: "close",
        rect: closeRect,
        label: options.closeLabel,
        look: "quiet",
        type: { ...typeRole.label, size: 11 },
        ids: options.glyphIds,
        ground: "paper",
      });
    }
    const buttonNode = builder.nodes.find((node) => node.kind === "button");
    const glyphNode = builder.nodes.find((node) => node.kind === "glyph");
    const close: GameLogClose = {
      ...(buttonNode?.kind === "button" && buttonNode.labelShift ? { labelShift: buttonNode.labelShift } : {}),
      ...(buttonNode?.kind === "button" && buttonNode.still ? { still: true } : {}),
      ...(glyphNode?.kind === "glyph" ? { glyph: glyphNode } : {}),
    };

    const element = region.element;
    const words = {
      heading: t("log.title"),
      closeLabel: options.closeLabel,
      emptyText: t("log.empty"),
      newerLabel: t("log.newer"),
      latestLabel: t("log.latest"),
      statusNames: {
        stunned: t("log.status.stunned"),
        confused: t("log.status.confused"),
        tough: t("log.status.tough"),
      },
    };
    const wordsKey = JSON.stringify([words, options.type]);
    if (wordsKey !== this.#wordsKey) {
      this.#wordsKey = wordsKey;
      Object.assign(element, words);
      element.refSize = options.type.ref;
      element.bodySize = options.type.body;
    }
    const closeKey = JSON.stringify(close);
    if (closeKey !== this.#closeKey) {
      this.#closeKey = closeKey;
      element.close = close;
    }
    if (!sameLines(element.lines as readonly LogLine[], log.lines)) element.lines = log.lines;
  }

  /** The panel's DOM, made once per visit of the scene (its region goes with the scene). */
  #mount(scene: Phaser.Scene, rect: Rect): void {
    this.#teardown();
    this.#scene = scene;
    const region = new DomRegion(scene, document.createElement("mc-game-log"), rect, {
      ...(this.#config.shownUnder ? { shownUnder: this.#config.shownUnder } : {}),
    });
    this.#region = region;
    const hoverRect = this.#config.hoverRect;
    if (hoverRect)
      region.setHoles(() => {
        const hover = hoverRect();
        return hover ? [hover] : [];
      });
    // Phaser hears the mouse on the canvas only, which the panel covers: the card hover popover needs the moves.
    region.forwardMouseMoves();
    region.element.addEventListener("mc-activate", (event) => {
      if ((event as CustomEvent<{ key: string }>).detail.key === "close") this.#onClose();
    });
    this.#glyphs = new SheetGlyphs(scene, () => this.#redraw());
    this.#offLanguage = onLanguageChange(() => this.#redraw());
    const gone = (): void => {
      if (this.#scene === scene) this.#teardown();
    };
    scene.events.once("shutdown", gone);
    scene.events.once("destroy", gone);
  }

  #teardown(): void {
    this.#offLanguage?.();
    this.#offLanguage = null;
    this.#glyphs?.dispose();
    this.#glyphs = null;
    this.#ring?.destroy();
    this.#ring = null;
    this.#region?.destroy();
    this.#region = null;
    this.#scene = null;
    this.#rect = null;
    this.#wordsKey = "";
    this.#closeKey = "";
  }
}
