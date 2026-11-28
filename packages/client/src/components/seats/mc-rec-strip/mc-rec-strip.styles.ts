import { css } from "lit";

export const McRecStripStyles = css`
  :host {
    display: block;
    min-width: 0;
    margin-bottom: 20px;
    padding: 0 0 6px 12px;
    background: var(--mc-fill-card);
    border-left: 6px solid var(--mc-line-red);
    box-shadow: inset 0 0 0 1px var(--mc-line-ink);
  }
  .title {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    height: 100%;
  }
  mc-section-header {
    flex: 1;
    min-width: 0;
    height: 100%;
  }
  .tap {
    position: absolute;
    inset: 0;
    appearance: none;
    margin: 0;
    padding: 0;
    background: none;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .tap:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
`;
