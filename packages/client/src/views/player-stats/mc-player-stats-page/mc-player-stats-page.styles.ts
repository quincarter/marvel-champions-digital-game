import { css } from "lit";

export const McPlayerStatsPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* The backdrop is drawn on the canvas under the panel: the body is left clear, the tiles and rows are opaque. */
    background: transparent;
  }
  mc-stats-header {
    flex: none;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px var(--gutter) var(--gutter);
  }
  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 12px;
  }
  mc-stats-list,
  mc-stats-matchup-grid {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  mc-empty-state {
    padding-top: 40px;
  }
`;
