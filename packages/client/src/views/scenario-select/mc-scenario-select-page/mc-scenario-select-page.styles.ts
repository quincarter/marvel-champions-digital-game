import { css } from "lit";

/**
 * The page: the ink bar over a paper body with a faint halftone. Wide, the body is two columns (the list column, then a
 * 300px ink panel the full height); narrow, one stacked column whose stages panel is a bar that opens over the list.
 */
export const McScenarioSelectPageStyles = css`
  :host {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--bar-height) minmax(0, 1fr);
    width: 100%;
    height: 100%;
    background-color: var(--mc-fill-paper);
    background-image: radial-gradient(
      circle,
      color-mix(in srgb, var(--mc-fill-ink) 10%, transparent) 1px,
      transparent 1.6px
    );
    background-size: 6px 6px;
  }
  .body {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--gutter);
    min-height: 0;
    padding: var(--gutter);
  }
  .browse {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1 1 0;
    min-height: 0;
    min-width: 0;
  }
  mc-scenario-shelves {
    flex: 1 1 0;
    min-height: 0;
  }
  /* Narrow, the stages sheet is open: it covers the list, which keeps its box (and its scroll) under it. */
  .browse[data-covered] {
    position: absolute;
    inset: var(--gutter);
    visibility: hidden;
    pointer-events: none;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: var(--gutter);
    flex: none;
    min-height: 0;
  }
  .side[data-open] {
    flex: 1 1 0;
  }
  mc-scenario-picked {
    flex: none;
  }
  .side[data-open] mc-scenario-picked {
    flex: 1 1 0;
  }
  mc-scenario-actions {
    flex: none;
  }
  /* Wide: the list column and the ink side panel. */
  :host([wide]) .body {
    flex-direction: row;
  }
  :host([wide]) .browse {
    gap: 8px;
  }
  :host([wide]) mc-scenario-stats {
    flex: none;
    margin-top: calc(var(--gutter) - 8px);
  }
  :host([wide]) .side {
    flex: 0 0 300px;
    gap: 0;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([wide]) mc-scenario-picked {
    flex: 1 1 0;
  }
  :host([wide]) mc-scenario-actions {
    padding: 16px;
  }
`;
