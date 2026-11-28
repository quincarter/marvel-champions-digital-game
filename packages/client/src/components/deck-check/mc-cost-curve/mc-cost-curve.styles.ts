import { css } from "lit";

export const McCostCurveStyles = css`
  :host {
    display: block;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 7px;
  }
  .heading {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .average {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  :host([framed]) {
    padding: 10px 12px 6px;
    background: var(--mc-fill-card);
    box-shadow: inset 0 0 0 3px var(--mc-line-ink);
  }
  :host([framed]) .heading {
    font-family: var(--mc-font-display);
    font-size: 18px;
    letter-spacing: 0;
    opacity: 1;
  }
`;
