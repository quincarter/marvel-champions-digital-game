import { ThemeStyles } from "@mc/ui";
import { html, LitElement, type PropertyDeclarations, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { McChatLinesStyles } from "./mc-chat-lines.styles.js";
import type { ChatLinesModel } from "./mc-chat-lines.types.js";

/**
 * # Chat lines
 * The room's chat lines in one natively scrolling column, mine in a heavier frame. A change of `model.toEnd` scrolls it to
 * the newest line. The column is the `data-key` it is given (`list:chat`), which the pad's stick scrolls.
 *
 * @element mc-chat-lines
 * @prop model - The lines (`ChatLinesModel`).
 * @attr list-key - The scroller's `data-key` ("list:chat").
 */
export class McChatLines extends LitElement {
  static override styles = [ThemeStyles, McChatLinesStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    listKey: { type: String, attribute: "list-key" },
  };

  declare model: ChatLinesModel;
  declare listKey: string;

  constructor() {
    super();
    this.model = { lines: [], empty: "", toEnd: 0 };
    this.listKey = "list:chat";
  }

  /** The scrolling column. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".list");
  }

  protected override updated(changed: PropertyValues): void {
    const list = this.scroller;
    if (!list || !changed.has("model")) return;
    const before = (changed.get("model") as ChatLinesModel | undefined)?.toEnd;
    if (before === undefined || before !== this.model.toEnd) list.scrollTop = list.scrollHeight;
  }

  override render() {
    const { lines, empty } = this.model;
    return html`<div class="list scroller" tabindex="-1" data-key=${this.listKey}>
      ${
        lines.length === 0
          ? html`<span class="empty">${empty}</span>`
          : repeat(
              lines,
              (line) => line.id,
              (line) => html`<div class="line" ?data-mine=${line.mine}><span>${line.who}: ${line.text}</span></div>`,
            )
      }
    </div>`;
  }
}
