import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { SvgOp } from "@mc/ui";
import { playPlatformMarkOf } from "../../../view/play-platform-mark.js";
import { PLATFORM_ICON_VIEWBOX, playPlatformSvgOps } from "../../../view/play-platform-svg.js";
import { McLobbyPeopleStyles } from "./mc-lobby-people.styles.js";
import type { LobbyPeopleModel, LobbyPersonModel } from "./mc-lobby-people.types.js";

function drawOp(op: SvgOp) {
  const fill = "fill" in op && op.fill !== undefined ? op.fill : "none";
  const stroke = "stroke" in op && op.stroke !== undefined ? op.stroke : "none";
  const sw = "sw" in op ? (op.sw ?? 1) : 1;
  switch (op.k) {
    case "rect":
      return svg`<rect x=${op.x} y=${op.y} width=${op.w} height=${op.h} fill=${fill} stroke=${stroke} stroke-width=${sw}></rect>`;
    case "circle":
      return svg`<circle cx=${op.cx} cy=${op.cy} r=${op.r} fill=${fill} stroke=${stroke} stroke-width=${sw}></circle>`;
    case "line":
      return svg`<line x1=${op.x1} y1=${op.y1} x2=${op.x2} y2=${op.y2} fill=${fill} stroke=${stroke} stroke-width=${sw}></line>`;
    case "path":
      return svg`<path d=${op.d} fill=${fill} stroke=${stroke} stroke-width=${sw}></path>`;
    default:
      return nothing;
  }
}

/**
 * # Lobby people
 * Who is in the room: the heading, then a card per person (name, a boxed role in capitals, the device as words beside its
 * small platform icon, and the seats and build note), or with `compact` one line each (the Epic and Competitive panels).
 * The icon never stands alone: the device words are always beside it.
 *
 * @element mc-lobby-people
 * @prop model - The people (`LobbyPeopleModel`); null draws nothing.
 */
export class McLobbyPeople extends LitElement {
  static override styles = [McLobbyPeopleStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbyPeopleModel | null;

  constructor() {
    super();
    this.model = null;
  }

  #device(person: LobbyPersonModel) {
    if (!person.device) return nothing;
    const mark = person.platform ? playPlatformMarkOf({ platform: person.platform }) : null;
    return html`<div class="device">
      ${
        mark
          ? html`<svg
              class="icon"
              viewBox=${`0 0 ${PLATFORM_ICON_VIEWBOX[0]} ${PLATFORM_ICON_VIEWBOX[1]}`}
              aria-hidden="true"
            >
              ${playPlatformSvgOps(mark, "currentColor", 0.85).map(drawOp)}
            </svg>`
          : nothing
      }
      <span>${person.device}</span>
    </div>`;
  }

  #person(person: LobbyPersonModel) {
    return html`<li class="person" data-person=${person.id}>
      <div class="top">
        <span class="name">${person.name}</span>
        <span class="role">${person.role}</span>
      </div>
      ${this.#device(person)} ${person.more ? html`<div class="more">${person.more}</div>` : nothing}
    </li>`;
  }

  override render() {
    const people = this.model;
    if (!people) return nothing;
    return html`<mc-section-heading .label=${people.heading}></mc-section-heading>
      <ul class="people" ?data-compact=${people.compact}>
        ${repeat(
          people.rows,
          (person) => person.id,
          (person) =>
            people.compact ? html`<li class="line" data-person=${person.id}>${person.line}</li>` : this.#person(person),
        )}
      </ul>`;
  }
}
