import { css } from "lit";

export const McBriefingPoolStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  mc-section-heading {
    margin-bottom: 12px;
  }
  .rows,
  .groups {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .groups {
    gap: 6px;
  }
  :host(:not([phone])) .groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 24px;
    align-items: start;
  }
`;
