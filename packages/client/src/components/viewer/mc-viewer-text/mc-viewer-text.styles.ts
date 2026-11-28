import { css } from "lit";

export const McViewerTextStyles = css`
  :host {
    display: block;
    min-width: 0;
    min-height: 0;
    color: var(--mc-text-paper);
  }
  .scroller {
    height: 100%;
    padding-right: 6px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .subtitle {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .line {
    font-size: 12px;
    line-height: 1.4;
    opacity: 0.95;
  }
  :host([wide]) .line {
    font-size: 14px;
  }
  .quote {
    font-style: italic;
    opacity: 0.75;
  }
  .promo {
    flex: none;
    width: min(100%, 260px);
    height: 44px;
    --mc-button-size: 13px;
  }
  .alert {
    font-size: 12px;
    line-height: 1.4;
    color: var(--mc-text-red);
  }
`;
