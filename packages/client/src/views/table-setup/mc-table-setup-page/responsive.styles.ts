import { css } from "lit";

/**
 * How the page lays itself out for each mode the scene sets from the screen's width (`mode`): wide is the paper body
 * beside the ink sidebar; phone (also a tablet in portrait) is one scrolling paper page between the top bar and the
 * pinned deal footer. Every rule is flow, grid or flex with native scrolling.
 */
export const ResponsiveStyles = css`
  :host([mode="wide"]) .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    min-height: 0;
    flex: 1;
  }
  :host([mode="wide"]) .main {
    padding: 24px;
    gap: 20px;
  }
  :host([mode="wide"]) .side {
    margin: 24px 24px 24px 0;
    padding: 18px 16px 16px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  :host([mode="wide"]) .side mc-setup-summary {
    flex: 1 1 auto;
  }
  :host([mode="phone"]) .body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  :host([mode="phone"]) .main {
    flex: 1;
    padding: 12px 16px 16px;
    gap: 14px;
  }
`;
