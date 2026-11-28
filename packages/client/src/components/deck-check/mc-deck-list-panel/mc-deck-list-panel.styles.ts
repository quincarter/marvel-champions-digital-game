import { css } from "lit";

export const McDeckListPanelStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    padding: 8px 16px 16px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 44px;
  }
  .heading {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .sort {
    flex: none;
    width: 132px;
    height: 44px;
  }
  .list {
    flex: 1;
    min-height: 0;
    margin-top: 8px;
  }
  .more {
    flex: none;
    padding: 6px 0;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  ::slotted([slot="actions"]) {
    flex: none;
    margin-top: 8px;
  }
`;
