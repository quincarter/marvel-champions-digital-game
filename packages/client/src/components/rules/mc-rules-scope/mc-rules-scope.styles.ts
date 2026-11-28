import { css } from "lit";

export const McRulesScopeStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 36px;
    padding: 0 16px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .caption {
    flex: 1 1 0;
    min-width: 0;
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .toggle {
    flex: none;
    display: flex;
    gap: 4px;
  }
  .option {
    box-sizing: border-box;
    min-width: 70px;
    max-width: 150px;
    height: 26px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid color-mix(in srgb, var(--mc-text-paper) 60%, transparent);
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .option.on {
    background: var(--mc-fill-paper);
    color: var(--mc-text-ink);
    border-color: var(--mc-fill-paper);
  }
  @media (max-width: 480px) {
    .caption {
      display: none;
    }
    .toggle {
      flex: 1 1 0;
    }
    .option {
      flex: 1 1 0;
      max-width: none;
    }
  }
`;
