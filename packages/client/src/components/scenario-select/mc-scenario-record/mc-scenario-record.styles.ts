import { css } from "lit";

export const McScenarioRecordStyles = css`
  :host {
    display: block;
    color: var(--mc-text-paper);
  }
  .label {
    display: block;
    margin-bottom: 4px;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .band {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    border: 2px solid var(--mc-line-ink-on-hue);
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink-on-hue);
  }
  :host([tone="beaten"]) .band {
    background: var(--mc-fill-heal);
    color: var(--mc-text-paper);
  }
  :host([tone="played"]) .band {
    background: var(--mc-fill-red-deep);
    color: var(--mc-text-paper);
  }
  .tally {
    font-weight: 800;
    font-size: 16px;
    line-height: 1.25;
  }
  .subline {
    font-weight: 700;
    font-size: 13px;
  }
`;
