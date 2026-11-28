import { css } from "lit";

export const McPackTextStyles = css`
  :host {
    display: block;
    min-height: 0;
    padding: 6px 8px;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
  .text {
    height: 100%;
    padding-right: 6px;
    font-size: 14px;
    line-height: 1.3;
  }
  /* The span carries the whitespace rule: the template's own indentation around it must not show. */
  .body {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`;
