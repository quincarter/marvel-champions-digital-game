import { css } from "lit";

/** The page: a header, the chosen identity, and the layout's body filling the rest of the screen. */
export const McDeckBuilderPageStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    background: var(--mc-fill-paper);
    background-image: radial-gradient(color-mix(in srgb, var(--mc-line-ink) 14%, transparent) 1px, transparent 1.2px);
    background-size: 18px 18px;
    color: var(--mc-text-ink);
    font-family: var(--mc-font-body);
    -webkit-font-smoothing: antialiased;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 40px;
    gap: 16px;
  }
  :host([layout="phone"]) .page {
    padding: 16px;
  }
  :host([layout="narrow"]) .page,
  :host([layout="phone"]) .page {
    max-width: 720px;
    margin: 0 auto;
  }
  mc-builder-header,
  mc-identity-row {
    flex: none;
  }
  mc-identity-picker,
  .body {
    flex: 1 1 auto;
    min-height: 0;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  /* The rows over the list keep their height; the list or the scrolling body takes what is left. */
  .body > * {
    flex: none;
  }
  .body > mc-pool-list,
  .body > .scroll {
    flex: 1 1 auto;
  }
  .scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: clip;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-gutter: stable;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .scroll > * {
    flex: none;
  }
  mc-pool-list {
    flex: 1 1 auto;
    min-height: 0;
  }
  .count {
    font-size: var(--mc-small-10, 10px);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.5;
  }
  .search-row {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }
  .search-row mc-pool-search {
    flex: 1 1 auto;
    min-width: 0;
  }
  .filters-toggle {
    flex: none;
    width: min(55%, 200px);
    height: 44px;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }
  .save {
    flex: none;
  }
  .pad {
    height: 0;
  }
`;
