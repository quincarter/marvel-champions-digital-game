import { css } from "lit";

/** The page: the reader frame with an auto-height ink header, a paper body with a faint halftone. */
export const McRulesPageStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    --reader-bar: auto;
  }
  mc-reader {
    background-color: var(--mc-fill-paper);
    background-image: radial-gradient(
      circle,
      color-mix(in srgb, var(--mc-fill-ink) 10%, transparent) 1px,
      transparent 1.6px
    );
    background-size: 6px 6px;
  }
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 16px 0;
  }
  mc-search-field {
    height: 44px;
  }
  .body {
    display: flex;
    flex-direction: column;
    padding: 8px 16px 16px;
  }
  .body > * {
    flex: 1 1 0;
    min-height: 0;
  }
`;
