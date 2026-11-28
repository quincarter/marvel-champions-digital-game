import { css } from "lit";

export const McLobbyHeaderStyles = css`
  :host {
    display: block;
  }
  :host([hidden]) {
    display: none;
  }
  .strip {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas: "eyebrow listed copy" "code listed copy" "line line line";
    align-items: center;
    column-gap: 10px;
    margin: 12px 16px 0;
    padding: 8px 12px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([compact]) .strip {
    margin: 10px 16px 0;
  }
  .eyebrow {
    grid-area: eyebrow;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .code {
    grid-area: code;
    font-family: var(--mc-font-display);
    font-size: 44px;
    line-height: 1.1;
    letter-spacing: 4px;
  }
  :host([compact]) .code {
    font-size: 36px;
  }
  .copy {
    grid-area: copy;
    width: 160px;
  }
  :host([compact]) .copy {
    width: 120px;
  }
  .listed {
    grid-area: listed;
    width: 210px;
  }
  .connection {
    grid-area: line;
    justify-self: start;
    margin-top: 4px;
    padding: 2px 6px;
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink-on-hue);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 12px;
  }
`;
