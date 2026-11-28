import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McAspectPickerStyles = [
  BuilderBaseStyles,
  css`
    :host {
      container-type: inline-size;
    }
    .chips {
      display: grid;
      gap: 6px;
      grid-template-columns: 1fr;
    }
    /* One row of five on a wide column, two-up on a phone's, one per row on the desktop rail. */
    @container (min-width: 300px) {
      .chips {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @container (min-width: 420px) {
      .chips {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }
    mc-tip-chip {
      display: flex;
      width: 100%;
      min-width: 0;
      height: 44px;
    }
  `,
];
