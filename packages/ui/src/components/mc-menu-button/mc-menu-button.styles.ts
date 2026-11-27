import { css } from "lit";

/**
 * A menu button is an `mc-button` filling its box, with its decorations over it: each is a picture that takes no
 * press, so a tap on it goes to the button under it.
 */
export const McMenuButtonStyles = css`
  :host {
    display: block;
    position: relative;
  }
  mc-button {
    position: absolute;
    inset: 0;
  }
  .over {
    position: absolute;
    pointer-events: none;
  }
  .icon {
    color: var(--mc-text-ink);
  }
  :host([kind="primary"]) .icon,
  :host([kind="onInk"]) .icon {
    color: var(--mc-text-paper);
  }
  :host([disabled]) .icon {
    color: var(--mc-text-ink);
    opacity: 0.4;
  }
  :host([kind="onInk"][disabled]) .icon {
    color: var(--mc-text-paper);
  }
  .icon svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  /* The note a mouse resting on the button shows under its icon ("Played on Windows"), on a mouse only. */
  .tip {
    display: none;
    position: absolute;
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
  mc-glyph {
    position: absolute;
    pointer-events: none;
  }
`;
