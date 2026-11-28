import { css } from "lit";

export const McBriefingRoleConfirmStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border: 2px solid var(--mc-line-ink);
  }
  .title {
    margin: 0;
    font-size: 28px;
    line-height: 1;
    overflow-wrap: anywhere;
  }
  .box.phone .title {
    font-size: 24px;
  }
  .chips {
    display: flex;
    gap: 6px;
  }
  .summary {
    margin: 0;
    font-weight: 700;
    font-size: var(--mc-small-11);
    line-height: 1.4;
  }
  .relation {
    opacity: 0.75;
    text-transform: none;
    letter-spacing: 0;
  }
  .notes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 4px 0 0;
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
  }
`;
