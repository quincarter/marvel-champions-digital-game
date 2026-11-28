import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McQuickFiltersStyles = [
  BuilderBaseStyles,
  css`
    :host {
      container-type: inline-size;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .group {
      display: flex;
      gap: 6px;
    }
    .group mc-button {
      flex: 1 1 0;
      height: 44px;
      min-width: 0;
    }
    mc-stepper {
      width: 100%;
    }
    /* A wide column takes every chip on one row with the trait stepper at its end. */
    @container (min-width: 720px) {
      .rows {
        flex-direction: row;
        align-items: stretch;
      }
      .costs {
        flex: 0 0 auto;
      }
      .costs mc-button {
        flex: none;
        width: 36px;
      }
      .icons {
        flex: 1 1 auto;
      }
      mc-stepper {
        flex: 0 0 200px;
        width: 200px;
      }
    }
  `,
];
