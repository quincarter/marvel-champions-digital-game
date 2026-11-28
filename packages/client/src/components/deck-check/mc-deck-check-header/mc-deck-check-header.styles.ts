import { css } from "lit";

export const McDeckCheckHeaderStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 64px;
    padding: 0 16px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    container-type: inline-size;
  }
  .back {
    flex: none;
    width: 90px;
    height: 44px;
  }
  .title {
    flex: 1;
    min-width: 0;
    font-family: var(--mc-font-display);
    font-size: 28px;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Clear of the dark mode toggle at the bar's centre when there is room left of it. */
  :host([size="wide"]) .title {
    max-width: max(260px, calc(50cqw - 30px - 122px));
  }
  .meta {
    flex: none;
    max-width: 30%;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* A phone's title sits below the dark mode tab that hangs from the top edge, as Scenario select's does. */
  :host([size="phone"]) .title {
    align-self: flex-end;
    padding-bottom: 8px;
    font-size: 18px;
  }
  :host([size="phone"]) .meta {
    align-self: flex-end;
    padding-bottom: 12px;
  }
  mc-deck-status-badge {
    flex: none;
  }
`;
