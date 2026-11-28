import { css } from "lit";

export const McLobbySeatRowStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  .row {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: var(--mc-fill-paper);
    border: 2px solid var(--mc-line-ink);
  }
  .row[data-mine] {
    border-width: 4px;
    padding: 8px;
  }
  .top {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .art {
    flex: none;
    display: block;
    width: 56px;
    height: 56px;
  }
  .blank {
    box-sizing: border-box;
    display: grid;
    place-items: center;
    border: 2px solid color-mix(in srgb, var(--mc-line-ink) 45%, transparent);
    font-family: var(--mc-font-display);
    font-size: 30px;
    opacity: 0.6;
  }
  .words {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tag {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1px;
    text-transform: uppercase;
    opacity: 0.75;
    overflow-wrap: anywhere;
  }
  .hero {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 15px;
    overflow-wrap: anywhere;
  }
  .hero.none {
    opacity: 0.7;
  }
  .detail {
    font-family: var(--mc-font-body);
    font-size: 12px;
    opacity: 0.85;
    overflow-wrap: anywhere;
  }
  .holder {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
    font-family: var(--mc-font-body);
    font-size: 14px;
  }
  .holder[data-held="false"] {
    opacity: 0.7;
  }
  .dot {
    flex: none;
    box-sizing: border-box;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--mc-line-ink);
  }
  .dot[data-filled] {
    background: var(--mc-fill-ink);
  }
  .who {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .mismatch {
    align-self: flex-start;
    margin-top: 4px;
    padding: 1px 5px;
    border: 2px solid var(--mc-line-ink);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .buttons {
    flex: none;
    width: 104px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .give {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .nobody,
  .mod-text,
  .request-text {
    margin: 0;
    font-family: var(--mc-font-body);
    font-size: 12px;
  }
  .mod-text {
    font-weight: 800;
  }
  .mod,
  .request {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .problem {
    box-sizing: border-box;
    display: flex;
    gap: 8px;
    padding: 8px;
    border: 3px solid var(--mc-line-ink);
  }
  .mark {
    flex: none;
    width: 16px;
    height: 16px;
    display: grid;
    place-items: center;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-family: var(--mc-font-display);
    font-size: 16px;
    line-height: 1;
  }
  .problem-words {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: var(--mc-font-body);
  }
  .problem-heading {
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .problem-title {
    font-weight: 800;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .problem-reason {
    font-size: 12px;
    opacity: 0.9;
    overflow-wrap: anywhere;
  }
`;
