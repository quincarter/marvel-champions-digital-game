import { css } from "lit";

export const McBriefingRoleBuildStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 0;
    height: 100%;
    container-type: inline-size;
  }
  .intro {
    margin: 0;
    font-size: var(--mc-small-12);
    line-height: 1.4;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex: none;
  }
  mc-chip {
    flex: 1 1 0;
    --chip-size: 15px;
    --chip-height: 44px;
  }
  .list,
  .confirm-scroll {
    flex: 1 1 0;
    min-height: 140px;
  }
  .none {
    opacity: 0.75;
  }
  .decline {
    flex: none;
    height: 52px;
  }
  .bar {
    flex: none;
  }
  /* A narrow call shrinks the chip words so "AGGRESSION 65" is not cut. */
  @container (max-width: 480px) {
    mc-chip {
      --chip-size: 12px;
    }
  }
`;
