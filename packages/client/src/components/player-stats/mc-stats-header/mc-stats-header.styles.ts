import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

/**
 * Two halves either side of the dark mode button at the bar's centre: Back and the title at the left, the figure and the
 * You / Everyone switch at the right, so the switch never lands under the button whatever the width.
 */
export const McStatsHeaderStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: center;
      height: 64px;
      padding: 0 22px;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      container-type: inline-size;
    }
    :host([mode="phone"]) {
      height: 60px;
      padding: 0 12px;
    }
    .left,
    .right {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    :host([mode="phone"]) .left,
    :host([mode="phone"]) .right {
      gap: 8px;
    }
    .right {
      justify-content: flex-end;
      padding-left: 34px;
    }
    .ctl {
      position: relative;
      flex: none;
      width: 104px;
      height: 44px;
    }
    :host([mode="phone"]) .ctl {
      width: 44px;
    }
    .back {
      width: 100%;
      height: 100%;
    }
    .title {
      flex: 0 1 auto;
      min-width: 0;
      font-family: var(--mc-font-display);
      font-size: 28px;
      letter-spacing: 1px;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .played {
      flex: none;
      font-weight: 800;
      font-size: var(--mc-small-10, 10px);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.6;
      white-space: nowrap;
    }
    /* Where the figure would crowd the switch, it gives way. */
    @container (max-width: 1000px) {
      .played {
        display: none;
      }
    }
    mc-stats-source-switch {
      flex: none;
    }
    /* A phone's title sits below the dark mode tab that hangs from the top edge. */
    :host([mode="phone"]) .title {
      align-self: flex-end;
      padding-bottom: 9px;
      font-size: 18px;
    }
    /* Clear of the dark mode tab at the centre: a long title (Spanish) is cut by an ellipsis. */
    :host([mode="phone"]) .left {
      align-items: center;
      padding-right: 28px;
    }
  `,
];
