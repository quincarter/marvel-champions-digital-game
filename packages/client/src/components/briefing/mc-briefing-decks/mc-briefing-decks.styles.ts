import { css } from "lit";

export const McBriefingDecksStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  mc-section-heading {
    margin-bottom: 12px;
  }
  .list {
    border: 2px solid var(--mc-line-ink);
  }
  .list mc-briefing-deck-row + mc-briefing-deck-row {
    border-top: 1px solid color-mix(in srgb, var(--mc-line-ink) 20%, transparent);
  }
  .note {
    margin: 12px 0 0;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 0;
    line-height: 1.3;
    opacity: 0.6;
  }
  .list + .note {
    margin-top: 12px;
  }
`;
