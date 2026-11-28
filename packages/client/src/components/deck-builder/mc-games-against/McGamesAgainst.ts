import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McGamesAgainstStyles } from "./mc-games-against.styles.js";
import type { GamesAgainstModel } from "./mc-games-against.types.js";

/**
 * # Games against
 * The Against block of "From your games": a stepper over the villains you have faced (or, on Everyone, every villain in the
 * pool), a You / Everyone switch for whose decks are read (the chosen one is filled and ticked, so it never rests on colour),
 * a note saying why there is nothing to read yet, and, on Everyone with sharing off, a "Share my games" button (one press
 * turns it on; the games finished so far are never sent). Turning sharing off stays in Settings.
 *
 * Focus stops: `games:previous`, `games:against` (when there is more than one villain), `games:source:yours`,
 * `games:source:everyone`, `games:share`.
 *
 * @element mc-games-against
 * @prop model - The block (`GamesAgainstModel`).
 * @fires mc-deck-builder - `games-step` `{ dir }`, `games-source` `{ source }`, `games-share`.
 */
export class McGamesAgainst extends BuilderElement {
  static override styles = [ThemeStyles, McGamesAgainstStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: GamesAgainstModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { stepper, share } = model;
    return html`${
        stepper
          ? html`<div class="step">
              ${
                stepper.steppable
                  ? html`<mc-button
                      class="prev"
                      kind="secondary"
                      data-stop="games:previous"
                      label="◂"
                      aria-label=${stepper.previousLabel}
                      @mc-press=${this.send({ type: "games-step", dir: -1 })}
                    ></mc-button>`
                  : nothing
              }
              <mc-button
                class="against"
                kind="secondary"
                data-stop=${stepper.steppable ? "games:against" : nothing}
                .label=${`${stepper.headline}${stepper.steppable ? " ▸" : ""}`}
                ?disabled=${!stepper.steppable}
                @mc-press=${this.send({ type: "games-step", dir: 1 })}
              ></mc-button>
            </div>`
          : nothing
      }
      <div class="sources">
        ${model.sources.map(
          (source) =>
            html`<mc-button
              kind=${source.chosen ? "primary" : "secondary"}
              data-stop=${`games:source:${source.id}`}
              .label=${`${source.chosen ? "✓ " : ""}${source.label}`}
              @mc-press=${this.send({ type: "games-source", source: source.id })}
            ></mc-button>`,
        )}
      </div>
      ${model.note ? html`<div class="note">${model.note}</div>` : nothing}
      ${
        share
          ? html`<div class="share">
              <mc-button
                kind="secondary"
                data-stop="games:share"
                .label=${share.label}
                @mc-press=${this.send({ type: "games-share" })}
              ></mc-button>
              <div class="line">${share.line}</div>
            </div>`
          : nothing
      }`;
  }
}
