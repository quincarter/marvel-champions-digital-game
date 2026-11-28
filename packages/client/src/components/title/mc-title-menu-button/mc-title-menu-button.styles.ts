import { css } from "lit";

/**
 * A menu row is an `mc-button` filling its box with the things a row wears over it: a platform mark, a count badge on
 * the top right corner, a small tag at the right end and a press glyph at the left. Each is a picture that takes no
 * press, so a tap on it goes to the button under it.
 */
export const McTitleMenuButtonStyles = css`
  :host {
    display: block;
    position: relative;
    height: var(--row-height, 44px);
    min-width: 0;
  }
  :host([tall]) {
    height: var(--row-height-tall, 52px);
    --icon-px: 28px;
  }
  mc-button {
    position: absolute;
    inset: 0;
    --mc-button-size: var(--row-size, 16px);
  }
  .over {
    position: absolute;
    pointer-events: none;
  }
  .icon {
    left: 14px;
    top: 50%;
    width: var(--icon-px, 24px);
    height: var(--icon-px, 24px);
    margin-top: calc(var(--icon-px, 24px) / -2);
    color: var(--mc-text-ink);
  }
  :host([kind="primary"]) .icon,
  :host([kind="onInk"]) .icon {
    color: var(--mc-text-paper);
  }
  :host([disabled]) .icon {
    opacity: 0.4;
  }
  .icon svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .tip {
    display: none;
    position: absolute;
    left: 14px;
    top: calc(100% + 10px);
    z-index: 5;
    padding: 6px 10px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    white-space: nowrap;
    pointer-events: none;
  }
  @media (hover: hover) {
    :host(:hover) .tip {
      display: block;
    }
  }
  .badge {
    right: -6px;
    top: -6px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 10px;
    background: var(--mc-fill-red);
    outline: 2px solid var(--mc-line-paper);
    outline-offset: -1px;
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: 12px;
    line-height: 1;
    z-index: 3;
  }
  .tag {
    right: 12px;
    top: 50%;
    margin-top: -8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 16px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--mc-fill-red) 28%, transparent);
    outline: 1.5px solid var(--mc-line-red);
    outline-offset: -1.5px;
    color: var(--mc-text-paper);
    font-family: var(--mc-font-mono);
    font-weight: 700;
    font-size: 9px;
    letter-spacing: 1px;
  }
  mc-glyph-hint {
    z-index: 3;
  }
`;
