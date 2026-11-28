import { css } from "lit";

export const McLobbySettingsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
    padding: 8px 10px;
  }
  .title {
    margin: 0 0 6px 2px;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 18px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .list {
    flex: 1;
    min-height: 0;
    padding-right: 6px;
  }
  .loading {
    margin: 0;
    font-size: 14px;
  }
  .note {
    margin: 0 0 8px;
    font-size: 12px;
    opacity: 0.75;
  }
  .group + .group {
    margin-top: 4px;
  }
  mc-press-card {
    margin: 4px 0 8px;
  }
  .pick-title {
    font-weight: 800;
    font-size: 14px;
    padding: 8px 10px 0;
  }
  .pick-detail {
    font-size: 12px;
    opacity: 0.8;
    padding: 2px 10px 8px;
  }
  .plain-choice {
    margin: 6px 0 10px;
  }
  .plain-choice .pick-title {
    padding: 0;
    font-size: 15px;
  }
  .plain-choice .pick-detail {
    padding: 2px 0 0;
    opacity: 0.85;
  }
  .mode {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 6px 0 10px;
    padding: 8px;
    border: 2px solid var(--mc-line-ink);
  }
  .pictures {
    flex: none;
    display: flex;
    gap: 4px;
  }
  .pictures mc-card-art {
    width: 44px;
    height: 60px;
  }
  .mode-text {
    flex: 1;
    min-width: 0;
  }
  .mode-title {
    font-family: var(--mc-font-display);
    font-size: 17px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .mode-tagline {
    font-size: 12px;
    opacity: 0.85;
  }
  .mode mc-lobby-button {
    flex: none;
    width: 104px;
  }
  .mod {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 4px 0;
  }
  .mod-name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .mod-state {
    flex: none;
    padding: 2px 8px;
    border: 2px solid var(--mc-line-ink);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .mod mc-lobby-button {
    flex: none;
    width: 110px;
  }
  .text {
    margin: 6px 0;
    font-size: 13px;
    line-height: 1.3;
  }
  .text[data-bold] {
    font-weight: 800;
  }
`;
