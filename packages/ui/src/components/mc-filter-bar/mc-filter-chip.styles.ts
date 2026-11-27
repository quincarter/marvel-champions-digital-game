import { css } from "lit";

/** A boxed toggle: paper with a 2px ink outline; on, an ink fill with a check mark before the word. */
export const McFilterChipStyles = css`
  :host {
    display: inline-flex;
    height: 100%;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .chip {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 100%;
    padding: 0 10px;
    background: var(--chip-fill, var(--mc-fill-paper));
    color: var(--chip-ink, var(--mc-text-ink));
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    white-space: nowrap;
    line-height: 1;
  }
  :host([selected]) .chip {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([disabled]) .chip {
    opacity: 0.4;
    outline-style: dashed;
    cursor: default;
  }
  .count {
    font-weight: 400;
    opacity: 0.75;
    letter-spacing: 0.4px;
  }
`;
