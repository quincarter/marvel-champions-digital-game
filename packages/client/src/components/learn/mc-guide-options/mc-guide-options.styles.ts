import { css } from "lit";

export const McGuideOptionsStyles = css`
  :host {
    display: block;
    min-width: 0;
    font-family: var(--mc-font-body);
    color: var(--mc-text-ink);
  }
  .subtitle {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.45;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    margin-top: 10px;
  }
  .chips mc-stamp {
    --stamp-pad: 8px;
  }
`;
