import { css } from "lit";

export const McBriefingHandledRowStyles = css`
  :host {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 12px 12px;
    min-width: 0;
  }
  .mark {
    flex: none;
    width: 24px;
    text-align: center;
    font-weight: 800;
    font-size: 14px;
    line-height: 1.25;
  }
  .mark.done {
    color: var(--mc-text-heal);
  }
  .mark.later {
    color: var(--mc-text-cost);
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .title {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .detail {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
    overflow-wrap: anywhere;
  }
  .citation {
    flex: none;
    max-width: 90px;
    padding-top: 2px;
    text-align: right;
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.4;
  }
`;
