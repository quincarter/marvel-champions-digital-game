import { css } from "lit";

export const McTopBarStyles = css`
  :host {
    display: block;
    height: 100%;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 100%;
    padding: 0 22px;
  }
  :host([compact]) .bar {
    gap: 12px;
    padding: 0 12px;
  }
  .back {
    flex: none;
    width: auto;
    min-width: var(--mc-top-bar-back-min, 76px);
    height: 44px;
    --mc-button-size: 18px;
  }
  .title {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: var(--mc-font-display);
    font-size: 28px;
    letter-spacing: 1px;
    line-height: 1;
    text-transform: uppercase;
    color: var(--mc-text-paper);
    transform: translateY(var(--mc-title-drop, 0px));
  }
  :host([compact]) .title {
    font-size: 22px;
  }
  .right {
    margin-left: auto;
    flex: none;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    color: var(--mc-text-paper);
    opacity: 0.5;
    white-space: nowrap;
  }
`;
