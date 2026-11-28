import { css } from "lit";

export const McWinCardStyles = css`
  :host {
    display: block;
    min-width: 0;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
  }
  .card {
    box-sizing: border-box;
    height: 100%;
    display: flex;
    gap: 14px;
    padding: 12px;
    background: var(--mc-fill-card);
    border: 3px solid var(--mc-line-ink);
  }
  .art {
    flex: none;
    height: var(--art-height, 104px);
    aspect-ratio: 5 / 7;
    background: var(--mc-fill-parchment);
  }
  :host([art="landscape"]) .art {
    aspect-ratio: 7 / 5;
  }
  mc-picture-tile {
    width: 100%;
    height: 100%;
  }
  .copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .heading {
    margin: 4px 0 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 18px;
    line-height: 1.05;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .body {
    font-size: 14px;
    line-height: 1.45;
    width: 100%;
  }
  /* The wide screen's LOSE cards: the scan takes the card's whole height, the words fill the rest. */
  :host([fill]) .art {
    height: auto;
    min-height: 100px;
    align-self: stretch;
    max-width: 55%;
  }
  /* The wide screen's tall WIN card: the scan fills the top, the words go under it. */
  :host([layout="column"]) .card {
    flex-direction: column;
  }
  :host([layout="column"]) .art {
    flex: 1 1 0;
    min-height: 160px;
    height: auto;
    align-self: center;
    aspect-ratio: 5 / 7;
    max-width: 100%;
  }
  :host([layout="column"]) .copy {
    flex: none;
  }
`;
