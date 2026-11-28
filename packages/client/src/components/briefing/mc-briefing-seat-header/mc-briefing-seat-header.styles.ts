import { css } from "lit";

export const McBriefingSeatHeaderStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    --portrait: 64px;
  }
  :host([phone]) {
    --portrait: 56px;
  }
  .portrait {
    position: relative;
    flex: none;
    width: var(--portrait);
    height: var(--portrait);
    background: var(--mc-fill-ink);
    border: 3px solid var(--mc-line-ink);
    box-sizing: border-box;
    overflow: hidden;
  }
  mc-picture-tile {
    position: absolute;
    inset: 0;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .name {
    font-size: 26px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([phone]) .name {
    font-size: 22px;
  }
  .chips {
    display: flex;
    gap: 6px;
  }
`;
