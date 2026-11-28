import { css } from "lit";

export const McBriefingSchemeStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  mc-section-heading {
    margin-bottom: 4px;
  }
  .chosen-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px 10px 16px;
  }
  .heading {
    font-size: 22px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cards {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  mc-briefing-pick-card {
    flex: 1 1 0;
  }
  .fixed-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
  }
  .sets {
    font-size: 14px;
    overflow-wrap: anywhere;
  }
`;
