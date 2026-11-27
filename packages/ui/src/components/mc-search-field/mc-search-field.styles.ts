import { css } from "lit";

/** The client's text field: a paper ground, a 2.5px ink frame, square corners, the mono face; a clear button at its end. */
export const McSearchFieldStyles = css`
  :host {
    display: block;
  }
  .field {
    position: relative;
    width: 100%;
    height: 100%;
  }
  input {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 0 40px 0 10px;
    background: var(--mc-fill-paper);
    color: var(--mc-text-ink);
    outline: 2.5px solid var(--mc-line-ink);
    outline-offset: -1.25px;
    font-family: var(--mc-font-mono);
    font-size: 13px;
    cursor: text;
  }
  input::placeholder {
    color: var(--mc-text-ink);
    opacity: 0.5;
  }
  input:focus-visible,
  input:focus {
    outline-width: 3.5px;
  }
  .clear {
    all: unset;
    position: absolute;
    top: 0;
    right: 0;
    width: 36px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 18px;
    color: var(--mc-text-ink);
    opacity: 0.7;
    -webkit-tap-highlight-color: transparent;
  }
  .clear:hover {
    opacity: 1;
  }
`;
