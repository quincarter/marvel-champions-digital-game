import { css } from "lit";

/** The page: an ink sheet, the header over a body whose picture and words sit side by side (wide) or stacked. */
export const McExtrasViewerPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    --pad: 24px;
  }
  :host([compact]) {
    --pad: 12px;
  }
  .bar {
    flex: none;
    border-bottom: 2px solid var(--mc-fill-red);
    --mc-top-bar-title-size: 32px;
  }
  :host([compact]) .bar {
    --mc-top-bar-title-size: 24px;
  }
  .close {
    width: 40px;
    height: 40px;
    --mc-button-size: 16px;
  }
  .body {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--pad);
    padding: var(--pad);
  }
  mc-viewer-slide {
    flex: 1 1 0;
  }
  mc-viewer-text {
    flex: none;
    height: min(34%, 200px);
  }
  :host([wide]) .body {
    flex-direction: row;
  }
  :host([wide]) mc-viewer-text {
    width: min(360px, 34%);
    height: auto;
  }
`;
