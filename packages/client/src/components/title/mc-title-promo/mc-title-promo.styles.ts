import { css } from "lit";

/**
 * A comic caption box: an ink halftone header band with a Bangers title, a pitch, a live chip, a table of four seats
 * (the side panel, where there is room) and two buttons, in a 3px ink frame. Borders, not shadows, and no red.
 */
export const McTitlePromoStyles = css`
  :host {
    display: block;
    container-type: inline-size;
    position: relative;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
    background: var(--mc-fill-paper);
    outline: 3px solid var(--mc-line-ink);
    outline-offset: -3px;
  }
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .band {
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 14px 8px;
    min-height: 44px;
    background-color: var(--mc-fill-ink);
    background-image: radial-gradient(
      circle at 70% 50%,
      color-mix(in srgb, var(--mc-fill-paper) 20%, transparent) 2.4px,
      transparent 2.8px
    );
    background-size: 9px 9px;
    border-bottom: 3px solid var(--mc-line-ink);
    color: var(--mc-text-paper);
  }
  :host([variant="side"]) .band {
    min-height: 112px;
    align-items: flex-end;
  }
  .title {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 26px;
    letter-spacing: 1px;
    line-height: 1.05;
    white-space: pre-line;
  }
  :host([variant="side"]) .title {
    font-size: 40px;
  }
  .chip {
    position: relative;
    flex: none;
    padding: 4px 10px 4px 22px;
    background: var(--mc-fill-paper);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
    color: var(--mc-text-ink);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    white-space: nowrap;
  }
  .chip::before {
    content: "";
    position: absolute;
    left: 8px;
    top: 50%;
    width: 8px;
    height: 8px;
    margin-top: -4px;
    border-radius: 50%;
    background: var(--mc-fill-heal);
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 14px 14px;
    min-height: 0;
  }
  .pitch {
    margin: 0;
    font-size: 15px;
    line-height: 1.2;
  }
  :host([variant="side"]) .pitch {
    font-size: 17px;
  }
  :host([unavailable]) .pitch,
  :host([unavailable]) .seats {
    opacity: 0.5;
  }
  .seats {
    flex: 1;
    min-height: 0;
    display: none;
    width: 100%;
  }
  @container (min-height: 1px) {
    :host([variant="side"]) .seats {
      display: block;
    }
  }
  .buttons {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  :host([variant="art"]) .buttons {
    flex-direction: row;
  }
  :host([variant="art"]) mc-button {
    flex: 1;
  }
  @container (max-width: 330px) {
    :host([variant="art"]) .buttons {
      flex-direction: column;
    }
    :host([variant="art"]) mc-button {
      flex: none;
    }
  }
  mc-button {
    flex: none;
    height: 44px;
    --mc-button-size: 16px;
  }
  :host([variant="side"]) mc-button {
    height: 52px;
  }
`;
