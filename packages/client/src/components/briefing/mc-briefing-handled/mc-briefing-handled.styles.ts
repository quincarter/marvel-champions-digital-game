import { css } from "lit";

export const McBriefingHandledStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  mc-section-heading {
    margin-bottom: 12px;
  }
  .list {
    border: 2px solid var(--mc-line-ink);
    padding: 2px 0;
  }
  .list mc-briefing-handled-row + mc-briefing-handled-row {
    border-top: 1px solid color-mix(in srgb, var(--mc-line-ink) 20%, transparent);
  }
  .note,
  .none {
    margin: 0;
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
  }
  .none {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
`;
