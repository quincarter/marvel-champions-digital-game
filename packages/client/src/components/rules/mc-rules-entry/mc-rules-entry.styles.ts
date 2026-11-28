import { css } from "lit";

export const McRulesEntryStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .card {
    position: relative;
    height: 100%;
    padding: 10px 12px 12px;
    background: var(--mc-fill-card);
    border: 3px solid var(--mc-line-ink);
  }
  .card.status {
    padding-left: 18px;
  }
  .card.status::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    background: var(--stripe);
  }
  .stunned {
    --stripe: var(--mc-fill-stunned);
  }
  .confused {
    --stripe: var(--mc-fill-confused);
  }
  .tough {
    --stripe: var(--mc-fill-tough);
  }
  .term {
    font-family: var(--mc-font-display);
    font-size: 24px;
    line-height: 1.1;
  }
  p {
    margin: 6px 0 0;
    overflow-wrap: anywhere;
  }
  .definition {
    font-size: 14px;
    line-height: 1.4;
    opacity: 0.92;
  }
  .cite {
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.65;
  }
  .note {
    font-size: 14px;
    line-height: 1.4;
    opacity: 0.75;
  }
  .origin {
    font-size: 14px;
    opacity: 0.75;
  }
  .origin.link {
    font-weight: 700;
    opacity: 0.92;
    cursor: pointer;
  }
  .strip {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
  }
  .thumb {
    width: 64px;
    --tile-caption: 26px;
    --tile-name: 10px;
  }
  .more {
    align-self: center;
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
