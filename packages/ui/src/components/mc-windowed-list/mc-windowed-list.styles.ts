import { css } from "lit";

export const McWindowedListStyles = css`
  :host {
    display: block;
    position: relative;
    overflow-x: clip;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-gutter: stable;
    scrollbar-color: color-mix(in srgb, var(--mc-line-ink) 60%, transparent)
      color-mix(in srgb, var(--mc-line-ink) 12%, transparent);
    min-height: 0;
  }
  .space {
    position: relative;
    width: 100%;
  }
  .row {
    position: absolute;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: repeat(var(--columns, 1), minmax(0, 1fr));
    column-gap: var(--column-gap, 0px);
  }
  .row > * {
    min-width: 0;
    min-height: 0;
  }
`;
