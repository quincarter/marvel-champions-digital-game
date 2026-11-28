import { css } from "lit";

export const McBriefingShieldStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  mc-section-heading {
    margin-bottom: 4px;
  }
  .gap {
    margin-top: 8px;
  }
  .note {
    margin: 0;
    font-size: var(--mc-small-12);
    line-height: 1.45;
    opacity: 0.75;
  }
  .note.strong {
    font-size: var(--mc-small-11);
    opacity: 1;
  }
  .note.caution {
    font-size: var(--mc-small-12);
    opacity: 0.9;
    color: var(--mc-text-caution);
  }
`;
