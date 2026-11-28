import { css } from "lit";

export const McChatLinesStyles = css`
  :host {
    display: block;
    min-height: 0;
  }
  .list {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-right: 4px;
  }
  .line {
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--mc-line-ink) 35%, transparent);
    font-size: 13px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .line[data-mine] {
    border: 2px solid var(--mc-line-ink);
    font-weight: 700;
  }
  .empty {
    padding: 4px 2px;
    font-size: 13px;
    opacity: 0.75;
  }
`;
