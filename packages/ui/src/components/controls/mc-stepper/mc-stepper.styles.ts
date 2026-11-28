import { css } from "lit";

export const McStepperStyles = css`
  :host {
    display: flex;
    gap: 8px;
    min-width: 0;
  }
  .arrow {
    position: relative;
    flex: none;
    width: var(--arrow-width, 78px);
  }
  .arrow mc-chip {
    height: 100%;
  }
  ::slotted(*) {
    height: 100%;
  }
  .name {
    flex: 1 1 0;
    min-width: 0;
  }
  mc-chip {
    --chip-height: 44px;
    --chip-size: 18px;
  }
`;
