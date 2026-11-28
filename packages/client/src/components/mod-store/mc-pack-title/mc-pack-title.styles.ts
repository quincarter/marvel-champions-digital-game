import { css } from "lit";

export const McPackTitleStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    min-height: 108px;
  }
  .name {
    max-width: 100%;
    font-family: var(--mc-font-display);
    font-size: 32px;
    line-height: 0.9;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([size="phone"]) .name {
    font-size: 24px;
  }
  .byline {
    max-width: 100%;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    font-size: var(--mc-small-11, 11px);
    line-height: 1.2;
    opacity: 0.6;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  mc-pack-state-chip {
    margin-top: 4px;
  }
`;
