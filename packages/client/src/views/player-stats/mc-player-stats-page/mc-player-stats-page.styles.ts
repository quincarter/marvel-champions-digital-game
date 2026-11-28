import { css } from "lit";

export const McPlayerStatsPageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    container-type: inline-size;
    /* The backdrop is drawn on the canvas under the panel: the body is left clear, the tiles and rows are opaque. */
    background: transparent;
  }
  mc-top-bar {
    flex: none;
  }
  /* The count of games gives way to the You / Everyone switch where it would crowd it. */
  .played {
    flex: none;
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
  }
  @container (max-width: 1000px) {
    .played {
      display: none;
    }
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
