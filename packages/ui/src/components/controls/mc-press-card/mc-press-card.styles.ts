import { css } from "lit";
import { CardFrameStyles, PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McPressCardStyles = [
  PressBaseStyles,
  CardFrameStyles,
  css`
    :host {
      min-width: 0;
    }
    .frame {
      height: 100%;
      padding: 8px 10px;
    }
  `,
];
