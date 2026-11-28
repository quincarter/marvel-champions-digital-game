import { css } from "lit";

export const McSearchToggleStyles = css`
  :host {
    display: block;
    position: relative;
    width: 44px;
    height: 44px;
  }
  mc-button {
    width: 100%;
    height: 100%;
  }
  /* The magnifier is ink on paper, paper on the ink fill of the on state (and under a mouse's hover). */
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    stroke: var(--mc-line-ink);
    stroke-linecap: round;
  }
  :host([selected]) svg {
    stroke: var(--mc-line-paper);
  }
  @media (hover: hover) {
    :host(:hover) svg {
      stroke: var(--mc-line-paper);
    }
  }
`;
