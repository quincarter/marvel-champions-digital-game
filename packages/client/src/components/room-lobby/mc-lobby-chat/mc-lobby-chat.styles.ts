import { css } from "lit";

export const McLobbyChatStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    height: 100%;
    padding: 8px 10px;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
  }
  /* The floating panel: opaque, a heavier border and a comic-panel drop shadow lift it off what is under it. */
  :host([floating]) {
    border-width: 4px;
    box-shadow: 6px 6px 0 var(--mc-fill-ink);
  }
  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 18px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .window {
    flex: none;
    width: 92px;
    --mc-lobby-button-height: 30px;
  }
  .blocked {
    flex: none;
    margin: 0 2px;
    font-size: 12px;
    font-weight: 800;
  }
  .words {
    margin: 4px 2px;
    font-size: 14px;
    opacity: 0.85;
  }
  .popped {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .popped mc-lobby-button {
    width: 160px;
  }
  .lines {
    flex: 1;
    min-height: 40px;
  }
  .compose {
    flex: none;
  }
`;
