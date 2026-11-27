import { css } from "lit";

/**
 * A heading in the display face, tracked, in capitals. Inline (the default) a 2px ink rule fills the rest of the line
 * before the count; `underline` puts the rule under the whole row instead, the count at the right end.
 */
export const McSectionHeaderStyles = css`
  :host {
    display: block;
    pointer-events: none;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 100%;
  }
  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 17px;
    letter-spacing: 1px;
    line-height: 1.2;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--mc-text-ink);
  }
  .rule {
    flex: 1;
    height: 2px;
    background: var(--mc-fill-ink);
  }
  .count {
    flex: none;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 13px;
    opacity: 0.75;
    white-space: nowrap;
    color: var(--mc-text-ink);
  }
  .head.under {
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    padding: 0 0 6px;
    border-bottom: 2px solid var(--mc-line-ink);
  }
  .head.under .label {
    font-size: 24px;
    line-height: 1;
  }
  .head.under.small {
    padding-bottom: 4px;
    border-bottom: 1px solid color-mix(in srgb, var(--mc-line-ink) 50%, transparent);
  }
  .head.bare .label {
    margin-right: auto;
  }
  .head.small .label {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0;
  }
`;
