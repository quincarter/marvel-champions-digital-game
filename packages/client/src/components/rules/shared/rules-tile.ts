/**
 * A card picture tile of the Rules reference: the scan above, its name below, one border round both. Drawn as a template
 * (not an element each) because the Card list can hold a thousand of them: a button with the scan as a lazy image, pressed
 * by a tap (never the lift that ends a swipe) or the focus route's click, and watched for the card hover popover and a
 * hold's Inspect (`watchedCard`). The owner element passes `onPress`.
 */
import { css, html, type TemplateResult } from "lit";
import { tapped, watchedCard, type PictureSource } from "@mc/ui";
import { t } from "../../../i18n/translate.js";

export interface RulesTile {
  /** The tile's focus stop and what a press says (`row:entry:stunned:card:01001`). */
  readonly key: string;
  readonly name: string;
  readonly cardId: string;
  /** The face the hover shows when it is not the card's default. */
  readonly face?: unknown;
  readonly picture: PictureSource;
}

export function cardTile(tile: RulesTile, onPress: (key: string) => void): TemplateResult {
  const src = tile.picture.src;
  return html`<button
    type="button"
    class="tile"
    tabindex="-1"
    data-stop=${tile.key}
    aria-label=${tile.name}
    ${tapped(() => onPress(tile.key))}
    ${watchedCard(() => ({ cardId: tile.cardId, face: tile.face }))}
    @click=${(event: MouseEvent) => {
      if (event.detail === 0) onPress(tile.key);
    }}
  >
    <span class="art">
      ${
        src
          ? html`<img
                src=${src}
                alt=""
                loading="lazy"
                decoding="async"
                draggable="false"
                @error=${(event: Event) => {
                  const img = event.target as HTMLImageElement;
                  img.hidden = true;
                  (img.nextElementSibling as HTMLElement | null)?.removeAttribute("hidden");
                  const retry = tile.picture.retry;
                  if (retry !== undefined)
                    img.dispatchEvent(
                      new CustomEvent("mc-image-error", { detail: { key: retry, src }, bubbles: true, composed: true }),
                    );
                }}
              /><span class="missing" hidden>${t("rules.noScan")}</span>`
          : html`<span class="missing">${t("rules.noScan")}</span>`
      }
    </span>
    <span class="name">${tile.name}</span>
  </button>`;
}

export const RulesTileStyles = css`
  .tile {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 3px solid var(--mc-line-ink);
    background: var(--mc-fill-card);
    color: var(--mc-text-ink);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .art {
    position: relative;
    display: block;
    aspect-ratio: 5 / 7;
    background: var(--mc-fill-parchment);
    border-bottom: 2px solid var(--mc-line-ink);
    overflow: hidden;
  }
  .art img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .missing {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    text-align: center;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .missing[hidden] {
    display: none;
  }
  .name {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--tile-caption, 26px);
    padding: 2px 6px;
    text-align: center;
    font-weight: 800;
    font-size: var(--tile-name, 11px);
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
`;
