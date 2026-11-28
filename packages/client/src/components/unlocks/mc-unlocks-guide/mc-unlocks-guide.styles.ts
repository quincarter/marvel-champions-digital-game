import { css } from "lit";

export const McUnlocksGuideStyles = css`
  :host {
    display: block;
    min-height: 0;
    color: var(--mc-text-paper);
  }
  .scroller {
    position: relative;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 12px;
  }
  section {
    margin-bottom: 18px;
  }
  h3 {
    margin: 0 0 6px;
    font-family: var(--mc-font-display);
    font-size: 18px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }
  p,
  li {
    font-size: var(--mc-small-12, 12px);
    line-height: 1.5;
    opacity: 0.88;
  }
  p {
    margin: 0 0 6px;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  li {
    margin-bottom: 4px;
  }
`;
