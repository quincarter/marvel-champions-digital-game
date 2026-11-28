import { css } from "lit";

export const McTrophyStateStyles = css`
  :host {
    display: inline-block;
    max-width: 100%;
  }
  .chip {
    display: inline-block;
    padding: 4px 7px;
    border: 1.5px solid currentColor;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.2;
    white-space: nowrap;
  }
  /* Earned: a filled paper chip with a mark, on the ink card. */
  :host([state="earned"]) .chip {
    background: var(--mc-fill-paper);
    color: var(--mc-text-ink);
    border-color: var(--mc-fill-paper);
  }
  :host([state="untracked"]) .chip {
    opacity: 0.6;
    border-style: dashed;
  }
`;
