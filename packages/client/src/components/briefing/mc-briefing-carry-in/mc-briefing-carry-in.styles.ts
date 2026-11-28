import { css } from "lit";

export const McBriefingCarryInStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border: 2px solid var(--mc-line-ink);
    min-width: 0;
  }
  .title {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.25;
  }
  .detail {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  mc-briefing-inspect-chip {
    width: 160px;
    max-width: 100%;
  }
`;
