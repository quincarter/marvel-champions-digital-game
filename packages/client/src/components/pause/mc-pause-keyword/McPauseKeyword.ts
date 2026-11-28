import { McPress, watchCard } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import type { PauseKeywordInput, PauseKeywordTone } from "../pause.types.js";
import { McPauseKeywordStyles } from "./mc-pause-keyword.styles.js";

/**
 * # Pause keyword card
 * One bordered keyword or status card of the Rules reference pane: the term, its definition, and "On <card>." for the first
 * card that carries it. A status (Stunned, Confused, Tough) is a filled card in its own colour with paper text, the term
 * always the plain word, never colour alone. The card is the control: a tap opens Rules reference on this term. A mouse
 * over the card's name raises the card hover (`watchCard`), and a hold on it Inspects the card.
 *
 * @element mc-pause-keyword
 * @prop keyword - The card (`PauseKeywordInput`).
 * @attr tone - plain | stunned | confused | tough (reflected from the keyword).
 * @fires mc-pressed - `PressDetail`, with `{ type: "keyword", id }` as its action.
 */
export class McPauseKeyword extends McPress {
  static override styles = McPauseKeywordStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    keyword: { attribute: false },
    tone: { type: String, reflect: true },
  };

  declare keyword: PauseKeywordInput | null;
  declare tone: PauseKeywordTone;
  #watched: HTMLElement | null = null;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.keyword = null;
    this.tone = "plain";
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("keyword") || !this.keyword) return;
    this.stop = `keyword:${this.keyword.id}`;
    this.action = { type: "keyword", id: this.keyword.id };
    this.tone = this.keyword.tone;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const tail = this.renderRoot.querySelector<HTMLElement>(".tail");
    if (tail === this.#watched) return;
    this.#unwatch?.();
    this.#watched = tail;
    this.#unwatch = tail
      ? watchCard(tail, () => {
          const id = this.keyword?.tail?.cardId;
          return id ? { cardId: id } : null;
        })
      : null;
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = null;
    this.#watched = null;
    super.disconnectedCallback();
  }

  override render() {
    const keyword = this.keyword;
    if (!keyword) return nothing;
    return html`<div class="card">
      <h4 class="term">${keyword.term}</h4>
      <p class="definition">${keyword.definition}</p>
      ${keyword.tail ? html`<span class="tail">${keyword.tail.text}</span>` : nothing}
    </div>`;
  }
}
