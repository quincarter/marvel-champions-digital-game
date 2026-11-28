import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McBuilderTabsStyles = [
  BuilderBaseStyles,
  css`
    .hint {
      position: relative;
      height: 14px;
      margin-bottom: 2px;
    }
    mc-tab-rail {
      height: 44px;
    }
  `,
];
