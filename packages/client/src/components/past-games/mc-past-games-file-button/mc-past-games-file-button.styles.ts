import { css } from "lit";

export const McPastGamesFileButtonStyles = css`
  :host {
    position: relative;
    display: block;
    width: 220px;
    height: 44px;
  }
  :host([phone]) {
    width: 128px;
  }
  mc-button {
    width: 100%;
    height: 100%;
    --mc-label-inset: 32px;
    --mc-button-size: 12px;
  }
  /* An open folder at the left, so the button reads as "open a file" at a glance (#858). */
  .icon {
    position: absolute;
    left: 12px;
    top: 50%;
    width: 18px;
    height: 13px;
    margin-top: -6.5px;
    color: var(--mc-text-paper);
    pointer-events: none;
  }
  :host([disabled]) .icon {
    opacity: 0.4;
  }
`;
