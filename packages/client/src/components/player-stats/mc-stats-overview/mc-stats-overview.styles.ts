import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

/**
 * The Overview's tiles in a column grid: two across on a phone, four on a tablet, and on a wide screen with a favorite
 * hero the hero stands tall at the left with the others stacked beside it, three across. A tile that would not fit
 * beside it simply continues below.
 */
export const McStatsOverviewStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: block;
      container-type: inline-size;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: auto;
      gap: 14px;
    }
    .grid > * {
      min-height: 92px;
    }
    .grid > [data-kind="record"] {
      grid-column: span 2;
      min-height: 128px;
    }
    .grid > [data-kind="split"],
    .grid > [data-kind="figures"] {
      grid-column: span 2;
      min-height: 96px;
    }
    .grid > [data-kind="figures"] {
      min-height: 118px;
    }
    .grid > [data-kind="portrait"] {
      min-height: 170px;
    }
    .grid > [data-kind="portrait"][variant="hero"] {
      grid-column: span 2;
      min-height: 132px;
    }
    @container (min-width: 600px) {
      .grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .grid > * {
        min-height: 100px;
      }
      .grid > [data-kind="record"] {
        min-height: 150px;
      }
      .grid > [data-kind="split"],
      .grid > [data-kind="figures"] {
        grid-column: span 1;
        min-height: 150px;
      }
      .grid > [data-kind="portrait"] {
        min-height: 230px;
      }
      .grid > [data-kind="portrait"][variant="hero"] {
        min-height: 150px;
      }
    }
    /* A tablet's four columns are narrow for the figures: they take two. */
    @container (min-width: 600px) and (max-width: 959px) {
      .grid > [data-kind="figures"] {
        grid-column: span 2;
      }
    }
    @container (min-width: 960px) {
      .grid.showcase {
        grid-template-columns: clamp(300px, 30%, 440px) repeat(3, minmax(0, 1fr));
      }
      .grid.showcase > [data-kind="portrait"][variant="hero"] {
        grid-column: 1;
        grid-row: 1 / span 3;
        min-height: 0;
      }
      .grid.showcase > [data-kind="record"] {
        grid-column: span 2;
      }
    }
  `,
];
