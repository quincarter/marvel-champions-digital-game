import { css } from "lit";

/**
 * Two equal columns 10px apart; a full row spans both and a half row takes one, so Campaign and Play online, Extras and
 * Past games, Trophy Room and Your stats, How to play and Mod Store sit in pairs. The rows are 44px (52px for the
 * primary ones); the gap between rows is `--menu-gap`, set by the page from the height it has.
 */
export const McTitleMenuStyles = css`
  :host {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--menu-gap, 18px) 10px;
    align-content: start;
  }
  mc-title-menu-button[width="full"] {
    grid-column: 1 / -1;
  }
`;
