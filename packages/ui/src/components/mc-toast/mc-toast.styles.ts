import { css } from "lit";

export const McToastStyles = css`
  :host {
    position: absolute;
    left: 50%;
    bottom: var(--mc-toast-bottom, 16px);
    transform: translateX(-50%);
    z-index: 30;
    width: max-content;
    max-width: min(640px, calc(100% - 32px));
    pointer-events: none;
  }
  :host([hidden]) {
    display: none;
  }
  .note {
    padding: 8px 16px;
    background: color-mix(in srgb, var(--mc-fill-ink) 95%, transparent);
    color: var(--mc-text-paper);
    font-family: var(--mc-font-body);
    font-size: 14px;
    line-height: 1.3;
    text-align: center;
    overflow-wrap: anywhere;
  }
`;
