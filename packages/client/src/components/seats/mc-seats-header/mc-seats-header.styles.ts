import { css } from "lit";

export const McSeatsHeaderStyles = css`
  :host {
    display: block;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .bar {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 16px;
    height: 64px;
    padding: 0 16px;
  }
  .back {
    flex: none;
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 44px;
    height: 44px;
    margin: 0;
    padding: 0 14px;
    background: none;
    color: inherit;
    border: 2px solid var(--mc-line-paper);
    font-family: var(--mc-font-display);
    font-style: italic;
    font-size: 20px;
    text-transform: uppercase;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .back:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: 2px;
  }
  .word {
    white-space: nowrap;
  }
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding-top: var(--drop, 0);
    max-width: var(--max-right, none);
    font-family: var(--mc-font-display);
    font-style: italic;
    font-weight: 400;
    font-size: 28px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .step {
    flex: none;
    max-width: 32%;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    text-align: right;
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (max-width: 767px) {
    .bar {
      gap: 10px;
      padding: 0 12px;
    }
    .title {
      font-size: 22px;
    }
    .back .word {
      max-width: 30vw;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;
