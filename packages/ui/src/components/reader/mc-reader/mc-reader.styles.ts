import { css } from "lit";

export const McReaderStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--mc-fill-paper);
  }
  .bar {
    flex: none;
    height: var(--reader-bar, 56px);
  }
  .toolbar {
    flex: none;
  }
  .body {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
  }
  .side {
    flex: none;
    width: var(--reader-side, 300px);
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--mc-fill-parchment);
    border-right: 2px solid var(--mc-line-ink);
  }
  .main {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .text {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  ::slotted([slot="side"]),
  ::slotted([slot="main"]) {
    flex: 1 1 0;
    min-height: 0;
  }
  :host([no-side]) .side {
    display: none;
  }
  :host(:not([wide])) .side {
    width: auto;
    flex: 1 1 0;
    border-right: 0;
  }
  :host(:not([wide])[pane="side"]) .main,
  :host(:not([wide])[pane="main"]) .side {
    display: none;
  }
`;
