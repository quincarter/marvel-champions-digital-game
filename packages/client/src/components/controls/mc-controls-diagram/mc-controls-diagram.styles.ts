import { css } from "lit";

export const McControlsDiagramStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .caption {
    margin: 10px 0 0;
    font-size: var(--mc-small-12, 12px);
    line-height: 1.45;
    opacity: 0.8;
  }
  .test {
    margin: 6px 0 0;
    font-size: var(--mc-small-12, 12px);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.75;
  }
`;
