import { css } from "lit";

export const McProgressBarStyles = css`
  :host {
    display: block;
    height: var(--mc-progress-height, 10px);
    color: inherit;
  }
  /* The track is outlined in the words' colour, so it reads on an ink card and on a paper one. */
  .track {
    position: relative;
    height: 100%;
    border: 1.5px solid currentColor;
  }
  .fill {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: calc((100% - 4px) * var(--mc-progress, 0));
    min-width: 2px;
    background: var(--mc-fill-red);
  }
  :host([empty]) .fill {
    display: none;
  }
`;
