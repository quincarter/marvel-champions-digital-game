import { css } from "lit";

/** A boxed field in the secondary skin (paper fill, 2.5px ink outline); focus thickens the outline in Hero Red. */
export const McTextFieldStyles = css`
  :host {
    display: flex;
    background: var(--mc-fill-paper);
    outline: 2.5px solid var(--mc-line-ink);
    outline-offset: -1.25px;
  }
  :host(:focus-within) {
    outline: 4px solid var(--mc-line-red);
    outline-offset: -2px;
  }
  input,
  textarea {
    all: unset;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    height: 100%;
    padding: 0 10px;
    font-family: var(--mc-font-mono, monospace);
    font-size: var(--mc-field-size, 16px);
    color: var(--mc-text-ink);
  }
  textarea {
    padding: 8px 10px;
    white-space: pre-wrap;
    overflow-y: auto;
    resize: none;
  }
  input::placeholder,
  textarea::placeholder {
    color: var(--mc-text-ink);
    opacity: 0.55;
  }
`;
