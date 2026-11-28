import { css } from "lit";

export const McBriefingSpeechBubbleStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .bubble {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    max-width: 100%;
    box-sizing: border-box;
    padding: 12px 16px;
    background: var(--mc-fill-card);
    border: 3px solid var(--mc-line-ink);
    border-radius: 16px;
    box-shadow: 5px 5px 0 var(--mc-fill-ink);
  }
  .bubble::before,
  .bubble::after {
    content: "";
    position: absolute;
    top: 14px;
    width: 0;
    height: 0;
    border-style: solid;
  }
  .bubble::before {
    left: -15px;
    border-width: 8px 12px 8px 0;
    border-color: transparent var(--mc-line-ink) transparent transparent;
  }
  .bubble::after {
    left: -9px;
    border-width: 8px 12px 8px 0;
    border-color: transparent var(--mc-fill-card) transparent transparent;
    top: 14px;
  }
  .words {
    font-weight: 700;
    font-size: var(--bubble-size, 15px);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
`;
