import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsMatchupTileStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: block;
      width: var(--tile-width, 112px);
      background: var(--mc-fill-parchment);
      outline: none;
      padding: 2px;
    }
    :host([look="won"]),
    :host([look="played"]) {
      border: 2px solid var(--mc-line-ink);
      padding: 0;
    }
    .art {
      position: relative;
      height: calc(var(--tile-width, 112px) * 0.78);
    }
    mc-picture-tile {
      display: block;
      height: 100%;
    }
    /* Pairings not beaten stay in view but stand back, so the wins read first. */
    :host([look="played"]) .art::after,
    :host([look="unplayed"]) .art::after {
      content: "";
      position: absolute;
      inset: 0;
      background: var(--mc-fill-parchment);
      opacity: 0.65;
      pointer-events: none;
    }
    :host([look="played"]) .art::after {
      opacity: 0.25;
    }
    .ribbon {
      height: 20px;
      display: grid;
      place-items: center;
      padding: 0 3px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
    }
    :host([look="won"]) .ribbon {
      background: var(--tile-color);
      color: var(--tile-ink);
    }
    :host([look="played"]) .ribbon {
      border-top: 2px solid var(--mc-line-ink);
    }
    :host([look="unplayed"]) .ribbon {
      opacity: 0.7;
    }
    mc-stats-credited {
      padding: 3px 3px 2px;
      font-size: 11px;
      line-height: 1.2;
      text-align: center;
      min-height: 30px;
    }
  `,
];
