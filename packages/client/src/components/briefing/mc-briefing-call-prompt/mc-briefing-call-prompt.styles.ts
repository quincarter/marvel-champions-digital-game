import { css } from "lit";

export const McBriefingCallPromptStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .quiet {
    opacity: 0.6;
  }
  .explain {
    margin: 0 0 4px;
    font-weight: 700;
    font-size: var(--mc-small-11);
    line-height: 1.4;
  }
  .rule {
    margin: 0;
    font-size: var(--mc-small-11);
    line-height: 1.45;
  }
`;
