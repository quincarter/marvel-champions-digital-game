import { css } from "lit";

export const McStepTicksStyles = css`
  :host {
    display: flex;
    gap: 4px;
    width: var(--ticks-width, 140px);
    height: var(--ticks-height, 10px);
  }
  .tick {
    flex: 1;
    background: var(--mc-fill-paper);
    opacity: 0.3;
  }
  .tick[data-on] {
    background: var(--mc-fill-caution);
    opacity: 1;
  }
`;
