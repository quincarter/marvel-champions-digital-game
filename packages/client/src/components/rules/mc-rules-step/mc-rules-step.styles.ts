import { css } from "lit";

export const McRulesStepStyles = css`
  :host {
    display: block;
    padding: 2px 4px;
  }
  .card {
    display: flex;
    gap: 16px;
    min-height: 106px;
    padding: 12px 16px;
    background: var(--mc-fill-card);
    border: 3px solid var(--mc-line-ink);
  }
  .card.current {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .art {
    flex: none;
    width: 96px;
    background: var(--mc-fill-parchment);
  }
  .art img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .words {
    min-width: 0;
  }
  .now {
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }
  .label {
    font-family: var(--mc-font-display);
    font-size: 18px;
    line-height: 1.1;
  }
  .detail {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.45;
    opacity: 0.9;
  }
`;
