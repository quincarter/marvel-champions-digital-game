import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type PictureSource } from "@mc/ui";
import { ModStoreElement } from "../shared/ModStoreElement.js";
import { CardWatches } from "../shared/card-watches.js";
import { McPackFacesStyles } from "./mc-pack-faces.styles.js";
import type { McPackFacesProps, PackFacesModel } from "./mc-pack-faces.types.js";

/**
 * # Pack pictures
 * The pictures that lead a pack's page: the pack's cover (the box art, whole), then its featured card's faces (a hero's two
 * sides, any other card its one), or one square slot (the pack's initial on ink while nothing has loaded) for a pack with
 * neither. Where the title block has no room beside them the extra faces fold away (container queries, not arithmetic).
 * A face raises the card hover popover, and a hold or right-click raises Inspect (`watchCard`).
 *
 * @element mc-pack-faces
 */
export class McPackFaces extends ModStoreElement implements McPackFacesProps {
  static override styles = [ThemeStyles, McPackFacesStyles];

  static override properties: PropertyDeclarations = {
    pictures: { attribute: false },
  };

  declare pictures: PackFacesModel | null;
  readonly #watches = new CardWatches();

  constructor() {
    super();
    this.pictures = null;
  }

  protected override updated(): void {
    const faces = [...this.renderRoot.querySelectorAll<HTMLElement>(".face")];
    this.#watches.watch(faces, (face) => this.pictures?.faces[Number(face.dataset.index)]?.hover ?? null);
  }

  override disconnectedCallback(): void {
    this.#watches.clear();
    super.disconnectedCallback();
  }

  #source(picture: { src: string | null; retry?: string; missing: string }, cover: boolean): PictureSource {
    return {
      src: picture.src,
      missing: picture.missing,
      ...(picture.retry ? { retry: picture.retry } : {}),
      ...(cover ? { cover: { x: 0.5, y: 0.3 } } : {}),
    };
  }

  override render() {
    const p = this.pictures;
    if (!p) return nothing;
    if (p.square) {
      return html`<div class="square">
        <mc-picture-tile
          letter
          .frame=${0}
          .picture=${this.#source(p.square, p.square.fit === "cover")}
        ></mc-picture-tile>
      </div>`;
    }
    return html`${
      p.cover
        ? html`<div class="cover" data-key="page-cover">
            <mc-picture-tile .frame=${0} .picture=${this.#source(p.cover, false)}></mc-picture-tile>
          </div>`
        : nothing
    }
    ${p.faces.map(
      (face, index) =>
        html`<div class="face" data-index=${index} data-key=${`page-face:${index}`}>
          <mc-picture-tile .frame=${2} .picture=${this.#source(face, false)}></mc-picture-tile>
        </div>`,
    )}`;
  }
}
