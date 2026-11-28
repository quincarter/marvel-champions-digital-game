import { css } from "lit";

export const McBriefingRoleTilesStyles = css`
  :host {
    display: block;
    min-width: 0;
    container-type: inline-size;
  }
  .tiles {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
  mc-briefing-option-tile {
    min-height: 96px;
  }
  .note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
  }
  .note-heading {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
  }
  .note-line {
    font-size: var(--mc-small-11);
    line-height: 1.45;
    opacity: 0.75;
  }
  @container (min-width: 560px) {
    .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    mc-briefing-option-tile {
      min-height: 98px;
    }
  }
`;
