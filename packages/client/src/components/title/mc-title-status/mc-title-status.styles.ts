import { css } from "lit";

export const McTitleStatusStyles = css`
  :host {
    display: block;
    font-family: var(--mc-font-body);
    font-size: 11px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    color: var(--title-text, var(--mc-text-ink));
  }
  :host([kind="problem"]) {
    padding: 6px 10px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-caution);
    text-align: center;
  }
`;
