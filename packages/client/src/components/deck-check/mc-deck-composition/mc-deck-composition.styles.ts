import { css } from "lit";

export const McDeckCompositionStyles = css`
  :host {
    display: block;
  }
  .heading {
    margin-bottom: 7px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .segments {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .rule {
    height: 3px;
    margin-top: 10px;
    background: var(--mc-fill-ink);
  }
`;
