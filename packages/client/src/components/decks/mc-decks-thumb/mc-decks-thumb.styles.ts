import { css } from "lit";

export const McDecksThumbStyles = css`
  :host {
    display: block;
    position: relative;
    background: var(--mc-fill-parchment);
    box-shadow: inset 0 0 0 2px var(--mc-line-paper);
  }
  mc-picture-tile {
    position: absolute;
    inset: 0;
  }
`;
