import { css } from "lit";

export const McBriefingMissionRowStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 54px;
    padding: 6px 12px 8px 16px;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-size: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
    overflow-wrap: anywhere;
  }
  mc-briefing-inspect-chip {
    flex: none;
    width: 92px;
  }
`;
