import { css } from "lit";

export const McBriefingModularStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    container-type: inline-size;
  }
  .question,
  .explain {
    margin: 0;
  }
  .explain {
    margin-bottom: 2px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  mc-briefing-option-tile {
    min-height: 78px;
    --name-size: 18px;
  }
  .lines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--mc-small-11);
  }
  .lines p {
    margin: 0;
  }
  @container (min-width: 640px) {
    .tiles {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
`;
