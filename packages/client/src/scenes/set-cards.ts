/**
 * "Cards in this modular set": a sheet any screen opens over itself (`scene.launch(SCENES.setCards, data)`).
 * A dim scrim (a tap closes), a panel with the set's name, a Close button, a scrolling grid of the set's distinct
 * cards (tap one to read it in Inspect) and, when the caller gives an `action`, a primary footer button.
 *
 * The contract with the caller: pressing the footer button emits `mc-set-cards-action` on `game.events` with the
 * set id, then stops this overlay. The caller never needs to know the overlay's internals. The drawing reuses the
 * Civil War builder's sheet (`view/civil-war-builder-{model,art,layout}.ts`); nothing here computes game state.
 */

import Phaser from "phaser";
import type { CardId } from "@mc/content";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { accent, surface, typeRole, type TypeSpec } from "../tokens.js";
import { artFor } from "../art/art-source.js";
import { cardFaces } from "../art/card-face-baker.js";
import { artThumbSpec } from "./roster-panel.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, fitText } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { addPressShield } from "../ui/press-shield.js";
import { onTap } from "../ui/tap.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import { setSheetFor } from "../view/civil-war-builder-model.js";
import { sectionedSheetLayout, type SectionedSheetLayout } from "../view/set-cards-layout.js";
import { rectsNearViewport, type FaceRef, type SetSheetView } from "../view/civil-war-builder-art.js";
import { setCardCaption, setCardsSubtitle } from "../view/set-cards.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { InspectData } from "./inspect.js";

export interface SetCardsData {
  readonly setId: string;
  /** A primary footer button; pressing it emits `mc-set-cards-action` (with the set id) and closes the sheet. */
  readonly action?: { readonly label: string; readonly enabled: boolean };
  /** The scene under the sheet, whose input is held off while the sheet is open (default: none besides the scrim). */
  readonly from?: string;
  /** The line under the title, in place of the card count. */
  readonly subtitle?: string;
  /** The sheet's title in place of the set's name (a sectioned sheet: "Standard sets"). */
  readonly title?: string;
  /**
   * Several sets in one sheet, each under its own heading (Table setup's Standard sets: I, II and III with where each
   * comes from). Absent: the one set `setId` names, with no heading.
   */
  readonly sections?: readonly SetCardsSection[];
}

export interface SetCardsSection {
  readonly setId: string;
  /** The heading's first line: the set's name ("Standard II · chosen"). */
  readonly heading: string;
  /** The heading's second line: where the set comes from. */
  readonly note: string;
  /** The chosen set: its heading is drawn in Hero Red. */
  readonly chosen: boolean;
}

/** Event emitted on `game.events` when the footer button is pressed; the payload is the set id. */
export const SET_CARDS_ACTION_EVENT = "mc-set-cards-action";

/** Faces this far (px) outside the scrolled view still load, so a flick does not scroll into blank tiles. */
const LOAD_MARGIN = 240;

interface Thumb {
  readonly rect: Rect;
  readonly url: string;
  done: boolean;
}

export class SetCardsOverlay extends Phaser.Scene {
  #data: SetCardsData = { setId: "" };
  #route: FocusRoute | null = null;
  #region: McScrollRegion | null = null;
  #buttons: McButton[] = [];
  #thumbs: Thumb[] = [];
  #stops = new Map<string, FocusStop>();
  readonly #scroll = new VariableListScroll();
  /** Header room for a subtitle that wraps past one line (measured each draw). */
  #extraHeader = 0;
  /** The desktop hover popover over the card pictures (`ui/card-hover-preview.ts`), as in the Civil War builder. */
  #hover: HoverPreview | null = null;
  #hoverFaces: { readonly face: FaceRef; readonly rect: Rect }[] = [];

  constructor() {
    super(SCENES.setCards);
  }

  init(data: SetCardsData): void {
    this.#data = data;
    this.#scroll.reset();
  }

  create(): void {
    const from = this.#data.from ? this.scene.get(this.#data.from) : null;
    if (from) {
      from.input.enabled = false;
      if (from.input.keyboard) from.input.keyboard.enabled = false;
    }
    this.scale.on("resize", this.#draw, this);
    const offBaked = cardFaces(this).onBaked(() => this.#fillThumbs());
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCardIds(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#close(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offBaked();
      this.#hover?.destroy();
      this.#hover = null;
      this.scale.off("resize", this.#draw, this);
      this.#clear();
      if (from) {
        from.input.enabled = true;
        if (from.input.keyboard) from.input.keyboard.enabled = true;
      }
    });
    this.#draw();
  }

  #clear(): void {
    this.#region?.destroy();
    this.#region = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#thumbs = [];
    this.#stops = new Map();
  }

  /** The card pictures on screen now, each clipped to the scrolled body. */
  #hoverCardIds(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const body = this.#layoutNow().body;
    this.#hoverFaces.forEach(({ face, rect }, index) => {
      const shown = clipHoverRect({ ...rect, y: rect.y - this.#scroll.offsetPx }, body);
      if (shown)
        found.set(hoverSlotOf(face.cardId, `face${index}`), {
          ...shown,
          cardId: face.cardId,
          face: face.face,
          through: true,
        });
    });
    return found;
  }

  #close(): void {
    this.scene.stop();
  }

  #cardScale(): number {
    return cardSizeFactor(appSession().settings.cardSize);
  }

  #urlOf(face: FaceRef): string | null {
    return artFor(CARDS_BY_ID.get(face.cardId), face.face)?.url ?? null;
  }

  #inspect(face: FaceRef): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: face.cardId as CardId, face: face.face },
    } satisfies InspectData);
    this.scene.bringToTop(SCENES.inspect);
  }

  #text(x: number, y: number, text: string, type: TypeSpec, width?: number, maxLines?: number, alpha = 1) {
    return this.add.text(x, y, text, {
      ...textStyle(type, surface.ink.hex, alpha),
      ...(width ? { wordWrap: { width } } : {}),
      ...(maxLines ? { maxLines } : {}),
    });
  }

  /** Draws every waiting picture whose baked face is on hand and whose slot is near the scrolled view. */
  #fillThumbs(): void {
    const sheet = this.#layoutNow();
    const view = { top: sheet.body.y + this.#scroll.offsetPx, height: sheet.body.height };
    const faces = cardFaces(this);
    for (const slot of this.#thumbs) {
      if (slot.done) continue;
      if (rectsNearViewport([slot.rect], view, LOAD_MARGIN).length === 0) continue;
      const key = faces.request(artThumbSpec(slot.rect, slot.url, 0.12, "contain"));
      if (!key) continue;
      const image = this.add.image(slot.rect.x, slot.rect.y, key).setOrigin(0, 0);
      image.setDisplaySize(slot.rect.width, slot.rect.height);
      faces.hold(key, image);
      this.#region?.content.add(image);
      slot.done = true;
    }
  }

  /** The sets this sheet shows: its sections, or the one set with no heading. */
  #sections(): readonly { readonly section: SetCardsSection | null; readonly sheet: SetSheetView }[] {
    const ctx = { cards: CARDS_BY_ID, encounterSets: POOL_ENCOUNTER_SETS };
    const { sections, setId } = this.#data;
    if (!sections || sections.length === 0) return [{ section: null, sheet: setSheetFor(ctx, setId) }];
    return sections.map((section) => ({ section, sheet: setSheetFor(ctx, section.setId) }));
  }

  #layoutNow(): SectionedSheetLayout {
    const groups = this.#sections();
    const { width, height } = this.scale.gameSize;
    return sectionedSheetLayout(
      { width, height },
      groups.map((g) => g.sheet.cards.length),
      this.#cardScale(),
      {
        headed: groups.some((g) => g.section !== null),
        extraHeader: this.#extraHeader,
        footer: Boolean(this.#data.action),
      },
    );
  }

  #draw(): void {
    this.#clear();
    resetHoverCards(this);
    this.#hoverFaces = [];
    destroyChildren(this);
    const { setId, action } = this.#data;
    const groups = this.#sections();
    const sheet = groups[0]!.sheet;
    const { width, height } = this.scale.gameSize;
    const subtitleText = this.#data.subtitle ?? setCardsSubtitle(sheet.totalCards, sheet.cards.length);
    // A long subtitle (the Standard sets' explanation on a phone) wraps: the header grows by the extra lines.
    this.#extraHeader = 0;
    const probe = this.#text(
      0,
      0,
      subtitleText,
      typeRole.body,
      this.#layoutNow().close.x - this.#layoutNow().header.x - 32,
    );
    this.#extraHeader = Math.max(0, Math.ceil(probe.height) - 18);
    probe.destroy();
    const L = this.#layoutNow();

    // The scrim takes every press, so nothing under the sheet answers while it is open; a tap on it closes.
    const shield = addPressShield(this, { x: 0, y: 0, width, height });
    onTap(shield, () => this.#close(), "set-cards:scrim");
    this.add.rectangle(0, 0, width, height, surface.ink.hex, 0.62).setOrigin(0, 0);
    const ground = this.add.graphics();
    ground.fillStyle(surface.card.hex, 1).fillRect(L.panel.x, L.panel.y, L.panel.width, L.panel.height);
    ground.lineStyle(3, surface.ink.hex, 1).strokeRect(L.panel.x, L.panel.y, L.panel.width, L.panel.height);
    // The panel takes a press that lands on it, so only the scrim around it closes.
    this.add.zone(L.panel.x, L.panel.y, L.panel.width, L.panel.height).setOrigin(0, 0).setInteractive();

    const textWidth = L.close.x - L.header.x - 32;
    const title = this.#text(L.header.x + 16, L.header.y + 8, this.#data.title ?? sheet.name, typeRole.barTitle);
    fitText(title, textWidth, 22);
    this.#text(L.header.x + 16, L.header.y + 36, subtitleText, typeRole.body, textWidth, undefined, 0.7);
    const close = (): void => this.#close();
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: "Close", type: typeRole.rowTitle, rect: L.close, onClick: close }),
    );
    this.#stops.set("set-cards:close", { rect: L.close, activate: close });

    const region = new McScrollRegion(this, {
      rect: L.body,
      heights: [L.contentHeight],
      scroll: this.#scroll,
      clipInteractive: true,
      onScroll: () => this.#fillThumbs(),
    });
    this.#region = region;
    const order: string[] = [];
    groups.forEach(({ section }, s) => {
      if (!section) return;
      const at = L.headings[s]!;
      const heading = this.#text(at.x, at.y + 2, section.heading, typeRole.rowTitle);
      if (section.chosen) heading.setColor(cssOf(accent.heroRed.hex));
      fitText(heading, at.width, typeRole.rowTitle.size);
      const note = this.#text(at.x, at.y + 22, section.note, typeRole.label, at.width, 1, 0.7);
      region.content.add([heading, note]);
    });
    const cards = groups.flatMap((g) => g.sheet.cards);
    cards.forEach((card, i) => {
      const cell = L.cells[i]!;
      const image: Rect = { x: cell.x, y: cell.y, width: cell.width, height: L.imageHeight };
      this.#hoverFaces.push({ face: card.face, rect: image });
      const frame = this.add.graphics();
      frame.fillStyle(surface.parchment.hex, 1).fillRect(image.x, image.y, image.width, image.height);
      frame
        .lineStyle(1.5, surface.ink.hex, 0.5)
        .strokeRect(image.x + 0.75, image.y + 0.75, image.width - 1.5, image.height - 1.5);
      region.content.add(frame);
      const url = this.#urlOf(card.face);
      if (url === null) {
        const missing = this.#text(
          image.x + 4,
          image.y + image.height / 2,
          card.face.name,
          typeRole.label,
          image.width - 8,
          3,
          0.7,
        );
        missing.setOrigin(0, 0.5);
        region.content.add(missing);
      } else {
        this.#thumbs.push({
          rect: { x: image.x, y: image.y, width: Math.round(image.width), height: Math.round(image.height) },
          url,
          done: false,
        });
      }
      const name = this.#text(cell.x, cell.y + L.imageHeight + 4, card.face.name, typeRole.label, cell.width, 2);
      name.setLineSpacing(0);
      const caption = this.#text(
        cell.x,
        cell.y + L.imageHeight + 32,
        setCardCaption(card.copies, card.typeWord),
        typeRole.label,
        cell.width,
        1,
        0.7,
      );
      region.content.add([name, caption]);
      const read = (): void => this.#inspect(card.face);
      const zone = this.add
        .zone(cell.x, cell.y, cell.width, cell.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      onTap(zone, read, `set-cards:read:${i}`);
      region.content.add(zone);
      const key = `set-cards:card:${i}`;
      order.push(key);
      this.#stops.set(key, {
        rect: () => ({ ...cell, y: cell.y - this.#scroll.offsetPx }),
        activate: read,
        inspect: read,
        ensureVisible: () => {
          const top = cell.y - this.#scroll.offsetPx;
          const bottom = top + cell.height;
          if (top < L.body.y) region.scrollByPx(top - L.body.y);
          else if (bottom > L.body.y + L.body.height) region.scrollByPx(bottom - (L.body.y + L.body.height));
        },
      });
    });
    region.refresh();
    region.syncInteractivity();

    if (action) {
      this.add
        .graphics()
        .lineStyle(2, surface.ink.hex, 1)
        .lineBetween(L.footer.x, L.footer.y, L.footer.x + L.footer.width, L.footer.y);
      const run = (): void => {
        if (!action.enabled) return;
        this.game.events.emit(SET_CARDS_ACTION_EVENT, setId);
        this.#close();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: action.label,
          type: typeRole.barTitle,
          rect: L.action,
          onClick: run,
          enabled: action.enabled,
        }),
      );
      this.#stops.set("set-cards:action", { rect: L.action, activate: run });
      order.push("set-cards:action");
    }
    order.push("set-cards:close");
    this.#route?.set(order, this.#stops);
    this.#fillThumbs();
    this.#hover?.onDraw();
  }
}
