import { html, type PropertyDeclarations } from "lit";
import { ThemeStyles, type CardSection, type CardSectionsModel } from "@mc/ui";
import { deckFaceGroupLayout } from "../../../view/deck-faces.js";
import { poolGridGeometry } from "../../../view/deck-pool-grid.js";
import { DeckCheckElement } from "../shared/DeckCheckElement.js";
import { McDeckCardSectionsStyles } from "./mc-deck-card-sections.styles.js";
import type { DeckCardGroupModel, DeckFaceGroupModel, McDeckCardSectionsProps } from "./mc-deck-card-sections.types.js";

/** The room a section leaves at its sides and a face tile's own margin, as the card list always had. */
const SIDE = 8;
const FACES_INSET = 4;

/**
 * # Deck card sections
 * The deck's own cards as a natively scrolling list (`mc-card-sections`): the identity's faces, then the cards by
 * group. The list's columns and tile sizes depend on how wide the screen leaves it, so this reads its own width
 * (a `ResizeObserver`) and gives `mc-card-sections` the geometry the pool grid uses. A tap on a card or a face says so;
 * a mouse over a picture or a hold on it raises the card hover and Inspect events (`mc-card-hover`, `mc-card-inspect`).
 *
 * @element mc-deck-card-sections
 * @fires mc-deck-check - `{ type: "card", key }` on a tap on a card cell or face tile.
 */
export class McDeckCardSections extends DeckCheckElement implements McDeckCardSectionsProps {
  static override styles = [ThemeStyles, McDeckCardSectionsStyles];

  static override properties: PropertyDeclarations = {
    faces: { attribute: false },
    groups: { attribute: false },
    note: { type: String },
    cardScale: { type: Number, attribute: "card-scale" },
    desktop: { type: Boolean },
    boxWidth: { state: true },
  };

  declare faces: readonly DeckFaceGroupModel[];
  declare groups: readonly DeckCardGroupModel[];
  declare note: string;
  declare cardScale: number;
  declare desktop: boolean;
  /** How wide the list is now (px), read from the element's own box. */
  declare boxWidth: number;
  #resize: ResizeObserver | null = null;

  constructor() {
    super();
    this.faces = [];
    this.groups = [];
    this.note = "";
    this.cardScale = 1;
    this.desktop = false;
    this.boxWidth = 0;
  }

  /** The list's native scroller, for the pad's stick and paging. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-card-sections")?.scroller ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === "undefined") return;
    this.#resize = new ResizeObserver(() => {
      this.boxWidth = this.clientWidth;
    });
    this.#resize.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
    this.#resize = null;
  }

  /** The sections `mc-card-sections` draws for the width: faces sized to rows, a note, the groups' cells. */
  #sections(width: number): CardSection[] {
    const faceWidth = width - SIDE - FACES_INSET * 2;
    const sections: CardSection[] = this.faces.map((group) => {
      const art = deckFaceGroupLayout(faceWidth, group.tiles.length).art[0];
      return {
        kind: "faces",
        title: group.title,
        tileWidth: art?.width ?? 84,
        tileHeight: art?.height ?? 118,
        tiles: group.tiles,
      };
    });
    if (this.note) sections.push({ kind: "note", text: this.note });
    for (const group of this.groups) sections.push({ kind: "cards", title: group.title, cells: group.cells });
    return sections;
  }

  #modelFor(width: number): CardSectionsModel {
    const cells = this.groups.reduce((sum, group) => sum + group.cells.length, 0);
    const geometry = poolGridGeometry(width, cells, this.desktop, this.cardScale);
    return {
      sections: this.#sections(width),
      contentWidth: width - SIDE,
      columns: geometry.columns,
      cellHeight: geometry.cellHeight,
      gap: SIDE,
    };
  }

  /** The list drew: its cards and faces are the focus route's stops, so the scene reads them again. */
  protected override updated(): void {
    this.emitRendered();
  }

  override render() {
    if (this.boxWidth <= 0) return html``;
    return html`<mc-card-sections
      .model=${this.#modelFor(this.boxWidth)}
      @mc-activate=${(event: CustomEvent<{ key: string }>) => {
        event.stopPropagation();
        this.emit({ type: "card", key: event.detail.key });
      }}
    ></mc-card-sections>`;
  }
}
