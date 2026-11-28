import { css } from "lit";

export const McBriefingConfirmBarStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    min-width: 0;
    container-type: inline-size;
  }
  mc-button,
  mc-hint-button {
    height: 48px;
  }
  .back,
  .confirm {
    flex: 0 1 180px;
    min-width: 0;
  }
  /* Inspect under Back on a wide bar. */
  .read {
    order: 3;
    flex: 0 0 180px;
    height: 44px;
  }
  /* A narrow bar puts Back, Inspect and Confirm in one row, so the bar is one button tall and can be pinned. */
  @container (max-width: 559px) {
    :host {
      flex-wrap: nowrap;
    }
    .back {
      flex: 0 0 27%;
    }
    .read {
      order: 0;
      flex: 0 0 29%;
      height: 48px;
    }
    .confirm {
      flex: 1 1 0;
    }
  }
`;
