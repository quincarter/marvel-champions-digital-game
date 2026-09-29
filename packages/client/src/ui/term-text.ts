/**
 * `McTermText` (guided mode G3b, `docs/guided-mode.md` §4): body copy with inline glossary terms,
 * each drawn with a dotted underline and backed by a hit area — hover-to-open on desktop, tap-to-open
 * on touch, both driven by `onTermOpen`/`onTermClose` (the caller owns the actual `McTooltip`, so one
 * tooltip instance can be shared across several `McTermText` blocks on the same screen).
 *
 * **Layout.** There's no Phaser rich-text object that mixes plain and decorated runs in one string, so
 * this lays words out itself: `view/term-text-model.ts` parses `[[id]]` / `[[id|label]]` markup into
 * text/term runs, this widget splits every text run on whitespace (keeping each word's own trailing
 * space, so a wrapped line never carries a stray leading gap) and a term run into one atomic word (a
 * term is never split mid-label), then greedily wraps at `width`, one `Phaser.GameObjects.Text` per
 * word — all one style (body/`typeRole.body`), so wrapping only ever needs to compare plain widths.
 *
 * **Touch hit height** (`tokens.ts`'s `hit.target`, 44px): a term's own line is body-sized (well under
 * 44px), so its zone is centered on the word but grown to at least `hit.target` tall, overlapping into
 * the line above/below rather than shrinking the type to fit a touch target.
 *
 * **Keyboard path.** `focusNext`/`activateFocused`/`blur` are a self-contained Tab-among-terms/Enter-
 * opens loop for a host that hasn't wired this block into a screen's own `focusOrder` yet (`view/focus.ts`)
 * — the dev demo (`scenes/term-text-demo.ts`) drives it directly. G4a, embedding this in the guide
 * callout, should fold these into the callout's own focus order instead of calling them itself; they're
 * kept here so this widget is independently testable-by-hand before that screen exists.
 */
import Phaser from "phaser";
import { border, hit, ink, typeRole, type TypeSpec } from "../tokens.js";
import { termTextModelOf, type TermTextTerm } from "../view/term-text-model.js";
import type { RulesEntry } from "../view/rules-reference.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";

interface Word {
  readonly kind: "word";
  readonly text: string;
  readonly term: TermTextTerm | null;
}

/** A forced line break between words — `view/term-text-model.ts`'s `TermTextBreak`, carried through layout. */
interface Break {
  readonly kind: "break";
  readonly paragraph: boolean;
}

type Token = Word | Break;

/** Splits a text run on whitespace, each word keeping its own trailing space (a leading pure-whitespace run becomes its own "word", dropped if it would open a line). */
function wordsOf(text: string): readonly Word[] {
  const words: Word[] = [];
  for (const match of text.matchAll(/\S+\s*|\s+/g)) words.push({ kind: "word", text: match[0], term: null });
  return words;
}

interface TermZone {
  readonly term: TermTextTerm;
  readonly rect: Rect;
  readonly zone: Phaser.GameObjects.Zone;
}

export interface McTermTextOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** Markup source — see `view/term-text-model.ts`'s header for the `[[id]]` / `[[id|label]]` syntax. */
  readonly text: string;
  readonly typeSpec?: TypeSpec;
  readonly color?: number;
  readonly alpha?: number;
  readonly lookup?: ReadonlyMap<string, RulesEntry>;
  readonly devMode?: boolean;
  /** A term opened (hover-in on desktop, tap on touch, or keyboard activate): draw a tooltip anchored at this rect, in this scene's own coordinates. */
  readonly onTermOpen: (term: TermTextTerm, anchorRect: Rect) => void;
  /** The open term should close (pointer-out, tapping the same term again, or losing keyboard focus). */
  readonly onTermClose: () => void;
}

/** Body text with dotted-underlined glossary terms, wrapped at a given width. */
export class McTermText {
  readonly container: Phaser.GameObjects.Container;
  readonly #scene: Phaser.Scene;
  readonly #objects: Phaser.GameObjects.GameObject[] = [];
  readonly #termZones: TermZone[] = [];
  readonly #focusRing: Phaser.GameObjects.Graphics;
  readonly #options: McTermTextOptions;
  #focusIndex = -1;
  #openTermId: string | null = null;
  #height = 0;

  constructor(scene: Phaser.Scene, options: McTermTextOptions) {
    this.#scene = scene;
    this.#options = options;
    this.container = scene.add.container(0, 0);
    this.#focusRing = scene.add.graphics();
    this.#objects.push(this.#focusRing);
    this.#layout(options);
    this.container.add(this.#objects);
  }

  /** The block's own measured height, once wrapped — a caller lays out whatever follows at `y + height`. */
  get height(): number {
    return this.#height;
  }

  #layout(options: McTermTextOptions): void {
    const spec = options.typeSpec ?? typeRole.body;
    const color = options.color ?? 0x14110e;
    const alpha = options.alpha ?? ink.body;
    const model = termTextModelOf(options.text, options.lookup, options.devMode);
    const tokens: Token[] = [];
    for (const run of model.runs) {
      if (run.kind === "text") tokens.push(...wordsOf(run.text));
      else if (run.kind === "term") tokens.push({ kind: "word", text: run.label, term: run });
      else tokens.push({ kind: "break", paragraph: run.paragraph });
    }

    const lineHeight = Math.round(spec.size * spec.lineHeight * 1.4);
    const paragraphGap = Math.round(lineHeight * 0.6);
    let x = 0;
    let y = 0;
    for (const token of tokens) {
      if (token.kind === "break") {
        x = 0;
        y += lineHeight + (token.paragraph ? paragraphGap : 0);
        continue;
      }
      const word = token;
      const isBlank = word.term === null && word.text.trim() === "";
      const label = this.#scene.add.text(0, 0, word.text, textStyle(spec, color, alpha));
      const wordWidth = label.width;
      if (isBlank && x === 0) {
        label.destroy();
        continue;
      }
      if (x + wordWidth > options.width && x > 0) {
        x = 0;
        y += lineHeight;
        if (isBlank) {
          label.destroy();
          continue;
        }
      }
      label.setPosition(options.x + x, options.y + y);
      this.#objects.push(label);
      if (word.term) {
        this.#addTerm(word.term, label, options.x + x, options.y + y, wordWidth);
      }
      x += wordWidth;
    }
    this.#height = y + lineHeight;
  }

  #addTerm(term: TermTextTerm, label: Phaser.GameObjects.Text, x: number, y: number, width: number): void {
    const underline = this.#scene.add.graphics();
    const color = this.#options.color ?? 0x14110e;
    dottedUnderline(underline, x, y + label.height - 1, width, color);
    this.#objects.push(underline);

    const rect: Rect = { x, y, width, height: label.height };
    const zoneHeight = Math.max(hit.target, rect.height);
    const zone = this.#scene.add
      .zone(rect.x, rect.y + rect.height / 2 - zoneHeight / 2, Math.max(width, 1), zoneHeight)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.#objects.push(zone);
    this.#termZones.push({ term, rect, zone });

    // Desktop hover-in opens; closing on hover-out is `McTooltip`'s own job (its module header explains why
    // it can't be this zone's `pointerout` — a covered zone can fire that before the pointer ever reaches
    // the tooltip's own "RULES GLOSSARY ▸" link).
    zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return;
      this.#open(term, rect);
    });
    zone.on("pointerup", () => {
      if (this.#openTermId === term.id) {
        this.#close();
      } else {
        this.#open(term, rect);
      }
    });
  }

  #open(term: TermTextTerm, rect: Rect): void {
    this.#openTermId = term.id;
    this.#options.onTermOpen(term, this.#worldRect(rect));
  }

  /**
   * A term's rect is laid out local to `this.container`'s own frame (`#addTerm`'s `x`/`y` are relative
   * to the constructor's `options.x`/`options.y`, not the screen) — every real caller repositions that
   * container as a whole once its host (a guide callout, the desktop rail) knows its final on-screen
   * box (`body.container.setPosition(...)`), so a term opened *after* that move sits somewhere the
   * container isn't. `onTermOpen`'s contract promises a rect "in this scene's own coordinates", so this
   * converts through the container's actual world transform (translation today, but this stays correct
   * if a future host ever nests or scales it) rather than leaving every caller to remember the offset
   * by hand — a `McTooltip` anchored at the un-converted rect was found opening near the screen's top
   * whenever the callout/rail had moved its body container down the page.
   */
  #worldRect(rect: Rect): Rect {
    const matrix = this.container.getWorldTransformMatrix();
    const topLeft = matrix.transformPoint(rect.x, rect.y);
    const bottomRight = matrix.transformPoint(rect.x + rect.width, rect.y + rect.height);
    return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
  }

  /**
   * Enables/disables every term zone this block owns for which `keep(id)` is false — used while a shared
   * `McTooltip` is open so a term whose hit area happens to sit *underneath* the open tooltip (the tooltip
   * draws on top, but a zone it visually covers is still hit-testable unless disabled) can't steal the
   * pointer away from the tooltip's own "RULES GLOSSARY ▸" link, and can't reopen a different term's
   * tooltip out from under a mouse only passing over that covered area on its way to the link. The host
   * (`onTermOpen`'s caller, coordinating every `McTermText` block sharing one tooltip) calls this with
   * `keep: (id) => id === openTerm.id` on open and `keep: () => true` on close.
   */
  setTermsEnabled(keep: (id: string) => boolean): void {
    for (const { term, zone } of this.#termZones) {
      if (keep(term.id)) zone.setInteractive({ useHandCursor: true });
      else zone.disableInteractive();
    }
  }

  #close(): void {
    this.#openTermId = null;
    this.#options.onTermClose();
  }

  /** Every term this block resolved, in reading order — the count `focusNext` cycles over. */
  get termCount(): number {
    return this.#termZones.length;
  }

  /** Every term's own id and on-screen rect, for a headless click-through driving real pointer events against canvas-drawn terms (`scenes/term-text-demo.ts`'s dev-only hook). */
  debugTermRects(): readonly { readonly id: string; readonly rect: Rect }[] {
    return this.#termZones.map((zone) => ({ id: zone.term.id, rect: zone.rect }));
  }

  /**
   * Moves keyboard focus to the next (or, `direction: -1`, previous) term, drawing a focus ring around
   * it, and returns whether there was one to focus (false when this block has no terms at all).
   */
  focusNext(direction: 1 | -1 = 1): boolean {
    if (this.#termZones.length === 0) return false;
    this.#focusIndex = (this.#focusIndex + direction + this.#termZones.length) % this.#termZones.length;
    this.#drawFocusRing();
    return true;
  }

  /** Opens the tooltip for whichever term keyboard focus is currently on, if any. */
  activateFocused(): void {
    const zone = this.#termZones[this.#focusIndex];
    if (zone) this.#open(zone.term, zone.rect);
  }

  /** Clears keyboard focus and its ring, without closing an already-open tooltip. */
  blur(): void {
    this.#focusIndex = -1;
    this.#focusRing.clear();
  }

  #drawFocusRing(): void {
    this.#focusRing.clear();
    const zone = this.#termZones[this.#focusIndex];
    if (!zone) return;
    this.#focusRing
      .lineStyle(border.control, 0x14110e, 1)
      .strokeRect(zone.rect.x - 2, zone.rect.y - 2, zone.rect.width + 4, zone.rect.height + 4);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

/** A dotted horizontal rule under a term — the design's dash rhythm (`border.dashSegment`/`border.dashGap`), one line rather than a whole rect. */
function dottedUnderline(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, color: number): void {
  const step = border.dashSegment + border.dashGap;
  g.lineStyle(1.5, color, 1);
  for (let at = 0; at < width; at += step) {
    const end = Math.min(at + border.dashSegment, width);
    g.lineBetween(x + at, y, x + end, y);
  }
}
