import { css } from "lit";

export const McCivilReviewStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--mc-text-ink);
  }
  mc-press-card {
    display: block;
    font-weight: 800;
    font-size: var(--mc-small-13, 13px);
  }
  .row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: 10px;
  }
  .pins {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  }
  .note {
    margin-top: 4px;
    font-weight: 400;
    font-size: var(--mc-small-11, 11px);
    line-height: 1.35;
    opacity: 0.75;
  }
`;
