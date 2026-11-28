import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import type { SetSheetView } from "../../../view/civil-war-builder-art.js";
import { CIVIL_WAR_EVENT, type CivilPictures, type CivilWarEventDetail } from "../civil-war.types.js";
import { McCivilSheetStyles } from "./mc-civil-sheet.styles.js";

/**
 * # Civil War set sheet
 * "Cards in this set": an `mc-dialog` over the dimmed screen listing every distinct card in a modular set, a card per cell
 * with its name, its copy count ("x2") and its type in words. A tap reads the card in Inspect, a mouse over a picture opens the
 * card hover. Add this set / Remove this set (primary; dimmed with the builder's reason when the set cannot be picked) and Close
 * sit in the footer; a tap on the scrim closes it. The sheet owns the keys while it is open: its stops are
 * `civil:sheet:card:<i>`, `civil:sheet:action` and `civil:sheet:close`.
 *
 * @element mc-civil-sheet
 * @prop sheet - `SetSheetView`.
 * @prop pictures - `CivilPictures`.
 * @attr set-id - The set's id.
 * @attr picked - The set is chosen.
 * @attr enabled - The set can be picked or removed.
 * @attr reason - Why it cannot, or empty.
 * @fires mc-civil-war - `inspect` to read a card, `act` for `civil:set:<id>`, `sheet` with null to close.
 */
export class McCivilSheet extends LitElement {
  static override styles = [McCivilSheetStyles];

  static override properties: PropertyDeclarations = {
    sheet: { attribute: false },
    pictures: { attribute: false },
    setId: { type: String, attribute: "set-id" },
    picked: { type: Boolean },
    enabled: { type: Boolean },
    reason: { type: String },
  };

  declare sheet: SetSheetView | null;
  declare pictures: CivilPictures | null;
  declare setId: string;
  declare picked: boolean;
  declare enabled: boolean;
  declare reason: string;

  constructor() {
    super();
    this.sheet = null;
    this.pictures = null;
    this.setId = "";
    this.picked = false;
    this.enabled = false;
    this.reason = "";
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  /** The scrolling body (the stick and the Page keys move it). */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement & { body?: HTMLElement | null }>("mc-dialog")?.body ?? null;
  }

  #say(detail: CivilWarEventDetail): void {
    this.dispatchEvent(
      new CustomEvent<CivilWarEventDetail>(CIVIL_WAR_EVENT, { detail, bubbles: true, composed: true }),
    );
  }

  override render() {
    const sheet = this.sheet;
    if (!sheet) return nothing;
    const close = (event: Event): void => {
      event.stopPropagation();
      this.#say({ type: "sheet", id: null });
    };
    return html`<mc-dialog .heading=${sheet.name} tall @mc-dialog-dismiss=${close}>
      <p slot="intro" class="intro">
        ${sheet.totalCards} cards, ${sheet.cards.length} different. Tap a card to read it.
      </p>
      <div class="cells">
        ${sheet.cards.map(
          (card, index) =>
            html`<div class="cell">
              <mc-press-card
                .stop=${`civil:sheet:card:${index}`}
                .action=${{ type: "inspect", cardId: card.face.cardId, face: card.face.face } satisfies CivilWarEventDetail}
                .holdAction=${{ type: "inspect", cardId: card.face.cardId, face: card.face.face } satisfies CivilWarEventDetail}
              >
                <mc-card-art
                  class=${card.face.landscape ? "landscape" : ""}
                  .picture=${this.pictures?.face(card.face) ?? null}
                  .cardId=${card.face.cardId}
                  .face=${card.face.face}
                ></mc-card-art>
                <div class="name">${card.face.name}</div>
                <div class="type">${card.copies > 1 ? `x${card.copies} · ` : ""}${card.typeWord}</div>
              </mc-press-card>
            </div>`,
        )}
      </div>
      <div slot="footer" class="footer">
        <mc-hint-button
          kind="primary"
          data-stop="civil:sheet:action"
          .label=${this.picked ? "Remove this set" : "Add this set"}
          ?disabled=${!this.enabled}
          .reason=${this.reason}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.#say({ type: "act", action: `civil:set:${this.setId}` });
          }}
        ></mc-hint-button>
        <mc-hint-button
          kind="secondary"
          data-stop="civil:sheet:close"
          label="Close"
          @mc-press=${close}
        ></mc-hint-button>
      </div>
    </mc-dialog>`;
  }
}
