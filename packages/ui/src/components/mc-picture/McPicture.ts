import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { PictureSource } from "../../shared/picture.types.js";
import { McPictureStyles } from "./mc-picture.styles.js";

/**
 * # Picture
 * A picture in a box: a card scan fitted whole, or a hero's face cropped around its focal point (`picture.cover`),
 * loaded lazily. With no `src`, or one that fails to load, the box says `picture.missing` on its ground. It is the
 * shared picture of the tiles and rows (`mc-picture-tile`, `mc-list-row`) and of any panel that shows a card.
 *
 * @element mc-picture
 * @attr framed - An ink outline inside the box.
 * @fires mc-image-error - `detail.key` (`picture.retry`), `detail.src`: the picture failed to load; the owner may hand a fresh URL.
 */
export class McPicture extends LitElement {
  static override styles = [ThemeStyles, McPictureStyles];

  static override properties: PropertyDeclarations = {
    picture: { attribute: false },
    framed: { type: Boolean, reflect: true },
    cover: { type: Boolean, reflect: true },
  };

  declare picture: PictureSource;
  declare framed: boolean;
  declare cover: boolean;
  readonly #failed = new Set<string>();
  readonly #retried = new Set<string>();
  readonly #sizes = new Map<string, { width: number; height: number }>();

  constructor() {
    super();
    this.picture = { src: null };
    this.framed = false;
    this.cover = false;
  }

  /** `object-position`: a share of the overflow, or (`centered`) the crop's middle on the point, kept inside the picture. */
  #position(): string {
    const cover = this.picture.cover!;
    const size = this.picture.src ? this.#sizes.get(this.picture.src) : undefined;
    if (!cover.centered || !size) return `${cover.x * 100}% ${cover.y * 100}%`;
    const box = { width: this.clientWidth || 1, height: this.clientHeight || 1 };
    const scale = Math.max(box.width / size.width, box.height / size.height);
    const share = (length: number, extent: number, point: number): number => {
      const crop = Math.min(length, extent / scale);
      const room = length - crop;
      return room <= 0 ? 50 : (Math.max(0, Math.min(room, point * length - crop / 2)) / room) * 100;
    };
    return `${share(size.width, box.width, cover.x)}% ${share(size.height, box.height, cover.y)}%`;
  }

  override willUpdate(): void {
    this.cover = this.picture.cover !== undefined;
    this.style.background = this.picture.fill ?? "";
  }

  override render() {
    const { src, missing, cover, retry } = this.picture;
    if (src === null || this.#failed.has(src)) return missing ? html`<span class="missing">${missing}</span>` : nothing;
    return html`<img
      src=${src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
      style=${cover ? `object-position:${this.#position()}` : nothing}
      @load=${(event: Event) => {
        if (retry !== undefined) this.#retried.delete(retry);
        const img = event.target as HTMLImageElement;
        if (cover?.centered && !this.#sizes.has(src) && img.naturalWidth > 0) {
          this.#sizes.set(src, { width: img.naturalWidth, height: img.naturalHeight });
          this.requestUpdate();
        }
      }}
      @error=${() => {
        this.#failed.add(src);
        if (retry !== undefined && !this.#retried.has(retry)) {
          this.#retried.add(retry);
          this.dispatchEvent(
            new CustomEvent("mc-image-error", { detail: { key: retry, src }, bubbles: true, composed: true }),
          );
        }
        this.requestUpdate();
      }}
    />`;
  }
}
