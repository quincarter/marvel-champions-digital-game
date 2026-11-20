/**
 * The Choosing Sides "cards earned" sheet (issue #883, plan M9; MC56 p. 16): when a team's Choosing Sides side scheme is
 * defeated and Now It's Personal comes into play, this says so and shows the four basic player cards of the team's own
 * leader that are still set aside, each with the hover popover. Taking them is Now It's Personal's own Action (two per
 * hero), answered through the ordinary choice; this only shows them. The words and cards come from
 * `view/choosing-sides.ts`.
 */
import Phaser from "phaser";
import { gameCardsById } from "../content/game-deps.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { t } from "../i18n/translate.js";
import { appSession } from "../session.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { HoverPreview, screenHoverArea } from "../ui/card-hover-preview.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { choosingSidesOf, type ChoosingSidesView } from "../view/choosing-sides.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface ChoosingSidesData {
  /** Dev preview: a made-up reward to draw instead of the live game's. */
  readonly preview?: ChoosingSidesView;
}

const INK = surface.ink.hex;
const PAPER = surface.paper.hex;

export class ChoosingSidesOverlay extends Phaser.Scene {
  #data: ChoosingSidesData = {};
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #hover: HoverPreview | null = null;
  #faces: { readonly cardId: string; readonly rect: Rect }[] = [];

  constructor() {
    super(SCENES.choosingSides);
  }

  init(data: ChoosingSidesData): void {
    this.#data = data ?? {};
  }

  create(): void {
    this.#route = new FocusRoute(this, { onCancel: () => this.#close(), primary: () => "close" });
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    const redraw = (): void => this.#draw();
    const offArt = cardArt(this).onArrived(() => {
      if (this.sys.isActive()) this.#draw();
    });
    this.scale.on("resize", redraw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", redraw, this);
      offArt();
      this.#hover?.destroy();
      this.#hover = null;
      for (const b of this.#buttons) b.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #close(): void {
    this.scene.stop();
  }

  #view(): ChoosingSidesView | null {
    if (this.#data.preview) return this.#data.preview;
    const { game, perspectiveId } = appSession().store.state;
    return game && perspectiveId ? choosingSidesOf(game, perspectiveId) : null;
  }

  #hoverIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const { width, height } = this.scale.gameSize;
    this.#faces.forEach(({ cardId, rect }, index) => {
      const shown = clipHoverRect(rect, { x: 0, y: 0, width, height });
      if (shown) found.set(hoverSlotOf(cardId, `earned${index}`), { ...shown, cardId, through: true });
    });
    return found;
  }

  #text(x: number, y: number, text: string, size: number, width: number, bold = false): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, textStyle(bold ? typeRole.rowTitle : typeRole.body, INK))
      .setFontSize(size)
      .setWordWrapWidth(width, true);
  }

  #draw(): void {
    for (const b of this.#buttons) b.destroy();
    this.#buttons = [];
    destroyChildren(this);
    this.#faces = [];
    const view = this.#view();
    if (!view) {
      this.scene.stop();
      return;
    }
    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const boxW = Math.min(560, width - 16);
    const boxH = Math.min(height - 16, 560);
    const box: Rect = { x: (width - boxW) / 2, y: (height - boxH) / 2, width: boxW, height: boxH };
    const g = this.add.graphics();
    g.fillStyle(PAPER, 1).fillRect(box.x, box.y, box.width, box.height);
    g.lineStyle(4, INK, 1).strokeRect(box.x, box.y, box.width, box.height);
    const x = box.x + 16;
    const w = box.width - 32;
    let y = box.y + 12;
    y +=
      this.add.text(x, y, t("comp.reward.title"), textStyle(typeRole.barTitle, INK)).setWordWrapWidth(w, true).height +
      8;
    y += this.#text(x, y, t("comp.reward.body", { leader: view.leaderName }), 14, w).height + 6;
    y += this.#text(x, y, t("comp.reward.each"), 14, w, true).height + 10;
    const closeRect: Rect = { x, y: box.y + box.height - 12 - hit.target, width: w, height: hit.target };
    // The four cards fit one row where they can and two rows on a narrow sheet.
    const cards = view.remaining;
    const perRow = w >= 440 ? Math.max(1, cards.length) : Math.min(2, Math.max(1, cards.length));
    const rows = Math.ceil(cards.length / perRow) || 1;
    const gap = 8;
    const room = closeRect.y - 10 - y;
    const cardW = Math.min((w - gap * (perRow - 1)) / perRow, ((room - gap * (rows - 1)) / rows) * 0.715);
    const cardH = cardW / 0.715;
    cards.forEach((card, index) => {
      const col = index % perRow;
      const row = Math.floor(index / perRow);
      const rowCount = Math.min(perRow, cards.length - row * perRow);
      const rowW = rowCount * cardW + (rowCount - 1) * gap;
      const art: Rect = {
        x: x + (w - rowW) / 2 + col * (cardW + gap),
        y: y + row * (cardH + gap),
        width: cardW,
        height: cardH,
      };
      this.add.graphics().fillStyle(surface.parchment.hex, 1).fillRect(art.x, art.y, art.width, art.height);
      const face = gameCardsById().get(card.cardId);
      const key = face ? cardArt(this).request(this, artFor(face, { kind: "front" })) : null;
      if (!drawArt(this, key, art, { fit: "contain" })) {
        this.add
          .text(art.x + art.width / 2, art.y + art.height / 2, card.name, textStyle(typeRole.label, INK))
          .setOrigin(0.5)
          .setWordWrapWidth(art.width - 6, true)
          .setAlign("center");
      }
      this.#faces.push({ cardId: card.cardId, rect: art });
    });
    const close = (): void => {
      this.#close();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: t("comp.over.close"),
        type: { ...typeRole.label, size: 12 },
        rect: closeRect,
        onClick: close,
      }),
    );
    const stops = new Map<string, FocusStop>([["close", { rect: closeRect, activate: close }]]);
    this.#route?.set(["close"], stops);
  }
}
