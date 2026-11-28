import { css } from "lit";

export const McLobbyFooterStyles = css`
  :host {
    display: block;
    container-type: inline-size;
    box-sizing: border-box;
    margin: 6px 16px 10px;
    padding: 10px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([hidden]) {
    display: none;
  }
  .foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .words {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--mc-font-body);
    font-weight: 500;
    font-size: 12px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .words[data-bold] {
    font-weight: 800;
  }
  .buttons {
    display: flex;
    gap: 8px;
  }
  .buttons mc-lobby-button {
    flex: 1;
    --mc-lobby-button-height: 52px;
  }
  @container (min-width: 600px) {
    .foot {
      flex-direction: row;
      align-items: center;
      gap: 20px;
    }
    .words {
      font-size: 13px;
    }
    .buttons {
      width: 240px;
    }
  }
`;
