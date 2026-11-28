import { css } from "lit";

export const McAlertBannerStyles = css`
  :host {
    display: block;
    position: relative;
  }
  .box {
    position: absolute;
    inset: 0;
    background: var(--mc-fill-caution);
    outline: 2px solid var(--mc-line-ink-on-hue);
    outline-offset: -1px;
  }
  .text {
    position: absolute;
    color: var(--mc-text-ink-on-hue);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .heading {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1px;
    line-height: 1.2;
  }
  .detail {
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    line-height: 1.25;
  }
`;
