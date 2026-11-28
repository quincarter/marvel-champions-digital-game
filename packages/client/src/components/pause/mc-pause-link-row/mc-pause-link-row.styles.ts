import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseLinkRowStyles = [
  PauseBaseStyles,
  css`
    :host {
      color: var(--mc-text-paper);
      min-width: 0;
    }
    .box {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 52px;
      height: 100%;
      padding: 6px 12px;
      background: var(--mc-fill-ink);
      outline: 2.5px solid var(--mc-line-paper);
      outline-offset: -1.25px;
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .title {
      font-size: var(--mc-small-12, 12px);
      font-weight: 800;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .detail {
      font-size: var(--mc-small-10, 10px);
      line-height: 1.3;
      opacity: 0.75;
    }
    .chev {
      flex: none;
      font-size: 18px;
      opacity: 0.75;
    }
    /* A compact cell: its title alone, centred, in the line it shares with the Reference toggle. */
    :host([variant="compact"]) .box {
      justify-content: center;
      min-height: 44px;
      padding: 4px 8px;
      text-align: center;
    }
    :host([variant="compact"]) .title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* A search result: no box, a hairline under it. */
    :host([variant="result"]) .box {
      min-height: 52px;
      padding: 6px 4px 6px 0;
      outline: 0;
      background: none;
      border-bottom: 1px solid color-mix(in srgb, var(--mc-line-paper) 25%, transparent);
    }
    :host([variant="result"]) .top {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    :host([variant="result"]) .title {
      flex: 1;
      min-width: 0;
      font-size: var(--mc-small-12, 14px);
      font-weight: 700;
    }
    .place {
      flex: none;
      max-width: 45%;
      font-size: var(--mc-small-10, 10px);
      opacity: 0.6;
      text-align: right;
    }
    mark {
      background: color-mix(in srgb, var(--mc-fill-caution) 45%, transparent);
      color: inherit;
      text-decoration: underline;
    }
    :host([disabled]) {
      cursor: default;
    }
    :host([disabled]) .box {
      opacity: 0.4;
      outline-style: dashed;
    }
  `,
];
