import { css } from "lit";

export const McScenarioRandomRowStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding-bottom: 8px;
    min-width: 0;
  }
  .back {
    flex: none;
    width: 130px;
    height: 28px;
  }
  .title {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-family: var(--mc-font-display);
    font-size: 18px;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-left: 2px;
  }
  .random {
    flex: 0 1 150px;
    min-width: 0;
    height: 28px;
  }
  /* Drilled into a box, the buttons sit at the right: the title takes the room between. */
  .title + .random {
    margin-left: auto;
  }
`;
