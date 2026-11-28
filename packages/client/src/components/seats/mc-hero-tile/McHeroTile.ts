import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { onHold } from "@mc/ui/tap";
import { watchCard } from "@mc/ui";
import { SeatsElement } from "../SeatsElement.js";
import type { HeroTileModel } from "../seats.types.js";
import { McHeroTileStyles } from "./mc-hero-tile.styles.js";

/**
 * # Hero tile
 * A hero on a shelf: the picture (aspect stamps along its foot, the seat or lock tag top right, a Team-Up plate top left)
 * over a caption of the title and one line (the source and identity, a recommendation's reason, or a short warning that
 * replaces it). The chosen tile wears the heavy red frame and says SEAT n in its tag, so it never rests on colour alone;
 * a tile that cannot be seated now is dimmed and says why in its tag. The whole tile is one stop, `hero:<card id>` or
 * `hero-rec:<card id>` (the model's `key`).
 *
 * A press raises `{ type: "hero", key, via: "press" }`. A hold or right-click (and the pad's Inspect key, through
 * `inspect()`) raises `via: "inspect"` when the model allows it. The picture is a card picture for the hover popover
 * (`watchCard`); its own `mc-card-inspect` is held back here, as the tile's inspect is the roster's richer one.
 *
 * `near` is the picture lease: the row sets it while the tile is near the view, and a tile off it drops its URL so the
 * browser can let the image go; the plain ground and caption stay.
 *
 * @element mc-hero-tile
 * @prop model - The tile (`HeroTileModel`).
 * @prop near - Whether the picture is loaded (default true).
 * @fires mc-seats - `{ type: "hero", key, via }`.
 */
export class McHeroTile extends SeatsElement {
  static override styles = [McHeroTileStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    near: { attribute: false },
    failedSrc: { state: true },
  };

  declare model: HeroTileModel | null;
  declare near: boolean;
  /** The URL that failed to load, so the initial stands in for it. */
  declare failedSrc: string;
  #unwatch: (() => void) | null = null;
  #unhold: (() => void) | null = null;

  constructor() {
    super();
    this.model = null;
    this.near = true;
    this.failedSrc = "";
  }

  /** The picture's element: where a hover popover is wanted. */
  get artElement(): HTMLElement | null {
    return this.renderRoot.querySelector(".art");
  }

  /** The pad's Inspect key: the same as a hold. */
  inspect(): void {
    const tile = this.model;
    if (tile?.inspect) this.emit({ type: "hero", key: tile.key, via: "inspect" });
  }

  protected override act(action: string): void {
    const tile = this.model;
    if (tile && action === "press") this.emit({ type: "hero", key: tile.key, via: "press" });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unhold?.();
    this.#unwatch = null;
    this.#unhold = null;
  }

  protected override updated(): void {
    super.updated();
    const art = this.artElement;
    const press = this.renderRoot.querySelector<HTMLElement>(".press");
    if (!art || !press || this.#unwatch) return;
    this.#unwatch = watchCard(art, () => (this.model?.cardId ? { cardId: this.model.cardId } : null));
    // The picture's hold would open the card popover's Inspect; the tile's own inspect is the one the roster wants.
    art.addEventListener("mc-card-inspect", (event) => event.stopPropagation());
    this.#unhold = onHold(press, () => this.inspect());
  }

  override render() {
    const tile = this.model;
    if (!tile) return nothing;
    const picture = tile.picture && this.near ? tile.picture : tile.picture ? { ...tile.picture, src: null } : null;
    const gone = !tile.picture?.src || tile.picture.src === this.failedSrc;
    const name = [tile.label ?? tile.title, tile.warning ?? tile.subtitle, tile.tag ?? ""]
      .filter((part) => part !== "")
      .join(", ");
    return html`<button
      type="button"
      class="press"
      data-action="press"
      data-stop=${tile.key}
      ?data-selected=${tile.selected}
      ?data-dim=${tile.dim}
      aria-label=${name}
      aria-pressed=${tile.selected ? "true" : "false"}
    >
      <span class="art">
        ${
          picture
            ? html`<mc-picture-tile
                class="pic"
                .picture=${picture}
                .frame=${0}
                ground="ink"
                @mc-image-error=${(event: CustomEvent<{ src: string }>) => (this.failedSrc = event.detail.src)}
              ></mc-picture-tile>`
            : nothing
        }
        ${gone ? html`<span class="initial">${tile.title.slice(0, 1)}</span>` : nothing}
        ${tile.tag ? html`<span class="tag">${tile.tag}</span>` : nothing}
        ${tile.plate ? html`<span class="plate">${tile.plate}</span>` : nothing}
        ${
          tile.stamps.length > 0
            ? html`<span class="stamps"
                >${tile.stamps.map(
                  (stamp) =>
                    html`<span class="stamp" style=${styleMap({ "--stamp-fill": stamp.fill, "--stamp-ink": stamp.ink })}
                      >${stamp.label}</span
                    >`,
                )}</span
              >`
            : nothing
        }
      </span>
      <span class="caption">
        <span class="title">${tile.title}</span>
        ${
          tile.warning
            ? html`<span class="line caution">${tile.warning}</span>`
            : html`<span class="line">${tile.subtitle}</span>`
        }
      </span>
    </button>`;
  }
}
