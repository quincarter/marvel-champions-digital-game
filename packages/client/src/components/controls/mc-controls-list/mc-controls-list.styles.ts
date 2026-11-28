import { css } from "lit";

export const McControlsListStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  section {
    margin-top: 16px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 6px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--mc-line-paper) 25%, transparent);
  }
  .glyphs {
    flex: 0 0 var(--glyph-column, 120px);
    display: flex;
    align-items: center;
    padding-left: 12px;
    min-height: 24px;
  }
  .words {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .action {
    font-size: var(--mc-small-12, 12px);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .note {
    font-size: var(--mc-small-10, 10px);
    line-height: 1.3;
    opacity: 0.75;
  }
  @media (max-width: 520px) {
    .glyphs {
      flex-basis: 96px;
    }
  }
`;
