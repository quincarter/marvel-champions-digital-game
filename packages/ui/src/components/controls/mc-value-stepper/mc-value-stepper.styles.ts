import { css } from "lit";

export const McValueStepperStyles = css`
  :host {
    display: grid;
    grid-template-columns: var(--stepper-arrow, 44px) minmax(0, 1fr) var(--stepper-arrow, 44px);
    gap: var(--stepper-gap, 6px);
    height: var(--stepper-height, 44px);
  }
  mc-button {
    width: 100%;
    height: 100%;
  }
`;
