import { css } from "lit";

export const McRoundStripStyles = css`
  :host {
    display: block;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
  }
  .strip {
    box-sizing: border-box;
    padding: 10px 14px 12px;
    background: var(--mc-fill-parchment);
    border: 2.5px solid var(--mc-line-ink);
  }
  .label {
    font-size: var(--mc-small-9, 9px);
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .steps {
    display: flex;
    align-items: stretch;
    margin-top: 8px;
  }
  .pill {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 4px 12px;
    text-align: center;
    font-size: var(--mc-small-10, 10px);
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    line-height: 1.2;
    color: var(--mc-text-paper);
  }
  .pill[data-step="ink"] {
    background: var(--mc-fill-ink);
  }
  .pill[data-step="red"] {
    background: var(--mc-fill-red);
  }
  .arrow {
    flex: none;
    display: grid;
    place-items: center;
    width: 26px;
    font-family: var(--mc-font-display);
    font-size: 24px;
  }
`;
