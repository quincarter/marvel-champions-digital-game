import { css } from "lit";

export const McBriefingSpeakerStyles = css`
  :host {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    min-width: 0;
    --portrait: 84px;
    --bubble-size: 15px;
  }
  :host([phone]) {
    --portrait: 64px;
    --bubble-size: 14px;
  }
  .portrait {
    position: relative;
    flex: none;
    width: var(--portrait);
    height: var(--portrait);
    border-radius: 50%;
    overflow: hidden;
    background: var(--mc-fill-ink);
    border: 3px solid var(--mc-line-ink);
    box-sizing: border-box;
    display: grid;
    place-items: center;
  }
  mc-picture-tile {
    position: absolute;
    inset: 0;
  }
  .initial {
    font-family: var(--mc-font-display);
    font-size: calc(var(--portrait) * 0.5);
    color: var(--mc-text-paper);
    line-height: 1;
  }
  mc-briefing-speech-bubble {
    flex: 1 1 0;
    min-width: 0;
    margin-left: 4px;
  }
`;
