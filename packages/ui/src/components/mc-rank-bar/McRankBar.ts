import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { fitOneLine } from "../../shared/fit.js";
import { onTap } from "../../shared/tap.js";
import { McRankBarStyles } from "./mc-rank-bar.styles.js";
import type { RankBarModel } from "./mc-rank-bar.types.js";

/**
 * # Rank bar
 * The Title's rank plate: the rank, the lifetime points and a thin bar to the next rank, on an ink plate that turns red
 * while a rank-up is announced. A full plate (the art panel) stacks the rank over its name; a compact one (a phone's
 * strip) puts them on one line. Sized by whoever places it; a tap on it is reported as `mc-press` (the scene opens the
 * Trophy Room), by the tap rule, never by a finger lifting at the end of a swipe.
 *
 * @element mc-rank-bar
 * @attr up - A rank-up is being announced (reflected).
 * @fires mc-press - The plate was tapped.
 */
export class McRankBar extends LitElement {
  static override styles = [ThemeStyles, McRankBarStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    up: { type: Boolean, reflect: true },
  };

  declare model: RankBarModel | null;
  declare up: boolean;

  constructor() {
    super();
    this.model = null;
    this.up = false;
  }

  #stopTap: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopTap = onTap(this, () =>
      this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true })),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopTap?.();
    this.#stopTap = null;
  }

  override willUpdate(): void {
    this.up = this.model?.up ?? false;
  }

  override updated(): void {
    const model = this.model;
    if (!model) return;
    const points = this.renderRoot.querySelector<HTMLElement>(".points");
    for (const line of this.renderRoot.querySelectorAll<HTMLElement>(".line")) {
      // The first line leaves room for the points at its right, as the Phaser plate did.
      const first = line.classList.contains("label") || line.classList.contains("first");
      line.style.right = first && points ? `${points.offsetWidth + 14}px` : "";
      fitOneLine(line);
    }
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const first = m.compact ? { top: 4 } : { top: 5 };
    return html`<div class="plate" data-key="plate"></div>
      <div class="line label first" style=${`top:${first.top}px`}>${m.label}</div>
      ${m.points !== null ? html`<div class="points" style=${`top:${first.top}px`}>${m.points}</div>` : nothing}
      ${m.compact ? nothing : html`<div class="line title" style="top:19px">${m.title}</div>`}
      ${
        m.up || m.next === null
          ? nothing
          : html`<div class="bar" style=${`top:${m.compact ? 20 : 36}px`}>
                <div
                  class="fill"
                  style=${`width:${m.fraction > 0 ? `max(2px, calc((100% - 2px) * ${m.fraction}))` : "0"}`}
                ></div>
              </div>
              <div class="line caption" style=${`top:${m.compact ? 27 : 44}px`}>${m.next}</div>`
      }`;
  }
}
