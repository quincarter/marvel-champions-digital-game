import { css } from "lit";

export const McLobbyPeopleStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  .people {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .person {
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--mc-line-ink) 35%, transparent);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .top {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }
  .name {
    min-width: 0;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 15px;
    overflow-wrap: anywhere;
  }
  .role {
    flex: none;
    padding: 2px 6px;
    border: 2px solid var(--mc-line-ink);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1px;
  }
  .device {
    display: flex;
    gap: 6px;
    align-items: center;
    font-family: var(--mc-font-body);
    font-size: 12px;
    opacity: 0.85;
  }
  .icon {
    flex: none;
    width: 14px;
    height: 14px;
  }
  .more {
    font-family: var(--mc-font-body);
    font-size: 12px;
    opacity: 0.8;
  }
  .line {
    font-family: var(--mc-font-body);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
`;
