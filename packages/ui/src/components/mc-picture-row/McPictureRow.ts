import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { McPictureRowModel } from "./mc-picture-row.types.js";
import { McPictureRowStyles } from "./mc-picture-row.styles.js";

/**
 * # Picture row
 * A list row led by a picture: a deck with its hero, a seat with its pick. The picture (a lazy `<img>`, cropped around
 * a focal point) carries small stamps along its foot (aspects), then the title (two lines at most), a meta line, a corner
 * badge and a footer line. A chosen row inverts to ink; a problem row gets a heavier red outline and a red title; a row
 * that is shown but not open fades. Decorative: the screen puts a tap area over it (press, hold, hover and focus belong
 * to the screen).
 *
 * @element mc-picture-row
 * @prop model - What it shows (`McPictureRowModel`).
 */
export class McPictureRow extends LitElement {
  static override styles = [ThemeStyles, McPictureRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: McPictureRowModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const top = m.group ? (m.groupHeight ?? 16) : 2;
    const classes = ["card", m.selected ? "selected" : "", m.alert ? "alert" : "", m.dim && !m.selected ? "dim" : ""];
    const wordsLeft = 6 + m.picture.width + 10;
    const focus = m.picture.focus ?? { x: 0.5, y: 0.2 };
    return html`
      ${m.group ? html`<div class="group">${m.group}</div>` : nothing}
      <div class=${classes.filter(Boolean).join(" ")} style=${styleMap({ top: `${top}px` })}>
        <div class="picture" style=${styleMap({ width: `${m.picture.width}px` })}>
          ${
            m.picture.src
              ? html`<img
                  src=${m.picture.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                  style=${`object-position:${focus.x * 100}% ${focus.y * 100}%`}
                />`
              : nothing
          }
          <div class="stamps">
            ${m.stamps.map(
              (stamp) =>
                html`<span class="stamp" style=${`background:${stamp.fill};color:${stamp.ink}`}>${stamp.label}</span>`,
            )}
          </div>
        </div>
        <div class="words" style=${styleMap({ left: `${wordsLeft}px` })}>
          <div class="title">${m.title}</div>
          <div class="meta">${m.meta}</div>
          ${m.footer ? html`<div class="footer">${m.footer}</div>` : nothing}
        </div>
        ${m.badge ? html`<span class="badge">${m.badge}</span>` : nothing}
      </div>
    `;
  }
}
