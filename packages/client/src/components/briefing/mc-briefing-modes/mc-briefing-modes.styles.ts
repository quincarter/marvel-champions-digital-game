import { css } from "lit";

export const McBriefingModesStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  mc-section-heading {
    display: block;
    margin-bottom: 12px;
  }
  .mode + .mode {
    margin-top: 10px;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-height: 22px;
    min-width: 0;
  }
  .name {
    flex: none;
    font-size: 16px;
  }
  .meta {
    min-width: 0;
    font-size: var(--mc-small-11);
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chips {
    display: flex;
    gap: 6px;
    margin-top: 0;
  }
  mc-chip {
    flex: 1 1 0;
    max-width: 120px;
    --chip-size: 18px;
    --chip-height: 44px;
  }
`;
