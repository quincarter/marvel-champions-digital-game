import { css } from "lit";

/**
 * An ink panel with a paper rim: a heading, then the rows in a natively scrolling list, or the remove question in its
 * place. Each row is one whole-row press (resume) with a red Resume button and outlined Watch and Remove buttons along
 * its bottom; the buttons sit above the row press area, so a tap on one never also resumes.
 */
export const McTitleGamesStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 12px;
    gap: 8px;
    background: color-mix(in srgb, var(--mc-fill-ink) 90%, transparent);
    outline: 2px solid var(--mc-line-paper);
    outline-offset: -2px;
    color: var(--mc-text-paper);
    font-family: var(--mc-font-body);
  }
  .heading {
    flex: none;
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 36px;
    font-family: var(--mc-font-display);
    font-size: 18px;
    letter-spacing: 1px;
    line-height: 1.1;
  }
  .heading .text {
    flex: 1;
    min-width: 0;
  }
  .tag {
    flex: none;
    padding: 2px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--mc-fill-red) 28%, transparent);
    outline: 1.5px solid var(--mc-line-red);
    outline-offset: -1.5px;
    font-family: var(--mc-font-mono);
    font-weight: 700;
    font-size: 9px;
    letter-spacing: 1px;
  }
  .hint {
    position: relative;
    flex: none;
    width: 56px;
    height: 24px;
  }
  mc-glyph-hint {
    left: auto;
    right: 0;
  }
  .list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .row {
    position: relative;
    flex: none;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 10px;
    padding: 10px;
    background: color-mix(in srgb, var(--mc-fill-paper) 10%, transparent);
    outline: 2px solid color-mix(in srgb, var(--mc-line-paper) 55%, transparent);
    outline-offset: -2px;
  }
  .icon {
    grid-row: 1 / 3;
    width: 24px;
    height: 24px;
    align-self: center;
  }
  .icon svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .name {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .detail {
    font-size: 12px;
    line-height: 1.25;
    opacity: 0.8;
  }
  .buttons {
    grid-column: 1 / -1;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .buttons mc-button {
    position: relative;
    z-index: 2;
    flex: 1 1 0;
    height: 40px;
    --mc-button-size: 13px;
  }
  .buttons mc-button.resume {
    flex: 2 1 0;
  }
  .needs {
    flex: 2 1 0;
    font-weight: 800;
    font-size: 13px;
    line-height: 1.2;
  }
  mc-hit-area {
    inset: 0;
  }
  .ask {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: color-mix(in srgb, var(--mc-fill-paper) 10%, transparent);
    outline: 2px solid color-mix(in srgb, var(--mc-line-paper) 55%, transparent);
    outline-offset: -2px;
  }
  .ask .name {
    font-size: 15px;
  }
  .ask .message {
    font-size: 14px;
    line-height: 1.4;
  }
  .error {
    font-size: 13px;
    color: var(--mc-text-caution);
  }
  .answers {
    margin-top: auto;
    display: flex;
    gap: 8px;
  }
  .answers .keep {
    position: relative;
    flex: 1;
  }
  .answers mc-button {
    height: 44px;
    --mc-button-size: 16px;
  }
  .answers mc-button.remove {
    flex: 1;
  }
`;
