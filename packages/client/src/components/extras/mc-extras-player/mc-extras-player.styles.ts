import { css } from "lit";

export const McExtrasPlayerStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .block {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 116px;
    padding: 14px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .note {
    flex: none;
    font-size: 44px;
    line-height: 1;
    padding: 0 4px;
  }
  .block[data-idle] .note {
    opacity: 0.4;
  }
  .words {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .status {
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-caution);
  }
  .title {
    font-family: var(--mc-font-display);
    font-size: 30px;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail {
    font-size: 12px;
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
  }
  .bar {
    flex: 1 1 0;
    height: 6px;
    background: color-mix(in srgb, var(--mc-fill-paper) 22%, transparent);
  }
  .fill {
    height: 100%;
    background: var(--mc-fill-red);
  }
  .clock {
    flex: none;
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.1px;
    opacity: 0.7;
  }
  mc-player-controls {
    max-width: 520px;
  }
  @media (max-width: 600px) {
    .block {
      min-height: 96px;
      padding: 12px;
    }
    .title {
      font-size: 24px;
    }
  }
`;
