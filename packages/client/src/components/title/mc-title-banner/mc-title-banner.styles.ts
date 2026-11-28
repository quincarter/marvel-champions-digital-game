import { css } from "lit";

/** Caution yellow with an ink-on-hue rim: the text on the left, the action buttons after it and the close button at the right. */
export const McTitleBannerStyles = css`
  :host {
    display: block;
    container-type: inline-size;
    font-family: var(--mc-font-body);
  }
  .box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 12px;
    background: var(--mc-fill-caution);
    outline: 2px solid var(--mc-line-ink-on-hue);
    outline-offset: -1px;
    color: var(--mc-text-ink-on-hue);
  }
  .text {
    flex: 1 1 116px;
    min-width: 0;
  }
  .heading,
  .detail {
    font-weight: 800;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .heading {
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1px;
  }
  .detail {
    font-size: var(--mc-small-11, 11px);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex: 0 1 auto;
  }
  mc-button {
    height: 44px;
    min-width: 104px;
    --mc-button-size: 11px;
  }
  .actions mc-button {
    flex: 1 1 104px;
  }
  mc-button.close {
    min-width: 44px;
    width: 44px;
    flex: none;
  }
  .close {
    order: 2;
    margin-left: auto;
  }
`;
