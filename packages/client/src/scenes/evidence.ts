/**
 * The Evidence view for Baron Zemo (MC50 pp. 18 and 19): the two envelopes by size while they are hidden, the evidence
 * the players hold faceup, the grid of 27 combinations with the crossed-out rows dimmed, and, once the accusation has
 * been made, the answer. Opened from the Board's EVIDENCE button (or the E key), launched over the Board with no payload.
 * Read only: it sends no command.
 *
 * It draws `view/evidence-model.ts#evidenceBoardOf`, which is built from the sealed state (`evidenceInputOf`), so a
 * hidden pile's cards are never in reach of this file: only their count is. Every card on it opens Inspect.
 */
import Phaser from "phaser";
import { AOS_EVIDENCE_COMBINATIONS } from "@mc/content";
import type { CardId } from "@mc/content";
import { CARDS_BY_ID } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton, fitText, paintPanel } from "../ui/widgets.js";
import { drawBoardMemberKey, drawEvidenceGrid, type CellMark } from "../ui/evidence-grid.js";
import { destroyChildren } from "../ui/destroy-children.js";
import type { Rect } from "../view/layout.js";
import { evidenceGridWantedHeight } from "../view/evidence-layout.js";
import {
  evidenceBoardOf,
  evidenceInputOf,
  type EvidenceBoardView,
  type EvidenceCardView,
  type EvidencePileView,
} from "../view/evidence-model.js";
import { evidenceRowId } from "@mc/engine";
import { appSession } from "../session.js";
import { onTap } from "../ui/tap.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface EvidenceOverlayData {
  /** The scene that asked: its pointer and keys are off while this is up. */
  readonly from?: string;
}

const PAD = 14;
const BAR = 40;
const KEY = 28;

const lookup = (id: CardId) => CARDS_BY_ID.get(id as string);

export class EvidenceOverlay extends Phaser.Scene {
  #from = "";
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #artOff: (() => void) | null = null;

  constructor() {
    super(SCENES.evidence);
  }

  create(data: EvidenceOverlayData = {}): void {
    this.#from = data.from ?? SCENES.board;
    const from = this.scene.get(this.#from);
    if (from) {
      from.input.enabled = false;
      if (from.input.keyboard) from.input.keyboard.enabled = false;
    }
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.scene.stop(),
    });
    this.#artOff = cardArt(this).onArrived(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#artOff?.();
      this.#artOff = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) {
        from.input.enabled = true;
        if (from.input.keyboard) from.input.keyboard.enabled = true;
      }
    });
    this.#draw();
  }

  #inspect(cardId: CardId): void {
    this.scene.launch(SCENES.inspect, { card: { cardId, face: { kind: "front" } } });
    this.scene.bringToTop(SCENES.inspect);
  }

  #view(): EvidenceBoardView | null {
    const game = appSession().store.state.game;
    const input = game ? evidenceInputOf(game) : null;
    return input ? evidenceBoardOf(input, AOS_EVIDENCE_COMBINATIONS, lookup) : null;
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height } = this.scale.gameSize;
    const view = this.#view();

    this.add
      .zone(0, 0, width, height)
      .setOrigin(0, 0)
      .setInteractive()
      .on("pointerdown", () => this.scene.stop());
    this.add.graphics().fillStyle(surface.void.hex, 0.78).fillRect(0, 0, width, height);

    const narrow = width < 600;
    const boxWidth = Math.min(1040, width - (narrow ? 12 : 32));
    const gridHeight = evidenceGridWantedHeight(boxWidth - PAD * 2);
    const pileHeight = narrow ? 96 : 118;
    const answerHeight = view?.answer ? (narrow ? 84 : 66) : 0;
    const wanted =
      BAR +
      PAD +
      pileHeight +
      10 +
      gridHeight +
      6 +
      KEY +
      (answerHeight ? answerHeight + 10 : 0) +
      12 +
      hit.target +
      PAD;
    const boxHeight = Math.min(height - 12, wanted);
    const box: Rect = {
      x: Math.round((width - boxWidth) / 2),
      y: Math.max(6, Math.round((height - boxHeight) / 2)),
      width: boxWidth,
      height: boxHeight,
    };
    const ground = this.add.graphics();
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    this.add.zone(box.x, box.y, box.width, box.height).setOrigin(0, 0).setInteractive();

    // Title bar.
    ground.fillStyle(surface.ink.hex, 1).fillRect(box.x, box.y, box.width, BAR);
    this.add
      .text(box.x + PAD, box.y + BAR / 2, "EVIDENCE", textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    const status = this.add
      .text(
        box.x + box.width - PAD,
        box.y + BAR / 2,
        view?.status ?? "No evidence in this game",
        textStyle(typeRole.emphasis, signal.caution.hex),
      )
      .setOrigin(1, 0.5);
    fitText(status, box.width - 170, 12);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    const addCard = (key: string, rect: Rect, cardId: CardId): void => {
      stops.set(key, { rect, activate: () => this.#inspect(cardId), inspect: () => this.#inspect(cardId) });
      order.push(key);
    };

    let y = box.y + BAR + PAD;
    const inner = box.width - PAD * 2;
    if (view) {
      // The envelopes.
      const piles = view.piles;
      const gap = 10;
      const tileWidth = piles.length > 0 ? (inner - gap * (piles.length - 1)) / piles.length : inner;
      piles.forEach((pile, index) => {
        const tile: Rect = { x: box.x + PAD + index * (tileWidth + gap), y, width: tileWidth, height: pileHeight };
        this.#drawPile(tile, pile, narrow, (rect, card) =>
          addCard(`pile:${pile.pile}:${card.cardId}`, rect, card.cardId),
        );
      });
      y += pileHeight + 10;

      // The grid, with the accusation and the mole flagged once they exist.
      const marks = new Map<string, CellMark>();
      if (view.answer?.accused) marks.set(evidenceRowId(view.answer.accused), "accused");
      if (view.answer?.mole) marks.set(evidenceRowId(view.answer.mole), "mole");
      const gridRect: Rect = { x: box.x + PAD, y, width: inner, height: gridHeight };
      const drawn = drawEvidenceGrid(this, gridRect, view.grid, {
        marks,
        onInspect: (cardId) => this.#inspect(cardId),
      });
      for (const [cardId, rect] of drawn.cardRects) addCard(`grid:${cardId}`, rect, cardId);
      y += gridHeight + 6;
      const keyRects = drawBoardMemberKey(
        this,
        { x: box.x + PAD, y, width: inner, height: KEY },
        view.grid.members,
        (id) => this.#inspect(id),
      );
      for (const [cardId, rect] of keyRects) addCard(`member:${cardId}`, rect, cardId);
      y += KEY + 10;

      if (view.answer) {
        this.#drawAnswer({ x: box.x + PAD, y, width: inner, height: answerHeight }, view);
        y += answerHeight + 10;
      }
    } else {
      this.add.text(box.x + PAD, y, "This game has no evidence to gather.", textStyle(typeRole.body, surface.ink.hex));
    }

    const closeRect: Rect = {
      x: box.x + PAD,
      y: box.y + box.height - PAD - hit.target,
      width: inner,
      height: hit.target,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Close",
        type: { ...typeRole.label, size: 13 },
        rect: closeRect,
        onClick: () => this.scene.stop(),
      }),
    );
    stops.set("close", { rect: closeRect, activate: () => this.scene.stop() });
    order.push("close");
    this.#route?.set(order, stops);

    if (import.meta.env.DEV) {
      (window as unknown as { __mcEvidenceDebug?: unknown }).__mcEvidenceDebug = {
        box: () => box,
        closeRect: () => closeRect,
        view: () => view,
      };
    }
  }

  /** One envelope: its title, how many cards are still hidden (a count, never which), and the cards turned faceup. */
  #drawPile(
    tile: Rect,
    pile: EvidencePileView,
    narrow: boolean,
    register: (rect: Rect, card: EvidenceCardView) => void,
  ): void {
    const g = this.add.graphics();
    paintPanel(g, tile, "card", "rest");
    this.add.text(tile.x + 8, tile.y + 6, pile.title.toUpperCase(), textStyle(typeRole.label, surface.ink.hex));
    const hidden =
      pile.hiddenCount > 0 ? `${pile.hiddenCount} hidden` : pile.faceup.length > 0 ? "all faceup" : "empty";
    // A narrow tile (a phone) puts the count under the title instead of beside it.
    const stacked = tile.width < 320;
    this.add
      .text(
        stacked ? tile.x + 8 : tile.x + tile.width - 8,
        stacked ? tile.y + 19 : tile.y + 6,
        hidden.toUpperCase(),
        textStyle(typeRole.label, accent.heroRed.hex),
      )
      .setOrigin(stacked ? 0 : 1, 0);

    // Cards still in the envelope: facedown backs, one per card, no identity.
    const thumbHeight = tile.height - (stacked ? 44 : 30);
    const thumbWidth = Math.round(thumbHeight * (63 / 88));
    let x = tile.x + 8;
    const top = tile.y + (stacked ? 36 : 24);
    const backs = Math.min(pile.hiddenCount, 6);
    for (let index = 0; index < backs; index++) {
      const back: Rect = { x, y: top, width: thumbWidth, height: thumbHeight };
      g.fillStyle(surface.ink.hex, 1).fillRect(back.x, back.y, back.width, back.height);
      g.lineStyle(2, surface.paper.hex, 1).strokeRect(back.x + 3, back.y + 3, back.width - 6, back.height - 6);
      if (index === backs - 1)
        this.add
          .text(back.x + back.width / 2, back.y + back.height / 2, "?", textStyle(typeRole.stat, surface.paper.hex))
          .setOrigin(0.5);
      // Overlapped: a count to read, and the room goes to the names of the cards that are out.
      x += Math.round(thumbWidth * 0.4);
    }
    if (backs > 0) x += thumbWidth - Math.round(thumbWidth * 0.4) + 10;
    for (const card of pile.faceup) {
      const rect: Rect = { x, y: top, width: thumbWidth, height: thumbHeight };
      const key = cardArt(this).request(this, artFor(lookup(card.cardId), { kind: "front" }));
      g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      if (!drawArt(this, key, rect, { fit: "cover" })) {
        const name = this.add
          .text(rect.x + rect.width / 2, rect.y + rect.height / 2, card.name, {
            ...textStyle(typeRole.label, surface.ink.hex),
            align: "center",
          })
          .setOrigin(0.5);
        name.setWordWrapWidth(rect.width - 4, true);
      }
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
      const cardZone = this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      onTap(cardZone, () => this.#inspect(card.cardId), `evidence:${card.cardId}`);
      register(rect, card);
      // The name beside the thumbnail so a card is never known by its picture alone.
      x += thumbWidth + 4;
    }
    // Names of the faceup cards, as one line under the title when there are any.
    if (pile.faceup.length > 0 && !narrow) {
      const names = this.add
        .text(
          x + 4,
          top + 2,
          pile.faceup.map((card) => card.name).join("\n"),
          textStyle(typeRole.emphasis, surface.ink.hex),
        )
        .setLineSpacing(2);
      const room = tile.x + tile.width - 8 - names.x;
      if (room > 40) fitText(names, room, 11);
      else names.destroy();
    }
  }

  /** What was accused, who the mole was, and how the two compare. */
  #drawAnswer(area: Rect, view: EvidenceBoardView): void {
    const answer = view.answer;
    if (!answer) return;
    const g = this.add.graphics();
    paintPanel(g, area, "card", "rest");
    const lines = [
      answer.accusedLine ? `ACCUSED  ${answer.accusedLine}` : null,
      answer.moleLine ? `MOLE  ${answer.moleLine}` : null,
      answer.verdict,
    ].filter((line): line is string => line !== null);
    const text = this.add
      .text(area.x + 8, area.y + 5, lines.join("\n"), textStyle(typeRole.emphasis, surface.ink.hex, ink.body))
      .setLineSpacing(2);
    text.setWordWrapWidth(area.width - 16, true);
  }
}
