import { html, LitElement, nothing, type PropertyDeclarations, type TemplateResult } from "lit";
import type { PressEvent } from "../../../shared/press/press.types.js";
import { McTermTextStyles } from "./mc-term-text.styles.js";
import type {
  McTermRun,
  McTermTextProps,
  McTermTipContent,
  TermGlossaryDetail,
  TermTipChangeDetail,
} from "./mc-term-text.types.js";

/** How long a mouse may be off a word and its tip before the tip closes: time to cross the gap between them. */
const LEAVE_MS = 220;

/**
 * # Term text
 * A sentence with glossary terms in it: each term that has a tip is a dotted word (`mc-dotted-term`, a focus stop
 * `<stop-prefix><id>`) that opens its definition on an ink plate (`mc-term-tip`). A mouse over the word opens it and
 * leaving word and plate closes it; a tap, or Enter on the stop, toggles it; a press anywhere else closes it. The open
 * term is this element's own state, told to its owner (`mc-term-tip-change`) so Escape can close the tip before it leaves
 * the screen (`closeTip()`). The tip's link raises `mc-term-glossary`.
 *
 * A term with no tip reads as plain words. Paragraph breaks are a gap, line breaks a `<br>`.
 *
 * @element mc-term-text
 * @prop runs - The sentence (`McTermRun`s).
 * @prop tips - The tips by term id (`McTermTipContent`).
 * @attr stop-prefix - What a term's focus stop key starts with (`term:`).
 * @attr link-stop - The open tip link's focus stop key (`tip-link`).
 * @fires mc-term-tip-change - `{ id }`: the open term, or null.
 * @fires mc-term-glossary - `{ id, heading }`: the tip's glossary link was pressed.
 */
export class McTermText extends LitElement implements McTermTextProps {
  static override styles = [McTermTextStyles];

  static override properties: PropertyDeclarations = {
    runs: { attribute: false },
    tips: { attribute: false },
    stopPrefix: { type: String, attribute: "stop-prefix" },
    linkStop: { type: String, attribute: "link-stop" },
    open: { state: true },
  };

  declare runs: readonly McTermRun[];
  declare tips: Readonly<Record<string, McTermTipContent>>;
  declare stopPrefix: string;
  declare linkStop: string;
  declare open: string | null;
  #leaving: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.runs = [];
    this.tips = {};
    this.stopPrefix = "term:";
    this.linkStop = "tip-link";
    this.open = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("pointerdown", this.#outside, true);
  }

  override disconnectedCallback(): void {
    window.removeEventListener("pointerdown", this.#outside, true);
    clearTimeout(this.#leaving);
    super.disconnectedCallback();
  }

  /** Closes the open tip; true when one was open (Escape then stays on the screen). */
  closeTip(): boolean {
    if (this.open === null) return false;
    this.#set(null);
    return true;
  }

  #set(id: string | null): void {
    clearTimeout(this.#leaving);
    if (this.open === id) return;
    this.open = id;
    this.dispatchEvent(
      new CustomEvent<TermTipChangeDetail>("mc-term-tip-change", { detail: { id }, bubbles: true, composed: true }),
    );
  }

  /** The term whose word or tip a pointer event came from, by the id its element carries. */
  #termOf(event: Event): string | null {
    for (const node of event.composedPath()) {
      if (node instanceof HTMLElement && node.dataset.term) return node.dataset.term;
    }
    return null;
  }

  readonly #pressed = (event: PressEvent): void => {
    const id = this.#termOf(event);
    if (id === null) return;
    event.stopPropagation();
    this.#set(this.open === id ? null : id);
  };

  readonly #hover = (event: CustomEvent<{ over: boolean }>): void => {
    event.stopPropagation();
    const id = this.#termOf(event);
    if (id === null) return;
    if (event.detail.over) this.#set(id);
    else this.#later();
  };

  #later(): void {
    clearTimeout(this.#leaving);
    this.#leaving = setTimeout(() => this.#set(null), LEAVE_MS);
  }

  /** A press anywhere that is neither the open word nor its tip closes the tip. */
  readonly #outside = (event: Event): void => {
    if (this.open === null) return;
    // The open word and its tip both carry `data-term`.
    const keeps = event.composedPath().some((node) => node instanceof HTMLElement && node.dataset.term === this.open);
    if (!keeps) this.#set(null);
  };

  readonly #link = (event: Event): void => {
    event.stopPropagation();
    const id = this.open;
    const tip = id === null ? undefined : this.tips[id];
    if (id === null || !tip) return;
    this.dispatchEvent(
      new CustomEvent<TermGlossaryDetail>("mc-term-glossary", {
        detail: { id, heading: tip.heading },
        bubbles: true,
        composed: true,
      }),
    );
  };

  #run(run: McTermRun): TemplateResult | typeof nothing {
    if (run.kind === "text") return html`<span>${run.text}</span>`;
    if (run.kind === "break") return html`<br />`;
    if (!this.tips[run.id]) return html`<span>${run.label}</span>`;
    return html`<mc-dotted-term
      data-term=${run.id}
      .stop=${`${this.stopPrefix}${run.id}`}
      .action=${run.id}
      label=${run.label}
    ></mc-dotted-term>`;
  }

  /** Splits the runs at paragraph breaks. */
  #paragraphs(): McTermRun[][] {
    const paragraphs: McTermRun[][] = [[]];
    for (const run of this.runs) {
      if (run.kind === "break" && run.paragraph) paragraphs.push([]);
      else paragraphs[paragraphs.length - 1]!.push(run);
    }
    return paragraphs.filter((paragraph) => paragraph.length > 0);
  }

  override render() {
    const open = this.open;
    const tip = open === null ? undefined : this.tips[open];
    const anchor =
      open === null ? null : this.renderRoot.querySelector<HTMLElement>(`mc-dotted-term[data-term="${open}"]`);
    return html`<div class="text" @mc-pressed=${this.#pressed} @mc-term-hover=${this.#hover}>
      ${this.#paragraphs().map((paragraph) => html`<p>${paragraph.map((run) => this.#run(run))}</p>`)}
      ${
        tip && anchor
          ? html`<mc-term-tip
              data-term=${open}
              .anchor=${anchor}
              heading=${tip.heading}
              body=${tip.body}
              link-label=${tip.linkLabel}
              link-stop=${this.linkStop}
              @pointerenter=${() => clearTimeout(this.#leaving)}
              @pointerleave=${(event: PointerEvent) => {
                if (event.pointerType === "mouse") this.#later();
              }}
              @mc-term-link=${this.#link}
            ></mc-term-tip>`
          : nothing
      }
    </div>`;
  }
}
