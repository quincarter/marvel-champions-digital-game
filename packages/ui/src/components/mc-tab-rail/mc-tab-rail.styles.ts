import { css } from "lit";

/** A recessed parchment strip with a 2px ink outline; its cells share the width equally. */
export const McTabRailStyles = css`
  :host {
    display: flex;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
  }
  mc-button {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
  }
`;
