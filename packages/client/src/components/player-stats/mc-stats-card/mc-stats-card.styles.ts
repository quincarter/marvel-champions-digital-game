import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsCardStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: block;
      width: var(--card-width, 118px);
      cursor: pointer;
      outline: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    mc-picture-tile {
      display: block;
      aspect-ratio: 63 / 88;
    }
    .value {
      margin-top: 6px;
      font-size: 14px;
      font-weight: 800;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail {
      font-size: 11px;
      line-height: 1.3;
      opacity: 0.75;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
    }
  `,
];
