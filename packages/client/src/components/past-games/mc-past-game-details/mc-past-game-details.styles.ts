import { css } from "lit";

export const McPastGameDetailsStyles = css`
  :host {
    display: block;
    min-width: 0;
    min-height: 0;
  }
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
    padding: 14px;
    background: var(--mc-fill-card);
    border: 3px solid var(--mc-line-ink);
    color: var(--mc-text-ink);
  }
  /* The words run in a region of their own above the actions: four heroes, a long title and a campaign line can outgrow
     the panel on a small screen, and the region scrolls (wheel, drag, the right stick) rather than cut any. */
  .words {
    flex: 1 1 0;
    min-height: 0;
    padding-right: 10px;
  }
  mc-past-game-actions {
    flex: none;
  }
  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 44px;
    height: 44px;
    z-index: 1;
    --mc-button-size: 16px;
  }
  /* A phone's popup: a scrim over the whole screen that takes every press and does nothing, the panel centred on it. */
  :host([popup]) {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--mc-fill-ink) 72%, transparent);
  }
  :host([popup]) .panel {
    width: min(460px, calc(100% - 24px));
    height: min(640px, calc(100% - 24px));
  }
  :host([popup]) mc-past-game-pictures {
    margin-top: 50px;
  }
`;
