import { css } from "lit";
import { TitlePressStyles } from "../shared/title-press.styles.js";

/**
 * An ink card (red while a rank-up is announced) with a paper edge: the rank and the points on one line, the rank name,
 * a 6px bar with a Hero Red fill and the caption under it. A compact card drops the name line.
 */
export const McTitleRankStyles = [
  TitlePressStyles,
  css`
    :host {
      color: var(--mc-text-paper);
    }
    .plate {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--mc-fill-ink) 90%, transparent);
      outline: 2px solid var(--mc-line-paper);
      outline-offset: -1px;
    }
    :host([up]) .plate {
      background: var(--mc-fill-red);
    }
    .first {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-weight: 800;
      font-size: var(--mc-small-9, 9px);
      letter-spacing: 1.2px;
      line-height: 1.2;
    }
    .first span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .points {
      flex: none;
    }
    .title {
      font-weight: 800;
      font-size: var(--mc-small-11, 11px);
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar {
      position: relative;
      height: 6px;
      margin-top: 3px;
      outline: 1px solid var(--mc-line-paper);
      outline-offset: -1px;
    }
    .fill {
      position: absolute;
      left: 1px;
      top: 1px;
      bottom: 1px;
      background: var(--mc-fill-red);
    }
    .caption {
      font-weight: 800;
      font-size: var(--mc-small-9, 9px);
      letter-spacing: 1.2px;
      line-height: 1.2;
      opacity: 0.6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
];
