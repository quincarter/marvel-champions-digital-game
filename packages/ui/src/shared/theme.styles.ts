import { css } from "lit";

/**
 * The look every component shares, from the client's design tokens. The client sets the values as CSS custom
 * properties on the layer the components live in (`packages/client/src/dom/ui-layer.ts`, from `tokens.ts`, per color
 * scheme), so nothing here repeats a color or a size.
 *
 * Text colors are `--mc-text-<token>` and fills and borders `--mc-fill-<token>` / `--mc-line-<token>`: dark mode maps
 * each channel on its own, as `view/color-scheme.ts` does for Phaser.
 */
export const ThemeStyles = css`
  :host {
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
    -webkit-font-smoothing: antialiased;
    box-sizing: border-box;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  .display {
    font-family: var(--mc-font-display);
    font-weight: 400;
    text-transform: uppercase;
  }
  /* A scrolling region: native scrolling, with the lists' ink scrollbar (ui/virtual-list.ts: a 12% ink track, a
     60% ink thumb). */
  .scroller {
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .scroller::-webkit-scrollbar {
    width: var(--mc-scrollbar-width, 6px);
  }
  .scroller::-webkit-scrollbar-track {
    background: color-mix(in srgb, var(--mc-fill-ink) 12%, transparent);
  }
  .scroller::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent);
  }
  @supports not selector(::-webkit-scrollbar) {
    .scroller {
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent)
        color-mix(in srgb, var(--mc-fill-ink) 12%, transparent);
    }
  }
`;
