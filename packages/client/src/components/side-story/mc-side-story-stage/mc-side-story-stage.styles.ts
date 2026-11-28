import { css } from "lit";

export const McSideStoryStageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .reading {
    flex: 1 1 0;
    min-height: 0;
  }
  .where {
    flex: none;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
