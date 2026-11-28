import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McGamesRowStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
    }
    .art {
      flex: none;
      width: var(--thumb-width, 48px);
      height: var(--thumb-height, 66px);
      cursor: pointer;
    }
    mc-card-art {
      width: 100%;
      height: 100%;
    }
    .words {
      flex: 1 1 auto;
      min-width: 0;
      font-size: var(--mc-small-12, 12px);
      line-height: 1.3;
    }
    .name {
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail {
      opacity: 0.75;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }
    mc-button {
      flex: none;
      width: 70px;
      height: 44px;
    }
  `,
];
