import { css } from "lit";

export const McLanguageMenuStyles = css`
  :host {
    display: block;
    position: absolute;
    inset: 0;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--mc-fill-void) calc(var(--mc-scrim, 0.7) * 100%), transparent);
  }
  .list {
    position: absolute;
    left: var(--box-x);
    top: var(--box-y);
    width: var(--box-w);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    background: var(--mc-fill-ink);
    border: 2px solid var(--mc-line-paper);
  }
  .note {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, calc(100% - 48px));
    max-height: calc(100% - 16px);
    overflow-y: auto;
    padding: 24px;
    background: var(--mc-fill-paper);
    border: 4px solid var(--mc-line-ink);
  }
  :host([phone]) .note {
    width: min(520px, calc(100% - 16px));
    padding: 16px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding-bottom: 8px;
    margin-bottom: 10px;
    border-bottom: 2px solid color-mix(in srgb, var(--mc-line-ink) 50%, transparent);
  }
  .title {
    font-family: var(--mc-font-display);
    font-size: 22px;
    text-transform: uppercase;
  }
  .close {
    width: 44px;
    height: 44px;
    margin-right: -8px;
  }
  p {
    margin: 0 0 10px;
    font-size: 15px;
    line-height: 1.25;
    opacity: 0.92;
  }
  :host([phone]) p {
    font-size: 13px;
  }
  .links {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }
  .links mc-popup-button {
    height: 44px;
  }
`;
