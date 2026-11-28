import { css } from "lit";

export const McBriefingSeatPickerStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 16px;
    box-sizing: border-box;
    background: color-mix(in srgb, var(--mc-fill-void) 55%, transparent);
  }
  .scrim {
    position: absolute;
    inset: 0;
  }
  .panel {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(420px, 100%);
    box-sizing: border-box;
    padding: 16px;
    background: var(--mc-fill-paper);
    border: 2px solid var(--mc-line-ink);
  }
  .title {
    margin: 0 0 4px;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 22px;
    letter-spacing: 1px;
  }
  mc-button {
    height: 56px;
  }
`;
