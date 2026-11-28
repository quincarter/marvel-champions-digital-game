import { css } from "lit";

export const McBriefingActionBarStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    height: 88px;
    padding: 0 16px 0 var(--gutter, 24px);
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .beside {
    flex: 1 1 0;
    min-width: 220px;
    display: flex;
    align-items: center;
  }
  .reason {
    margin: 0;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 1.2px;
    line-height: 1.2;
    text-transform: uppercase;
    color: var(--mc-text-red);
  }
  .watch {
    max-width: 380px;
    min-width: 0;
  }
  .edit {
    flex: none;
    width: 150px;
    height: 62px;
    --mc-button-size: 16px;
  }
  .open {
    flex: 0 1 425px;
    min-width: 240px;
    height: 62px;
    --mc-button-size: 22px;
  }
  :host([phone]) {
    height: 80px;
    padding: 0 12px;
  }
  :host([phone]) .beside {
    display: none;
  }
  :host([phone]) .edit,
  :host([phone]) .open {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    height: 48px;
    --mc-button-size: 15px;
  }
`;
