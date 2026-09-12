/**
 * The Inspect overlay: one card, whole.
 *
 * The table caps rules text at two lines on purpose (Components.dc.html section
 * 06, "numbers before prose"), which only works if the full wording is always
 * one gesture away. This is that gesture's destination, and it runs in parallel
 * over Board so the table stays visible behind the scrim.
 *
 * Two panels, from `Screens - Desktop` section 08:
 *  - the card itself on paper, with a 5px ink border: cost chip, name, type
 *    line, the scan, rules text, flavor, resource pips, set/collector footer;
 *  - "Rules & state" on ink: what the engine says about this card right now,
 *    its keywords and traits, and the one action that makes sense from here.
 *
 * Everything on the left comes from `@mc/content`; everything on the right
 * comes from the engine's `legalActions`. This scene decides nothing.
 */

import Phaser from "phaser";
import { CORE_DEPS } from "@mc/cards";
import type { InstanceId } from "@mc/engine";
import { cardArt, drawArt } from "../art/card-art.js";
import { appSession } from "../session.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, label, paintDotGrid } from "../ui/widgets.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { inspectModel, type InspectModel } from "../view/inspect-model.js";
import { SCENES } from "./keys.js";

/** What Board hands over when it launches this overlay. */
export interface InspectData {
  readonly instanceId: InstanceId;
  /** Cards the ◂ ▸ keys step through — the hand, when inspect was opened from it. */
  readonly siblings?: readonly InstanceId[];
}

export class InspectOverlay extends Phaser.Scene {
  #instanceId: InstanceId | null = null;
  #siblings: readonly InstanceId[] = [];
  #buttons: McButton[] = [];
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super({ key: SCENES.inspect });
  }

  create(data: InspectData): void {
    this.#instanceId = data.instanceId;
    this.#siblings = data.siblings ?? [];

    const { store } = appSession();
    this.#unsubscribe = store.subscribe(() => this.#rebuild());
    this.scale.on("resize", () => this.#rebuild(), this);
    // A scan that arrives while the sheet is open should appear in it.
    const artOff = cardArt(this).onArrived(() => this.#rebuild());

    this.input.keyboard?.on("keydown-ESC", () => this.#close());
    this.input.keyboard?.on("keydown-LEFT", () => this.#step(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.#step(1));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      artOff();
    });
    this.#rebuild();
  }

  #close(): void {
    this.scene.stop();
  }

  /** ◂ ▸ through whatever list the overlay was opened from. */
  #step(direction: number): void {
    if (this.#siblings.length < 2 || !this.#instanceId) return;
    const at = this.#siblings.indexOf(this.#instanceId);
    if (at < 0) return;
    const next = this.#siblings[(at + direction + this.#siblings.length) % this.#siblings.length];
    if (next) {
      this.#instanceId = next;
      this.#rebuild();
    }
  }

  #rebuild(): void {
    const { store } = appSession();
    const state = store.state;
    if (!state.game || state.perspectiveId === null || !this.#instanceId) return;

    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);

    const model = inspectModel(state.game, this.#instanceId, state.legal?.actions ?? null, state.perspectiveId, CORE_DEPS);

    const { width, height } = this.scale.gameSize;
    // The scrim is a dismiss target as well as a scrim: the design says "click
    // anywhere to dismiss", so the whole backdrop takes the tap.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.9).fillRect(0, 0, width, height);
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk).setAlpha(0.7);
    this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerup", () => this.#close());

    // Phone stacks the two panels; anything wider sets them side by side.
    const narrow = formFactorFor(width, height) === "phone" || width < 900;
    const gap = narrow ? 10 : 26;
    const pad = narrow ? 12 : 40;
    const cardWidth = narrow ? width - pad * 2 : Math.min(400, (width - pad * 2 - gap) * 0.48);
    const cardHeight = Math.min(height - pad * 2, narrow ? (height - pad * 2) * 0.62 : 660);
    const sideWidth = narrow ? width - pad * 2 : Math.min(440, width - pad * 2 - gap - cardWidth);

    const cardRect: Rect = narrow
      ? { x: pad, y: pad, width: cardWidth, height: cardHeight }
      : {
          x: (width - (cardWidth + gap + sideWidth)) / 2,
          y: (height - cardHeight) / 2,
          width: cardWidth,
          height: cardHeight,
        };
    const sideRect: Rect = narrow
      ? { x: pad, y: cardRect.y + cardRect.height + gap, width: sideWidth, height: height - pad - (cardRect.y + cardRect.height + gap) }
      : { x: cardRect.x + cardWidth + gap, y: cardRect.y, width: sideWidth, height: cardHeight };

    this.#drawCard(cardRect, model);
    this.#drawRulesAndState(sideRect, model);

    const hint =
      this.#siblings.length > 1
        ? "◂ previous · next ▸ · esc or tap anywhere to dismiss"
        : "esc or tap anywhere to dismiss";
    label(this, width / 2, height - 20, hint, typeRole.label, surface.paper.hex, ink.meta).setOrigin(0.5);

    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex, 0));
  }

  /** The card face: everything `@mc/content` prints on it. */
  #drawCard(rect: Rect, model: InspectModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(5, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    // The sheet swallows taps so dismissing needs the scrim, not the card.
    this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();

    // Header: cost chip, name, type line.
    const headerHeight = 62;
    let nameLeft = rect.x + 14;
    if (model.cost !== null) {
      const chip: Rect = { x: rect.x + 5, y: rect.y + 5, width: 54, height: headerHeight - 5 };
      const chipG = this.add.graphics();
      chipG.fillStyle(signal.cost.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
      this.add
        .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(model.cost), {
          ...textStyle(typeRole.screenTitle, surface.paper.hex),
          fontSize: "40px",
        })
        .setOrigin(0.5);
      nameLeft = chip.x + chip.width + 12;
    }
    this.add
      .text(nameLeft, rect.y + 12, caseOf(typeRole.barTitle, model.name), {
        ...textStyle(typeRole.barTitle, surface.ink.hex),
        fontSize: `${Math.min(32, Math.max(20, Math.round(rect.width / 13)))}px`,
      })
      .setLetterSpacing(1)
      .setWordWrapWidth(rect.x + rect.width - 12 - nameLeft)
      .setMaxLines(1);
    label(this, nameLeft, rect.y + 46, model.typeLine, typeRole.label, surface.ink.hex, ink.label);
    const rule = this.add.graphics();
    rule.fillStyle(surface.ink.hex, 1).fillRect(rect.x + 5, rect.y + headerHeight, rect.width - 10, 4);

    // Footer first, so the art and the body know where they end.
    const footerTop = rect.y + rect.height - 28;
    const footRule = this.add.graphics();
    footRule.fillStyle(surface.ink.hex, 1).fillRect(rect.x + 5, footerTop, rect.width - 10, 4);
    label(this, rect.x + 14, footerTop + 12, model.footerLeft, typeRole.label, surface.ink.hex, ink.label);
    label(this, rect.x + rect.width - 14, footerTop + 12, model.footerRight, typeRole.label, surface.ink.hex, ink.label).setOrigin(1, 0);

    // Body: the text decides how much room is left for the scan, not the other
    // way round — a card whose whole point is its wording must show it all.
    const bodyWidth = rect.width - 28;
    const measure = this.add
      .text(-10000, -10000, model.rulesText, textStyle(typeRole.body, surface.ink.hex))
      .setWordWrapWidth(bodyWidth)
      .setFontSize(14);
    const textHeight = measure.height + (model.flavor ? 28 : 0) + (model.printedText ? 46 : 0) + (model.resourceIcons.length ? 30 : 0) + (model.stats.length ? 34 : 0);
    measure.destroy();

    const artTop = rect.y + headerHeight + 4;
    const artHeight = Math.max(0, Math.min(rect.height * 0.42, footerTop - artTop - textHeight - 20));
    const artBottom = artTop + artHeight;
    if (artHeight > 40) {
      const band: Rect = { x: rect.x + 5, y: artTop, width: rect.width - 10, height: artHeight };
      const frame = this.add.graphics();
      frame.fillStyle(surface.parchment.hex, 1).fillRect(band.x, band.y, band.width, band.height);
      const key = cardArt(this).request(this, model.art);
      if (!drawArt(this, key, band, { focusY: 0.3 })) {
        label(this, band.x + band.width / 2, band.y + band.height / 2, model.hidden ? "facedown" : "no scan", typeRole.label, surface.ink.hex, ink.meta).setOrigin(0.5);
      }
      const bandRule = this.add.graphics();
      bandRule.fillStyle(surface.ink.hex, 1).fillRect(band.x, band.y + band.height, band.width, 4);
    }

    let y = artBottom + 12;
    if (model.stats.length > 0) {
      const statLine = model.stats.map((tile) => `${tile.label} ${tile.value}`).join("  ·  ");
      this.add.text(rect.x + 14, y, statLine, textStyle(typeRole.stat, surface.ink.hex)).setLetterSpacing(1);
      y += 30;
    }
    const body = this.add
      .text(rect.x + 14, y, model.rulesText, textStyle(typeRole.body, surface.ink.hex))
      .setFontSize(14)
      .setWordWrapWidth(bodyWidth);
    y += body.height + 10;

    if (model.printedText) {
      // Errata: the card in hand no longer says what the cardboard says.
      label(this, rect.x + 14, y, "printed text (superseded by errata)", typeRole.label, accent.redDeep.hex, ink.body);
      const printed = this.add
        .text(rect.x + 14, y + 14, model.printedText, textStyle(typeRole.body, surface.ink.hex, ink.meta))
        .setWordWrapWidth(bodyWidth)
        .setMaxLines(3);
      y += printed.height + 22;
    }
    if (model.flavor) {
      const flavor = this.add
        .text(rect.x + 14, y, model.flavor, textStyle(typeRole.body, surface.ink.hex, ink.meta))
        .setWordWrapWidth(bodyWidth)
        .setMaxLines(2);
      y += flavor.height + 8;
    }
    if (model.resourceIcons.length > 0 && y < footerTop - 24) {
      model.resourceIcons.forEach((icon, index) => {
        const box: Rect = { x: rect.x + 14 + index * 22, y, width: 18, height: 18 };
        const pip = this.add.graphics();
        pip.fillStyle(signal.cost.hex, 1).fillRect(box.x, box.y, box.width, box.height);
        this.add
          .text(box.x + box.width / 2, box.y + box.height / 2, icon.charAt(0).toUpperCase(), textStyle(typeRole.label, surface.paper.hex))
          .setOrigin(0.5);
      });
      label(
        this,
        rect.x + 18 + model.resourceIcons.length * 22,
        y + 5,
        `generates ${model.resourceIcons.join(", ")} when spent`,
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
    }
  }

  /** "Rules & state": the engine's verdict, the keywords, the one useful action. */
  #drawRulesAndState(rect: Rect, model: InspectModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(5, surface.paper.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive();

    this.add
      .text(rect.x + 18, rect.y + 16, "RULES & STATE", textStyle(typeRole.barTitle, surface.paper.hex))
      .setLetterSpacing(1);
    this.add
      .text(rect.x + rect.width - 18, rect.y + 20, "ESC", textStyle(typeRole.label, surface.paper.hex))
      .setOrigin(1, 0)
      .setLetterSpacing(typeRole.label.letterSpacing)
      .setPadding(6, 4, 6, 4);

    let y = rect.y + 52;
    const inner = rect.width - 36;

    // "Right now" — the engine's own sentence, in the design's red callout.
    if (model.status.message) {
      label(this, rect.x + 18, y, "right now", typeRole.label, surface.paper.hex, ink.meta);
      y += 16;
      const text = this.add
        .text(rect.x + 30, y + 10, model.status.message, textStyle(typeRole.body, surface.paper.hex))
        .setFontSize(12)
        .setWordWrapWidth(inner - 24);
      const box: Rect = { x: rect.x + 18, y, width: inner, height: text.height + 20 };
      const callout = this.add.graphics();
      callout.fillStyle(accent.heroRed.hex, 0.2).fillRect(box.x, box.y, box.width, box.height);
      callout.lineStyle(3, accent.heroRed.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
      // The graphics were added after the text, so put the text back on top.
      this.children.bringToTop(text);
      y += box.height + 18;
    }
    if (model.status.targets.length > 0) {
      label(this, rect.x + 18, y, "legal targets", typeRole.label, surface.paper.hex, ink.meta);
      const targets = this.add
        .text(rect.x + 18, y + 16, model.status.targets.join(" · "), textStyle(typeRole.body, surface.paper.hex, ink.secondary))
        .setWordWrapWidth(inner);
      y += 16 + targets.height + 16;
    }

    y = this.#chips(rect, y, inner, "keywords on this card", model.keywords);
    y = this.#chips(rect, y, inner, "traits", model.traits);

    // One action, and only when the engine has already said it is legal.
    if (model.status.playable === true) {
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Play it",
          type: typeRole.barTitle,
          rect: { x: rect.x + 18, y: rect.y + rect.height - hit.primary - 16, width: inner, height: hit.primary },
          onClick: () => {
            const instanceId = this.#instanceId;
            this.#close();
            if (instanceId) this.game.events.emit("mc-play-card", instanceId);
          },
        }),
      );
    }
  }

  /** A labeled row of outlined chips, as the design draws keywords. Returns the next y. */
  #chips(rect: Rect, top: number, inner: number, heading: string, items: readonly string[]): number {
    if (items.length === 0) return top;
    label(this, rect.x + 18, top, heading, typeRole.label, surface.paper.hex, ink.meta);
    let x = rect.x + 18;
    let y = top + 16;
    for (const item of items) {
      const text = this.add
        .text(x + 8, y + 5, caseOf(typeRole.label, item), textStyle(typeRole.label, surface.paper.hex))
        .setLetterSpacing(typeRole.label.letterSpacing);
      const chipWidth = text.width + 16;
      if (x + chipWidth > rect.x + 18 + inner) {
        x = rect.x + 18;
        y += 28;
        text.setPosition(x + 8, y + 5);
      }
      const chip = this.add.graphics();
      chip.lineStyle(2, surface.paper.hex, 1).strokeRect(x, y, chipWidth, 22);
      this.children.bringToTop(text);
      x += chipWidth + 7;
    }
    return y + 40;
  }
}
