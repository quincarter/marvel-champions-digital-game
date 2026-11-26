import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "../mc-button/mc-button.js";
import "../mc-glyph/mc-glyph.js";
import { tapped } from "../../shared/tapped.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { SheetGlyph } from "../mc-sheet/mc-sheet.js";
import { McGameLogStyles } from "./mc-game-log.styles.js";

/** Whose beat a line was: the rule down its left edge. */
export type GameLogVoice = "player" | "villain" | "scenario" | "win" | "loss";

/** A status a line gave or took off, as a chip; `spent` once it has been used up (struck through and faded). */
export interface GameLogTag {
  readonly status: string;
  readonly spent: boolean;
}

/** One line of the log, as the client's `view/log-lines.ts` words it. */
export interface GameLogLine {
  readonly id: string;
  /** The beat reference over the line ("R3.5"). */
  readonly ref: string;
  readonly text: string;
  readonly voice: GameLogVoice;
  readonly tags: readonly GameLogTag[];
}

/** The close button's glyph (the key or pad button the shortcut shows) and how its word makes room, from `SheetGlyphs`. */
export interface GameLogClose {
  readonly labelShift?: number;
  readonly still?: boolean;
  readonly glyph?: SheetGlyph;
}

/** How near the bottom counts as at the bottom: sub-pixel scroll positions and the scrollbar's rounding. */
const BOTTOM_SLACK_PX = 6;

/**
 * # Game log
 * The game log's large view (a docked panel beside the table, or the villain phase's own panel): a header with the
 * title and a quiet close button, then every line of the log in a natively scrolling list. It follows the newest line
 * while the reader is at the bottom; scrolled up, an ink "N newer" chip at the foot says how much is below and a tap
 * on it goes back down. Lines far from the screen are skipped by the browser (`content-visibility`), so a log of a few
 * hundred lines stays cheap. Nothing but the close button and the chip is a control, and both take a tap only (press
 * and release on them, nothing scrolled between), so a swipe that lifts over them fires nothing.
 *
 * Every word comes in as a property, already translated.
 *
 * @element mc-game-log
 * @fires mc-activate - `detail.key` is "close": the close button was tapped.
 */
export class McGameLog extends LitElement {
  static override styles = [ThemeStyles, McGameLogStyles];

  static override properties: PropertyDeclarations = {
    lines: { attribute: false },
    heading: { type: String },
    closeLabel: { type: String },
    emptyText: { type: String },
    newerLabel: { type: String },
    latestLabel: { type: String },
    statusNames: { attribute: false },
    refSize: { type: Number },
    bodySize: { type: Number },
    close: { attribute: false },
    _behind: { state: true },
    _newer: { state: true },
  };

  declare lines: readonly GameLogLine[];
  /** The header's title (not `title`: that is the element's own tooltip). */
  declare heading: string;
  declare closeLabel: string;
  declare emptyText: string;
  /** The chip while reading back: "▼ {count} newer · latest". */
  declare newerLabel: string;
  /** The chip when nothing is below the view: "▼ latest". */
  declare latestLabel: string;
  /** The status chips' words, by status name. */
  declare statusNames: Readonly<Record<string, string>>;
  /** The ref's and the lines' px sizes (the client's `logTypeFor`). */
  declare refSize: number;
  declare bodySize: number;
  declare close: GameLogClose;
  declare _behind: boolean;
  declare _newer: number;
  #following = true;
  /** The first line in view and how far below the list's top it was, before lines changed under a reader. */
  #place: { readonly id: string; readonly offset: number } | null = null;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.lines = [];
    this.heading = "";
    this.closeLabel = "";
    this.emptyText = "";
    this.newerLabel = "";
    this.latestLabel = "";
    this.statusNames = {};
    this.refSize = 13;
    this.bodySize = 18;
    this.close = {};
    this._behind = false;
    this._newer = 0;
  }

  /** The scrolling list, for the right stick (`scrollBy`) and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector(".scroller");
  }

  /** The close button, for the focus route's rect. */
  get closeButton(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-button.close");
  }

  /** Whether the list follows the newest line (the reader is at the bottom). */
  get following(): boolean {
    return this.#following;
  }

  /** Back down to the newest line, and following it again. */
  scrollToLatest(): void {
    const scroller = this.scroller;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    this.#following = true;
    this._behind = false;
    this._newer = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A line measured after it first showed (the browser skips far lines until then) must not leave a following list
    // above the bottom.
    if (typeof ResizeObserver !== "undefined") {
      this.#resize = new ResizeObserver(() => {
        if (this.#following) this.scrollToLatest();
      });
      const list = this.renderRoot.querySelector(".list");
      if (list) this.#resize.observe(list);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  override firstUpdated(): void {
    const list = this.renderRoot.querySelector(".list");
    if (list) this.#resize?.observe(list);
    this.scrollToLatest();
  }

  /**
   * Reading back, the place is kept by hand (no scroll anchoring in WebKit): the first line in view and its distance
   * from the top are noted before lines change (new ones at the foot, old ones trimmed from the top) and put back after.
   */
  override willUpdate(changed: PropertyValues): void {
    this.#place = null;
    const scroller = this.scroller;
    if (!changed.has("lines") || !this.hasUpdated || this.#following || !scroller) return;
    for (const line of scroller.querySelectorAll<HTMLElement>(".line")) {
      if (line.offsetTop + line.offsetHeight >= scroller.scrollTop) {
        this.#place = { id: line.dataset.id ?? "", offset: line.offsetTop - scroller.scrollTop };
        return;
      }
    }
  }

  override updated(changed: PropertyValues): void {
    this.#fitTitle();
    if (!changed.has("lines")) return;
    if (this.#following) {
      this.scrollToLatest();
      return;
    }
    const scroller = this.scroller;
    const place = this.#place;
    if (scroller && place) {
      for (const line of scroller.querySelectorAll<HTMLElement>(".line")) {
        if (line.dataset.id === place.id) {
          scroller.scrollTop = line.offsetTop - place.offset;
          break;
        }
      }
    }
    this.#measure();
  }

  /** The title shrinks (to a floor) so it never runs under the close button, as Phaser's fitText did. */
  #fitTitle(): void {
    const box = this.renderRoot.querySelector<HTMLElement>("header h2");
    const word = box?.firstElementChild as HTMLElement | null;
    if (!box || !word || box.clientWidth === 0) return;
    word.style.fontSize = "";
    let size = 26;
    while (word.scrollWidth > box.clientWidth && size > 14) {
      size -= 1;
      word.style.fontSize = `${size}px`;
    }
  }

  readonly #onScroll = (): void => this.#measure();

  /** Reads where the reader is: at the bottom follows the newest line; above it shows the chip and how much is below. */
  #measure(): void {
    const scroller = this.scroller;
    if (!scroller) return;
    const below = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    this.#following = below <= BOTTOM_SLACK_PX;
    this._behind = !this.#following;
    this._newer = this.#following ? 0 : this.#linesBelow(scroller);
  }

  /** How many lines start below the visible part. */
  #linesBelow(scroller: HTMLElement): number {
    const edge = scroller.scrollTop + scroller.clientHeight;
    const lines = scroller.querySelectorAll<HTMLElement>(".line");
    let count = 0;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (lines[index]!.offsetTop < edge) break;
      count += 1;
    }
    return count;
  }

  readonly #press = (): void => {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key: "close" }, bubbles: true, composed: true }));
  };

  override render() {
    const { glyph } = this.close;
    return html`<div class="frame" style=${`--ref:${this.refSize}px;--body:${this.bodySize}px`}>
      <header>
        <h2 class="display"><span>${this.heading}</span></h2>
        <mc-button
          class="close"
          kind="quiet"
          style=${`--mc-button-size:var(--mc-small-11, 11px);--mc-label-shift:${this.close.labelShift ?? 0}px`}
          .label=${this.closeLabel}
          ?still=${this.close.still ?? false}
          @mc-press=${this.#press}
        ></mc-button>
        ${
          glyph
            ? html`<mc-glyph
                style=${`left:${glyph.x}px;top:${glyph.y - glyph.height / 2}px`}
                .specs=${glyph.specs}
                .height=${glyph.height}
                .ground=${glyph.ground}
                .openness=${glyph.openness}
                ?still=${glyph.still ?? false}
              ></mc-glyph>`
            : nothing
        }
      </header>
      <div class="scroller" @scroll=${this.#onScroll}>
        <div class="list">
          ${
            this.lines.length === 0
              ? html`<p class="empty">${this.emptyText}</p>`
              : repeat(
                  this.lines,
                  (line) => line.id,
                  (line) => this.#line(line),
                )
          }
        </div>
      </div>
      ${
        this._behind
          ? html`<div class="newer" ${tapped(() => this.scrollToLatest())}>
              ${this._newer > 0 ? this.newerLabel.replace("{count}", String(this._newer)) : this.latestLabel}
            </div>`
          : nothing
      }
    </div>`;
  }

  #line(line: GameLogLine) {
    return html`<article class="line" data-id=${line.id} data-voice=${line.voice}>
      <div class="ref">${line.ref}</div>
      <p class="text">${line.text}</p>
      ${
        line.tags.length > 0
          ? html`<div class="tags">
              ${line.tags.map(
                (tag) =>
                  html`<span class="tag" data-status=${tag.status} ?data-spent=${tag.spent}
                    >${this.statusNames[tag.status] ?? tag.status}</span
                  >`,
              )}
            </div>`
          : nothing
      }
    </article>`;
  }
}
