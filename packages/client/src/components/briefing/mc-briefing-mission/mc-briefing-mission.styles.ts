import { css } from "lit";

export const McBriefingMissionStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  mc-section-heading {
    margin-bottom: 4px;
  }
  .note {
    margin: 0;
    font-size: var(--mc-small-12);
    line-height: 1.45;
    opacity: 0.75;
  }
`;
