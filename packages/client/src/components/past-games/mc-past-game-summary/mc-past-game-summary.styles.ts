import { css } from "lit";

export const McPastGameSummaryStyles = css`
  :host {
    display: block;
    min-width: 0;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .result {
    flex: none;
    font-family: var(--mc-font-display);
    font-size: 18px;
    line-height: 1.1;
    letter-spacing: 1px;
  }
  .result[data-tone="won"] {
    color: var(--mc-text-heal);
  }
  .result[data-tone="lost"] {
    color: var(--mc-text-red);
  }
  .reason {
    min-width: 0;
    font-size: 13px;
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The title steps down to two lines at most. */
  .title {
    margin-top: 2px;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .when,
  .fates {
    margin-top: 3px;
    font-size: 13px;
    line-height: 1.3;
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .when {
    white-space: nowrap;
  }
  .fates {
    margin-top: 2px;
    opacity: 0.9;
    white-space: nowrap;
  }
  .campaign {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 800;
    opacity: 0.75;
  }
  /* The details: the result large over its reason, the title and the facts under it. */
  :host([size="detail"]) .head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
  :host([size="detail"]) .result {
    font-size: 28px;
  }
  :host([size="detail"]) .reason {
    margin: 2px 0 4px;
    font-size: 15px;
    opacity: 1;
    white-space: normal;
  }
  :host([size="detail"]) .title {
    font-size: 16px;
    -webkit-line-clamp: unset;
    line-clamp: unset;
    display: block;
    margin-top: 0;
  }
  :host([size="detail"]) .when {
    margin: 4px 0 10px;
    font-size: 14px;
    opacity: 0.8;
    white-space: normal;
  }
  :host([size="detail"]) .when:has(+ .campaign) {
    margin-bottom: 2px;
  }
`;
