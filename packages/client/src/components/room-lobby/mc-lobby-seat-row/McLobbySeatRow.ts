import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { LOBBY_EVENT, type LobbyEvent } from "../room-lobby.types.js";
import { CardWatchController } from "../card-watch.controller.js";
import { McLobbySeatRowStyles } from "./mc-lobby-seat-row.styles.js";
import type { LobbySeatRowModel } from "./mc-lobby-seat-row.types.js";
import "../mc-lobby-button/mc-lobby-button.js";
import "../mc-lobby-button-row/mc-lobby-button-row.js";

/**
 * # Lobby seat row
 * One seat of the room: the hero's picture (a "?" frame until a deck), the tag ("SEAT 2 · PRESET"), the deck's hero, detail
 * and mods or "No deck yet", who holds it (a filled dot while connected, a hollow one otherwise, always with the words),
 * "requested by me", a boxed "Different build", and a column of buttons (Ask / Take / Leave / Withdraw / Remove, Play,
 * Give to...). Under the row, in order: the open Give list, a deck the host turned down (boxed, headed with "!"), a Mod Store
 * link per missing mod, the deck button, and each request with Approve and Deny. My own seat has the heavier frame.
 * Every button is an `mc-lobby-button`; the hero picture is a card picture (`watchCard`).
 *
 * @element mc-lobby-seat-row
 * @prop model - The seat (`LobbySeatRowModel`); null draws nothing.
 * @fires mc-pressed - From each button (the section's relay raises the `mc-room-lobby` event).
 * @fires mc-card-hover - See `watchCard`.
 * @fires mc-card-hover-end - See `watchCard`.
 * @fires mc-card-inspect - See `watchCard`.
 */
export class McLobbySeatRow extends LitElement {
  static override styles = [McLobbySeatRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: LobbySeatRowModel | null;

  constructor() {
    super();
    this.model = null;
    new CardWatchController(this);
    new FeatureRelay<LobbyEvent>(this, LOBBY_EVENT);
  }

  #art(row: LobbySeatRowModel) {
    const deck = row.deck;
    return deck
      ? html`<mc-picture-tile
          class="art"
          .picture=${deck.picture}
          .frame=${2}
          data-card=${deck.cardId}
        ></mc-picture-tile>`
      : html`<div class="art blank" aria-hidden="true">?</div>`;
  }

  #words(row: LobbySeatRowModel) {
    const deck = row.deck;
    const filled = row.holder.held && row.holder.connected;
    return html`<div class="words">
      <span class="tag">${row.tag}</span>
      ${
        deck
          ? html`<span class="hero">${deck.hero}</span>
              <span class="detail">${deck.detail}</span>
              ${deck.mods ? html`<span class="detail mods">${deck.mods}</span>` : nothing}`
          : html`<span class="hero none">${row.noDeck}</span>`
      }
      <span class="holder" data-held=${row.holder.held}>
        <span class="dot" ?data-filled=${filled} aria-hidden="true"></span>
        <span class="who">${row.holder.text}</span>
      </span>
      ${row.requestedByMe ? html`<span class="detail asked">${row.requestedByMe}</span>` : nothing}
      ${row.mismatch ? html`<span class="mismatch">${row.mismatch}</span>` : nothing}
    </div>`;
  }

  #buttons(row: LobbySeatRowModel) {
    const { action, play, give } = row;
    if (!action && !play && !give) return nothing;
    return html`<div class="buttons">
      ${action ? html`<mc-lobby-button .model=${action}></mc-lobby-button>` : nothing}
      ${play ? html`<mc-lobby-button .model=${play}></mc-lobby-button>` : nothing}
      ${give ? html`<mc-lobby-button .model=${give.toggle}></mc-lobby-button>` : nothing}
    </div>`;
  }

  #giveList(row: LobbySeatRowModel) {
    const give = row.give;
    if (!give?.open) return nothing;
    return html`<div class="give" data-give=${row.id}>
      ${
        give.candidates.length === 0
          ? html`<p class="nobody">${give.nobody}</p>`
          : repeat(
              give.candidates,
              (candidate) => candidate.stop,
              (candidate) => html`<mc-lobby-button .model=${candidate}></mc-lobby-button>`,
            )
      }
    </div>`;
  }

  #problem(row: LobbySeatRowModel) {
    const problem = row.problem;
    if (!problem) return nothing;
    return html`<div class="problem" role="alert">
      <span class="mark" aria-hidden="true">!</span>
      <div class="problem-words">
        <span class="problem-heading">${problem.heading}</span>
        <span class="problem-title">${problem.title}</span>
        <span class="problem-reason">${problem.reason}</span>
      </div>
    </div>`;
  }

  #missing(row: LobbySeatRowModel) {
    return repeat(
      row.missingMods,
      (mod) => mod.store.stop,
      (mod) =>
        html`<div class="mod">
          <p class="mod-text">${mod.text}</p>
          <mc-lobby-button .model=${mod.store}></mc-lobby-button>
        </div>`,
    );
  }

  #requests(row: LobbySeatRowModel) {
    return repeat(
      row.requests,
      (request) => request.approve.stop,
      (request) =>
        html`<div class="request">
          <p class="request-text">${request.text}</p>
          <mc-lobby-button-row .row=${[request.approve, request.deny]}></mc-lobby-button-row>
        </div>`,
    );
  }

  override render() {
    const row = this.model;
    if (!row) return nothing;
    return html`<article class="row" ?data-mine=${row.mine} data-seat=${row.id}>
      <div class="top">${this.#art(row)} ${this.#words(row)} ${this.#buttons(row)}</div>
      ${this.#giveList(row)} ${this.#problem(row)} ${this.#missing(row)}
      ${row.deckButton ? html`<mc-lobby-button .model=${row.deckButton}></mc-lobby-button>` : nothing}
      ${this.#requests(row)}
    </article>`;
  }
}
