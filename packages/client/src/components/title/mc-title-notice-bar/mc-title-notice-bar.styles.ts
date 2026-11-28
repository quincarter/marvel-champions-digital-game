import { css } from "lit";
import { TitlePressStyles } from "../shared/title-press.styles.js";

/** An ink strip with a caution rule under it: a caution tag, the message in the display face and the link at the right. */
export const McTitleNoticeBarStyles = [
  TitlePressStyles,
  css`
    :host {
      container-type: inline-size;
      height: var(--notice-height, 40px);
    }
    .bar {
      height: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 12px 2px;
      background: var(--mc-fill-ink);
      border-bottom: 2px solid var(--mc-line-caution);
    }
    .tag {
      flex: none;
      padding: 3px 6px;
      background: var(--mc-fill-caution);
      color: var(--mc-text-ink-on-hue);
      font-weight: 800;
      font-size: var(--mc-small-9, 9px);
      letter-spacing: 1px;
      line-height: 1.2;
    }
    .message {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--mc-text-paper);
      font-family: var(--mc-font-display);
      font-size: 18px;
      letter-spacing: 2px;
      line-height: 1.2;
    }
    .link {
      flex: none;
      color: var(--mc-text-paper);
      font-weight: 800;
      font-size: var(--mc-small-11, 11px);
      line-height: 1.25;
      background: linear-gradient(
          color-mix(in srgb, var(--mc-text-paper) 60%, transparent),
          color-mix(in srgb, var(--mc-text-paper) 60%, transparent)
        )
        bottom / 100% 1px no-repeat;
    }
    .short {
      display: none;
    }
    @container (max-width: 480px) {
      .full {
        display: none;
      }
      .short {
        display: inline;
      }
    }
    mc-glyph-hint {
      position: static;
      transform: none;
      flex: none;
    }
    @container (max-width: 560px) {
      mc-glyph-hint {
        display: none;
      }
    }
  `,
];
