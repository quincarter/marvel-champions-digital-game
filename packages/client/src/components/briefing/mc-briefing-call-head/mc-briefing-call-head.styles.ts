import { css } from "lit";

export const McBriefingCallHeadStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  mc-section-heading {
    margin-bottom: 4px;
  }
  .hint {
    margin: 0;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 1.2px;
    line-height: 1.2;
    text-transform: uppercase;
    color: var(--mc-text-red);
  }
`;
