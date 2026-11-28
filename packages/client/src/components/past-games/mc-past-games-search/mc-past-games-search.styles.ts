import { css } from "lit";

export const McPastGamesSearchStyles = css`
  :host {
    display: block;
    container-type: inline-size;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  mc-button,
  mc-search-field {
    display: block;
    height: 44px;
  }
  mc-button {
    width: min(100%, 340px);
    --mc-button-size: 13px;
  }
  mc-search-field {
    min-width: 0;
    width: 100%;
  }
  /* Room for both: the export button and the field side by side. */
  @container (min-width: 720px) {
    .row {
      flex-direction: row;
      gap: 10px;
    }
    mc-button {
      flex: none;
    }
    mc-search-field {
      flex: 1 1 0;
      width: auto;
    }
  }
`;
