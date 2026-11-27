import { css } from "lit";

/**
 * The footer is one line at its box's top edge: the note at the left, then at the right (right to left) the version,
 * a link 16px before it and the next link 24px before that. Each link is an underlined word (a 60% line) with a 44px
 * touch target hung from the footer's top and 6px of room each side.
 */
export const McFooterBarStyles = css`
  :host {
    display: block;
    position: relative;
  }
  .note,
  .version,
  .link,
  .aside {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.2;
    white-space: nowrap;
    color: var(--mc-text-ink);
  }
  .note {
    position: absolute;
    left: 0;
    top: 0;
    opacity: 0.5;
  }
  .note[hidden] {
    display: none;
  }
  .right {
    position: absolute;
    right: 0;
    top: 0;
    display: flex;
    flex-direction: row-reverse;
    align-items: flex-start;
  }
  .version {
    opacity: 0.5;
  }
  .link {
    height: 44px;
    padding: 0 6px;
    margin-right: 10px;
    margin-left: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .link span {
    background: linear-gradient(
        color-mix(in srgb, currentColor 60%, transparent),
        color-mix(in srgb, currentColor 60%, transparent)
      )
      bottom / 100% 1px no-repeat;
  }
  .link + .link {
    margin-right: 12px;
  }
  /* On the phone the whole screen is ink: the words are paper. */
  :host([ground="ink"]) .note,
  :host([ground="ink"]) .version,
  :host([ground="ink"]) .link,
  :host([ground="ink"]) .aside {
    color: var(--mc-text-paper);
  }
  .aside {
    position: absolute;
    right: 0;
    top: -20px;
  }
`;
