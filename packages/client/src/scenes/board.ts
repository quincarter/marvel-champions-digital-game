/**
 * The Board: the table itself.
 *
 * This scene draws `BoardModel` and `Highlights` and nothing else. It holds no
 * game state, makes no legality decision, and computes no stat — it subscribes
 * to the store, asks the view models what to show, and sends every command back
 * through the store's single `dispatch` (PLAN.md Phase 4, "Phaser is a view,
 * never an authority").
 *
 * Interaction follows the design: tapping an action-bar button with targets
 * enters target-select mode (the button inverts to red), the valid targets
 * pulse, and everything not targetable drops to 35–42% rather than being
 * hidden, so the board never reflows mid-decision.
 */

import Phaser from "phaser";
import { CORE_DEPS } from "@mc/cards";
import type { ResourceIconType } from "@mc/content";
import type { Command, InstanceId, LegalAction } from "@mc/engine";
import { cardArt, drawArt, type ArtFit, type CardArt } from "../art/card-art.js";
import type { ArtSource } from "../art/art-source.js";
import { appSession } from "../session.js";
import { accent, dotGrid, hit, ink, signal, status as statusTokens, surface, threatMeter, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, McSelectionRing, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { boardModel, type BoardModel, type CharacterPanel, type HandCardView, type SchemePanel } from "../view/board-model.js";
import { highlights, type BasicAction, type Highlights, type IllegalReason } from "../view/highlights.js";
import { appendEvents, emptyLog, type LogState } from "../view/log-lines.js";
import { boardLayout, cardRow, type BoardLayout, type Rect } from "../view/layout.js";
import type { SessionState } from "../store/session-store.js";
import { SCENES } from "./keys.js";

/** What the player has picked so far, when an action needs a target. */
type Selection =
  | { readonly kind: "idle" }
  /** An action-bar button or a hand card is chosen; now pick what it aims at. */
  | { readonly kind: "targeting"; readonly action: LegalAction; readonly prompt: string };

export class BoardScene extends Phaser.Scene {
  #unsubscribe: (() => void) | null = null;
  #model: BoardModel | null = null;
  #marks: Highlights | null = null;
  #layout: BoardLayout | null = null;
  #log: LogState = emptyLog();
  #selection: Selection = { kind: "idle" };
  #buttons: McButton[] = [];
  #rings: McSelectionRing[] = [];
  /** Card rect by instance id, so a target tap can be hit-tested and ringed. */
  #hitRects = new Map<InstanceId, Rect>();
  #version = -1;
  #choiceOpen = false;
  /** Card scans, shared with every overlay above this scene. */
  #artCache: CardArt | null = null;
  #artUnsubscribe: (() => void) | null = null;

  get #art(): CardArt {
    this.#artCache ??= cardArt(this);
    return this.#artCache;
  }

  constructor() {
    super(SCENES.board);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    const { store } = appSession();
    this.#unsubscribe = store.subscribe((state) => this.#onState(state));
    this.scale.on("resize", () => this.#draw(), this);
    // A scan arrives after the frame that asked for it, so the board redraws
    // once per batch rather than holding the table back on the network.
    this.#artUnsubscribe = this.#art.onArrived(() => this.#draw());
    // The Inspect overlay's "Play it" comes back here, because playing a card
    // is the board's job: the overlay only ever reports what the engine said.
    this.game.events.on("mc-play-card", this.#onInspectPlay, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
      this.#artUnsubscribe?.();
      this.#artUnsubscribe = null;
      this.game.events.off("mc-play-card", this.#onInspectPlay, this);
    });
  }

  #onState(state: SessionState): void {
    if (!state.game || state.perspectiveId === null) return;

    // Fold this command's events onto the log before the state replaces it.
    if (state.version !== this.#version) {
      this.#log = appendEvents(this.#log, state.lastEvents, state.game, state.perspectiveId);
      this.#version = state.version;
      // A new state invalidates any half-made selection: the engine may have
      // changed what is legal, and a stale target would just be rejected.
      this.#selection = { kind: "idle" };
    }

    this.#model = boardModel(state.game, state.perspectiveId, CORE_DEPS);
    this.#marks = state.legal ? highlights(state.legal.actions) : null;

    if (state.game.outcome) {
      this.scene.start(SCENES.gameOver);
      return;
    }
    this.#syncChoiceOverlay(state);
    this.#draw();
  }

  /**
   * The pending-choice overlay runs in parallel over this scene, so the board
   * stays visible underneath while a decision is open.
   */
  #syncChoiceOverlay(state: SessionState): void {
    const open = state.game?.pendingChoice != null;
    if (open && !this.#choiceOpen) {
      this.#choiceOpen = true;
      this.scene.launch(SCENES.choice);
    } else if (!open && this.#choiceOpen) {
      this.#choiceOpen = false;
      this.scene.stop(SCENES.choice);
    }
  }

  #draw(): void {
    const model = this.#model;
    if (!model) return;

    for (const button of this.#buttons) button.destroy();
    for (const ring of this.#rings) ring.destroy();
    this.#buttons = [];
    this.#rings = [];
    this.#hitRects.clear();
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const layout = boardLayout({ x: 0, y: 0, width, height }, {
      playerCount: model.team.length + 1,
      ...(this.#layout?.activeTab ? { activeTab: this.#layout.activeTab } : {}),
    });
    this.#layout = layout;

    // The table felt, and nothing else.
    paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk);

    this.#drawChrome(layout.zones.chrome!, model);
    if (layout.zones.threat) this.#drawSchemes(layout.zones.threat, model);
    if (layout.zones.enemies) this.#drawEnemies(layout.zones.enemies, model);
    if (layout.zones.encounter) this.#drawEncounter(layout.zones.encounter, model);
    if (layout.zones.log) this.#drawLog(layout.zones.log);
    if (layout.zones.me) this.#drawIdentity(layout.zones.me, model);
    if (layout.zones.playArea) this.#drawPlayArea(layout.zones.playArea, model);
    if (layout.zones.team) this.#drawTeam(layout.zones.team, model);
    this.#drawHand(layout.zones.hand!, model);
    this.#drawActionBar(layout.zones.actionBar!, model);
    this.#drawTargetRings();
  }

  /** Round chip, phase toggle and the current step, on the ink chrome bar. */
  #drawChrome(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

    // The live round chip is the one red besides the forward action.
    const chip: Rect = { x: rect.x + 10, y: rect.y + 6, width: 62, height: rect.height - 12 };
    const chipG = this.add.graphics();
    chipG.fillStyle(accent.heroRed.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
    this.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, `RD ${model.round}`, textStyle(typeRole.statSmall, surface.paper.hex))
      .setOrigin(0.5);

    // Two-state phase toggle: whichever side's clock is running is filled.
    const toggleX = chip.x + chip.width + 12;
    (["player", "villain"] as const).forEach((phase, index) => {
      const box: Rect = { x: toggleX + index * 86, y: chip.y, width: 82, height: chip.height };
      const active = model.phase === phase;
      const bg = this.add.graphics();
      bg.fillStyle(active ? surface.paper.hex : surface.ink.hex, 1).fillRect(box.x, box.y, box.width, box.height);
      bg.lineStyle(2, surface.paper.hex, active ? 1 : ink.meta).strokeRect(box.x, box.y, box.width, box.height);
      this.add
        .text(box.x + box.width / 2, box.y + box.height / 2, phase.toUpperCase(), textStyle(typeRole.label, active ? surface.ink.hex : surface.paper.hex, active ? 1 : ink.meta))
        .setOrigin(0.5)
        .setLetterSpacing(typeRole.label.letterSpacing);
    });

    this.add
      .text(toggleX + 190, rect.y + rect.height / 2, model.stepLabel, textStyle(typeRole.emphasis, surface.paper.hex, ink.secondary))
      .setOrigin(0, 0.5);

    if (model.firstPlayerId === model.perspectiveId) {
      this.add
        .text(rect.x + rect.width - 12, rect.y + rect.height / 2, "1ST PLAYER", textStyle(typeRole.label, signal.caution.hex))
        .setOrigin(1, 0.5)
        .setLetterSpacing(typeRole.label.letterSpacing);
    }
  }

  #drawSchemes(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "card", "rest");
    let y = rect.y + 10;

    y = this.#drawScheme({ x: rect.x + 10, y, width: rect.width - 20, height: 92 }, model.mainScheme);
    for (const side of model.sideSchemes.slice(0, 3)) {
      y = this.#drawScheme({ x: rect.x + 10, y: y + 6, width: rect.width - 20, height: 52 }, side);
    }
  }

  /**
   * A scheme with the design's threat meter: fill is always Hero Red. The art
   * sits in a column on the left with a 3px rule beside it, which is how the
   * Long Table canvas frames a scheme.
   */
  #drawScheme(rect: Rect, scheme: SchemePanel): number {
    this.#hitRects.set(scheme.instanceId, rect);
    const g = this.add.graphics();
    paintPanel(g, rect, "card", this.#targetState(scheme.instanceId));

    const dim = this.#dimAlpha(scheme.instanceId);
    // The art column only earns its place when the panel is wide enough that
    // the name and the meter still fit beside it.
    const artWidth = rect.width >= 220 ? Math.round(Math.min(96, rect.width * 0.3)) : 0;
    if (artWidth > 0) {
      const column: Rect = { x: rect.x + 3, y: rect.y + 3, width: artWidth, height: rect.height - 6 };
      const frame = this.add.graphics();
      frame.fillStyle(surface.parchment.hex, dim).fillRect(column.x, column.y, column.width, column.height);
      const key = this.#art.request(this, scheme.art);
      if (!drawArt(this, key, column, { alpha: dim, focusY: 0.3 })) {
        label(this, column.x + column.width / 2, column.y + column.height / 2, "art", typeRole.label, surface.ink.hex, ink.meta * dim).setOrigin(0.5);
      }
      const rule = this.add.graphics();
      rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
    }

    const textLeft = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
    const textWidth = rect.x + rect.width - 8 - textLeft;
    this.add
      .text(textLeft, rect.y + 6, scheme.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
      .setWordWrapWidth(textWidth)
      .setMaxLines(2);
    label(this, textLeft, rect.y + 30, scheme.subtitle, typeRole.label, surface.ink.hex, ink.label * dim);

    const meter: Rect = { x: textLeft, y: rect.y + rect.height - 26, width: textWidth, height: 18 };
    const mg = this.add.graphics();
    mg.fillStyle(surface.parchment.hex, dim).fillRect(meter.x, meter.y, meter.width, meter.height);
    if (scheme.target && scheme.target > 0) {
      const ratio = Math.min(1, scheme.threat / scheme.target);
      mg.fillStyle(threatMeter.fill.hex, dim).fillRect(meter.x, meter.y, meter.width * ratio, meter.height);
    }
    mg.lineStyle(2, surface.ink.hex, dim).strokeRect(meter.x, meter.y, meter.width, meter.height);
    this.add
      .text(
        meter.x + meter.width / 2,
        meter.y + meter.height / 2,
        scheme.target === null ? `${scheme.threat} THREAT` : `${scheme.threat} / ${scheme.target} THREAT`,
        textStyle(typeRole.statSmall, surface.ink.hex, dim),
      )
      .setOrigin(0.5);

    this.#makeTapTarget(rect, scheme.instanceId);
    return rect.y + rect.height;
  }

  #drawEnemies(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "card", "rest");

    const villainRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: Math.min(280, rect.width - 20), height: 128 };
    this.#drawCharacter(villainRect, model.villain);

    const minionTop = villainRect.y + villainRect.height + 8;
    const minionArea: Rect = {
      x: rect.x + 10,
      y: minionTop,
      width: rect.width - 20,
      height: Math.max(0, rect.y + rect.height - minionTop - 10),
    };
    if (model.minions.length > 0 && minionArea.height > 40) {
      const slots = cardRow(minionArea, model.minions.length, { gap: 8, maxHeight: minionArea.height });
      model.minions.forEach((minion, index) => this.#drawCharacter(slots[index]!, minion));
    }
  }

  /**
   * The design's entity card: an art band, then name + status, then a stat
   * triplet in 2px boxes (Components.dc.html, "Art band, then name + status,
   * then consequence, then a stat triplet"). A panel too short for a band
   * drops it rather than squeezing it — the compact variant in the same sheet.
   */
  #drawCharacter(rect: Rect, panel: CharacterPanel): void {
    this.#hitRects.set(panel.instanceId, rect);
    const dim = this.#dimAlpha(panel.instanceId);
    const g = this.add.graphics();
    paintPanel(g, rect, "card", this.#targetState(panel.instanceId));

    // Reserve what the text below the band actually needs: two lines of
    // heading plus the stat row. Whatever is left over is the art.
    const textNeeded = (panel.stats.length > 0 ? 34 : 8) + 34;
    const bandHeight = Math.max(0, Math.min(Math.round(rect.height * 0.46), rect.height - textNeeded));
    let top = rect.y + 6;
    if (bandHeight >= 24) {
      const band: Rect = { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: bandHeight };
      this.#drawArtBand(band, panel.art, dim);
      top = band.y + band.height + 5;
    }

    this.add
      .text(rect.x + 8, top, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
      .setWordWrapWidth(rect.width - 16)
      .setMaxLines(1);
    label(this, rect.x + 8, top + 15, panel.subtitle, typeRole.label, surface.ink.hex, ink.label * dim);

    // Status pips: initial only, in the hue that exists nowhere else. They sit
    // over the art band, as the design's STUNNED/TOUGH badges do.
    panel.statuses.forEach(({ status }, index) => {
      const pip: Rect = { x: rect.x + rect.width - 26 - index * 24, y: rect.y + 6, width: 20, height: 20 };
      const pg = this.add.graphics();
      pg.fillStyle(statusTokens[status].hex, dim).fillRect(pip.x, pip.y, pip.width, pip.height);
      pg.lineStyle(3, surface.ink.hex, dim).strokeRect(pip.x, pip.y, pip.width, pip.height);
      this.add
        .text(pip.x + pip.width / 2, pip.y + pip.height / 2, status.charAt(0).toUpperCase(), textStyle(typeRole.statSmall, surface.ink.hex, dim))
        .setOrigin(0.5);
    });

    if (panel.exhausted) {
      label(this, rect.x + rect.width - 8, top, "exhausted", typeRole.label, signal.spent.hex, ink.meta * dim).setOrigin(1, 0);
    }
    if (panel.boostCount > 0) {
      label(this, rect.x + rect.width - 8, top + 15, `boost ?? ×${panel.boostCount}`, typeRole.label, surface.ink.hex, ink.meta * dim).setOrigin(1, 0);
    }

    // Stat tiles, in 2px inner boxes.
    const tiles = panel.stats;
    if (tiles.length > 0) {
      const boxWidth = (rect.width - 16 - (tiles.length - 1) * 4) / tiles.length;
      tiles.forEach((tile, index) => {
        const box: Rect = {
          x: rect.x + 8 + index * (boxWidth + 4),
          y: rect.y + rect.height - 30,
          width: boxWidth,
          height: 24,
        };
        const bg = this.add.graphics();
        bg.lineStyle(2, surface.ink.hex, dim).strokeRect(box.x, box.y, box.width, box.height);
        label(this, box.x + 3, box.y + 2, tile.label, typeRole.label, surface.ink.hex, ink.label * dim);
        this.add
          .text(box.x + box.width - 3, box.y + box.height - 4, tile.value, textStyle(typeRole.statSmall, surface.ink.hex, dim))
          .setOrigin(1, 1);
      });
    }

    this.#makeTapTarget(rect, panel.instanceId);
  }

  /**
   * One art slot: the scan when it has arrived, and the designed fallback
   * frame when it hasn't. The frame is drawn either way as the ground, so a
   * scan that loads mid-game just paints over its own placeholder — there is
   * never a hole where a picture is about to be.
   */
  #drawArtBand(band: Rect, source: ArtSource | null, dim: number, fit: ArtFit = "cover"): void {
    const frame = this.add.graphics();
    frame.fillStyle(surface.parchment.hex, dim).fillRect(band.x, band.y, band.width, band.height);

    const key = this.#art.request(this, source);
    const image = drawArt(this, key, band, { fit, alpha: dim });
    if (!image && band.height >= 30) {
      // The design's empty art slot: dashed, so it reads as "not filled yet".
      label(this, band.x + band.width / 2, band.y + band.height / 2, "art", typeRole.label, surface.ink.hex, ink.meta * dim).setOrigin(0.5);
    }
    // A 3px ink rule closes the band, which is the design's whole depth model here.
    const rule = this.add.graphics();
    rule.fillStyle(surface.ink.hex, dim).fillRect(band.x, band.y + band.height, band.width, 3);
  }

  #drawEncounter(rect: Rect, model: BoardModel): void {
    const half = (rect.height - 6) / 2;
    const piles: readonly [string, number, number][] = [
      ["ENC DECK", model.encounterPiles.deck, rect.y],
      ["DISCARD", model.encounterPiles.discard, rect.y + half + 6],
    ];
    for (const [name, count, y] of piles) {
      const box: Rect = { x: rect.x, y, width: rect.width, height: half };
      const g = this.add.graphics();
      paintPanel(g, box, count > 0 ? "card" : "quiet", count > 0 ? "rest" : "unavailable");
      label(this, box.x + 6, box.y + 6, name, typeRole.label, surface.ink.hex, ink.label);
      this.add
        .text(box.x + box.width / 2, box.y + box.height / 2 + 6, String(count), textStyle(typeRole.stat, surface.ink.hex))
        .setOrigin(0.5);
    }
  }

  /** The game log, virtualized: only the lines that fit exist as objects. */
  #drawLog(rect: Rect): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    label(this, rect.x + 6, rect.y + 5, "LOG", typeRole.label, surface.ink.hex, ink.label);

    const lineHeight = 26;
    const capacity = Math.max(0, Math.floor((rect.height - 24) / lineHeight));
    const visible = this.#log.lines.slice(-capacity);
    visible.forEach((line, index) => {
      const y = rect.y + 22 + index * lineHeight;
      label(this, rect.x + 6, y, line.ref, typeRole.mono, surface.ink.hex, ink.meta);
      this.add
        .text(rect.x + 6, y + 11, line.text, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setWordWrapWidth(rect.width - 12)
        // Two lines on the table at most; the rest is one tap away in Inspect.
        .setMaxLines(1);
    });
  }

  #drawIdentity(rect: Rect, model: BoardModel): void {
    this.#drawCharacter(rect, model.me);
  }

  #drawPlayArea(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    label(this, rect.x + 8, rect.y + 6, "your play area", typeRole.label, surface.ink.hex, ink.label);

    const inner: Rect = { x: rect.x + 8, y: rect.y + 22, width: rect.width - 16, height: rect.height - 30 };
    if (model.myPlayArea.length === 0) {
      // A dashed slot: present, not yet filled.
      const empty = this.add.graphics();
      paintPanel(empty, inner, "quiet", "unavailable");
      this.add
        .text(inner.x + inner.width / 2, inner.y + inner.height / 2, "Play a card to put it here", textStyle(typeRole.body, surface.ink.hex, ink.meta))
        .setOrigin(0.5);
      return;
    }
    const slots = cardRow(inner, model.myPlayArea.length, { gap: 8, maxHeight: inner.height });
    model.myPlayArea.forEach((panel, index) => this.#drawCharacter(slots[index]!, panel));
  }

  #drawTeam(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    paintPanel(g, rect, "rail", "rest");
    label(this, rect.x + 8, rect.y + 6, "other heroes", typeRole.label, surface.ink.hex, ink.label);

    const rowHeight = Math.min(58, (rect.height - 28) / Math.max(1, model.team.length));
    model.team.forEach((seat, index) => {
      const row: Rect = { x: rect.x + 8, y: rect.y + 24 + index * (rowHeight + 4), width: rect.width - 16, height: rowHeight };
      const rg = this.add.graphics();
      paintPanel(rg, row, "card", seat.eliminated ? "unavailable" : "rest");
      const alpha = seat.eliminated ? ink.illegal : 1;
      this.add.text(row.x + 6, row.y + 5, seat.name, textStyle(typeRole.rowTitle, surface.ink.hex, alpha));
      label(
        this,
        row.x + 6,
        row.y + 22,
        `${seat.form === "hero" ? "Hero" : "Alter-ego"} · ${seat.hp ? `${seat.hp.current}/${seat.hp.max} HP` : "—"} · ${seat.handCount} cards`,
        typeRole.label,
        surface.ink.hex,
        ink.label * alpha,
      );
      if (seat.done) {
        label(this, row.x + row.width - 40, row.y + 5, "done", typeRole.label, signal.heal.hex, ink.body);
      }
      if (seat.isFirstPlayer) {
        label(this, row.x + row.width - 40, row.y + 22, "1st", typeRole.label, signal.caution.hex, ink.body);
      }
    });
  }

  #drawHand(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    label(
      this,
      rect.x + 10,
      rect.y + 4,
      `hand ${model.hand.length} · deck ${model.myPiles.deck} · discard ${model.myPiles.discard}`,
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );

    const inner: Rect = { x: rect.x + 10, y: rect.y + 20, width: rect.width - 20, height: rect.height - 28 };
    const slots = cardRow(inner, model.hand.length, { gap: 6, maxHeight: inner.height });

    model.hand.forEach((card, index) => {
      const slot = slots[index];
      if (!slot) return;
      this.#hitRects.set(card.instanceId, slot);
      this.#drawHandCard(slot, card);
    });
  }

  /**
   * One card in hand, in the Long Table canvas's layout: a header strip of cost
   * chip + name + type line, an art band, the rules text, then the resource
   * pips the card generates when spent. An illegal card keeps its place at 38%
   * ink and carries the engine's own reason as a badge ("dim, don't hide").
   */
  #drawHandCard(slot: Rect, card: HandCardView): void {
    const playable = this.#marks?.playable.has(card.instanceId) ?? false;
    const alpha = playable ? 1 : ink.illegal;
    const cg = this.add.graphics();
    paintPanel(cg, slot, "card", playable ? "rest" : "unavailable");

    // Header strip: a Bangers cost chip against the name and type line.
    const headerHeight = Math.min(30, Math.max(22, Math.round(slot.height * 0.2)));
    const header: Rect = { x: slot.x + 3, y: slot.y + 3, width: slot.width - 6, height: headerHeight };
    let nameLeft = header.x + 4;
    if (card.cost !== null) {
      const chip: Rect = { x: header.x, y: header.y, width: 20, height: header.height };
      const chipG = this.add.graphics();
      chipG.fillStyle(signal.cost.hex, alpha).fillRect(chip.x, chip.y, chip.width, chip.height);
      this.add
        .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(card.cost), textStyle(typeRole.statSmall, surface.paper.hex, alpha))
        .setOrigin(0.5);
      nameLeft = chip.x + chip.width + 4;
    }
    this.add
      .text(nameLeft, header.y + 1, card.name, textStyle(typeRole.rowTitle, surface.ink.hex, alpha))
      .setWordWrapWidth(header.x + header.width - nameLeft)
      .setMaxLines(1);
    label(this, nameLeft, header.y + 15, card.typeLine, typeRole.label, surface.ink.hex, ink.label * alpha);
    const headerRule = this.add.graphics();
    headerRule.fillStyle(surface.ink.hex, alpha).fillRect(header.x, header.y + header.height, header.width, 2);

    // Art band, then whatever is left for rules text and pips.
    const pipRow = card.resourceIcons.length > 0 ? 14 : 0;
    const bodyTop = header.y + header.height + 2;
    const bodyHeight = slot.y + slot.height - 3 - bodyTop - pipRow;
    const bandHeight = Math.max(0, Math.min(Math.round(slot.height * 0.36), bodyHeight - 22));
    let textTop = bodyTop + 3;
    if (bandHeight >= 20) {
      this.#drawArtBand({ x: slot.x + 3, y: bodyTop, width: slot.width - 6, height: bandHeight }, card.art, alpha);
      textTop = bodyTop + bandHeight + 5;
    }
    this.add
      .text(slot.x + 5, textTop, card.rulesText, textStyle(typeRole.body, surface.ink.hex, ink.secondary * alpha))
      .setWordWrapWidth(slot.width - 10)
      // Capped on the table; Inspect carries the full wording.
      .setMaxLines(Math.max(1, Math.floor((slot.y + slot.height - pipRow - 4 - textTop) / 15)));

    // The icons this card generates when it is spent as a resource. The design
    // draws them as squares, not dots — a resource is a thing you hand over.
    // One colour for every resource, with the type carried by a glyph rather
    // than a hue: the palette has one "resource" signal, and an indicator must
    // never rely on colour alone (PLAN.md Phase 4, accessibility).
    card.resourceIcons.forEach((icon, iconIndex) => {
      const box: Rect = { x: slot.x + 6 + iconIndex * 15, y: slot.y + slot.height - 15, width: 12, height: 12 };
      if (box.x + box.width > slot.x + slot.width - 4) return;
      const pip = this.add.graphics();
      pip.fillStyle(signal.cost.hex, alpha).fillRect(box.x, box.y, box.width, box.height);
      this.add
        .text(box.x + box.width / 2, box.y + box.height / 2, RESOURCE_GLYPH[icon], textStyle(typeRole.label, surface.paper.hex, alpha))
        .setOrigin(0.5);
    });

    // "ALTER-EGO ONLY", "CAN'T AFFORD" — the engine's own reason, shortened to
    // a tag. The full sentence is one tap away in Inspect.
    const reason = this.#marks?.unplayable.get(card.instanceId);
    if (reason && slot.width >= 70) {
      const tagText = shortReason(reason);
      const tag = this.add
        .text(slot.x + slot.width - 3, slot.y - 9, tagText, textStyle(typeRole.label, surface.paper.hex))
        .setOrigin(1, 0)
        .setLetterSpacing(typeRole.label.letterSpacing)
        .setPadding(4, 2, 4, 2)
        .setBackgroundColor(cssOf(surface.ink.hex));
      tag.setText(caseOf(typeRole.label, tagText));
    }

    this.#makeTapTarget(slot, card.instanceId, () => void this.#playCard(card.instanceId));
  }

  #drawActionBar(rect: Rect, model: BoardModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

    const marks = this.#marks;
    const basics: readonly BasicAction[] = ["attack", "thwart", "recover", "changeForm"];
    const labels: Record<BasicAction, string> = {
      attack: "Attack",
      thwart: "Thwart",
      recover: "Recover",
      changeForm: model.myForm === "hero" ? "Flip to alter-ego" : "Flip to hero",
      endTurn: "End turn",
    };

    const endTurnWidth = Math.min(180, rect.width * 0.28);
    const cellWidth = (rect.width - endTurnWidth - 30 - (basics.length - 1) * 6) / basics.length;

    basics.forEach((action, index) => {
      const button = marks?.basics.find((basic) => basic.action === action);
      const targeting = this.#selection.kind === "targeting" && basicKindOf(this.#selection.action) === action;
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: labels[action],
          type: typeRole.label,
          rect: { x: rect.x + 10 + index * (cellWidth + 6), y: rect.y + 6, width: cellWidth, height: hit.target },
          enabled: button?.enabled ?? false,
          selected: targeting,
          ...(button?.reason ? { reason: button.reason } : {}),
          onClick: () => this.#chooseBasic(action),
        }),
      );
    });

    // The one red fill in the bar: the forward action of the table.
    const endTurn = marks?.basics.find((basic) => basic.action === "endTurn");
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "End turn",
        type: typeRole.barTitle,
        rect: { x: rect.x + rect.width - endTurnWidth - 10, y: rect.y + 6, width: endTurnWidth, height: hit.primary - 6 },
        enabled: endTurn?.enabled ?? false,
        ...(endTurn?.reason ? { reason: endTurn.reason } : {}),
        onClick: () => void this.#dispatchExample("endTurn"),
      }),
    );

    // The advisory line: a prompt while targeting, otherwise the engine's last
    // rejection. Caution yellow, never red — red is the action, not the alarm.
    const message =
      this.#selection.kind === "targeting"
        ? this.#selection.prompt
        : (appSession().store.state.error ?? "");
    if (message) {
      this.add
        .text(rect.x + 10, rect.y + rect.height - 18, message, textStyle(typeRole.body, signal.caution.hex))
        .setOrigin(0, 0.5)
        .setMaxLines(1);
    }
  }

  /** Pulsing rings on the valid targets while a target is being chosen. */
  #drawTargetRings(): void {
    if (this.#selection.kind !== "targeting") return;
    const reduced = appSession().settings.reducedMotion;
    for (const target of this.#selection.action.targets) {
      const rect = this.#hitRects.get(target);
      if (!rect) continue;
      const ring = new McSelectionRing(this);
      ring.show(rect, "pulse", reduced);
      this.#rings.push(ring);
    }
  }

  /** "Out of scope" opacity while a target is being chosen (dim, don't hide). */
  #dimAlpha(id: InstanceId): number {
    if (this.#selection.kind !== "targeting") return 1;
    return this.#selection.action.targets.includes(id) ? 1 : ink.illegal;
  }

  #targetState(id: InstanceId): "rest" | "selected" | "unavailable" {
    if (this.#selection.kind !== "targeting") return "rest";
    return this.#selection.action.targets.includes(id) ? "selected" : "unavailable";
  }

  /**
   * A tap acts; a press-and-hold or a right-click inspects.
   *
   * The table's primary gesture has to stay "tap the thing you mean", so
   * Inspect takes the second gesture rather than a chrome button per card. The
   * hold threshold is `INSPECT_HOLD_MS`: long enough that a decisive tap never
   * opens a sheet, short enough to feel deliberate.
   */
  #makeTapTarget(rect: Rect, id: InstanceId, fallback?: () => void): void {
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    let held: Phaser.Time.TimerEvent | null = null;
    let inspected = false;
    const cancelHold = (): void => {
      held?.remove();
      held = null;
    };

    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      inspected = false;
      if (pointer.rightButtonDown()) {
        inspected = true;
        this.#inspect(id);
        return;
      }
      held = this.time.delayedCall(INSPECT_HOLD_MS, () => {
        inspected = true;
        this.#inspect(id);
      });
    });
    zone.on("pointerout", cancelHold);
    zone.on("pointerup", () => {
      cancelHold();
      // A hold already did something; the release must not also act on it.
      if (inspected) return;
      if (this.#selection.kind === "targeting") {
        void this.#commitTarget(id);
        return;
      }
      fallback?.();
    });
  }

  /** Opens the Inspect overlay over the board, stepping through the hand when it came from there. */
  #inspect(id: InstanceId): void {
    const siblings = this.#model?.hand.map((card) => card.instanceId) ?? [];
    this.scene.launch(SCENES.inspect, {
      instanceId: id,
      ...(siblings.includes(id) ? { siblings } : {}),
    });
  }

  /**
   * Enters target-select mode, or dispatches immediately when the action needs
   * no target. The engine decided both: `targets` came from `legalActions`.
   */
  #chooseBasic(action: BasicAction): void {
    const entry = this.#legalFor(action);
    if (!entry) return;
    if (entry.targets.length === 0) {
      void this.#dispatch(entry.example);
      return;
    }
    if (entry.targets.length === 1) {
      // One legal target is not a decision; aim and go.
      void this.#dispatch(entry.example);
      return;
    }
    this.#selection = { kind: "targeting", action: entry, prompt: `Choose a target to ${action}` };
    this.#draw();
  }

  async #commitTarget(id: InstanceId): Promise<void> {
    if (this.#selection.kind !== "targeting") return;
    const { action } = this.#selection;
    if (!action.targets.includes(id)) return;
    this.#selection = { kind: "idle" };
    await this.#dispatch(retarget(action.example, id));
  }

  /**
   * Plays a hand card using the smallest payment the engine found. The Payment
   * overlay, where the player picks what to spend, is the next piece of client
   * work; until then the engine's own `example` payment is used, which is a
   * payment `applyCommand` has already accepted.
   */
  async #playCard(instanceId: InstanceId): Promise<void> {
    const entry = this.#marks?.playable.has(instanceId)
      ? this.#legalEntries().find((candidate) => candidate.action.kind === "playCard" && candidate.action.instanceId === instanceId)
      : undefined;
    if (!entry) return;
    await this.#dispatch(entry.example);
  }

  #onInspectPlay(instanceId: InstanceId): void {
    void this.#playCard(instanceId);
  }

  async #dispatchExample(kind: BasicAction): Promise<void> {
    const entry = this.#legalFor(kind);
    if (entry) await this.#dispatch(entry.example);
  }

  async #dispatch(command: Command): Promise<void> {
    const { store } = appSession();
    const before = store.state.version;
    await store.dispatch(command);
    // A rejection doesn't change the version, so redraw to show the message.
    if (store.state.version === before) this.#draw();
  }

  #legalEntries(): readonly LegalAction[] {
    const { store } = appSession();
    const actions = store.state.legal?.actions;
    return actions?.kind === "turn" ? actions.legal : [];
  }

  #legalFor(action: BasicAction): LegalAction | undefined {
    const kind = BASIC_TO_KIND[action];
    return this.#legalEntries().find((entry) => entry.action.kind === kind);
  }
}

/**
 * The type of a resource, as a glyph. Colour says "resource"; the glyph says
 * which one, so the distinction survives colourblindness and a 12px pip.
 */
const RESOURCE_GLYPH: Readonly<Record<ResourceIconType, string>> = {
  physical: "P",
  mental: "M",
  energy: "E",
  wild: "*",
};

/**
 * The engine's reason as a tag that fits on a card corner. The full sentence
 * stays available — this only picks the short form of a code the engine gave.
 */
function shortReason(reason: IllegalReason): string {
  switch (reason.code) {
    case "wrong_form":
      return "wrong form";
    case "insufficient_resources":
      return "can't afford";
    case "already_exhausted":
      return "exhausted";
    case "limit_reached":
      return "limit";
    case "no_valid_target":
      return "no target";
    case "card_type_not_playable":
      return "not an action";
    case "already_changed_form":
      return "already flipped";
    default:
      return "illegal";
  }
}

/**
 * How long a press has to last before it inspects instead of acting. Below
 * this, a tap is a tap; above it, the player clearly meant to look.
 */
const INSPECT_HOLD_MS = 420;

const BASIC_TO_KIND: Record<BasicAction, string> = {
  attack: "basicAttack",
  thwart: "basicThwart",
  recover: "basicRecover",
  changeForm: "changeForm",
  endTurn: "endTurn",
};

const basicKindOf = (entry: LegalAction): BasicAction | null => {
  for (const [action, kind] of Object.entries(BASIC_TO_KIND)) {
    if (entry.action.kind === kind) return action as BasicAction;
  }
  return null;
};

/**
 * Re-aims the engine's example command at the target the player picked. Only
 * the target field changes: the payment and cost picks the engine found stay
 * exactly as it produced them.
 */
function retarget(command: Command, target: InstanceId): Command {
  switch (command.type) {
    case "basicAttack":
      return { ...command, targetInstanceId: target };
    case "basicThwart":
      return { ...command, schemeInstanceId: target };
    case "playCard":
      return { ...command, attachToInstanceId: target };
    default:
      return command;
  }
}
